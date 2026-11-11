#pragma once

#include <tree_sitter/api.h>

#include <array>
#include <atomic>
#include <memory>
#include <string>
#include <vector>

#include "codepad.h"
#include "text.hpp"

namespace codepad {

struct TreeDeleter {
  void operator()(TSTree *tree) const { ts_tree_delete(tree); }
};
using Tree = std::unique_ptr<TSTree, TreeDeleter>;

struct ParserDeleter {
  void operator()(TSParser *parser) const { ts_parser_delete(parser); }
};
using Parser = std::unique_ptr<TSParser, ParserDeleter>;

struct CursorDeleter {
  void operator()(TSQueryCursor *cursor) const { ts_query_cursor_delete(cursor); }
};
using Cursor = std::unique_ptr<TSQueryCursor, CursorDeleter>;

inline Tree copy(const Tree &tree) { return Tree(ts_tree_copy(tree.get())); }

// Tree-sitter counts bytes of UTF-16 text: two per unit, columns included.
inline uint32_t bytes(int64_t units) { return static_cast<uint32_t>(units * 2); }
inline int32_t units(uint32_t bytes) { return static_cast<int32_t>(bytes / 2); }

inline TSInputEdit input_edit(int32_t start, int32_t old_end, int32_t new_end, cp_point s, cp_point oe, cp_point ne) {
  TSInputEdit edit;
  edit.start_byte = bytes(start);
  edit.old_end_byte = bytes(old_end);
  edit.new_end_byte = bytes(new_end);
  edit.start_point = {static_cast<uint32_t>(s.line), bytes(s.column)};
  edit.old_end_point = {static_cast<uint32_t>(oe.line), bytes(oe.column)};
  edit.new_end_point = {static_cast<uint32_t>(ne.line), bytes(ne.column)};
  return edit;
}

// Included ranges as six ints each: start, end, start row, start column, end row, end column, in units.
using Range6 = std::array<int32_t, 6>;

inline std::vector<int32_t> included_ranges(const TSTree *tree) {
  uint32_t count = 0;
  TSRange *ranges = ts_tree_included_ranges(tree, &count);
  std::vector<int32_t> out;
  out.reserve(count * 6);
  for (uint32_t i = 0; i < count; i++) {
    const TSRange &r = ranges[i];
    out.insert(out.end(), {units(r.start_byte), units(r.end_byte), static_cast<int32_t>(r.start_point.row),
                           units(r.start_point.column), static_cast<int32_t>(r.end_point.row),
                           units(r.end_point.column)});
  }
  free(ranges);
  return out;
}

inline bool set_included_ranges(TSParser *parser, const std::vector<int32_t> &six) {
  std::vector<TSRange> ranges(six.size() / 6);
  for (size_t i = 0; i < ranges.size(); i++) {
    const int32_t *r = six.data() + i * 6;
    ranges[i].start_byte = bytes(r[0]);
    ranges[i].end_byte = bytes(r[1]);
    ranges[i].start_point = {static_cast<uint32_t>(r[2]), bytes(r[3])};
    ranges[i].end_point = {static_cast<uint32_t>(r[4]), bytes(r[5])};
  }
  return ts_parser_set_included_ranges(parser, ranges.data(), static_cast<uint32_t>(ranges.size()));
}

// What changed between two versions of a tree, as unit pairs.
inline std::vector<int32_t> changed_ranges(const TSTree *old_tree, const TSTree *new_tree) {
  uint32_t count = 0;
  TSRange *ranges = ts_tree_get_changed_ranges(old_tree, new_tree, &count);
  std::vector<int32_t> out;
  out.reserve(count * 2);
  for (uint32_t i = 0; i < count; i++) {
    out.push_back(units(ranges[i].start_byte));
    out.push_back(units(ranges[i].end_byte));
  }
  free(ranges);
  return out;
}

// Appends the capture hull of every match in [from, to): one pair per match, predicates not evaluated.
inline void match_hulls(TSQueryCursor *cursor, const TSQuery *query, TSNode root, int32_t from, int32_t to,
                        std::vector<int32_t> &out) {
  ts_query_cursor_exec(cursor, query, root);
  ts_query_cursor_set_byte_range(cursor, bytes(from), bytes(to));
  TSQueryMatch match;
  while (ts_query_cursor_next_match(cursor, &match)) {
    uint32_t lo = UINT32_MAX;
    uint32_t hi = 0;
    for (uint16_t i = 0; i < match.capture_count; i++) {
      lo = std::min(lo, ts_node_start_byte(match.captures[i].node));
      hi = std::max(hi, ts_node_end_byte(match.captures[i].node));
    }
    if (lo >= hi) continue;
    out.push_back(units(lo));
    out.push_back(units(hi));
  }
}

// One parse, read chunk by chunk. NULL when the flag or the budget stopped it: call again to resume, or reset.
TSTree *parse(TSParser *parser, const TSTree *old_tree, const Text &text, const std::atomic<int> *flag,
              int64_t budget_micros, const cp_host &host);

}  // namespace codepad
