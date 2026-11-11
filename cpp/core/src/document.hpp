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

// One replacement: [start, end) of the old text became [start, new_end) of the new one.
struct Change {
  uint32_t start = 0;
  std::u16string removed;
  std::u16string inserted;
  int32_t revision = 0;
  uint32_t end() const { return start + static_cast<uint32_t>(removed.size()); }
  uint32_t new_end() const { return start + static_cast<uint32_t>(inserted.size()); }
  int64_t delta() const { return static_cast<int64_t>(inserted.size()) - static_cast<int64_t>(removed.size()); }
};

// Lines of UTF-16 units joined by \n. The main thread is the only writer and reads without the lock. Other
// threads read under the shared lock, which a writer holds exclusively only around commit.
class Document {
 public:
  explicit Document(std::u16string_view text);

  // An edit built on the main thread outside the lock, applied by commit under the exclusive lock.
  struct Pending {
    Change change;
    SharedText text;
    int32_t first_line = 0;
    int32_t last_line = 0;
    std::vector<uint32_t> fresh_starts;
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
  Pending prepare(uint32_t start, uint32_t end, std::u16string_view inserted);
  // Under the exclusive lock. Sets the change's revision.
  void commit(Pending &pending);
  // prepare, then commit under the exclusive lock.
  Change replace(uint32_t start, uint32_t end, std::u16string_view inserted);

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
