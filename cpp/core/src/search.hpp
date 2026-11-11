#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "regex.hpp"

namespace codepad {

// A compiled query, safe to share across threads.
class Search {
 public:
  // flags are CP_SEARCH_*. nullptr with PCRE2's message in error when a regex does not compile.
  static std::shared_ptr<const Search> compile(std::u16string_view text, int32_t flags, std::string &error);

  // Writes up to cap / 2 non overlapping, non empty match pairs found at or after from. Returns the ints written,
  // or -1 when a match attempt hit PCRE2's match limit before any pair was written.
  int32_t find(std::u16string_view subject, uint32_t from, int32_t *out, uint32_t cap) const;
  // Every match. limited is set when the scan stopped at the match limit.
  std::vector<int32_t> find_all(std::u16string_view subject, bool &limited) const;

 private:
  std::unique_ptr<Regex> regex_;
  bool whole_word_ = false;
};

// The query and its matches for one document revision, packed as start and end pairs.
struct SearchSession {
  std::shared_ptr<const Search> search;
  std::vector<int32_t> matches;
  int32_t revision = -1;

  int32_t count() const { return static_cast<int32_t>(matches.size() / 2); }
  // The first match starting at or after offset, else count.
  int32_t index_at_or_after(int32_t offset) const;
  // The match equal to [start, end), else -1.
  int32_t index_of(int32_t start, int32_t end) const;
  // The match after the selection, skipping the selected one, wrapping to the first. -1 without matches.
  int32_t next_index(int32_t min, int32_t max) const;
  // The match before the selection, wrapping to the last. -1 without matches.
  int32_t previous_index(int32_t min) const;
};

}  // namespace codepad
