#include "regex.hpp"

#include <pcre2.h>

namespace codepad {

std::unique_ptr<Regex> Regex::compile(std::u16string_view pattern, std::string &error) {
  pcre2_compile_context_16 *context = pcre2_compile_context_create_16(nullptr);
  // Java and ICU end a line at CR, LF, CRLF, NEL, LS and PS. ANY is the closest PCRE2 setting.
  pcre2_set_newline_16(context, PCRE2_NEWLINE_ANY);
  int code = 0;
  PCRE2_SIZE offset = 0;
  // Invalid UTF-16 in a document (a lone surrogate) must not stop matching.
  uint32_t options = PCRE2_UTF | PCRE2_UCP | PCRE2_ALT_EXTENDED_CLASS | PCRE2_MATCH_INVALID_UTF;
  pcre2_code_16 *compiled = pcre2_compile_16(reinterpret_cast<PCRE2_SPTR16>(pattern.data()), pattern.size(),
                                             options, &code, &offset, context);
  pcre2_compile_context_free_16(context);
  if (!compiled) {
    PCRE2_UCHAR16 buffer[256];
    int length = pcre2_get_error_message_16(code, buffer, 256);
    std::u16string message(reinterpret_cast<const char16_t *>(buffer), length > 0 ? static_cast<size_t>(length) : 0);
    error = utf16_to_utf8(message) + " at offset " + std::to_string(offset);
    return nullptr;
  }
  return std::unique_ptr<Regex>(new Regex(compiled));
}

Regex::~Regex() { pcre2_code_free_16(code_); }

bool Regex::search(std::u16string_view subject) const {
  pcre2_match_data_16 *data = pcre2_match_data_create_from_pattern_16(code_, nullptr);
  int result = pcre2_match_16(code_, reinterpret_cast<PCRE2_SPTR16>(subject.data()), subject.size(), 0, 0, data,
                              nullptr);
  pcre2_match_data_free_16(data);
  return result >= 0;
}

std::u16string utf8_to_utf16(std::string_view text) {
  std::u16string out;
  out.reserve(text.size());
  size_t i = 0;
  while (i < text.size()) {
    auto c = static_cast<unsigned char>(text[i]);
    uint32_t point = 0xFFFD;
    size_t extra = c < 0x80 ? 0 : c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : c >= 0xC0 ? 1 : 0;
    if (c < 0x80) {
      point = c;
    } else if (extra > 0 && i + extra < text.size()) {
      point = c & (0x3F >> extra);
      for (size_t k = 1; k <= extra; k++) point = (point << 6) | (static_cast<unsigned char>(text[i + k]) & 0x3F);
    }
    i += extra + 1;
    if (point >= 0x10000) {
      point -= 0x10000;
      out.push_back(static_cast<char16_t>(0xD800 + (point >> 10)));
      out.push_back(static_cast<char16_t>(0xDC00 + (point & 0x3FF)));
    } else {
      out.push_back(static_cast<char16_t>(point));
    }
  }
  return out;
}

std::string utf16_to_utf8(std::u16string_view text) {
  std::string out;
  out.reserve(text.size());
  for (size_t i = 0; i < text.size(); i++) {
    uint32_t point = text[i];
    if (point >= 0xD800 && point < 0xDC00 && i + 1 < text.size() && text[i + 1] >= 0xDC00 && text[i + 1] < 0xE000) {
      point = 0x10000 + ((point - 0xD800) << 10) + (text[i + 1] - 0xDC00);
      i++;
    }
    if (point < 0x80) {
      out.push_back(static_cast<char>(point));
    } else if (point < 0x800) {
      out.push_back(static_cast<char>(0xC0 | (point >> 6)));
      out.push_back(static_cast<char>(0x80 | (point & 0x3F)));
    } else if (point < 0x10000) {
      out.push_back(static_cast<char>(0xE0 | (point >> 12)));
      out.push_back(static_cast<char>(0x80 | ((point >> 6) & 0x3F)));
      out.push_back(static_cast<char>(0x80 | (point & 0x3F)));
    } else {
      out.push_back(static_cast<char>(0xF0 | (point >> 18)));
      out.push_back(static_cast<char>(0x80 | ((point >> 12) & 0x3F)));
      out.push_back(static_cast<char>(0x80 | ((point >> 6) & 0x3F)));
      out.push_back(static_cast<char>(0x80 | (point & 0x3F)));
    }
  }
  return out;
}

}  // namespace codepad
