// The layout half of the C API in codepad.h.

#include <algorithm>

#include "codepad.h"
#include "editor.hpp"
#include "layout.hpp"

using codepad::Layout;

namespace {

void fill(const Layout &l, cp_geometry *out) {
  if (out != nullptr) l.geometry(*out);
}

}  // namespace

extern "C" {

cp_layout *cp_layout_new(void) { return new cp_layout{std::make_shared<Layout>()}; }

void cp_layout_free(cp_layout *layout) { delete layout; }

void cp_editor_attach_layout(cp_editor *editor, cp_layout *layout) {
  editor->attach_layout(layout != nullptr ? layout->layout : nullptr);
}

int32_t cp_layout_configure(cp_layout *layout, const cp_layout_config *config) {
  return layout->layout->configure(*config) ? 1 : 0;
}

void cp_layout_geometry(const cp_layout *layout, cp_geometry *out) { fill(*layout->layout, out); }

int32_t cp_layout_scroll_to(cp_layout *layout, int32_t x, int32_t y, cp_geometry *out) {
  bool moved = layout->layout->scroll_to(x, y);
  fill(*layout->layout, out);
  return moved ? 1 : 0;
}

int32_t cp_layout_reveal(cp_layout *layout, int32_t left, int32_t top, int32_t right, int32_t bottom,
                         cp_geometry *out) {
  bool moved = layout->layout->reveal(left, top, right, bottom);
  fill(*layout->layout, out);
  return moved ? 1 : 0;
}

uint32_t cp_layout_measure(cp_layout *layout, const int32_t *pairs, uint32_t pair_count, int32_t widest,
                           int32_t first_line, int32_t last_line, cp_geometry *out, int32_t *tops_rows,
                           uint32_t cap) {
  Layout &l = *layout->layout;
  for (uint32_t i = 0; i < pair_count; i++) l.measured(pairs[2 * i], pairs[2 * i + 1]);
  if (widest >= 0 && l.config().wrap == 0) l.widest_line = std::max(l.widest_line, widest);
  fill(l, out);
  if (first_line > last_line) return 0;
  auto lines = static_cast<uint32_t>(last_line - first_line + 1);
  const std::vector<int32_t> &gaps = l.gap_lines();
  uint32_t needed = 2 * lines + 1 + 3 * static_cast<uint32_t>(gaps.size());
  if (tops_rows == nullptr || cap < needed) return needed;
  for (uint32_t i = 0; i <= lines; i++) tops_rows[i] = l.line_top(first_line + static_cast<int32_t>(i));
  for (uint32_t i = 0; i < lines; i++) tops_rows[lines + 1 + i] = l.rows(first_line + static_cast<int32_t>(i));
  int32_t *gap = tops_rows + 2 * lines + 1;
  for (int32_t line : gaps) {
    *gap++ = line;
    *gap++ = l.row_top(l.row_start(line) + l.rows(line));
    *gap++ = l.gap_rows(line);
  }
  return needed;
}

void cp_layout_set_widest(cp_layout *layout, int32_t widest) { layout->layout->widest_line = widest; }

int32_t cp_layout_rows(const cp_layout *layout, int32_t line) { return layout->layout->rows(line); }

int32_t cp_layout_gap_rows(const cp_layout *layout, int32_t line) { return layout->layout->gap_rows(line); }

int32_t cp_layout_row_start(const cp_layout *layout, int32_t line) { return layout->layout->row_start(line); }

int32_t cp_layout_line_at_row(const cp_layout *layout, int32_t row) { return layout->layout->line_at_row(row); }

int32_t cp_layout_is_gap_row(const cp_layout *layout, int32_t row) { return layout->layout->is_gap_row(row) ? 1 : 0; }

int32_t cp_layout_row_top(const cp_layout *layout, int32_t row) { return layout->layout->row_top(row); }

int32_t cp_layout_line_top(const cp_layout *layout, int32_t line) { return layout->layout->line_top(line); }

int32_t cp_layout_row_at(const cp_layout *layout, int32_t y) { return layout->layout->row_at(y); }

void cp_layout_anchor(const cp_layout *layout, int32_t *line, int32_t *offset) {
  Layout::Anchor a = layout->layout->anchor();
  *line = a.line;
  *offset = a.offset;
}

int32_t cp_layout_restore(cp_layout *layout, int32_t line, int32_t offset) {
  int32_t x = layout->layout->scroll_x();
  int32_t y = layout->layout->scroll_y();
  layout->layout->restore({line, offset});
  return x != layout->layout->scroll_x() || y != layout->layout->scroll_y() ? 1 : 0;
}

void cp_layout_reset_rows(cp_layout *layout) { layout->layout->reset_rows(); }

}  // extern "C"
