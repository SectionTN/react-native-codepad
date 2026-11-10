#pragma once

#include <cstdint>
#include <string>
#include <string_view>

namespace codepad {

// Capture names interned into ids shared by every language, so span buffers stay plain ints.
int32_t style_id(std::string_view name);
std::string style_name(int32_t id);

}  // namespace codepad
