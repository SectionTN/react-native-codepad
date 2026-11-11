#pragma once

#include <cstdint>

#include "document.hpp"
#include "indenter.hpp"

namespace codepad::autoclose {

enum class Kind { kNone, kInsertPair, kSkipCloser, kWrap };

struct Action {
  Kind kind = Kind::kNone;
  char16_t open = 0;
  char16_t close = 0;
};

Action action_for(const Document &doc, uint32_t sel_min, uint32_t sel_max, int32_t head, char16_t typed,
                  const Settings &settings);
// Backspace between an empty pair removes both units.
bool deletes_pair(const Document &doc, uint32_t caret);

}  // namespace codepad::autoclose
