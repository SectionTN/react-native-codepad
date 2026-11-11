#include "undo.hpp"

namespace codepad {
namespace {

constexpr size_t kMaxGroups = 1000;
constexpr int64_t kCoalesceMillis = 1000;

UndoManager::Kind kind_of(const Change &c, bool typing) {
  if (!typing) return UndoManager::Kind::kOther;
  if (c.removed.empty() && c.inserted.size() == 1 && c.inserted != u"\n") return UndoManager::Kind::kInsert;
  if (c.inserted.empty() && c.removed.size() == 1 && c.removed != u"\n") return UndoManager::Kind::kBackspace;
  return UndoManager::Kind::kOther;
}

}  // namespace

void UndoManager::begin_group(Selection selection) {
  if (depth_ == 0) {
    open_ = std::make_unique<Group>();
    open_->before = selection;
    open_->after = selection;
  }
  depth_++;
}

void UndoManager::end_group(Selection selection) {
  // An end without a begin is ignored, so the nesting count never goes negative.
  if (depth_ == 0) return;
  depth_--;
  if (depth_ > 0 || !open_) return;
  std::unique_ptr<Group> group = std::move(open_);
  if (group->changes.empty()) return;
  group->after = selection;
  group->time = clock_();
  push(std::move(group));
}

void UndoManager::record(const Change &change, Selection before, Selection after, bool typing) {
  redo_.clear();
  int64_t now = clock_();
  if (open_) {
    open_->changes.push_back(change);
    open_->after = after;
    open_->time = now;
    return;
  }
  Kind kind = kind_of(change, typing);
  if (!undo_.empty()) {
    Group &last = *undo_.back();
    if (typing && last.typing && !selection_dirty && can_merge(last, change, kind, before, now)) {
      Change &prev = last.changes.back();
      if (kind == Kind::kInsert) {
        prev.inserted += change.inserted;
      } else {
        prev.start = change.start;
        prev.removed = change.removed + prev.removed;
      }
      prev.revision = change.revision;
      last.after = after;
      last.time = now;
      selection_dirty = false;
      return;
    }
  }
  auto group = std::make_unique<Group>();
  group->before = before;
  group->after = after;
  group->changes.push_back(change);
  group->time = now;
  group->kind = kind;
  group->typing = typing;
  push(std::move(group));
  selection_dirty = false;
}

void UndoManager::amend_selection_after(Selection selection) {
  if (open_) {
    open_->after = selection;
  } else if (!undo_.empty()) {
    undo_.back()->after = selection;
  }
}

const UndoManager::Group *UndoManager::pop_undo() {
  if (undo_.empty()) return nullptr;
  redo_.push_back(std::move(undo_.back()));
  undo_.pop_back();
  return redo_.back().get();
}

const UndoManager::Group *UndoManager::pop_redo() {
  if (redo_.empty()) return nullptr;
  undo_.push_back(std::move(redo_.back()));
  redo_.pop_back();
  return undo_.back().get();
}

void UndoManager::clear() {
  undo_.clear();
  redo_.clear();
  open_.reset();
  depth_ = 0;
}

void UndoManager::push(std::unique_ptr<Group> group) {
  undo_.push_back(std::move(group));
  while (undo_.size() > kMaxGroups) undo_.pop_front();
}

bool UndoManager::can_merge(const Group &last, const Change &c, Kind kind, Selection before, int64_t now) const {
  if (kind == Kind::kOther || last.kind != kind) return false;
  if (now - last.time >= kCoalesceMillis) return false;
  if (before != last.after) return false;
  const Change &prev = last.changes.back();
  return kind == Kind::kInsert ? c.start == prev.new_end() : c.end() == prev.start;
}

}  // namespace codepad
