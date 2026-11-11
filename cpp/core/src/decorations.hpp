#pragma once

#include <cstdint>
#include <deque>
#include <optional>
#include <vector>

#include "codepad.h"
#include "document.hpp"

namespace codepad {

// One edit in old document coordinates, with the line bounds that decide where line decorations go.
struct EditSpan {
  int32_t start;
  int32_t old_end;
  int32_t new_length;
  int32_t start_line;
  int32_t start_line_start;
  int32_t start_line_end;
  int32_t end_line;
  int32_t end_line_end;
  int32_t inserted_lines;
  int32_t revision;

  // Built right after the document took change, so text outside the change still reads as before it.
  static EditSpan of(const Change &change, const Document &doc);
  // The decoration after the edit, or none when its range or line is gone.
  std::optional<cp_decoration> map(const cp_decoration &d) const;
};

// The app's decorations in current document coordinates, kept through every edit. version moves on every change.
class Decorations {
 public:
  const std::vector<cp_decoration> &items() const { return items_; }
  int32_t version() const { return version_; }

  // Every document change, history included, goes through here before any listener sees it.
  void edited(const Change &change, const Document &doc);
  // Forgets the set and the log, for text that setText replaced.
  void reset(int32_t floor);
  // revision is the document revision the items were computed for, below zero for the current one.
  // False when the edits since then are no longer known, which keeps the current set.
  bool set(const cp_decoration *items, uint32_t count, int32_t revision, const Document &doc);

 private:
  void replace(std::vector<cp_decoration> items);

  std::vector<cp_decoration> items_;
  int32_t version_ = 0;
  std::deque<EditSpan> edits_;
  int32_t floor_ = 0;
};

}  // namespace codepad
