#pragma once

#include <cstdint>
#include <shared_mutex>
#include <string>
#include <string_view>
#include <vector>

#include "codepad.h"
#include "text.hpp"

namespace codepad {

// \r\n and a lone \r become \n.
std::u16string normalize_newlines(std::u16string_view text);

// Lines of UTF-16 units joined by \n. The main thread is the only writer and reads without the lock. Other
// threads read under the shared lock, which replace takes exclusively only around the swap.
class Document {
 public:
  explicit Document(std::u16string_view text);

  struct Edit {
    uint32_t start;
    std::u16string removed;
    std::u16string inserted;
    int32_t revision;
  };

  uint32_t length() const { return text_->length(); }
  int32_t revision() const { return revision_; }
  int32_t line_count() const { return static_cast<int32_t>(starts_.size()) - 1; }
  // Clamped to [0, line_count]. line_count gives length + 1.
  uint32_t line_start(int32_t line) const;
  uint32_t line_length(int32_t line) const;
  uint32_t line_end(int32_t line) const { return line_start(line) + line_length(line); }
  int32_t line_at(uint32_t offset) const;
  // A line end, and any offset at or past the length, reads as \n.
  char16_t unit_at(uint32_t offset) const;
  std::u16string text(uint32_t start, uint32_t end) const;
  cp_point position(uint32_t offset) const;
  uint32_t offset(int32_t line, int32_t column) const;
  const SharedText &view() const { return text_; }

  // start and end are clamped and ordered. inserted is normalized.
  Edit replace(uint32_t start, uint32_t end, std::u16string_view inserted);

  std::shared_mutex &mutex() const { return mutex_; }
  // Units copied out of existing chunks since the last call.
  uint32_t take_copied();

 private:
  SharedText text_;
  // Line starts, then length + 1, so the starts are uniform prefix sums.
  std::vector<uint32_t> starts_;
  int32_t revision_ = 0;
  uint32_t copied_ = 0;
  mutable std::shared_mutex mutex_;
};

}  // namespace codepad
