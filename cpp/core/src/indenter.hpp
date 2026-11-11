#pragma once

#include <cstdint>
#include <string>

#include "document.hpp"

namespace codepad {

struct Settings {
  int32_t tab_size = 4;
  bool insert_spaces = true;
  bool auto_indent = true;
  bool auto_close = true;
};

namespace indenter {

struct Newline {
  std::u16string text;
  uint32_t caret_offset;
};

std::u16string unit(const Settings &settings);
// Text to insert for Enter replacing [start, end), and where the caret lands from the insertion start.
Newline newline(const Document &doc, uint32_t start, uint32_t end, const Settings &settings);
// Lines a selection covers. A selection ending exactly at a line start leaves that line out.
void selected_lines(const Document &doc, uint32_t min, uint32_t max, int32_t &first, int32_t &last);
// Units to drop from the line start for one outdent: a tab, or up to tab_size spaces.
uint32_t outdent_count(const std::u16string &line, const Settings &settings);

}  // namespace indenter
}  // namespace codepad
