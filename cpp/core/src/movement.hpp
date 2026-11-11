#pragma once

#include <cstdint>

#include "document.hpp"

namespace codepad::movement {

enum Unit : int32_t { kChar, kWord, kLineStart, kLineEnd, kDocStart, kDocEnd };

uint32_t next_grapheme(const Document &doc, uint32_t offset);
uint32_t prev_grapheme(const Document &doc, uint32_t offset);
// End of the word after offset. Skips white space first and steps over a line break at a line end.
uint32_t next_word_end(const Document &doc, uint32_t offset);
uint32_t prev_word_start(const Document &doc, uint32_t offset);

struct Range {
  uint32_t start;
  uint32_t end;
};
// Double tap target: an identifier run, a white space run, or a single punctuation grapheme.
Range word_range_at(const Document &doc, uint32_t offset);

}  // namespace codepad::movement
