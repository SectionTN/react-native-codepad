#pragma once

#include <memory>
#include <string>
#include <string_view>

struct pcre2_real_code_16;

namespace codepad {

// A PCRE2 pattern over UTF-16 text: Unicode classes, ICU style set classes, any newline ends a line.
class Regex {
 public:
  // nullptr with the PCRE2 message in error when the pattern does not compile.
  static std::unique_ptr<Regex> compile(std::u16string_view pattern, std::string &error);
  ~Regex();
  Regex(const Regex &) = delete;
  Regex &operator=(const Regex &) = delete;

  // True when the pattern matches anywhere in subject. Safe to call from several threads.
  bool search(std::u16string_view subject) const;

 private:
  explicit Regex(pcre2_real_code_16 *code) : code_(code) {}
  pcre2_real_code_16 *code_;
};

std::u16string utf8_to_utf16(std::string_view text);
std::string utf16_to_utf8(std::u16string_view text);

}  // namespace codepad
