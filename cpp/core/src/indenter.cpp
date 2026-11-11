#include "indenter.hpp"

#include "unicode.hpp"

namespace codepad::indenter {
namespace {

char16_t closer_of(char16_t opener) {
  switch (opener) {
    case u'{':
      return u'}';
    case u'(':
      return u')';
    case u'[':
      return u']';
    default:
      return 0;
  }
}

}  // namespace

std::u16string unit(const Settings &settings) {
  return settings.insert_spaces ? std::u16string(static_cast<size_t>(settings.tab_size), u' ') : u"\t";
}

Newline newline(const Document &doc, uint32_t start, uint32_t end, const Settings &settings) {
  if (!settings.auto_indent) return {u"\n", 1};
  int32_t line = doc.line_at(start);
  uint32_t line_start = doc.line_start(line);
  std::u16string text = doc.text(line_start, line_start + doc.line_length(line));
  uint32_t col = start - line_start;
  size_t indent = 0;
  while (indent < text.size() && (text[indent] == u' ' || text[indent] == u'\t')) indent++;
  if (indent > col) indent = col;
  std::u16string indent_text = text.substr(0, indent);
  char16_t opener = 0;
  for (uint32_t i = col; i > 0; i--) {
    if (!unicode::is_white_space(text[i - 1])) {
      opener = text[i - 1];
      break;
    }
  }
  char16_t matching = closer_of(opener);
  if (matching == 0) return {u"\n" + indent_text, 1 + static_cast<uint32_t>(indent)};
  std::u16string inner = indent_text + unit(settings);
  uint32_t caret = 1 + static_cast<uint32_t>(inner.size());
  if (end < doc.length() && doc.unit_at(end) == matching) return {u"\n" + inner + u"\n" + indent_text, caret};
  return {u"\n" + inner, caret};
}

void selected_lines(const Document &doc, uint32_t min, uint32_t max, int32_t &first, int32_t &last) {
  first = doc.line_at(min);
  last = doc.line_at(max);
  if (last > first && max == doc.line_start(last)) last--;
}

uint32_t outdent_count(const std::u16string &line, const Settings &settings) {
  if (line.empty()) return 0;
  if (line[0] == u'\t') return 1;
  uint32_t n = 0;
  while (n < line.size() && static_cast<int32_t>(n) < settings.tab_size && line[n] == u' ') n++;
  return n;
}

}  // namespace codepad::indenter
