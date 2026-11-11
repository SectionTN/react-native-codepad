#pragma once

#include <tree_sitter/api.h>

#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "regex.hpp"
#include "text.hpp"

namespace codepad {

// The text node predicates read: a carried tree's own positions lag the text by shift units.
struct TextView {
  const Text *text = nullptr;
  int32_t shift = 0;
  // A node inside one chunk is read in place. One spanning chunks is copied into scratch.
  std::u16string_view node(TSNode n, std::u16string &scratch) const;
};

struct Predicate {
  enum class Kind { Eq, Match, AnyOf, Contains, HasParent, HasAncestor, Other };
  Kind kind = Kind::Other;
  bool negate = false;
  bool any = false;
  int32_t capture = -1;
  int32_t other = -1;
  std::vector<std::u16string> strings;
  std::vector<std::string> types;
  std::unique_ptr<Regex> regex;
};

// An offset! directive: row and column deltas for the start and end of one capture.
struct OffsetDirective {
  uint32_t capture;
  int32_t start_row, start_column, end_row, end_column;
};

class CompiledQuery {
 public:
  // nullptr with a message starting with label when the query or one of its regexes does not compile.
  static std::unique_ptr<CompiledQuery> compile(const TSLanguage *language, std::string_view source,
                                                const std::string &label, std::string &error);
  ~CompiledQuery();
  CompiledQuery(const CompiledQuery &) = delete;
  CompiledQuery &operator=(const CompiledQuery &) = delete;

  TSQuery *query() const { return query_; }
  const std::string &capture_name(uint32_t capture) const { return capture_names_[capture]; }
  int32_t style_id(uint32_t capture) const { return style_ids_[capture]; }
  int32_t capture_index(std::string_view name) const;
  bool has_predicates(uint32_t pattern) const { return !predicates_[pattern].empty(); }
  bool matches(const TSQueryMatch &match, const TextView &text) const;
  const std::unordered_map<std::string, std::string> &settings(uint32_t pattern) const { return settings_[pattern]; }
  const std::optional<OffsetDirective> &offset(uint32_t pattern) const { return offsets_[pattern]; }

 private:
  CompiledQuery() = default;
  bool holds(const Predicate &p, const TSQueryMatch &match, const TextView &text) const;

  TSQuery *query_ = nullptr;
  std::vector<std::string> capture_names_;
  std::vector<int32_t> style_ids_;
  std::vector<std::vector<Predicate>> predicates_;
  std::vector<std::unordered_map<std::string, std::string>> settings_;
  std::vector<std::optional<OffsetDirective>> offsets_;
};

}  // namespace codepad

struct cp_language {
  std::string id;
  const TSLanguage *ts = nullptr;
  std::unique_ptr<codepad::CompiledQuery> highlights;
  std::unique_ptr<codepad::CompiledQuery> injections;
};
