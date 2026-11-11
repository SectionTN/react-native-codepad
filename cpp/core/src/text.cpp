#include "text.hpp"

#include <algorithm>
#include <atomic>
#include <cstdlib>

namespace codepad {
namespace {

std::atomic<uint32_t> override_max{0};
std::atomic<uint32_t> override_min{0};

bool high(char16_t u) { return u >= 0xD800 && u <= 0xDBFF; }

ChunkLimits defaults() {
#ifdef CODEPAD_TEST_HOOKS
  static const bool tiny = [] {
    const char *value = std::getenv("CODEPAD_TINY_CHUNKS");
    return value != nullptr && value[0] == '1';
  }();
  if (tiny) return {4, 2};
#endif
  return {16384, 1024};
}

}  // namespace

ChunkLimits chunk_limits() {
  uint32_t max = override_max.load(std::memory_order_relaxed);
  if (max != 0) return {max, override_min.load(std::memory_order_relaxed)};
  return defaults();
}

void set_chunk_limits(uint32_t max, uint32_t min) {
  override_min.store(min, std::memory_order_relaxed);
  override_max.store(max, std::memory_order_relaxed);
}

SharedText Text::make(std::u16string_view text) {
  std::shared_ptr<Text> view(new Text());
  view->append(text, chunk_limits());
  return view;
}

size_t Text::index(uint32_t offset) const {
  auto it = std::upper_bound(starts_.begin(), starts_.end() - 1, offset);
  size_t i = static_cast<size_t>(it - starts_.begin()) - 1;
  return std::min(i, chunks_.size() - 1);
}

std::u16string_view Text::read(uint32_t offset) const {
  if (offset >= length()) return {};
  size_t i = index(offset);
  return std::u16string_view(*chunks_[i]).substr(offset - starts_[i]);
}

char16_t Text::unit_at(uint32_t offset) const {
  size_t i = index(offset);
  return (*chunks_[i])[offset - starts_[i]];
}

void Text::copy(uint32_t start, uint32_t end, char16_t *out) const {
  if (start >= end) return;
  size_t i = index(start);
  while (start < end) {
    const std::u16string &chunk = *chunks_[i];
    uint32_t from = start - starts_[i];
    uint32_t n = std::min<uint32_t>(end - start, static_cast<uint32_t>(chunk.size()) - from);
    std::copy_n(chunk.data() + from, n, out);
    out += n;
    start += n;
    i++;
  }
}

std::u16string Text::string(uint32_t start, uint32_t end) const {
  std::u16string out(end - start, u'\0');
  copy(start, end, out.data());
  return out;
}

void Text::push(std::shared_ptr<const std::u16string> chunk) {
  starts_.push_back(starts_.back() + static_cast<uint32_t>(chunk->size()));
  chunks_.push_back(std::move(chunk));
}

void Text::append(std::u16string_view units, ChunkLimits limits) {
  size_t target = std::max<uint32_t>(1, limits.max / 2);
  size_t from = 0;
  while (units.size() - from > limits.max) {
    size_t cut = from + target;
    if (high(units[cut - 1])) cut = cut - 1 > from ? cut - 1 : cut + 1;
    push(std::make_shared<const std::u16string>(units.substr(from, cut - from)));
    from = cut;
  }
  if (from < units.size()) push(std::make_shared<const std::u16string>(units.substr(from)));
}

SharedText Text::replace(uint32_t start, uint32_t end, std::u16string_view inserted, uint32_t &copied) const {
  ChunkLimits limits = chunk_limits();
  std::shared_ptr<Text> next(new Text());
  if (chunks_.empty()) {
    next->append(inserted, limits);
    return next;
  }
  size_t a = index(start);
  size_t b = end > start ? index(end - 1) : a;
  std::u16string_view first(*chunks_[a]);
  std::u16string_view last(*chunks_[b]);
  std::u16string_view prefix = first.substr(0, start - starts_[a]);
  std::u16string_view suffix = last.substr(end - starts_[b]);
  std::u16string middle;
  middle.reserve(prefix.size() + inserted.size() + suffix.size());
  middle.append(prefix).append(inserted).append(suffix);
  copied += static_cast<uint32_t>(prefix.size() + suffix.size());
  while (!middle.empty() && high(middle.back()) && b + 1 < chunks_.size()) {
    b++;
    middle.append(*chunks_[b]);
    copied += static_cast<uint32_t>(chunks_[b]->size());
  }
  if (middle.size() < limits.min) {
    if (b + 1 < chunks_.size() && middle.size() + chunks_[b + 1]->size() <= limits.max) {
      b++;
      middle.append(*chunks_[b]);
      copied += static_cast<uint32_t>(chunks_[b]->size());
    } else if (a > 0 && middle.size() + chunks_[a - 1]->size() <= limits.max) {
      a--;
      middle.insert(0, *chunks_[a]);
      copied += static_cast<uint32_t>(chunks_[a]->size());
    }
  }
  next->chunks_.reserve(chunks_.size() + middle.size() / std::max<uint32_t>(1, limits.max / 2) + 1);
  for (size_t i = 0; i < a; i++) next->push(chunks_[i]);
  next->append(middle, limits);
  for (size_t i = b + 1; i < chunks_.size(); i++) next->push(chunks_[i]);
  return next;
}

}  // namespace codepad
