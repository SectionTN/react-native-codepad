#pragma once

#include <cstdint>

#include "codepad.h"

namespace codepad::unicode {

enum Gcb : uint8_t { kOther, kCR, kLF, kControl, kExtend, kZWJ, kRegional, kPrepend, kSpacingMark, kL, kV, kT, kLV, kLVT };
enum Incb : uint8_t { kIncbNone, kIncbLinker, kIncbConsonant, kIncbExtend };

struct Range {
  uint32_t first;
  uint32_t last;
  uint8_t value;
};

extern const Range kGraphemeBreak[];
extern const uint32_t kGraphemeBreakCount;
extern const Range kExtendedPictographic[];
extern const uint32_t kExtendedPictographicCount;
extern const Range kIndicConjunctBreak[];
extern const uint32_t kIndicConjunctBreakCount;
extern const Range kWhiteSpace[];
extern const uint32_t kWhiteSpaceCount;

Gcb grapheme_break(uint32_t code_point);
bool is_white_space(uint32_t code_point);
// ASCII letters, digits and underscore.
bool is_word_unit(cp_unit unit);

// Grapheme cluster boundaries (UAX 29) within text. offset must sit on a boundary for next_grapheme.
uint32_t next_grapheme(const cp_unit *text, uint32_t length, uint32_t offset);
uint32_t prev_grapheme(const cp_unit *text, uint32_t length, uint32_t offset);

}  // namespace codepad::unicode
