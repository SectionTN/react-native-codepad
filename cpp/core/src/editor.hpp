#pragma once

#include <atomic>
#include <cstdint>
#include <string_view>

#include "brackets.hpp"
#include "codepad.h"
#include "decorations.hpp"
#include "document.hpp"
#include "indenter.hpp"
#include "undo.hpp"

namespace codepad {

// The editing state behind one editor. Only the main thread writes. Other threads read the document under its
// shared lock, and the selection and the history flags from atomics, which an edit updates under that lock.
class Editor {
 public:
  Editor(const cp_editor_host *host, std::u16string_view text);

  Document doc;
  Settings settings;
  Decorations decorations;

  Selection selection() const;
  // Bit 0 can undo, bit 1 can redo.
  int32_t history() const { return history_.load(std::memory_order_acquire); }

  // The single mutation path. typing marks single key input that may coalesce in the history. caret_after puts
  // a collapsed caret after the inserted text instead of mapping the selection.
  Change replace(uint32_t start, uint32_t end, std::u16string_view text, int32_t origin, bool typing, bool caret_after);
  void set_text(std::u16string_view text, bool keep_history);
  void insert(std::u16string_view text, int32_t origin);
  // One code point at a time, through auto close and auto indent.
  void type(std::u16string_view text);
  // True when undo or redo did something.
  bool command(int32_t command);
  void set_selection(int32_t anchor, int32_t head);
  void move(int32_t unit, bool forward, bool extend);
  void select_word_at(uint32_t offset);
  bool deletes_pair(uint32_t caret) const;
  void begin_group();
  void end_group();
  bool selection_dirty() const { return undo_.selection_dirty; }
  void set_selection_dirty(bool dirty) { undo_.selection_dirty = dirty; }
  BracketPair bracket_match(const cp_snapshot *snapshot, uint32_t caret) const;

 private:
  void type_unit(std::u16string_view unit);
  void newline();
  void tab();
  void indent();
  void outdent();
  void backspace();
  void erase_forward();
  bool undo();
  bool redo();
  // Replays a history change: no recording, the selection maps silently until the group lands.
  void replay(uint32_t start, uint32_t end, const std::u16string &text, int32_t origin);
  void move_selection(Selection next, bool from_edit);
  void store(Selection s);
  Selection clamped(Selection s) const;
  void sync_history();
  void notify(const Change &change, int32_t origin);
  int64_t now() const;

  cp_editor_host host_{};
  UndoManager undo_;
  std::atomic<int64_t> selection_{0};
  std::atomic<int32_t> history_{0};
  // The selection the host last heard about.
  Selection reported_;
};

}  // namespace codepad
