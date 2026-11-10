#pragma once

#include <algorithm>
#include <cstdint>
#include <numeric>
#include <vector>

namespace codepad {

// Sorts unit pairs by start and merges the ones that overlap or touch, so a burst of edits stays one region.
inline std::vector<int32_t> coalesce(const std::vector<int32_t> &pairs) {
  if (pairs.size() <= 2) return pairs;
  std::vector<size_t> order(pairs.size() / 2);
  std::iota(order.begin(), order.end(), 0);
  std::stable_sort(order.begin(), order.end(), [&](size_t a, size_t b) { return pairs[a * 2] < pairs[b * 2]; });
  std::vector<int32_t> out;
  out.reserve(pairs.size());
  for (size_t idx : order) {
    int32_t s = pairs[idx * 2];
    int32_t e = pairs[idx * 2 + 1];
    if (!out.empty() && s <= out.back()) {
      out.back() = std::max(out.back(), e);
    } else {
      out.push_back(s);
      out.push_back(e);
    }
  }
  return out;
}

}  // namespace codepad
