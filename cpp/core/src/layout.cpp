#include "layout.hpp"

#include <algorithm>
#include <map>

namespace codepad {

bool Layout::configure(const cp_layout_config &config) {
  int32_t before = text_area_width();
  config_ = config;
  // Rows are divided by the row height.
  config_.row_height = std::max(config_.row_height, 1);
  return text_area_width() != before;
}

int32_t Layout::rows(int32_t line) const { return line >= 0 && line < line_count_ ? rows_[line] : 0; }

int32_t Layout::gap_rows(int32_t line) const { return line >= 0 && line < line_count_ ? gaps_[line] : 0; }

int32_t Layout::row_start(int32_t line) const {
  int32_t l = std::clamp(line, 0, line_count_);
  ensure(l);
  return starts_[l];
}

int32_t Layout::line_at_row(int32_t row) const {
  ensure(line_count_);
  int32_t r = std::clamp(row, 0, std::max(starts_[line_count_] - 1, 0));
  int32_t lo = 0;
  int32_t hi = line_count_ - 1;
  while (lo < hi) {
    int32_t mid = static_cast<int32_t>((static_cast<uint32_t>(lo) + static_cast<uint32_t>(hi) + 1) >> 1);
    if (starts_[mid] <= r) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

bool Layout::is_gap_row(int32_t row) const {
  if (row < 0 || row >= total_rows()) return false;
  int32_t line = line_at_row(row);
  return row >= row_start(line) + rows_[line];
}

int32_t Layout::set_rows(int32_t line, int32_t count) {
  if (line < 0 || line >= line_count_) return count;
  int32_t old = rows_[line];
  if (old != count) {
    rows_[line] = count;
    clean_lines_ = std::min(clean_lines_, line + 1);
  }
  return old;
}

void Layout::set_gaps(const std::vector<cp_decoration> &items) {
  std::map<int32_t, int32_t> next;
  for (const cp_decoration &d : items) {
    if (d.kind == CP_DECORATION_GAP) next[d.a] += d.b;
  }
  auto in_map = [this](int32_t line) { return line >= 0 && line < line_count_; };
  int32_t dirty = line_count_;
  for (int32_t line : gap_lines_) {
    auto it = next.find(line);
    if ((it == next.end() ? 0 : it->second) != gaps_[line]) dirty = std::min(dirty, line);
  }
  for (const auto &[line, count] : next) {
    if (in_map(line) && gaps_[line] != count) dirty = std::min(dirty, line);
  }
  if (dirty == line_count_) return;
  for (int32_t line : gap_lines_) gaps_[line] = 0;
  gap_lines_.clear();
  for (const auto &[line, count] : next) {
    if (in_map(line) && count > 0) {
      gaps_[line] = count;
      gap_lines_.push_back(line);
    }
  }
  clean_lines_ = std::min(clean_lines_, dirty + 1);
}

void Layout::replace_lines(int32_t first, int32_t old_count, int32_t new_count) {
  first = std::clamp(first, 0, line_count_);
  old_count = std::clamp(old_count, 0, line_count_ - first);
  new_count = std::max(new_count, 0);
  int32_t tail = line_count_ - first - old_count;
  int32_t next = line_count_ - old_count + new_count;
  if (static_cast<size_t>(next) > rows_.size()) {
    size_t size = std::max(static_cast<size_t>(next), rows_.size() * 2);
    rows_.resize(size, 1);
    gaps_.resize(size, 0);
  }
  if (new_count != old_count && tail > 0) {
    auto from = static_cast<size_t>(first + old_count);
    auto to = static_cast<size_t>(first + new_count);
    auto n = static_cast<size_t>(tail);
    if (to < from) {
      std::copy(rows_.begin() + from, rows_.begin() + from + n, rows_.begin() + to);
      std::copy(gaps_.begin() + from, gaps_.begin() + from + n, gaps_.begin() + to);
    } else {
      std::copy_backward(rows_.begin() + from, rows_.begin() + from + n, rows_.begin() + to + n);
      std::copy_backward(gaps_.begin() + from, gaps_.begin() + from + n, gaps_.begin() + to + n);
    }
  }
  for (int32_t i = first; i < first + new_count; i++) {
    rows_[i] = 1;
    gaps_[i] = 0;
  }
  std::vector<int32_t> shifted;
  for (int32_t line : gap_lines_) {
    if (line < first) {
      shifted.push_back(line);
    } else if (line >= first + old_count) {
      shifted.push_back(line + new_count - old_count);
    }
  }
  gap_lines_ = std::move(shifted);
  line_count_ = next;
  clean_lines_ = std::min(clean_lines_, first + 1);
}

void Layout::reset_rows() {
  std::fill(rows_.begin(), rows_.begin() + line_count_, 1);
  clean_lines_ = 0;
}

void Layout::reset(int32_t line_count) {
  line_count_ = std::max(line_count, 1);
  size_t size = std::max(static_cast<size_t>(line_count_), static_cast<size_t>(16));
  rows_.assign(size, 1);
  gaps_.assign(size, 0);
  gap_lines_.clear();
  clean_lines_ = 0;
}

void Layout::edited(const Change &change, const Document &doc, const std::vector<cp_decoration> &gaps) {
  auto span = [](const std::u16string &text) {
    return 1 + static_cast<int32_t>(std::count(text.begin(), text.end(), u'\n'));
  };
  replace_lines(doc.line_at(change.start), span(change.removed), span(change.inserted));
  set_gaps(gaps);
  clamp();
}

int32_t Layout::text_area_width() const {
  return std::max(0, config_.width - text_area_left() - config_.inset_right);
}

int32_t Layout::viewport_height() const {
  return std::max(0, config_.height - config_.inset_top - config_.inset_bottom);
}

int32_t Layout::wrap_width() const {
  return config_.wrap != 0 ? std::max(1, text_area_width() - 2 * config_.text_padding) : 0;
}

int32_t Layout::content_width() const {
  if (config_.wrap != 0) return text_area_width();
  return std::max(text_area_width(), widest_line + 2 * config_.text_padding);
}

int32_t Layout::max_scroll_x() const { return std::max(0, content_width() - text_area_width()); }

int32_t Layout::max_scroll_y() const { return std::max(0, content_height() - viewport_height()); }

bool Layout::scroll_to(int32_t x, int32_t y) {
  int32_t nx = std::max(0, std::min(x, max_scroll_x()));
  int32_t ny = std::max(0, std::min(y, max_scroll_y()));
  if (nx == scroll_x_ && ny == scroll_y_) return false;
  scroll_x_ = nx;
  scroll_y_ = ny;
  return true;
}

int32_t Layout::row_top(int32_t row) const { return config_.inset_top + row * config_.row_height - scroll_y_; }

int32_t Layout::row_at(int32_t y) const {
  int32_t n = y + scroll_y_ - config_.inset_top;
  int32_t h = config_.row_height;
  return n >= 0 ? n / h : -((-n + h - 1) / h);
}

int32_t Layout::first_visible_row() const { return std::max(0, row_at(config_.inset_top)); }

int32_t Layout::last_visible_line() const {
  return line_at_row(std::max(first_visible_row(), row_at(config_.height - config_.inset_bottom - 1)));
}

bool Layout::reveal(int32_t left, int32_t top, int32_t right, int32_t bottom) {
  int32_t x = scroll_x_;
  int32_t y = scroll_y_;
  int32_t vh = viewport_height();
  int32_t vw = text_area_width();
  int32_t r = right + 2 * config_.text_padding;
  if (bottom - top >= vh || top < y) {
    y = top;
  } else if (bottom > y + vh) {
    y = bottom - vh;
  }
  if (r - left >= vw || left < x) {
    x = left;
  } else if (r > x + vw) {
    x = r - vw;
  }
  return scroll_to(x, y);
}

Layout::Anchor Layout::anchor() const {
  int32_t line = first_visible_line();
  return {line, scroll_y_ - row_start(line) * config_.row_height};
}

void Layout::restore(Anchor anchor) {
  int32_t line = std::clamp(anchor.line, 0, line_count_ - 1);
  int32_t span = (rows(line) + gap_rows(line)) * config_.row_height;
  int32_t within = anchor.offset >= 0 && anchor.offset < span ? anchor.offset : 0;
  scroll_to(scroll_x_, row_start(line) * config_.row_height + within);
}

void Layout::measured(int32_t line, int32_t rows) {
  int32_t first = first_visible_line();
  int32_t old = set_rows(line, rows);
  if (old == rows) return;
  if (line < first) scroll_y_ += (rows - old) * config_.row_height;
  // A visible line that shrinks can lower the end of the content below the scroll.
  scroll_y_ = std::clamp(scroll_y_, 0, max_scroll_y());
}

void Layout::geometry(cp_geometry &out) const {
  out.scroll_x = scroll_x_;
  out.scroll_y = scroll_y_;
  out.max_scroll_x = max_scroll_x();
  out.max_scroll_y = max_scroll_y();
  out.content_width = content_width();
  out.content_height = content_height();
  out.first_line = first_visible_line();
  out.last_line = last_visible_line();
  out.text_area_left = text_area_left();
  out.text_area_width = text_area_width();
  out.viewport_height = viewport_height();
  out.wrap_width = wrap_width();
  out.text_left = text_area_left() + config_.text_padding - scroll_x_;
  out.total_rows = total_rows();
  out.line_count = line_count_;
  out.row_height = config_.row_height;
  out.widest_line = widest_line;
}

void Layout::ensure(int32_t up_to) const {
  if (starts_.size() < static_cast<size_t>(line_count_) + 1) {
    starts_.resize(std::max(static_cast<size_t>(line_count_) + 1, starts_.size() * 2));
  }
  if (clean_lines_ == 0) {
    starts_[0] = 0;
    clean_lines_ = 1;
  }
  while (clean_lines_ <= up_to) {
    int32_t i = clean_lines_;
    starts_[i] = starts_[i - 1] + rows_[i - 1] + gaps_[i - 1];
    clean_lines_++;
  }
}

}  // namespace codepad
