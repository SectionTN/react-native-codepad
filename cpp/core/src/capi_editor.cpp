#include <algorithm>
#include <mutex>
#include <shared_mutex>

#include "codepad.h"
#include "document.hpp"

struct cp_text {
  codepad::SharedText view;
};

struct cp_editor {
  cp_editor(const cp_editor_host *h, std::u16string_view text) : doc(text) {
    if (h != nullptr) host = *h;
  }
  codepad::Document doc;
  cp_editor_host host{};
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

cp_text *cp_editor_text(cp_editor *editor) { return new cp_text{editor->doc.view()}; }

void cp_doc_replace(cp_editor *editor, uint32_t start, uint32_t end, const cp_unit *text, uint32_t length,
                    cp_change *out) {
  codepad::Document::Edit edit = editor->doc.replace(start, end, units(text, length));
  if (out != nullptr) {
    *out = cp_change{static_cast<int32_t>(edit.start), static_cast<int32_t>(edit.removed.size()),
                     static_cast<int32_t>(edit.inserted.size()), edit.revision};
  }
}

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
