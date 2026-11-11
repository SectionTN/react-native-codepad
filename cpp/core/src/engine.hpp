#pragma once

#include <cstdint>
#include <memory>

#include "codepad.h"
#include "document.hpp"
#include "text.hpp"

namespace codepad {

struct Engine;

// The engine behind a handle, shared with the editor attached to it.
std::shared_ptr<Engine> engine_of(cp_engine *engine);
// Main thread. The engine parses text from now on. Returns the attach's epoch, 0 once the engine is closed.
uint64_t engine_attach(Engine &engine, SharedText text, int32_t revision);
// Main thread, right after an edit committed: after is the text it produced. An old epoch is ignored.
void engine_edit(Engine &engine, uint64_t epoch, const Change &change, cp_point start, cp_point old_end,
                 cp_point new_end, SharedText after);

}  // namespace codepad
