#include "document.hpp"

#include <algorithm>
#include <mutex>

namespace codepad {

std::u16string normalize_newlines(std::u16string_view text) {
  std::u16string out;
  out.reserve(text.size());
  for (size_t i = 0; i < text.size(); i++) {
    char16_t u = text[i];
    if (u == u'\r') {
      out.push_back(u'\n');
      if (i + 1 < text.size() && text[i + 1] == u'\n') i++;
    } else {
      out.push_back(u);
    }
  }
  return out;
}

Document::Document(std::u16string_view text) {
  std::u16string normalized = normalize_newlines(text);
  text_ = Text::make(normalized);
  starts_.push_back(0);
  for (size_t i = 0; i < normalized.size(); i++) {
    if (normalized[i] == u'\n') starts_.push_back(static_cast<uint32_t>(i + 1));
  }
  starts_.push_back(static_cast<uint32_t>(normalized.size()) + 1);
}

uint32_t Document::line_start(int32_t line) const {
  return starts_[static_cast<size_t>(std::clamp(line, 0, line_count()))];
}

uint32_t Document::line_length(int32_t line) const {
  if (line < 0 || line >= line_count()) return 0;
  return starts_[line + 1] - starts_[line] - 1;
}

int32_t Document::line_at(uint32_t offset) const {
  uint32_t o = std::min(offset, length());
  auto it = std::upper_bound(starts_.begin(), starts_.end() - 1, o);
  return static_cast<int32_t>(it - starts_.begin()) - 1;
}

char16_t Document::unit_at(uint32_t offset) const {
  return offset < length() ? text_->unit_at(offset) : u'\n';
}

std::u16string Document::text(uint32_t start, uint32_t end) const {
  uint32_t s = std::min(start, length());
  uint32_t e = std::min(end, length());
  if (s > e) std::swap(s, e);
  return text_->string(s, e);
}

cp_point Document::position(uint32_t offset) const {
  uint32_t o = std::min(offset, length());
  int32_t line = line_at(o);
  return cp_point{line, static_cast<int32_t>(o - starts_[line])};
}

uint32_t Document::offset(int32_t line, int32_t column) const {
  int32_t l = std::clamp(line, 0, line_count() - 1);
  int32_t c = std::clamp(column, 0, static_cast<int32_t>(line_length(l)));
  return starts_[l] + static_cast<uint32_t>(c);
}

Document::Pending Document::prepare(uint32_t start, uint32_t end, std::u16string_view inserted) {
  uint32_t s = std::min(start, length());
  uint32_t e = std::min(end, length());
  if (s > e) std::swap(s, e);
  Pending p;
  p.change = Change{s, text_->string(s, e), normalize_newlines(inserted), 0};
  p.text = text_->replace(s, e, p.change.inserted, copied_);
  p.first_line = line_at(s);
  p.last_line = line_at(e);
  const std::u16string &units = p.change.inserted;
  for (size_t i = 0; i < units.size(); i++) {
    if (units[i] == u'\n') p.fresh_starts.push_back(s + static_cast<uint32_t>(i) + 1);
  }
  auto inserted_len = static_cast<uint32_t>(units.size());
  p.start_point = {p.first_line, static_cast<int32_t>(s - starts_[p.first_line])};
  p.old_end_point = {p.last_line, static_cast<int32_t>(e - starts_[p.last_line])};
  if (p.fresh_starts.empty()) {
    p.new_end_point = {p.first_line, p.start_point.column + static_cast<int32_t>(inserted_len)};
  } else {
    p.new_end_point = {p.first_line + static_cast<int32_t>(p.fresh_starts.size()),
                       static_cast<int32_t>(s + inserted_len - p.fresh_starts.back())};
  }
  return p;
}

void Document::commit(Pending &p) {
  int64_t delta = p.change.delta();
  text_ = std::move(p.text);
  auto from = starts_.begin() + p.first_line + 1;
  from = starts_.erase(from, from + (p.last_line - p.first_line));
  from = starts_.insert(from, p.fresh_starts.begin(), p.fresh_starts.end());
  from += static_cast<ptrdiff_t>(p.fresh_starts.size());
  for (auto it = from; it != starts_.end(); ++it) *it = static_cast<uint32_t>(*it + delta);
  p.change.revision = ++revision_;
}

Change Document::replace(uint32_t start, uint32_t end, std::u16string_view inserted) {
  Pending p = prepare(start, end, inserted);
  {
    std::unique_lock lock(mutex_);
    commit(p);
  }
  return std::move(p.change);
}

uint32_t Document::take_copied() {
  uint32_t n = copied_;
  copied_ = 0;
  return n;
}

}  // namespace codepad
