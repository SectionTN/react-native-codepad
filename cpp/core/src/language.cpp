#include "language.hpp"

#include <algorithm>
#include <cstring>
#include <string>

#include "codepad.h"
#include "styles.hpp"

namespace codepad {

std::u16string_view TextView::node(TSNode n) const {
  // Tree-sitter counts bytes of UTF-16 text, two per unit. A stale tree can reach past the text: clamp.
  int64_t start = static_cast<int64_t>(ts_node_start_byte(n) / 2) + shift;
  int64_t end = static_cast<int64_t>(ts_node_end_byte(n) / 2) + shift;
  start = std::clamp<int64_t>(start, 0, length);
  end = std::clamp<int64_t>(end, start, length);
  return {data + start, static_cast<size_t>(end - start)};
}

std::unique_ptr<CompiledQuery> CompiledQuery::compile(const TSLanguage *language, std::string_view source,
                                                      const std::string &label, std::string &error) {
  uint32_t offset = 0;
  TSQueryError type = TSQueryErrorNone;
  TSQuery *query = ts_query_new(language, source.data(), static_cast<uint32_t>(source.size()), &offset, &type);
  if (!query) {
    error = label + " query failed to compile: tree-sitter query error type " + std::to_string(type) + " at byte " +
            std::to_string(offset);
    return nullptr;
  }
  std::unique_ptr<CompiledQuery> out(new CompiledQuery());
  out->query_ = query;
  uint32_t captures = ts_query_capture_count(query);
  for (uint32_t i = 0; i < captures; i++) {
    uint32_t length = 0;
    const char *name = ts_query_capture_name_for_id(query, i, &length);
    out->capture_names_.emplace_back(name, length);
    out->style_ids_.push_back(codepad::style_id(out->capture_names_.back()));
  }
  auto string_value = [query](uint32_t id) {
    uint32_t length = 0;
    const char *value = ts_query_string_value_for_id(query, id, &length);
    return std::string(value, length);
  };
  uint32_t patterns = ts_query_pattern_count(query);
  out->predicates_.resize(patterns);
  out->settings_.resize(patterns);
  out->offsets_.resize(patterns);
  for (uint32_t pattern = 0; pattern < patterns; pattern++) {
    uint32_t count = 0;
    const TSQueryPredicateStep *steps = ts_query_predicates_for_pattern(query, pattern, &count);
    uint32_t i = 0;
    while (i < count) {
      uint32_t j = i;
      while (j < count && steps[j].type != TSQueryPredicateStepTypeDone) j++;
      if (steps[i].type == TSQueryPredicateStepTypeString) {
        std::string raw = string_value(steps[i].value_id);
        std::vector<std::string> strings;
        std::vector<uint32_t> capture_args;
        int32_t first_capture = -1;
        int32_t other = -1;
        for (uint32_t k = i + 1; k < j; k++) {
          if (steps[k].type == TSQueryPredicateStepTypeString) {
            strings.push_back(string_value(steps[k].value_id));
          } else if (steps[k].type == TSQueryPredicateStepTypeCapture) {
            // The tested capture is the first one, the eq? operand the first one after the first argument.
            if (first_capture < 0) first_capture = static_cast<int32_t>(steps[k].value_id);
            if (k > i + 1 && other < 0) other = static_cast<int32_t>(steps[k].value_id);
          }
        }
        if (raw == "set!") {
          if (!strings.empty()) out->settings_[pattern][strings[0]] = strings.size() > 1 ? strings[1] : "true";
        } else if (raw == "offset!") {
          if (first_capture >= 0 && strings.size() >= 4 && !out->offsets_[pattern]) {
            int32_t v[4];
            bool ok = true;
            for (int n = 0; n < 4 && ok; n++) {
              char *end = nullptr;
              long parsed = std::strtol(strings[n].c_str(), &end, 10);
              ok = !strings[n].empty() && end && *end == 0;
              v[n] = static_cast<int32_t>(parsed);
            }
            if (ok) out->offsets_[pattern] = OffsetDirective{static_cast<uint32_t>(first_capture), v[0], v[1], v[2], v[3]};
          }
        } else if (!raw.empty() && raw.back() != '!') {
          Predicate p;
          std::string name = raw;
          p.negate = name.rfind("not-", 0) == 0;
          if (p.negate) name = name.substr(4);
          p.any = name.rfind("any-", 0) == 0 && name != "any-of?";
          if (p.any) name = name.substr(4);
          p.capture = first_capture;
          p.other = other;
          if (name == "eq?") p.kind = Predicate::Kind::Eq;
          else if (name == "match?") p.kind = Predicate::Kind::Match;
          else if (name == "any-of?") p.kind = Predicate::Kind::AnyOf;
          else if (name == "contains?") p.kind = Predicate::Kind::Contains;
          else if (name == "has-parent?") p.kind = Predicate::Kind::HasParent;
          else if (name == "has-ancestor?") p.kind = Predicate::Kind::HasAncestor;
          for (const std::string &s : strings) p.strings.push_back(utf8_to_utf16(s));
          p.types = strings;
          if (p.kind == Predicate::Kind::Match && !strings.empty()) {
            std::string message;
            p.regex = Regex::compile(p.strings[0], message);
            if (!p.regex) {
              error = label + ": " + raw + " pattern '" + strings[0] + "' does not compile: " + message;
              return nullptr;
            }
          }
          out->predicates_[pattern].push_back(std::move(p));
        }
      }
      i = j + 1;
    }
  }
  return out;
}

CompiledQuery::~CompiledQuery() { ts_query_delete(query_); }

int32_t CompiledQuery::capture_index(std::string_view name) const {
  for (size_t i = 0; i < capture_names_.size(); i++) {
    if (capture_names_[i] == name) return static_cast<int32_t>(i);
  }
  return -1;
}

bool CompiledQuery::matches(const TSQueryMatch &match, const TextView &text) const {
  for (const Predicate &p : predicates_[match.pattern_index]) {
    if (!holds(p, match, text)) return false;
  }
  return true;
}

bool CompiledQuery::holds(const Predicate &p, const TSQueryMatch &match, const TextView &text) const {
  if (p.capture < 0) return true;
  std::optional<std::u16string_view> expected;
  if (p.kind == Predicate::Kind::Eq) {
    if (p.other >= 0) {
      for (uint16_t i = 0; i < match.capture_count; i++) {
        if (static_cast<int32_t>(match.captures[i].index) == p.other) {
          expected = text.node(match.captures[i].node);
          break;
        }
      }
    } else if (!p.strings.empty()) {
      expected = p.strings[0];
    }
  }
  auto test = [&](TSNode n) {
    switch (p.kind) {
      case Predicate::Kind::Eq:
        return expected.has_value() && text.node(n) == *expected;
      case Predicate::Kind::Match:
        return p.regex != nullptr && p.regex->search(text.node(n));
      case Predicate::Kind::AnyOf: {
        std::u16string_view t = text.node(n);
        return std::any_of(p.strings.begin(), p.strings.end(), [&](const std::u16string &s) { return t == s; });
      }
      case Predicate::Kind::Contains: {
        std::u16string_view t = text.node(n);
        return std::any_of(p.strings.begin(), p.strings.end(),
                           [&](const std::u16string &s) { return t.find(s) != std::u16string_view::npos; });
      }
      case Predicate::Kind::HasParent: {
        TSNode parent = ts_node_parent(n);
        return !ts_node_is_null(parent) && std::find(p.types.begin(), p.types.end(), ts_node_type(parent)) != p.types.end();
      }
      case Predicate::Kind::HasAncestor: {
        for (TSNode a = ts_node_parent(n); !ts_node_is_null(a); a = ts_node_parent(a)) {
          if (std::find(p.types.begin(), p.types.end(), ts_node_type(a)) != p.types.end()) return true;
        }
        return false;
      }
      case Predicate::Kind::Other:
        return true;
    }
    return true;
  };
  bool seen = false;
  bool all = true;
  bool any = false;
  for (uint16_t i = 0; i < match.capture_count; i++) {
    if (static_cast<int32_t>(match.captures[i].index) != p.capture) continue;
    seen = true;
    bool ok = test(match.captures[i].node);
    all = all && ok;
    any = any || ok;
  }
  bool base = !seen || (p.any ? any : all);
  return p.negate ? !base : base;
}

}  // namespace codepad

namespace {

void write_error(char *out, uint32_t cap, const std::string &message) {
  if (!out || cap == 0) return;
  size_t n = std::min<size_t>(message.size(), cap - 1);
  std::memcpy(out, message.data(), n);
  out[n] = 0;
}

}  // namespace

extern "C" int32_t cp_abi_min(void) { return TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION; }

extern "C" int32_t cp_abi_max(void) { return TREE_SITTER_LANGUAGE_VERSION; }

extern "C" cp_language *cp_language_load(const char *id, const void *ts_language, const char *highlights,
                                         uint32_t highlights_len, const char *injections, uint32_t injections_len,
                                         char *error, uint32_t error_cap) {
  write_error(error, error_cap, "");
  std::string name = id ? id : "";
  if (!ts_language) {
    write_error(error, error_cap, "language '" + name + "' has no grammar");
    return nullptr;
  }
  auto *grammar = static_cast<const TSLanguage *>(ts_language);
  uint32_t abi = ts_language_abi_version(grammar);
  if (abi < TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION || abi > TREE_SITTER_LANGUAGE_VERSION) {
    write_error(error, error_cap,
                "language '" + name + "' has ABI " + std::to_string(abi) + ", runtime supports " +
                    std::to_string(TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION) + " to " +
                    std::to_string(TREE_SITTER_LANGUAGE_VERSION));
    return nullptr;
  }
  std::string message;
  auto compiled = codepad::CompiledQuery::compile(grammar, {highlights ? highlights : "", highlights_len},
                                                  name + " highlights", message);
  if (!compiled) {
    write_error(error, error_cap, message);
    return nullptr;
  }
  auto *language = new cp_language();
  language->id = name;
  language->ts = grammar;
  language->highlights = std::move(compiled);
  if (injections && injections_len > 0) {
    language->injections = codepad::CompiledQuery::compile(grammar, {injections, injections_len},
                                                           name + " injections", message);
    // A broken injections query leaves the language without injections, as the platform engines did.
    if (!language->injections) write_error(error, error_cap, message);
  }
  return language;
}

extern "C" const char *cp_language_id(const cp_language *language) { return language->id.c_str(); }

#ifdef CODEPAD_TEST_HOOKS
extern "C" int32_t cp_test_predicate(const cp_language *language, const char *query, uint32_t query_len,
                                     const cp_unit *source, uint32_t source_len, char *error, uint32_t error_cap) {
  std::string message;
  auto compiled = codepad::CompiledQuery::compile(language->ts, {query, query_len}, "test", message);
  if (!compiled) {
    write_error(error, error_cap, message);
    return -1;
  }
  TSParser *parser = ts_parser_new();
  ts_parser_set_language(parser, language->ts);
  TSTree *tree = ts_parser_parse_string_encoding(parser, nullptr, reinterpret_cast<const char *>(source),
                                                 source_len * 2, TSInputEncodingUTF16LE);
  TSQueryCursor *cursor = ts_query_cursor_new();
  ts_query_cursor_exec(cursor, compiled->query(), ts_tree_root_node(tree));
  codepad::TextView text{reinterpret_cast<const char16_t *>(source), source_len, 0};
  int32_t count = 0;
  TSQueryMatch match;
  while (ts_query_cursor_next_match(cursor, &match)) {
    if (compiled->matches(match, text)) count++;
  }
  ts_query_cursor_delete(cursor);
  ts_tree_delete(tree);
  ts_parser_delete(parser);
  return count;
}
#endif
