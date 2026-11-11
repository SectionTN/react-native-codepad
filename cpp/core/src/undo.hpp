#pragma once

#include <cstdint>
#include <deque>
#include <functional>
#include <memory>
#include <vector>

#include "document.hpp"

namespace codepad {

struct Selection {
  int32_t anchor = 0;
  int32_t head = 0;
  int32_t min() const { return anchor < head ? anchor : head; }
  int32_t max() const { return anchor < head ? head : anchor; }
  bool empty() const { return anchor == head; }
  bool operator==(const Selection &o) const { return anchor == o.anchor && head == o.head; }
  bool operator!=(const Selection &o) const { return !(*this == o); }
  static Selection caret(int32_t offset) { return {offset, offset}; }
};

// Groups of changes for undo and redo. Typed units coalesce into the last group inside a one second window.
class UndoManager {
 public:
  enum class Kind { kInsert, kBackspace, kOther };

  struct Group {
    Selection before;
    Selection after;
    std::vector<Change> changes;
    int64_t time = 0;
    Kind kind = Kind::kOther;
    bool typing = false;
  };

  explicit UndoManager(std::function<int64_t()> clock) : clock_(std::move(clock)) {}

  bool can_undo() const { return !undo_.empty(); }
  bool can_redo() const { return !redo_.empty(); }

  void begin_group(Selection selection);
  void end_group(Selection selection);
  void record(const Change &change, Selection before, Selection after, bool typing);
  void amend_selection_after(Selection selection);
  // The group moved to the other stack, or null. Valid until the next call that changes the stacks.
  const Group *pop_undo();
  const Group *pop_redo();
  void clear();

  // True when the selection moved for a reason other than an edit. The next typed unit starts a new group.
  bool selection_dirty = false;

 private:
  void push(std::unique_ptr<Group> group);
  bool can_merge(const Group &last, const Change &c, Kind kind, Selection before, int64_t now) const;

  std::function<int64_t()> clock_;
  std::deque<std::unique_ptr<Group>> undo_;
  std::vector<std::unique_ptr<Group>> redo_;
  std::unique_ptr<Group> open_;
  int32_t depth_ = 0;
};

}  // namespace codepad
