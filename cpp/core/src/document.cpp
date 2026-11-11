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
  text_ = TextView::make(normalized);
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

Document::Edit Document::replace(uint32_t start, uint32_t end, std::u16string_view inserted) {
  uint32_t s = std::min(start, length());
  uint32_t e = std::min(end, length());
  if (s > e) std::swap(s, e);
  Edit edit{s, text_->string(s, e), normalize_newlines(inserted), 0};
  SharedText next = text_->replace(s, e, edit.inserted, copied_);
  int32_t first = line_at(s);
  int32_t last = line_at(e);
  std::vector<uint32_t> fresh;
  for (size_t i = 0; i < edit.inserted.size(); i++) {
    if (edit.inserted[i] == u'\n') fresh.push_back(s + static_cast<uint32_t>(i) + 1);
  }
  int64_t delta = static_cast<int64_t>(edit.inserted.size()) - static_cast<int64_t>(e - s);
  {
    std::unique_lock lock(mutex_);
    text_ = std::move(next);
    auto from = starts_.begin() + first + 1;
    from = starts_.erase(from, from + (last - first));
    from = starts_.insert(from, fresh.begin(), fresh.end()) + static_cast<ptrdiff_t>(fresh.size());
    for (auto it = from; it != starts_.end(); ++it) *it = static_cast<uint32_t>(*it + delta);
    edit.revision = ++revision_;
  }
  return edit;
}

uint32_t Document::take_copied() {
  uint32_t n = copied_;
  copied_ = 0;
  return n;
}

}  // namespace codepad
