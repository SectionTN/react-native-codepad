#include "editor.hpp"

#include <algorithm>
#include <chrono>
#include <mutex>
#include <vector>

#include "autoclose.hpp"
#include "movement.hpp"

namespace codepad {
namespace {

int32_t map_offset(int32_t offset, const Change &c) {
  auto start = static_cast<int32_t>(c.start);
  if (offset < start) return offset;
  if (offset == start) return c.removed.empty() ? static_cast<int32_t>(c.new_end()) : offset;
  if (offset >= static_cast<int32_t>(c.end())) return static_cast<int32_t>(offset + c.delta());
  return static_cast<int32_t>(c.new_end());
}

Selection mapped(Selection s, const Change &c) { return {map_offset(s.anchor, c), map_offset(s.head, c)}; }

int64_t pack(Selection s) {
  return static_cast<int64_t>((static_cast<uint64_t>(static_cast<uint32_t>(s.anchor)) << 32) |
                              static_cast<uint32_t>(s.head));
}

Selection unpack(int64_t v) {
  auto bits = static_cast<uint64_t>(v);
  return {static_cast<int32_t>(static_cast<uint32_t>(bits >> 32)), static_cast<int32_t>(static_cast<uint32_t>(bits))};
}

}  // namespace

Editor::Editor(const cp_editor_host *host, std::u16string_view text)
    : doc(text), undo_([this] { return now(); }) {
  if (host != nullptr) host_ = *host;
}

int64_t Editor::now() const {
  if (host_.now_millis != nullptr) return host_.now_millis(host_.ctx);
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

Selection Editor::selection() const { return unpack(selection_.load(std::memory_order_acquire)); }

void Editor::store(Selection s) { selection_.store(pack(s), std::memory_order_release); }

Selection Editor::clamped(Selection s) const {
  auto limit = static_cast<int32_t>(doc.length());
  return {std::clamp(s.anchor, 0, limit), std::clamp(s.head, 0, limit)};
}

void Editor::sync_history() {
  history_.store((undo_.can_undo() ? 1 : 0) | (undo_.can_redo() ? 2 : 0), std::memory_order_release);
}

void Editor::notify(const Change &change, int32_t origin) {
  if (host_.on_change == nullptr) return;
  cp_change c{static_cast<int32_t>(change.start), static_cast<int32_t>(change.removed.size()),
              static_cast<int32_t>(change.inserted.size()), change.revision};
  host_.on_change(host_.ctx, &c, reinterpret_cast<const cp_unit *>(change.removed.data()),
                  reinterpret_cast<const cp_unit *>(change.inserted.data()), origin);
}

void Editor::attach(std::shared_ptr<Engine> engine) {
  engine_ = std::move(engine);
  epoch_ = engine_ ? engine_attach(*engine_, doc.view(), doc.revision()) : 0;
}

void Editor::attach_layout(std::shared_ptr<Layout> layout) {
  layout_ = std::move(layout);
  if (!layout_) return;
  layout_->reset(doc.line_count());
  layout_->set_gaps(decorations.items());
  layout_->clamp();
}

bool Editor::set_decorations(const cp_decoration *items, uint32_t count, int32_t revision) {
  if (!decorations.set(items, count, revision, doc)) return false;
  if (layout_) {
    Layout::Anchor a = layout_->anchor();
    layout_->set_gaps(decorations.items());
    layout_->restore(a);
  }
  return true;
}

void Editor::forward(const Document::Pending &p) {
  if (engine_) engine_edit(*engine_, epoch_, p.change, p.start_point, p.old_end_point, p.new_end_point, doc.view());
}

void Editor::move_selection(Selection next, bool from_edit) {
  if (next != selection()) store(next);
  if (next == reported_) return;
  if (!from_edit) undo_.selection_dirty = true;
  reported_ = next;
  if (host_.on_selection != nullptr) host_.on_selection(host_.ctx, next.anchor, next.head);
}

Change Editor::replace(uint32_t start, uint32_t end, std::u16string_view text, int32_t origin, bool typing,
                       bool caret_after) {
  Selection before = selection();
  Document::Pending p = doc.prepare(start, end, text);
  Selection after = caret_after ? Selection::caret(static_cast<int32_t>(p.change.new_end())) : mapped(before, p.change);
  {
    std::unique_lock lock(doc.mutex());
    doc.commit(p);
    store(after);
  }
  forward(p);
  decorations.edited(p.change, doc);
  if (layout_) layout_->edited(p.change, doc, decorations.items());
  move_selection(after, true);
  if (origin == CP_ORIGIN_INPUT || origin == CP_ORIGIN_API) {
    undo_.record(p.change, before, after, typing);
    sync_history();
  }
  notify(p.change, origin);
  return std::move(p.change);
}

void Editor::replay(uint32_t start, uint32_t end, const std::u16string &text, int32_t origin) {
  Document::Pending p = doc.prepare(start, end, text);
  {
    std::unique_lock lock(doc.mutex());
    doc.commit(p);
    store(mapped(selection(), p.change));
  }
  forward(p);
  decorations.edited(p.change, doc);
  if (layout_) layout_->edited(p.change, doc, decorations.items());
  notify(p.change, origin);
}

void Editor::set_text(std::u16string_view text, bool keep_history) {
  replace(0, doc.length(), text, CP_ORIGIN_API, false, false);
  move_selection({0, 0}, true);
  if (!keep_history) {
    undo_.clear();
    sync_history();
  }
  decorations.reset(doc.revision());
  if (layout_) layout_->set_gaps(decorations.items());
}

void Editor::insert(std::u16string_view text, int32_t origin) {
  Selection s = selection();
  replace(static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), text, origin, false, true);
}

void Editor::type(std::u16string_view text) {
  size_t i = 0;
  while (i < text.size()) {
    size_t n = 1;
    if (text[i] >= 0xD800 && text[i] <= 0xDBFF && i + 1 < text.size() && text[i + 1] >= 0xDC00 && text[i + 1] <= 0xDFFF) {
      n = 2;
    }
    type_unit(text.substr(i, n));
    i += n;
  }
}

void Editor::type_unit(std::u16string_view unit) {
  if (unit == u"\n") {
    newline();
    return;
  }
  Selection s = selection();
  auto lo = static_cast<uint32_t>(s.min());
  auto hi = static_cast<uint32_t>(s.max());
  if (unit.size() == 1) {
    autoclose::Action a = autoclose::action_for(doc, lo, hi, s.head, unit[0], settings);
    switch (a.kind) {
      case autoclose::Kind::kSkipCloser:
        move_selection(Selection::caret(s.head + 1), false);
        return;
      case autoclose::Kind::kInsertPair: {
        const char16_t pair[] = {a.open, a.close};
        replace(lo, hi, std::u16string_view(pair, 2), CP_ORIGIN_INPUT, false, false);
        move_selection(Selection::caret(static_cast<int32_t>(lo) + 1), true);
        undo_.amend_selection_after(selection());
        return;
      }
      case autoclose::Kind::kWrap:
        undo_.begin_group(s);
        replace(hi, hi, std::u16string_view(&a.close, 1), CP_ORIGIN_INPUT, false, false);
        replace(lo, lo, std::u16string_view(&a.open, 1), CP_ORIGIN_INPUT, false, false);
        move_selection({static_cast<int32_t>(lo) + 1, static_cast<int32_t>(hi) + 1}, true);
        undo_.end_group(selection());
        sync_history();
        return;
      case autoclose::Kind::kNone:
        break;
    }
  }
  replace(lo, hi, unit, CP_ORIGIN_INPUT, true, true);
}

void Editor::newline() {
  Selection s = selection();
  auto start = static_cast<uint32_t>(s.min());
  indenter::Newline nl = indenter::newline(doc, start, static_cast<uint32_t>(s.max()), settings);
  replace(start, static_cast<uint32_t>(s.max()), nl.text, CP_ORIGIN_INPUT, false, false);
  move_selection(Selection::caret(static_cast<int32_t>(start + nl.caret_offset)), true);
  undo_.amend_selection_after(selection());
}

void Editor::tab() {
  Selection s = selection();
  if (doc.line_at(static_cast<uint32_t>(s.min())) != doc.line_at(static_cast<uint32_t>(s.max()))) {
    indent();
  } else {
    replace(static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), indenter::unit(settings),
            CP_ORIGIN_INPUT, false, true);
  }
}

void Editor::indent() {
  std::u16string unit = indenter::unit(settings);
  Selection s = selection();
  int32_t first = 0;
  int32_t last = 0;
  indenter::selected_lines(doc, static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), first, last);
  undo_.begin_group(s);
  for (int32_t line = first; line <= last; line++) {
    uint32_t start = doc.line_start(line);
    replace(start, start, unit, CP_ORIGIN_INPUT, false, false);
  }
  undo_.end_group(selection());
  sync_history();
}

void Editor::outdent() {
  Selection s = selection();
  int32_t first = 0;
  int32_t last = 0;
  indenter::selected_lines(doc, static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), first, last);
  undo_.begin_group(s);
  for (int32_t line = first; line <= last; line++) {
    uint32_t start = doc.line_start(line);
    uint32_t n = indenter::outdent_count(doc.text(start, start + doc.line_length(line)), settings);
    if (n > 0) replace(start, start + n, u"", CP_ORIGIN_INPUT, false, false);
  }
  undo_.end_group(selection());
  sync_history();
}

void Editor::backspace() {
  Selection s = selection();
  if (!s.empty()) {
    replace(static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), u"", CP_ORIGIN_INPUT, false, true);
    return;
  }
  auto caret = static_cast<uint32_t>(s.head);
  if (caret == 0) return;
  if (settings.auto_close && autoclose::deletes_pair(doc, caret)) {
    replace(caret - 1, caret + 1, u"", CP_ORIGIN_INPUT, false, true);
    return;
  }
  uint32_t from = movement::prev_grapheme(doc, caret);
  replace(from, caret, u"", CP_ORIGIN_INPUT, caret - from == 1, true);
}

void Editor::erase_forward() {
  Selection s = selection();
  if (!s.empty()) {
    replace(static_cast<uint32_t>(s.min()), static_cast<uint32_t>(s.max()), u"", CP_ORIGIN_INPUT, false, true);
    return;
  }
  auto caret = static_cast<uint32_t>(s.head);
  if (caret >= doc.length()) return;
  replace(caret, movement::next_grapheme(doc, caret), u"", CP_ORIGIN_INPUT, false, true);
}

bool Editor::undo() {
  const UndoManager::Group *group = undo_.pop_undo();
  sync_history();
  if (group == nullptr) return false;
  std::vector<Change> changes = group->changes;
  Selection before = group->before;
  for (auto it = changes.rbegin(); it != changes.rend(); ++it) replay(it->start, it->new_end(), it->removed, CP_ORIGIN_UNDO);
  move_selection(clamped(before), true);
  return true;
}

bool Editor::redo() {
  const UndoManager::Group *group = undo_.pop_redo();
  sync_history();
  if (group == nullptr) return false;
  std::vector<Change> changes = group->changes;
  Selection after = group->after;
  for (const Change &c : changes) replay(c.start, c.end(), c.inserted, CP_ORIGIN_REDO);
  move_selection(clamped(after), true);
  return true;
}

bool Editor::command(int32_t command) {
  switch (command) {
    case CP_CMD_NEWLINE:
      newline();
      return false;
    case CP_CMD_TAB:
      tab();
      return false;
    case CP_CMD_SHIFT_TAB:
    case CP_CMD_OUTDENT:
      outdent();
      return false;
    case CP_CMD_INDENT:
      indent();
      return false;
    case CP_CMD_BACKSPACE:
      backspace();
      return false;
    case CP_CMD_DELETE:
      erase_forward();
      return false;
    case CP_CMD_UNDO:
      return undo();
    case CP_CMD_REDO:
      return redo();
    case CP_CMD_SELECT_ALL:
      move_selection({0, static_cast<int32_t>(doc.length())}, false);
      return false;
    default:
      return false;
  }
}

void Editor::set_selection(int32_t anchor, int32_t head) { move_selection(clamped({anchor, head}), false); }

void Editor::move(int32_t unit, bool forward, bool extend) {
  Selection s = selection();
  bool collapsing = !extend && !s.empty() && unit == movement::kChar;
  auto from = static_cast<uint32_t>(collapsing ? (forward ? s.max() : s.min()) : s.head);
  uint32_t target = from;
  switch (unit) {
    case movement::kChar:
      if (!collapsing) target = forward ? movement::next_grapheme(doc, from) : movement::prev_grapheme(doc, from);
      break;
    case movement::kWord:
      target = forward ? movement::next_word_end(doc, from) : movement::prev_word_start(doc, from);
      break;
    case movement::kLineStart:
      target = doc.line_start(doc.line_at(from));
      break;
    case movement::kLineEnd:
      target = doc.line_end(doc.line_at(from));
      break;
    case movement::kDocStart:
      target = 0;
      break;
    case movement::kDocEnd:
      target = doc.length();
      break;
    default:
      break;
  }
  auto t = static_cast<int32_t>(target);
  move_selection(extend ? Selection{s.anchor, t} : Selection::caret(t), false);
}

void Editor::select_word_at(uint32_t offset) {
  movement::Range r = movement::word_range_at(doc, offset);
  move_selection({static_cast<int32_t>(r.start), static_cast<int32_t>(r.end)}, false);
}

bool Editor::deletes_pair(uint32_t caret) const { return autoclose::deletes_pair(doc, caret); }

void Editor::begin_group() { undo_.begin_group(selection()); }

void Editor::end_group() {
  undo_.end_group(selection());
  sync_history();
}

BracketPair Editor::bracket_match(const cp_snapshot *snapshot, uint32_t caret) const {
  return match_bracket(doc, caret, snapshot);
}

bool Editor::set_search(std::u16string_view text, int32_t flags, std::string &error) {
  std::shared_ptr<const Search> compiled = Search::compile(text, flags, error);
  if (!compiled) {
    search_.reset();
    return false;
  }
  search_ = SearchSession{std::move(compiled), {}, -1};
  return true;
}

void Editor::ensure_matches() {
  if (!search_ || search_->revision == doc.revision()) return;
  bool limited = false;
  search_->matches = search_->search->find_all(doc.text(0, doc.length()), limited);
  search_->revision = doc.revision();
}

const std::vector<int32_t> &Editor::matches() {
  static const std::vector<int32_t> none;
  ensure_matches();
  return search_ ? search_->matches : none;
}

void Editor::select_match(int32_t index) {
  const std::vector<int32_t> &m = search_->matches;
  move_selection({m[static_cast<size_t>(index) * 2], m[static_cast<size_t>(index) * 2 + 1]}, false);
}

bool Editor::find(bool forward, int32_t &index, int32_t &total) {
  ensure_matches();
  if (!search_) return false;
  Selection s = selection();
  int32_t i = forward ? search_->next_index(s.min(), s.max()) : search_->previous_index(s.min());
  if (i < 0) return false;
  select_match(i);
  index = i;
  total = search_->count();
  return true;
}

bool Editor::replace_current(std::u16string_view text) {
  ensure_matches();
  if (!search_) return false;
  Selection s = selection();
  int32_t current = search_->index_of(s.min(), s.max());
  if (current < 0) return false;
  const std::vector<int32_t> &m = search_->matches;
  replace(static_cast<uint32_t>(m[static_cast<size_t>(current) * 2]), static_cast<uint32_t>(m[static_cast<size_t>(current) * 2 + 1]),
          text, CP_ORIGIN_API, false, true);
  ensure_matches();
  if (search_->count() > 0) {
    int32_t i = search_->index_at_or_after(selection().min());
    select_match(i >= search_->count() ? 0 : i);
  }
  return true;
}

int32_t Editor::replace_all(std::u16string_view text) {
  ensure_matches();
  if (!search_ || search_->matches.empty()) return 0;
  std::vector<int32_t> targets = search_->matches;
  begin_group();
  for (size_t i = targets.size(); i >= 2; i -= 2) {
    replace(static_cast<uint32_t>(targets[i - 2]), static_cast<uint32_t>(targets[i - 1]), text, CP_ORIGIN_API, false, false);
  }
  end_group();
  ensure_matches();
  return static_cast<int32_t>(targets.size() / 2);
}

bool Editor::accept_matches(int32_t revision, const int32_t *pairs, uint32_t count) {
  if (!search_ || revision != doc.revision()) return false;
  search_->matches.assign(pairs, pairs + count);
  search_->revision = revision;
  return true;
}

}  // namespace codepad
