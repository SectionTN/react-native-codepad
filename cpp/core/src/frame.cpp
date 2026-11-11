#include <algorithm>
#include <cstring>
#include <vector>

#include "codepad.h"
#include "editor.hpp"
#include "highlighter.hpp"
#include "spans.hpp"

namespace codepad {
namespace {

// The runs of lines the draw must re-query, flat inclusive [lo, hi, ...]: a line with no entry or one older than the
// applied snapshot, or, with regions given, one a region meets. Without regions every line not at revision.
std::vector<int32_t> dirty_runs(const Lines &lines, int32_t first, int32_t revision, int32_t applied,
                                const int32_t *changed, int32_t changed_len, const int32_t *entries) {
  std::vector<int32_t> out;
  size_t r = 0;
  auto n = static_cast<size_t>(std::max(changed_len, 0));
  for (size_t k = 0; k < lines.start.size(); k++) {
    int32_t entry = entries[k];
    bool dirty;
    if (entry == CP_NO_ENTRY) {
      dirty = true;
    } else if (entry == revision) {
      dirty = false;
    } else if (changed_len < 0 || entry < applied) {
      dirty = true;
    } else {
      int32_t start = lines.start[k];
      while (r + 1 < n && std::max(changed[r], changed[r + 1] - 1) < start) r += 2;
      dirty = r + 1 < n && changed[r] <= lines.end(k);
    }
    if (!dirty) continue;
    int32_t line = first + static_cast<int32_t>(k);
    if (!out.empty() && out.back() == line - 1) {
      out.back() = line;
    } else {
      out.push_back(line);
      out.push_back(line);
    }
  }
  return out;
}

// A line's triples after a change inside it replaced removed units at start with inserted units: a span containing
// the edit, or ending at it with nothing removed, grows; one cut by it keeps its parts; later spans move.
std::vector<int32_t> shift_spans(const int32_t *spans, uint32_t count, int32_t start, int32_t removed,
                                 int32_t inserted) {
  int32_t delta = inserted - removed;
  int32_t end_removed = start + removed;
  std::vector<int32_t> out;
  out.reserve(count + 3);
  auto add = [&](int32_t s, int32_t e, int32_t style) {
    if (s < e) out.insert(out.end(), {s, e, style});
  };
  for (uint32_t i = 0; i + 2 < count; i += 3) {
    int32_t s = spans[i];
    int32_t e = spans[i + 1];
    int32_t style = spans[i + 2];
    if (e < start || (e == start && removed > 0)) {
      add(s, e, style);
    } else if (s >= end_removed && !(s == start && removed == 0 && e == start)) {
      add(s + delta, e + delta, style);
    } else if (s < start && e >= end_removed) {
      add(s, e + delta, style);
    } else if (e == start) {
      add(s, e + delta, style);
    } else {
      if (s < start) add(s, start, style);
      if (e > end_removed) add(end_removed + delta, e + delta, style);
    }
  }
  return out;
}

uint32_t deliver(const std::vector<int32_t> &ints, int32_t *out, uint32_t cap) {
  auto size = static_cast<uint32_t>(ints.size());
  if (out && size <= cap && size > 0) std::memcpy(out, ints.data(), size * sizeof(int32_t));
  return size;
}

}  // namespace
}  // namespace codepad

using codepad::deliver;

extern "C" uint32_t cp_highlight(const cp_snapshot *snapshot, int32_t first_line, int32_t last_line,
                                 uint32_t first_line_start, int32_t *out, uint32_t cap) {
  int32_t count = last_line - first_line + 1;
  if (!snapshot || !snapshot->text || count <= 0) return 0;
  codepad::Lines lines = codepad::scan_lines(*snapshot->text, first_line_start, count);
  std::vector<int32_t> ints;
  codepad::highlight(*snapshot, lines, 0, static_cast<size_t>(count), ints);
  return deliver(ints, out, cap);
}

extern "C" uint32_t cp_editor_frame(const cp_editor *editor, const cp_snapshot *snapshot, int32_t first_line,
                                    int32_t last_line, int32_t applied_revision, int32_t use_changed,
                                    const int32_t *entry_revisions, int32_t *out, uint32_t cap, cp_unit *text_out,
                                    uint32_t text_cap, uint32_t *text_len) {
  const codepad::Document &doc = editor->doc;
  int32_t line_count = doc.line_count();
  int32_t first = std::clamp(first_line, 0, line_count - 1);
  int32_t last = std::clamp(last_line, first, line_count - 1);
  codepad::Selection sel = editor->selection();
  std::vector<int32_t> ints{doc.revision(),
                            static_cast<int32_t>(doc.length()),
                            line_count,
                            sel.anchor,
                            sel.head,
                            doc.line_at(static_cast<uint32_t>(std::max(sel.head, 0))),
                            editor->decorations.version(),
                            editor->history()};
  auto count = static_cast<size_t>(last - first + 1);
  codepad::Lines lines;
  std::vector<int32_t> entries(count);
  for (size_t k = 0; k < count; k++) {
    int32_t line = first + static_cast<int32_t>(k);
    lines.start.push_back(static_cast<int32_t>(doc.line_start(line)));
    lines.length.push_back(static_cast<int32_t>(doc.line_length(line)));
    bool requested = line >= first_line && line <= last_line;
    entries[k] = requested ? entry_revisions[line - first_line] : CP_NO_ENTRY;
  }
  for (int32_t line = first; line <= last + 1; line++) ints.push_back(static_cast<int32_t>(doc.line_start(line)));
  bool consistent = snapshot != nullptr && snapshot->text && snapshot->revision == doc.revision();
  std::vector<int32_t> runs;
  if (consistent) {
    const int32_t *changed = use_changed ? snapshot->changed.data() : nullptr;
    int32_t changed_len = use_changed ? static_cast<int32_t>(snapshot->changed.size()) : -1;
    runs = codepad::dirty_runs(lines, first, snapshot->revision, applied_revision, changed, changed_len,
                               entries.data());
  } else {
    for (size_t k = 0; k < count; k++) {
      if (entries[k] != CP_NO_ENTRY) continue;
      int32_t line = first + static_cast<int32_t>(k);
      if (!runs.empty() && runs.back() == line - 1) {
        runs.back() = line;
      } else {
        runs.push_back(line);
        runs.push_back(line);
      }
    }
  }
  ints.push_back(static_cast<int32_t>(runs.size() / 2));
  ints.insert(ints.end(), runs.begin(), runs.end());
  for (size_t r = 0; r + 1 < runs.size(); r += 2) {
    auto lo = static_cast<size_t>(runs[r] - first);
    auto hi = static_cast<size_t>(runs[r + 1] - first);
    if (consistent) {
      codepad::highlight(*snapshot, lines, lo, hi - lo + 1, ints);
    } else {
      ints.insert(ints.end(), hi - lo + 1, 0);
    }
  }
  // Each run line's text: offset and length in text_out.
  uint32_t units = 0;
  for (size_t r = 0; r + 1 < runs.size(); r += 2) {
    for (int32_t line = runs[r]; line <= runs[r + 1]; line++) {
      auto length = static_cast<uint32_t>(lines.length[static_cast<size_t>(line - first)]);
      ints.push_back(static_cast<int32_t>(units));
      ints.push_back(static_cast<int32_t>(length));
      units += length;
    }
  }
  if (text_len != nullptr) *text_len = units;
  auto size = static_cast<uint32_t>(ints.size());
  if (out == nullptr || size > cap || (units > 0 && (text_out == nullptr || units > text_cap))) return size;
  std::memcpy(out, ints.data(), size * sizeof(int32_t));
  auto *dest = reinterpret_cast<char16_t *>(text_out);
  for (size_t r = 0; r + 1 < runs.size(); r += 2) {
    for (int32_t line = runs[r]; line <= runs[r + 1]; line++) {
      auto k = static_cast<size_t>(line - first);
      auto start = static_cast<uint32_t>(lines.start[k]);
      auto length = static_cast<uint32_t>(lines.length[k]);
      doc.view()->copy(start, start + length, dest);
      dest += length;
    }
  }
  return size;
}

extern "C" uint32_t cp_shift_spans(const int32_t *spans, uint32_t count, int32_t start, int32_t removed,
                                   int32_t inserted, int32_t *out, uint32_t cap) {
  return deliver(codepad::shift_spans(spans, count, start, removed, inserted), out, cap);
}

#ifdef CODEPAD_TEST_HOOKS
extern "C" uint32_t cp_test_dirty_runs(const cp_unit *text, uint32_t length, uint32_t first_line_start,
                                       int32_t first_line, int32_t last_line, int32_t revision, int32_t applied,
                                       const int32_t *changed, int32_t changed_len, const int32_t *entry_revisions,
                                       int32_t *out, uint32_t cap) {
  codepad::SharedText source = codepad::Text::make({reinterpret_cast<const char16_t *>(text), length});
  codepad::Lines lines = codepad::scan_lines(*source, first_line_start, last_line - first_line + 1);
  std::vector<int32_t> runs =
      codepad::dirty_runs(lines, first_line, revision, applied, changed, changed_len, entry_revisions);
  std::vector<int32_t> ints{static_cast<int32_t>(runs.size() / 2)};
  ints.insert(ints.end(), runs.begin(), runs.end());
  return deliver(ints, out, cap);
}

extern "C" uint32_t cp_test_coalesce(const int32_t *pairs, uint32_t count, int32_t *out, uint32_t cap) {
  return deliver(codepad::coalesce(std::vector<int32_t>(pairs, pairs + count)), out, cap);
}
#endif
