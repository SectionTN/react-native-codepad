#include <algorithm>
#include <shared_mutex>

#include "codepad.h"
#include "editor.hpp"
#include "movement.hpp"

struct cp_text {
  codepad::SharedText view;
};

struct cp_editor : codepad::Editor {
  using Editor::Editor;
};

namespace {

std::u16string_view units(const cp_unit *text, uint32_t length) {
  if (text == nullptr || length == 0) return {};
  return {reinterpret_cast<const char16_t *>(text), length};
}

}  // namespace

extern "C" {

cp_text *cp_text_retain(const cp_text *text) { return new cp_text{text->view}; }

void cp_text_release(cp_text *text) { delete text; }

uint32_t cp_text_length(const cp_text *text) { return text->view->length(); }

uint32_t cp_text_copy(const cp_text *text, uint32_t start, uint32_t end, cp_unit *out, uint32_t cap) {
  uint32_t length = text->view->length();
  uint32_t s = std::min(start, length);
  uint32_t e = std::clamp(end, s, length);
  if (out != nullptr) text->view->copy(s, s + std::min(e - s, cap), reinterpret_cast<char16_t *>(out));
  return e - s;
}

cp_editor *cp_editor_new(const cp_editor_host *host, const cp_unit *text, uint32_t length) {
  return new cp_editor(host, units(text, length));
}

void cp_editor_free(cp_editor *editor) { delete editor; }

void cp_editor_lock_shared(cp_editor *editor) { editor->doc.mutex().lock_shared(); }

void cp_editor_unlock_shared(cp_editor *editor) { editor->doc.mutex().unlock_shared(); }

uint32_t cp_doc_length(const cp_editor *editor) { return editor->doc.length(); }

int32_t cp_doc_revision(const cp_editor *editor) { return editor->doc.revision(); }

int32_t cp_doc_line_count(const cp_editor *editor) { return editor->doc.line_count(); }

uint32_t cp_doc_line_start(const cp_editor *editor, int32_t line) { return editor->doc.line_start(line); }

uint32_t cp_doc_line_end(const cp_editor *editor, int32_t line) { return editor->doc.line_end(line); }

int32_t cp_doc_line_at(const cp_editor *editor, uint32_t offset) { return editor->doc.line_at(offset); }

cp_unit cp_doc_unit_at(const cp_editor *editor, uint32_t offset) { return editor->doc.unit_at(offset); }

uint32_t cp_doc_copy(const cp_editor *editor, uint32_t start, uint32_t end, cp_unit *out, uint32_t cap) {
  const codepad::Document &doc = editor->doc;
  uint32_t s = std::min(start, doc.length());
  uint32_t e = std::min(end, doc.length());
  if (s > e) std::swap(s, e);
  if (out != nullptr) doc.view()->copy(s, s + std::min(e - s, cap), reinterpret_cast<char16_t *>(out));
  return e - s;
}

cp_point cp_doc_position(const cp_editor *editor, uint32_t offset) { return editor->doc.position(offset); }

uint32_t cp_doc_offset(const cp_editor *editor, int32_t line, int32_t column) {
  return editor->doc.offset(line, column);
}

uint32_t cp_doc_grapheme(const cp_editor *editor, uint32_t offset, int32_t forward) {
  return forward != 0 ? codepad::movement::next_grapheme(editor->doc, offset)
                      : codepad::movement::prev_grapheme(editor->doc, offset);
}

cp_text *cp_editor_text(cp_editor *editor) { return new cp_text{editor->doc.view()}; }

void cp_editor_set_settings(cp_editor *editor, const cp_settings *s) {
  editor->settings = codepad::Settings{s->tab_size, s->insert_spaces != 0, s->auto_indent != 0, s->auto_close != 0};
}

void cp_editor_replace(cp_editor *editor, uint32_t start, uint32_t end, const cp_unit *text, uint32_t length,
                       int32_t origin, int32_t typing, int32_t caret_after) {
  editor->replace(start, end, units(text, length), origin, typing != 0, caret_after != 0);
}

void cp_editor_set_text(cp_editor *editor, const cp_unit *text, uint32_t length, int32_t keep_history) {
  editor->set_text(units(text, length), keep_history != 0);
}

void cp_editor_insert(cp_editor *editor, const cp_unit *text, uint32_t length, int32_t origin) {
  editor->insert(units(text, length), origin);
}

void cp_editor_type(cp_editor *editor, const cp_unit *text, uint32_t length) { editor->type(units(text, length)); }

int32_t cp_editor_command(cp_editor *editor, int32_t command) { return editor->command(command) ? 1 : 0; }

void cp_editor_set_selection(cp_editor *editor, int32_t anchor, int32_t head) { editor->set_selection(anchor, head); }

void cp_editor_move(cp_editor *editor, int32_t unit, int32_t forward, int32_t extend) {
  editor->move(unit, forward != 0, extend != 0);
}

void cp_editor_select_word_at(cp_editor *editor, uint32_t offset) { editor->select_word_at(offset); }

int32_t cp_editor_deletes_pair(const cp_editor *editor, uint32_t caret) { return editor->deletes_pair(caret) ? 1 : 0; }

void cp_editor_begin_group(cp_editor *editor) { editor->begin_group(); }

void cp_editor_end_group(cp_editor *editor) { editor->end_group(); }

int32_t cp_editor_selection_dirty(const cp_editor *editor) { return editor->selection_dirty() ? 1 : 0; }

void cp_editor_set_selection_dirty(cp_editor *editor, int32_t dirty) { editor->set_selection_dirty(dirty != 0); }

int64_t cp_editor_selection(const cp_editor *editor) {
  codepad::Selection s = editor->selection();
  return static_cast<int64_t>((static_cast<uint64_t>(static_cast<uint32_t>(s.anchor)) << 32) |
                              static_cast<uint32_t>(s.head));
}

int32_t cp_editor_history(const cp_editor *editor) { return editor->history(); }

int32_t cp_editor_bracket_match(const cp_editor *editor, const cp_snapshot *snapshot, uint32_t caret, int32_t out[2]) {
  codepad::BracketPair pair = editor->bracket_match(snapshot, caret);
  if (!pair.found()) return 0;
  out[0] = pair.at;
  out[1] = pair.partner;
  return 1;
}

int32_t cp_editor_set_decorations(cp_editor *editor, const cp_decoration *items, uint32_t count, int32_t revision) {
  return editor->decorations.set(items, count, revision, editor->doc) ? 1 : 0;
}

uint32_t cp_editor_decorations(const cp_editor *editor, cp_decoration *out, uint32_t cap) {
  const std::vector<cp_decoration> &items = editor->decorations.items();
  if (out != nullptr) std::copy_n(items.begin(), std::min<size_t>(items.size(), cap), out);
  return static_cast<uint32_t>(items.size());
}

int32_t cp_editor_decorations_version(const cp_editor *editor) { return editor->decorations.version(); }

#ifdef CODEPAD_TEST_HOOKS
uint32_t cp_test_chunk_ends(cp_editor *editor, uint32_t *out, uint32_t cap) {
  const codepad::SharedText &view = editor->doc.view();
  size_t n = view->chunk_count();
  for (size_t i = 0; i < n && i < cap; i++) out[i] = view->chunk_end(i);
  return static_cast<uint32_t>(n);
}

uint32_t cp_test_units_copied(cp_editor *editor) { return editor->doc.take_copied(); }

void cp_test_set_chunk_limits(uint32_t max, uint32_t min) { codepad::set_chunk_limits(max, min); }
#endif

}  // extern "C"
