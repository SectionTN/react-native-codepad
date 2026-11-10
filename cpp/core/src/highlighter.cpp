#include "highlighter.hpp"

#include <algorithm>
#include <unordered_set>

namespace codepad {
namespace {

struct Hit {
  int32_t start;
  int32_t end;
  int32_t style;
  int32_t layer;
  uint32_t pattern;
};

// nvim reads spell and conceal as editor hints. They never carry a color.
bool marker(const std::string &name) {
  return name.rfind('_', 0) == 0 || name == "spell" || name == "nospell" || name == "conceal";
}

// Queries [start, end) of the text. A tree whose positions lag the text by shift is read in its own units.
void collect(const CompiledQuery &query, const TSTree *tree, const TextView &text, int32_t start, int32_t end,
             int32_t layer, int32_t shift, const std::vector<int32_t> &clip, std::vector<Hit> &out) {
  Cursor cursor(ts_query_cursor_new());
  ts_query_cursor_exec(cursor.get(), query.query(), ts_tree_root_node(tree));
  ts_query_cursor_set_byte_range(cursor.get(), bytes(std::max(0, start - shift)), bytes(std::max(0, end - shift)));
  std::unordered_set<uint32_t> rejected;
  std::unordered_set<uint32_t> accepted;
  TSQueryMatch match;
  uint32_t index = 0;
  while (ts_query_cursor_next_capture(cursor.get(), &match, &index)) {
    if (rejected.count(match.id)) continue;
    if (!accepted.count(match.id) && query.has_predicates(match.pattern_index)) {
      if (!query.matches(match, text)) {
        rejected.insert(match.id);
        ts_query_cursor_remove_match(cursor.get(), match.id);
        continue;
      }
      accepted.insert(match.id);
    }
    const TSQueryCapture &capture = match.captures[index];
    const std::string &name = query.capture_name(capture.index);
    if (marker(name)) continue;
    int32_t style = name == "none" ? -1 : query.style_id(capture.index);
    int32_t s = units(ts_node_start_byte(capture.node));
    int32_t e = units(ts_node_end_byte(capture.node));
    if (clip.empty()) {
      out.push_back({s + shift, e + shift, style, layer, match.pattern_index});
      continue;
    }
    // A combined tree only paints its own ranges: a node can span the host text between two of them.
    for (size_t i = 0; i + 1 < clip.size() && clip[i] < e; i += 2) {
      int32_t a = std::max(s, clip[i]);
      int32_t b = std::min(e, clip[i + 1]);
      if (a < b) out.push_back({a + shift, b + shift, style, layer, match.pattern_index});
    }
  }
}

}  // namespace

size_t Lines::at(int32_t offset) const {
  auto it = std::upper_bound(start.begin(), start.end(), offset);
  return it == start.begin() ? 0 : static_cast<size_t>(it - start.begin()) - 1;
}

Lines scan_lines(const std::u16string &text, uint32_t first_line_start, int32_t count) {
  Lines lines;
  auto n = static_cast<int32_t>(text.size());
  int32_t pos = std::min(static_cast<int32_t>(first_line_start), n);
  for (int32_t k = 0; k < count; k++) {
    int32_t stop = pos;
    while (stop < n && text[static_cast<size_t>(stop)] != u'\n') stop++;
    lines.start.push_back(pos);
    lines.length.push_back(stop - pos);
    pos = std::min(stop + 1, n);
  }
  return lines;
}

void highlight(const cp_snapshot &snapshot, const Lines &lines, size_t first, size_t count, std::vector<int32_t> &out) {
  if (count == 0) return;
  int32_t range_start = lines.start[first];
  int32_t range_end = lines.end(first + count - 1);
  const std::u16string &text = *snapshot.text;
  auto length = static_cast<uint32_t>(text.size());
  std::vector<Hit> hits;
  collect(*snapshot.language->highlights, snapshot.tree.get(), TextView{text.data(), length, 0}, range_start, range_end,
          0, 0, {}, hits);
  // Injections are sorted by start: skip trees ending before the range, stop at the first one starting past it.
  for (size_t i = 0; i < snapshot.injected.size(); i++) {
    const InjectedTree &inj = snapshot.injected[i];
    if (inj.end <= range_start) continue;
    if (inj.start >= range_end) break;
    collect(*inj.language->highlights, inj.tree.get(), TextView{text.data(), length, inj.shift}, range_start,
            range_end, static_cast<int32_t>(i) + 1, inj.shift, inj.clip, hits);
  }
  std::stable_sort(hits.begin(), hits.end(), [](const Hit &a, const Hit &b) {
    if (a.layer != b.layer) return a.layer < b.layer;
    if (a.start != b.start) return a.start < b.start;
    return a.pattern < b.pattern;
  });
  std::vector<size_t> offset(count + 1, 0);
  for (size_t k = 0; k < count; k++) offset[k + 1] = offset[k] + static_cast<size_t>(lines.length[first + k]);
  std::vector<int32_t> paint(offset[count], -1);
  for (const Hit &h : hits) {
    int32_t s = std::max(h.start, range_start);
    int32_t e = std::min(h.end, range_end);
    if (s >= e) continue;
    for (size_t k = std::max(lines.at(s), first); k < first + count; k++) {
      int32_t ls = lines.start[k];
      int32_t from = std::max(s, ls) - ls;
      int32_t to = std::min(std::min(e, lines.end(k)) - ls, lines.length[k]);
      int32_t *row = paint.data() + offset[k - first];
      for (int32_t c = from; c < to; c++) row[c] = h.style;
      if (e <= lines.end(k) + 1) break;
    }
  }
  for (size_t k = 0; k < count; k++) {
    size_t count_at = out.size();
    out.push_back(0);
    const int32_t *row = paint.data() + offset[k];
    auto size = static_cast<int32_t>(offset[k + 1] - offset[k]);
    for (int32_t i = 0; i < size;) {
      int32_t style = row[i];
      int32_t j = i + 1;
      while (j < size && row[j] == style) j++;
      if (style >= 0) {
        out.insert(out.end(), {i, j, style});
        out[count_at]++;
      }
      i = j;
    }
  }
}

}  // namespace codepad
