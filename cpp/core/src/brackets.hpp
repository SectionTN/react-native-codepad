#pragma once

#include <cstdint>

#include "codepad.h"
#include "document.hpp"

namespace codepad {

struct BracketPair {
  int32_t at = -1;
  int32_t partner = -1;
  bool found() const { return at >= 0; }
};

// The bracket at the caret and its partner. The bracket after the caret is tried first, then the one before
// it. With a snapshot at the document's revision, brackets inside strings and comments are skipped.
BracketPair match_bracket(const Document &doc, uint32_t caret, const cp_snapshot *snapshot);

}  // namespace codepad
