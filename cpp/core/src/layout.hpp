#pragma once

#include <cstdint>
#include <memory>
#include <vector>

#include "codepad.h"
#include "document.hpp"

namespace codepad {

// Rows per line, the gaps under lines, the scroll and the mapping between rows and view units. Main thread only.
// An unmeasured line counts as one row, so every line has a position before layout and only moves once measured.
class Layout {
 public:
  struct Anchor {
    int32_t line;
    int32_t offset;
  };

  // True when the text area width changed, which is when line layouts must be rebuilt.
  bool configure(const cp_layout_config &config);
  const cp_layout_config &config() const { return config_; }
  int32_t widest_line = 0;

  int32_t line_count() const { return line_count_; }
  int32_t total_rows() const { return row_start(line_count_); }
  // Zero for a line outside the map.
  int32_t rows(int32_t line) const;
  int32_t gap_rows(int32_t line) const;
  // The lines with a gap, ascending.
  const std::vector<int32_t> &gap_lines() const { return gap_lines_; }
  int32_t row_start(int32_t line) const;
  int32_t line_at_row(int32_t row) const;
  bool is_gap_row(int32_t row) const;
  // Lines outside the map are ignored. Returns the previous count.
  int32_t set_rows(int32_t line, int32_t count);
  // Replaces every gap from the decorations. Gaps on lines outside the map are ignored.
  void set_gaps(const std::vector<cp_decoration> &items);
  // Lines [first, first + old_count) became new_count fresh lines of one row each, without gaps.
  void replace_lines(int32_t first, int32_t old_count, int32_t new_count);
  // Every line back to one row. Gaps stay.
  void reset_rows();
  // A new document: one row per line and no gaps.
  void reset(int32_t line_count);
  // An edit of the attached document: fresh rows for the lines it touched, the gaps, then a clamped scroll.
  void edited(const Change &change, const Document &doc, const std::vector<cp_decoration> &gaps);

  int32_t scroll_x() const { return scroll_x_; }
  int32_t scroll_y() const { return scroll_y_; }
  int32_t text_area_left() const { return config_.inset_left + config_.gutter_width; }
  int32_t text_area_width() const;
  int32_t viewport_height() const;
  // Zero means no wrapping.
  int32_t wrap_width() const;
  int32_t content_width() const;
  int32_t content_height() const { return total_rows() * config_.row_height; }
  int32_t max_scroll_x() const;
  int32_t max_scroll_y() const;

  // Clamps and applies. True when the position moved.
  bool scroll_to(int32_t x, int32_t y);
  bool clamp() { return scroll_to(scroll_x_, scroll_y_); }
  // View y of the top of row, and the content row under view y, possibly outside [0, total_rows).
  int32_t row_top(int32_t row) const;
  int32_t line_top(int32_t line) const { return row_top(row_start(line)); }
  int32_t row_at(int32_t y) const;
  int32_t first_visible_row() const;
  int32_t first_visible_line() const { return line_at_row(first_visible_row()); }
  int32_t last_visible_line() const;
  // Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the
  // text padding around it.
  bool reveal(int32_t left, int32_t top, int32_t right, int32_t bottom);
  Anchor anchor() const;
  void restore(Anchor anchor);
  // Records a measurement. A line above the viewport shifts the scroll so the visible text stays put.
  void measured(int32_t line, int32_t rows);
  void geometry(cp_geometry &out) const;

 private:
  void ensure(int32_t up_to) const;

  cp_layout_config config_{1, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  int32_t scroll_x_ = 0;
  int32_t scroll_y_ = 0;
  int32_t line_count_ = 1;
  std::vector<int32_t> rows_ = std::vector<int32_t>(16, 1);
  std::vector<int32_t> gaps_ = std::vector<int32_t>(16, 0);
  std::vector<int32_t> gap_lines_;
  // Prefix sums of rows plus gaps, valid below clean_lines_.
  mutable std::vector<int32_t> starts_ = std::vector<int32_t>(17, 0);
  mutable int32_t clean_lines_ = 0;
};

}  // namespace codepad

// The C handle shares the layout with the editor it is attached to.
struct cp_layout {
  std::shared_ptr<codepad::Layout> layout;
};
