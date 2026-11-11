#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace codepad {

struct ChunkLimits {
  uint32_t max;
  uint32_t min;
};

ChunkLimits chunk_limits();
// 0, 0 restores the defaults.
void set_chunk_limits(uint32_t max, uint32_t min);

class Text;
using SharedText = std::shared_ptr<const Text>;

// Immutable UTF-16 text in shared chunks. An edit builds a new view that shares every chunk it does not touch,
// so a view never changes under a reader on another thread. No chunk but the last ends on a high surrogate,
// because tree-sitter reads a surrogate split across two reads as two code points.
class Text {
 public:
  static SharedText make(std::u16string_view text);

  uint32_t length() const { return starts_.back(); }
  // The units from offset to the end of its chunk. Empty at or past the end.
  std::u16string_view read(uint32_t offset) const;
  char16_t unit_at(uint32_t offset) const;
  // [start, end) must lie inside the text.
  void copy(uint32_t start, uint32_t end, char16_t *out) const;
  std::u16string string(uint32_t start, uint32_t end) const;

  // [start, end) replaced by inserted. copied grows by the units taken from existing chunks.
  SharedText replace(uint32_t start, uint32_t end, std::u16string_view inserted, uint32_t &copied) const;

  size_t chunk_count() const { return chunks_.size(); }
  uint32_t chunk_end(size_t i) const { return starts_[i + 1]; }

 private:
  Text() = default;
  size_t index(uint32_t offset) const;
  void append(std::u16string_view units, ChunkLimits limits);
  void push(std::shared_ptr<const std::u16string> chunk);

  std::vector<std::shared_ptr<const std::u16string>> chunks_;
  std::vector<uint32_t> starts_{0};
};

}  // namespace codepad
