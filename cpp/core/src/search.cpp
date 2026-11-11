#include "search.hpp"

#include <pcre2.h>

#include "codepad.h"
#include "unicode.hpp"

namespace codepad {
namespace {

bool bounded(std::u16string_view text, size_t start, size_t end) {
  bool before = start == 0 || !unicode::is_word_unit(text[start - 1]);
  bool after = end >= text.size() || !unicode::is_word_unit(text[end]);
  return before && after;
}

// One code point on, like ICU and Java after an empty match.
size_t step(std::u16string_view text, size_t i) {
  bool pair = i + 1 < text.size() && text[i] >= 0xD800 && text[i] <= 0xDBFF && text[i + 1] >= 0xDC00 && text[i + 1] <= 0xDFFF;
  return i + (pair ? 2 : 1);
}

}  // namespace

std::shared_ptr<const Search> Search::compile(std::u16string_view text, int32_t flags, std::string &error) {
  auto search = std::make_shared<Search>();
  search->whole_word_ = (flags & CP_SEARCH_WORD) != 0;
  if (text.empty()) return search;
  uint32_t options = PCRE2_UTF | PCRE2_MATCH_INVALID_UTF;
  if ((flags & CP_SEARCH_CASE) == 0) options |= PCRE2_CASELESS;
  // PCRE2 refuses MULTILINE and UCP next to LITERAL, and neither changes how a literal matches.
  options |= (flags & CP_SEARCH_REGEX) != 0 ? PCRE2_UCP | PCRE2_MULTILINE | PCRE2_ALT_EXTENDED_CLASS : PCRE2_LITERAL;
  search->regex_ = Regex::compile(text, options, error);
  if (!search->regex_) return nullptr;
  return search;
}

int32_t Search::find(std::u16string_view subject, uint32_t from, int32_t *out, uint32_t cap) const {
  if (!regex_ || cap < 2) return 0;
  const pcre2_code_16 *code = regex_->code();
  pcre2_match_data_16 *data = pcre2_match_data_create_from_pattern_16(code, nullptr);
  auto units = reinterpret_cast<PCRE2_SPTR16>(subject.data());
  size_t start = from;
  int32_t written = 0;
  while (start <= subject.size() && static_cast<uint32_t>(written) + 2 <= cap) {
    int rc = pcre2_match_16(code, units, subject.size(), start, 0, data, nullptr);
    if (rc < 0) {
      bool limit = rc == PCRE2_ERROR_MATCHLIMIT || rc == PCRE2_ERROR_DEPTHLIMIT || rc == PCRE2_ERROR_HEAPLIMIT;
      if (limit && written == 0) written = -1;
      break;
    }
    PCRE2_SIZE *ovector = pcre2_get_ovector_pointer_16(data);
    size_t s = ovector[0];
    size_t e = ovector[1];
    if (e > s) {
      if (!whole_word_ || bounded(subject, s, e)) {
        out[written++] = static_cast<int32_t>(s);
        out[written++] = static_cast<int32_t>(e);
      }
      start = e;
    } else if (s >= subject.size()) {
      break;
    } else {
      start = step(subject, s);
    }
  }
  pcre2_match_data_free_16(data);
  return written;
}

std::vector<int32_t> Search::find_all(std::u16string_view subject, bool &limited) const {
  limited = false;
  std::vector<int32_t> all;
  std::vector<int32_t> batch(8192);
  uint32_t from = 0;
  while (true) {
    int32_t n = find(subject, from, batch.data(), static_cast<uint32_t>(batch.size()));
    if (n < 0) {
      limited = true;
      break;
    }
    all.insert(all.end(), batch.begin(), batch.begin() + n);
    if (static_cast<size_t>(n) < batch.size()) break;
    from = static_cast<uint32_t>(batch[static_cast<size_t>(n) - 1]);
  }
  return all;
}

int32_t SearchSession::index_at_or_after(int32_t offset) const {
  int32_t lo = 0;
  int32_t hi = count();
  while (lo < hi) {
    int32_t mid = (lo + hi) / 2;
    if (matches[static_cast<size_t>(mid) * 2] < offset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

int32_t SearchSession::index_of(int32_t start, int32_t end) const {
  int32_t i = index_at_or_after(start);
  bool equal = i < count() && matches[static_cast<size_t>(i) * 2] == start && matches[static_cast<size_t>(i) * 2 + 1] == end;
  return equal ? i : -1;
}

int32_t SearchSession::next_index(int32_t min, int32_t max) const {
  if (count() == 0) return -1;
  int32_t index = index_at_or_after(min);
  if (index < count() && matches[static_cast<size_t>(index) * 2] == min && matches[static_cast<size_t>(index) * 2 + 1] == max) {
    index++;
  }
  return index >= count() ? 0 : index;
}

int32_t SearchSession::previous_index(int32_t min) const {
  if (count() == 0) return -1;
  int32_t index = index_at_or_after(min) - 1;
  return index < 0 ? count() - 1 : index;
}

}  // namespace codepad
