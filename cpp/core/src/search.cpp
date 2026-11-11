#include "search.hpp"

#include <pcre2.h>

#include <chrono>

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

struct Budget {
  std::chrono::steady_clock::time_point deadline;
  uint32_t calls = 0;
  size_t stopped = 0;
};

// Runs before each start position PCRE2 tries. The clock is read every 16 positions to keep cheap scans cheap.
int on_start(pcre2_callout_block_16 *block, void *data) {
  auto *budget = static_cast<Budget *>(data);
  if ((++budget->calls & 15) != 0 || std::chrono::steady_clock::now() < budget->deadline) return 0;
  budget->stopped = block->start_match;
  return PCRE2_ERROR_CALLOUT;
}

// A leading callout lets a budget stop a regex scan between start positions. PCRE2 skips it when it looks for a
// first code unit, and a pattern that opens with a (*VERB) keeps the plain code.
std::unique_ptr<Regex> compile_timed(std::u16string_view text, uint32_t options, bool regex, std::string &error) {
  std::unique_ptr<Regex> plain = Regex::compile(text, options, error);
  if (!plain || !regex) return plain;
  std::string ignored;
  std::unique_ptr<Regex> timed = Regex::compile(u"(?C)" + std::u16string(text), options, ignored);
  if (!timed) return plain;
  return timed;
}

}  // namespace

std::shared_ptr<const Search> Search::compile(std::u16string_view text, int32_t flags, std::string &error) {
  auto search = std::make_shared<Search>();
  search->whole_word_ = (flags & CP_SEARCH_WORD) != 0;
  if (text.empty()) return search;
  uint32_t options = PCRE2_UTF;
  if ((flags & CP_SEARCH_CASE) == 0) options |= PCRE2_CASELESS;
  bool regex = (flags & CP_SEARCH_REGEX) != 0;
  // PCRE2 refuses MULTILINE and UCP next to LITERAL, and neither changes how a literal matches.
  options |= regex ? PCRE2_UCP | PCRE2_MULTILINE | PCRE2_ALT_EXTENDED_CLASS : PCRE2_LITERAL;
  search->tolerant_ = compile_timed(text, options | PCRE2_MATCH_INVALID_UTF, regex, error);
  if (!search->tolerant_) return nullptr;
  std::string ignored;
  search->strict_ = compile_timed(text, options, regex, ignored);
  return search;
}

bool Search::well_formed(std::u16string_view text) {
  for (size_t i = 0; i < text.size(); i++) {
    char16_t u = text[i];
    if (u < 0xD800 || u > 0xDFFF) continue;
    if (u > 0xDBFF || i + 1 >= text.size() || text[i + 1] < 0xDC00 || text[i + 1] > 0xDFFF) return false;
    i++;
  }
  return true;
}

int32_t Search::find(std::u16string_view subject, bool well_formed, cp_search_scan &scan, int32_t *out, uint32_t cap) const {
  const Regex *regex = well_formed && strict_ ? strict_.get() : tolerant_.get();
  if (regex == nullptr || cap < 2 || scan.next < 0 || scan.limited != 0) {
    scan.next = -1;
    return 0;
  }
  uint32_t match_options = regex == strict_.get() ? PCRE2_NO_UTF_CHECK : 0;
  const pcre2_code_16 *code = regex->code();
  pcre2_match_data_16 *data = pcre2_match_data_create_from_pattern_16(code, nullptr);
  pcre2_match_context_16 *context = nullptr;
  Budget budget;
  if (scan.budget_ms > 0) {
    budget.deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(scan.budget_ms);
    context = pcre2_match_context_create_16(nullptr);
    pcre2_set_callout_16(context, on_start, &budget);
  }
  auto units = reinterpret_cast<PCRE2_SPTR16>(subject.data());
  size_t start = static_cast<size_t>(scan.next);
  int32_t written = 0;
  int32_t next = -1;
  while (start <= subject.size()) {
    if (static_cast<uint32_t>(written) + 2 > cap) {
      next = static_cast<int32_t>(start);
      break;
    }
    int rc = pcre2_match_16(code, units, subject.size(), start, match_options, data, context);
    if (rc == PCRE2_ERROR_CALLOUT) {
      next = static_cast<int32_t>(budget.stopped);
      break;
    }
    if (rc < 0) {
      if (rc == PCRE2_ERROR_MATCHLIMIT || rc == PCRE2_ERROR_DEPTHLIMIT || rc == PCRE2_ERROR_HEAPLIMIT) scan.limited = 1;
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
  scan.next = next;
  if (context != nullptr) pcre2_match_context_free_16(context);
  pcre2_match_data_free_16(data);
  return written;
}

std::vector<int32_t> Search::find_all(std::u16string_view subject, bool &limited) const {
  std::vector<int32_t> all;
  std::vector<int32_t> batch(8192);
  cp_search_scan scan{0, 0, 0};
  bool clean = well_formed(subject);
  while (scan.next >= 0) {
    int32_t n = find(subject, clean, scan, batch.data(), static_cast<uint32_t>(batch.size()));
    all.insert(all.end(), batch.begin(), batch.begin() + n);
  }
  limited = scan.limited != 0;
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
