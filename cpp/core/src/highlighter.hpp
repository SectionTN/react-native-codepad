#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "snapshot.hpp"

namespace codepad {

// Start offset and length of consecutive lines, found by scanning text from the first line's start.
struct Lines {
  std::vector<int32_t> start;
  std::vector<int32_t> length;
  int32_t end(size_t k) const { return start[k] + length[k]; }
  // The line holding offset, relative to the first scanned line.
  size_t at(int32_t offset) const;
};

Lines scan_lines(const std::u16string &text, uint32_t first_line_start, int32_t count);

// Appends, for each scanned line from first to first + count - 1, its triple count then its
// (startColumn, endColumn, styleId) triples. Same precedence as nvim: injections paint over the host,
// then later starts win, then later patterns.
void highlight(const cp_snapshot &snapshot, const Lines &lines, size_t first, size_t count, std::vector<int32_t> &out);

}  // namespace codepad
