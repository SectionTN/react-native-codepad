#include <algorithm>
#include <atomic>
#include <climits>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "codepad.h"
#include "language.hpp"
#include "snapshot.hpp"
#include "spans.hpp"
#include "tree.hpp"

namespace codepad {
namespace {

// A kept injected tree: hulls are unit pairs over its match's captures, extent the content span after offsets.
struct Kept {
  const cp_language *language;
  Tree tree;
  bool combined;
  std::vector<int32_t> hulls;
  int32_t extent[2];
  // The start point, shifted like the extent. The tree's own positions stay where its last applied edit left them.
  int32_t row, col, base, base_row, base_col;
  // Pass-local marks: a region met one of the hulls, the tree was replaced by a reparse.
  bool hit = false;
  bool consumed = false;

  Kept(const cp_language *language, Tree tree, bool combined, std::vector<int32_t> hulls, int32_t start, int32_t end,
       int32_t row, int32_t col)
      : language(language),
        tree(std::move(tree)),
        combined(combined),
        hulls(std::move(hulls)),
        extent{start, end},
        row(row),
        col(col),
        base(start),
        base_row(row),
        base_col(col) {}

  int32_t start() const { return extent[0]; }
  int32_t end() const { return extent[1]; }
  // Units to add to the tree's positions to reach the text.
  int32_t shift() const { return start() - base; }

  // Applies the edits deferred before the tree as one synthetic edit, so its positions match the text again.
  void catch_up() {
    if (start() == base && row == base_row && col == base_col) return;
    cp_point before{base_row, base_col};
    cp_point now{row, col};
    TSInputEdit edit = start() >= base ? input_edit(base, base, start(), before, before, now)
                                       : input_edit(start(), base, start(), now, before, now);
    ts_tree_edit(tree.get(), &edit);
    base = start();
    base_row = row;
    base_col = col;
  }
};

struct Match {
  const cp_language *target;
  bool combined;
  int32_t hull_start;
  int32_t hull_end;
  Range6 ranges6;
  int32_t start;
  int32_t end;
};

struct Counts {
  int32_t fresh = 0;
  int32_t reused = 0;
  int32_t carried = 0;
};

// Pairs after the edit move with it, pairs before it stay, pairs meeting it grow over its new span.
void shift(int32_t *pairs, size_t size, int32_t start, int32_t old_end, int32_t new_end) {
  int32_t delta = new_end - old_end;
  for (size_t i = 0; i + 1 < size; i += 2) {
    int32_t s = pairs[i];
    int32_t e = pairs[i + 1];
    if (s >= old_end) {
      pairs[i] = s + delta;
      pairs[i + 1] = e + delta;
    } else if (e > start) {
      pairs[i] = std::min(s, start);
      pairs[i + 1] = std::max(e + delta, new_end);
    }
  }
}

// Region [a, b) meets hull [c, d) when they intersect or touch, so an edit at a hull end counts.
bool meets(int32_t a, int32_t b, int32_t c, int32_t d) { return a <= d && b >= c; }

bool met_by(const std::vector<int32_t> &hulls, const std::vector<int32_t> &regions) {
  for (size_t i = 0; i + 1 < hulls.size(); i += 2) {
    for (size_t j = 0; j + 1 < regions.size(); j += 2) {
      if (meets(regions[j], regions[j + 1], hulls[i], hulls[i + 1])) return true;
    }
  }
  return false;
}

// The unit pairs of six-int included ranges, empty for a single range.
std::vector<int32_t> clip_of(const std::vector<int32_t> &ranges6) {
  if (ranges6.size() <= 6) return {};
  std::vector<int32_t> out(ranges6.size() / 3);
  for (size_t i = 0; i < out.size(); i++) out[i] = ranges6[(i / 2) * 6 + i % 2];
  return out;
}

}  // namespace

// One engine per editor. Its state belongs to the host's serial worker, except the atomics.
struct Engine : std::enable_shared_from_this<Engine> {
  cp_host host{};
  int64_t budget = 0;
  void (*on_snapshot)(void *, cp_snapshot *) = nullptr;
  std::atomic<int> pending{0};
  std::atomic<int> cancel{0};
  // Set by the first call after a snapshot, cleared when the next one posts: the difference is the parse latency.
  std::atomic<int64_t> pending_since{0};

  // Worker only from here on.
  bool closed = false;
  // Shared with the snapshots and a split parse, copied before an edit while any of them holds it.
  std::shared_ptr<std::u16string> mirror = std::make_shared<std::u16string>();
  Parser parser{ts_parser_new()};
  const cp_language *language = nullptr;
  Tree tree;
  // Injected trees of the last pass, edited along with the text so unchanged ranges reparse for free.
  std::vector<std::unique_ptr<Kept>> kept;
  // The host tree of the last completed pass, edited like the live one. Its diff against the new tree bounds the pass.
  Tree reconciled;
  int32_t reconciled_revision = -1;
  // New spans of the edits since the last completed pass, shifted like hulls: the diff misses a retyped leaf.
  std::vector<int32_t> dirty;
  // The text a split parse keeps reading until it finishes, and the edits made since, replayed onto its tree.
  std::shared_ptr<const std::u16string> frozen;
  std::vector<TSInputEdit> replay;
  int32_t revision = 0;
  std::unordered_map<std::string, const cp_language *> resolved;

  struct Work {
    std::shared_ptr<Engine> engine;
    std::function<void()> fn;
  };
  struct Post {
    std::shared_ptr<Engine> engine;
    cp_snapshot *snapshot;
  };

  static void run_work(void *arg) {
    std::unique_ptr<Work> work(static_cast<Work *>(arg));
    work->fn();
  }

  static void run_post(void *arg) {
    std::unique_ptr<Post> post(static_cast<Post *>(arg));
    post->engine->on_snapshot(post->engine->host.ctx, post->snapshot);
  }

  void schedule(std::function<void()> fn) {
    host.schedule(host.ctx, run_work, new Work{shared_from_this(), std::move(fn)});
  }

  void post(cp_snapshot *snapshot) {
    host.post_main(host.ctx, run_post, new Post{shared_from_this(), snapshot});
  }

  int64_t now() const { return host.now_micros(host.ctx); }

  void mark_pending() {
    int64_t zero = 0;
    pending_since.compare_exchange_strong(zero, now());
    pending.fetch_add(1);
    cancel.store(1);
  }

  void submit(std::function<void()> block) {
    mark_pending();
    schedule([this, block = std::move(block)] {
      if (closed) return;
      if (pending.fetch_sub(1) == 1) cancel.store(0);
      block();
    });
  }

  std::u16string &writable() {
    if (mirror.use_count() > 1) mirror = std::make_shared<std::u16string>(*mirror);
    return *mirror;
  }

  const cp_language *resolve(const std::string &name) {
    auto it = resolved.find(name);
    if (it != resolved.end()) return it->second;
    const cp_language *found = host.resolve ? host.resolve(host.ctx, name.c_str()) : nullptr;
    resolved.emplace(name, found);
    return found;
  }

  void set_language(const cp_language *next) {
    submit([this, next] {
      language = next;
      tree.reset();
      drop_kept();
      drop_frozen();
      resolved.clear();
      ts_parser_reset(parser.get());
      if (language) ts_parser_set_language(parser.get(), language->ts);
      reparse();
    });
  }

  void set_text(std::u16string text, int32_t rev) {
    submit([this, text = std::move(text), rev]() mutable {
      mirror = std::make_shared<std::u16string>(std::move(text));
      revision = rev;
      tree.reset();
      drop_kept();
      drop_frozen();
      ts_parser_reset(parser.get());
      reparse();
    });
  }

  void edit(int32_t start, int32_t removed, std::u16string inserted, int32_t rev, cp_point s, cp_point oe,
            cp_point ne) {
    mark_pending();
    schedule([this, start, removed, inserted = std::move(inserted), rev, s, oe, ne] {
      if (closed) return;
      std::u16string &text = writable();
      auto at = std::min<size_t>(static_cast<size_t>(std::max(start, 0)), text.size());
      text.replace(at, std::min<size_t>(static_cast<size_t>(std::max(removed, 0)), text.size() - at), inserted);
      revision = rev;
      int32_t old_end = start + removed;
      int32_t new_end = start + static_cast<int32_t>(inserted.size());
      TSInputEdit e = input_edit(start, old_end, new_end, s, oe, ne);
      if (frozen) {
        replay.push_back(e);
      } else if (tree) {
        ts_tree_edit(tree.get(), &e);
      }
      if (reconciled) ts_tree_edit(reconciled.get(), &e);
      for (auto &kp : kept) {
        Kept &k = *kp;
        int32_t ks = k.start();
        bool before = old_end <= ks;
        bool after = start > k.end();
        // Only an edit reaching the tree is applied to it: one before it accumulates as a shift, one after is a no-op.
        bool reaches = k.combined || !(before || after);
        if (reaches) {
          k.catch_up();
          ts_tree_edit(k.tree.get(), &e);
        }
        shift(k.hulls.data(), k.hulls.size(), start, old_end, new_end);
        shift(k.extent, 2, start, old_end, new_end);
        if (before) {
          // Tree-sitter's point arithmetic: a start at or past the old end moves with the new end.
          if (k.row > oe.line) {
            k.row += ne.line - oe.line;
          } else {
            k.row = ne.line;
            k.col = ne.column + (k.col - oe.column);
          }
        } else if (start < ks) {
          k.row = s.line;
          k.col = s.column;
        }
        if (reaches) {
          k.base = k.start();
          k.base_row = k.row;
          k.base_col = k.col;
        }
      }
      shift(dirty.data(), dirty.size(), start, old_end, new_end);
      dirty.push_back(start);
      dirty.push_back(new_end);
      dirty = coalesce(dirty);
      if (pending.fetch_sub(1) == 1) {
        cancel.store(0);
        reparse();
      }
    });
  }

  void release(cp_snapshot *snapshot) {
    schedule([snapshot] { delete snapshot; });
  }

  void close() {
    schedule([this] {
      closed = true;
      tree.reset();
      drop_kept();
      drop_frozen();
      parser.reset();
      // The last call the host gets: every snapshot posted before it has been delivered.
      post(nullptr);
    });
  }

  // Queues the next slice of a parse. Work queued after close sees closed and ends.
  void resume() {
    schedule([this] {
      if (!closed) reparse();
    });
  }

  void drop_kept() {
    kept.clear();
    reconciled.reset();
    dirty.clear();
  }

  void drop_frozen() {
    frozen.reset();
    replay.clear();
  }

  // Brings a tree parsed from the frozen text to the live one: the replayed edits, then one parse never cut short.
  Tree catch_up(Tree parsed) {
    if (!frozen) return parsed;
    frozen.reset();
    for (const TSInputEdit &e : replay) ts_tree_edit(parsed.get(), &e);
    replay.clear();
    // Edits cutting into this parse too could keep every snapshot from landing.
    return Tree(parse(parser.get(), parsed.get(), *mirror, nullptr, 0, host));
  }

  // The whole text before the first completed pass, else tree-sitter's diff plus the edits' own spans.
  std::vector<int32_t> regions_for(const TSTree *live, int32_t length) const {
    if (!reconciled) return {0, length};
    std::vector<int32_t> out = changed_ranges(reconciled.get(), live);
    out.insert(out.end(), dirty.begin(), dirty.end());
    for (int32_t &v : out) v = std::clamp(v, 0, length);
    return coalesce(out);
  }

  // Appends the capture hull of every highlight match the regions meet.
  static void collect_hulls(const TSQuery *query, const TSTree *of, const std::vector<int32_t> &regions,
                            int32_t length, std::vector<int32_t> &out) {
    Cursor cursor(ts_query_cursor_new());
    TSNode root = ts_tree_root_node(of);
    for (size_t i = 0; i + 1 < regions.size(); i += 2) {
      match_hulls(cursor.get(), query, root, std::max(0, regions[i] - 1), std::min(length, regions[i + 1] + 1), out);
    }
  }

  // One cursor run over [from, to). Matches are deduped across runs by pattern and content extent.
  void collect_matches(const cp_language *lang, TSQueryCursor *cursor, TSNode root, int32_t from, int32_t to,
                       std::set<std::tuple<uint32_t, int32_t, int32_t>> &seen, std::vector<Match> &out) {
    const CompiledQuery *compiled = lang->injections.get();
    if (!compiled) return;
    int32_t content = compiled->capture_index("injection.content");
    if (content < 0) return;
    int32_t language_index = compiled->capture_index("injection.language");
    TextView text{mirror->data(), static_cast<uint32_t>(mirror->size()), 0};
    ts_query_cursor_exec(cursor, compiled->query(), root);
    ts_query_cursor_set_byte_range(cursor, bytes(from), bytes(to));
    TSQueryMatch match;
    // Whole matches: a capture walk can hand over a match before its later captures, such as a heredoc's language.
    while (ts_query_cursor_next_match(cursor, &match)) {
      uint32_t pattern = match.pattern_index;
      if (!compiled->matches(match, text)) continue;
      const auto &settings = compiled->settings(pattern);
      std::string name;
      auto set = settings.find("injection.language");
      if (set != settings.end()) {
        name = set->second;
      } else {
        bool found = false;
        for (uint16_t i = 0; i < match.capture_count && !found; i++) {
          if (static_cast<int32_t>(match.captures[i].index) != language_index) continue;
          name = utf16_to_utf8(text.node(match.captures[i].node));
          found = true;
        }
        if (!found) continue;
      }
      const cp_language *target = resolve(name);
      if (!target) continue;
      bool combined = settings.count("injection.combined") > 0;
      const auto &offset = compiled->offset(pattern);
      // The hull spans every captured node, so an edit to a language marker touches the tree.
      int32_t hull_start = INT32_MAX;
      int32_t hull_end = 0;
      for (uint16_t i = 0; i < match.capture_count; i++) {
        hull_start = std::min(hull_start, units(ts_node_start_byte(match.captures[i].node)));
        hull_end = std::max(hull_end, units(ts_node_end_byte(match.captures[i].node)));
      }
      for (uint16_t i = 0; i < match.capture_count; i++) {
        if (static_cast<int32_t>(match.captures[i].index) != content) continue;
        TSNode n = match.captures[i].node;
        TSPoint sp = ts_node_start_point(n);
        TSPoint ep = ts_node_end_point(n);
        int32_t start = units(ts_node_start_byte(n));
        int32_t end = units(ts_node_end_byte(n));
        int32_t start_column = units(sp.column);
        int32_t end_column = units(ep.column);
        // Column shifts trim delimiters on their own row, which is all nvim uses. Row shifts are ignored.
        if (offset && static_cast<int32_t>(offset->capture) == content && offset->start_row == 0 &&
            offset->end_row == 0) {
          start += offset->start_column;
          end += offset->end_column;
          start_column += offset->start_column;
          end_column += offset->end_column;
        }
        if (start >= end) continue;
        if (!seen.insert({pattern, start, end}).second) continue;
        out.push_back(Match{target, combined, hull_start, hull_end,
                            {start, end, static_cast<int32_t>(sp.row), start_column, static_cast<int32_t>(ep.row),
                             end_column},
                            start, end});
      }
    }
  }

  // Reconciles the kept trees against what changed since the last completed pass: the query runs over the changed
  // regions only, trees they meet are reparsed, the rest are carried. Empty optional when a new edit cancelled it.
  std::optional<std::vector<InjectedTree>> injections(const cp_language *lang, const TSTree *live,
                                                      const std::vector<int32_t> &regions, int32_t length,
                                                      Counts &counts, std::vector<int32_t> *changed) {
    const CompiledQuery *compiled = lang->injections.get();
    if (!compiled || compiled->capture_index("injection.content") < 0) return std::vector<InjectedTree>{};
    std::vector<Kept *> touched;
    std::vector<Kept *> carried;
    for (auto &kp : kept) {
      kp->hit = met_by(kp->hulls, regions);
      kp->consumed = false;
      (kp->hit || kp->combined ? touched : carried).push_back(kp.get());
    }
    std::vector<Match> matches;
    TSNode root = ts_tree_root_node(live);
    std::set<std::tuple<uint32_t, int32_t, int32_t>> seen;
    {
      Cursor cursor(ts_query_cursor_new());
      for (size_t i = 0; i + 1 < regions.size(); i += 2) {
        // Widened by one unit so a touched hull, however the edit sits against it, intersects the run.
        collect_matches(lang, cursor.get(), root, std::max(0, regions[i] - 1), std::min(length, regions[i + 1] + 1),
                        seen, matches);
      }
      // A combined group is re-derived every pass: each member hull is queried so unchanged members are found again.
      for (Kept *k : touched) {
        if (!k->combined) continue;
        for (size_t j = 0; j + 1 < k->hulls.size(); j += 2) {
          collect_matches(lang, cursor.get(), root, std::max(0, k->hulls[j] - 1),
                          std::min(length, k->hulls[j + 1] + 1), seen, matches);
        }
      }
    }
    // A match found again at a carried tree's language and extent keeps the carried tree.
    std::set<std::tuple<std::string, int32_t, int32_t>> carried_keys;
    for (Kept *k : carried) carried_keys.insert({k->language->id, k->start(), k->end()});
    std::vector<std::pair<std::string, std::vector<Match>>> plain;
    std::vector<std::pair<std::string, std::vector<Match>>> grouped;
    auto group_of = [](std::vector<std::pair<std::string, std::vector<Match>>> &groups,
                       const std::string &id) -> std::vector<Match> & {
      for (auto &g : groups) {
        if (g.first == id) return g.second;
      }
      groups.emplace_back(id, std::vector<Match>{});
      return groups.back().second;
    };
    for (const Match &m : matches) {
      if (m.combined) {
        group_of(grouped, m.target->id).push_back(m);
      } else if (!carried_keys.count({m.target->id, m.start, m.end})) {
        group_of(plain, m.target->id).push_back(m);
      }
    }
    // Touched trees are indexed by their edited ranges. A plain match with equal ranges reparses against one.
    std::map<std::pair<std::string, std::vector<int32_t>>, std::deque<Kept *>> index;
    for (Kept *k : touched) {
      if (!k->combined) k->catch_up();
      // The old tree's matches are the ones that can vanish with this pass.
      if (changed) collect_hulls(k->language->highlights->query(), k->tree.get(), regions, length, *changed);
      if (k->combined) continue;
      index[{k->language->id, included_ranges(k->tree.get())}].push_back(k);
    }
    std::vector<InjectedTree> out;
    std::vector<std::unique_ptr<Kept>> next;
    // Keeps the carried trees, the new ones and, when asked, every touched tree no reparse replaced.
    auto rebuild = [&](bool keep_untouched) {
      std::unordered_set<Kept *> keep(carried.begin(), carried.end());
      if (keep_untouched) {
        for (Kept *k : touched) {
          if (!k->consumed) keep.insert(k);
        }
      }
      std::vector<std::unique_ptr<Kept>> result;
      for (auto &kp : kept) {
        if (keep.count(kp.get())) result.push_back(std::move(kp));
      }
      for (auto &n : next) result.push_back(std::move(n));
      kept = std::move(result);
    };
    // A new edit cancelled a parse: every tree still valid stays kept for the next pass, nothing is published.
    auto cancelled = [&]() -> std::optional<std::vector<InjectedTree>> {
      out.clear();
      rebuild(true);
      return std::nullopt;
    };
    for (auto &[id, group] : plain) {
      const cp_language *target = group[0].target;
      Parser sub(ts_parser_new());
      if (!ts_parser_set_language(sub.get(), target->ts)) continue;
      for (const Match &m : group) {
        std::vector<int32_t> six(m.ranges6.begin(), m.ranges6.end());
        set_included_ranges(sub.get(), six);
        Kept *old = nullptr;
        auto it = index.find({id, six});
        if (it != index.end() && !it->second.empty()) {
          old = it->second.front();
          it->second.pop_front();
        }
        TSTree *parsed = parse(sub.get(), old ? old->tree.get() : nullptr, *mirror, &cancel, 0, host);
        if (!parsed) return cancelled();
        if (changed) collect_hulls(target->highlights->query(), parsed, regions, length, *changed);
        if (old) {
          old->tree.reset();
          old->consumed = true;
          counts.reused++;
        } else {
          counts.fresh++;
        }
        next.push_back(std::make_unique<Kept>(target, Tree(ts_tree_copy(parsed)), false,
                                              std::vector<int32_t>{m.hull_start, m.hull_end}, m.start, m.end,
                                              m.ranges6[2], m.ranges6[3]));
        out.push_back(InjectedTree{target, Tree(parsed), m.start, m.end, 0, {}});
      }
    }
    // A combined group is one tree over every member range. It reparses against its old tree only when the ranges match.
    for (auto &[id, group] : grouped) {
      const cp_language *target = group[0].target;
      std::stable_sort(group.begin(), group.end(), [](const Match &a, const Match &b) { return a.start < b.start; });
      std::vector<int32_t> flat;
      std::vector<int32_t> hulls;
      for (const Match &m : group) {
        flat.insert(flat.end(), m.ranges6.begin(), m.ranges6.end());
        hulls.push_back(m.hull_start);
        hulls.push_back(m.hull_end);
      }
      Kept *old = nullptr;
      for (Kept *k : touched) {
        if (k->combined && !k->consumed && k->language->id == id) {
          old = k;
          break;
        }
      }
      bool same = old && included_ranges(old->tree.get()) == flat;
      if (old && same && !old->hit) {
        // No member met a region and the ranges are unchanged: the group is carried like a plain tree.
        touched.erase(std::find(touched.begin(), touched.end(), old));
        carried.push_back(old);
        continue;
      }
      Parser sub(ts_parser_new());
      if (!ts_parser_set_language(sub.get(), target->ts)) continue;
      set_included_ranges(sub.get(), flat);
      TSTree *parsed = parse(sub.get(), same ? old->tree.get() : nullptr, *mirror, &cancel, 0, host);
      if (!parsed) return cancelled();
      if (changed) collect_hulls(target->highlights->query(), parsed, regions, length, *changed);
      if (old) {
        old->tree.reset();
        old->consumed = true;
      }
      if (same) {
        counts.reused++;
      } else {
        counts.fresh++;
      }
      int32_t start = group.front().start;
      int32_t end = group.back().end;
      next.push_back(std::make_unique<Kept>(target, Tree(ts_tree_copy(parsed)), true, hulls, start, end,
                                            group.front().ranges6[2], group.front().ranges6[3]));
      out.push_back(InjectedTree{target, Tree(parsed), start, end, 0, clip_of(flat)});
    }
    counts.carried = static_cast<int32_t>(carried.size());
    std::vector<InjectedTree> result;
    result.reserve(carried.size() + out.size());
    for (Kept *k : carried) {
      std::vector<int32_t> clip = k->combined ? clip_of(included_ranges(k->tree.get())) : std::vector<int32_t>{};
      result.push_back(InjectedTree{k->language, copy(k->tree), k->start(), k->end(), k->shift(), std::move(clip)});
    }
    for (auto &i : out) result.push_back(std::move(i));
    std::stable_sort(result.begin(), result.end(),
                     [](const InjectedTree &a, const InjectedTree &b) { return a.start < b.start; });
    rebuild(false);
    std::stable_sort(kept.begin(), kept.end(), [](const auto &a, const auto &b) { return a->start() < b->start(); });
    return result;
  }

  void reparse() {
    const cp_language *lang = language;
    if (!lang) return;
    if (pending.load() > 0) return;
    TSTree *parsed = parse(parser.get(), tree.get(), frozen ? *frozen : *mirror, &cancel, budget, host);
    if (!parsed) {
      // The parse resumes on the text it started with, whatever the edits that cut in do to the live one.
      if (!frozen) frozen = mirror;
      if (!cancel.load()) resume();
      return;
    }
    tree = catch_up(Tree(parsed));
    const TSTree *live = tree.get();
    Counts counts;
    int32_t based_on = reconciled ? reconciled_revision : -1;
    auto length = static_cast<int32_t>(mirror->size());
    std::vector<int32_t> regions = regions_for(live, length);
    // The regions plus the capture hulls of every highlight match they meet, old tree and new: the painter's dirty lines.
    std::optional<std::vector<int32_t>> changed;
    if (based_on >= 0) {
      changed.emplace(regions);
      collect_hulls(lang->highlights->query(), reconciled.get(), regions, length, *changed);
      collect_hulls(lang->highlights->query(), live, regions, length, *changed);
    }
    auto injected = injections(lang, live, regions, length, counts, changed ? &*changed : nullptr);
    if (!injected) {
      if (!cancel.load()) resume();
      return;
    }
    reconciled = Tree(ts_tree_copy(live));
    reconciled_revision = revision;
    dirty.clear();
    auto *snapshot = new cp_snapshot();
    snapshot->revision = revision;
    snapshot->language = lang;
    snapshot->tree = Tree(ts_tree_copy(live));
    snapshot->injected = std::move(*injected);
    snapshot->text = mirror;
    snapshot->based_on = based_on;
    if (changed) {
      for (int32_t &v : *changed) v = std::clamp(v, 0, length);
      snapshot->changed = coalesce(*changed);
    }
    int64_t since = pending_since.exchange(0);
    snapshot->latency_ms = since == 0 ? 0 : static_cast<int32_t>((now() - since) / 1000);
    snapshot->fresh = counts.fresh;
    snapshot->reused = counts.reused;
    snapshot->carried = counts.carried;
    post(snapshot);
  }
};

}  // namespace codepad

struct cp_engine {
  std::shared_ptr<codepad::Engine> engine;
};

extern "C" cp_engine *cp_engine_new(const cp_host *host, int64_t budget_micros,
                                    void (*on_snapshot)(void *ctx, cp_snapshot *snapshot)) {
  auto engine = std::make_shared<codepad::Engine>();
  engine->host = *host;
  engine->budget = budget_micros;
  engine->on_snapshot = on_snapshot;
  return new cp_engine{std::move(engine)};
}

extern "C" void cp_engine_set_language(cp_engine *engine, const cp_language *language) {
  engine->engine->set_language(language);
}

extern "C" void cp_engine_set_text(cp_engine *engine, const cp_unit *text, uint32_t length, int32_t revision) {
  engine->engine->set_text(std::u16string(reinterpret_cast<const char16_t *>(text), length), revision);
}

extern "C" void cp_engine_edit(cp_engine *engine, uint32_t start, uint32_t removed, const cp_unit *inserted,
                               uint32_t inserted_len, int32_t revision, cp_point start_point, cp_point old_end,
                               cp_point new_end) {
  engine->engine->edit(static_cast<int32_t>(start), static_cast<int32_t>(removed),
                       std::u16string(reinterpret_cast<const char16_t *>(inserted), inserted_len), revision,
                       start_point, old_end, new_end);
}

extern "C" void cp_engine_release(cp_engine *engine, cp_snapshot *snapshot) {
  if (!snapshot) return;
  if (engine) {
    engine->engine->release(snapshot);
  } else {
    delete snapshot;
  }
}

extern "C" void cp_engine_close(cp_engine *engine) {
  engine->engine->close();
  delete engine;
}

extern "C" void cp_snapshot_info_get(const cp_snapshot *snapshot, cp_snapshot_info *out) {
  out->revision = snapshot->revision;
  out->based_on = snapshot->based_on;
  out->latency_ms = snapshot->latency_ms;
  out->fresh = snapshot->fresh;
  out->reused = snapshot->reused;
  out->carried = snapshot->carried;
  out->changed_len = static_cast<uint32_t>(snapshot->changed.size());
}

extern "C" const int32_t *cp_snapshot_changed(const cp_snapshot *snapshot) { return snapshot->changed.data(); }

extern "C" const cp_language *cp_snapshot_language(const cp_snapshot *snapshot) { return snapshot->language; }

extern "C" uint32_t cp_snapshot_length(const cp_snapshot *snapshot) {
  return snapshot->text ? static_cast<uint32_t>(snapshot->text->size()) : 0;
}

extern "C" uint32_t cp_snapshot_injected_count(const cp_snapshot *snapshot) {
  return static_cast<uint32_t>(snapshot->injected.size());
}

extern "C" void cp_snapshot_injected_get(const cp_snapshot *snapshot, uint32_t index, cp_injected_info *out) {
  const codepad::InjectedTree &inj = snapshot->injected[index];
  uint32_t ranges = 0;
  free(ts_tree_included_ranges(inj.tree.get(), &ranges));
  *out = cp_injected_info{inj.language, inj.start, inj.end, inj.shift, ranges};
}
