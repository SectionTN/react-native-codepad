#include "movement.hpp"

#include <algorithm>
#include <string>

#include "unicode.hpp"

namespace codepad::movement {
namespace {

struct Line {
  uint32_t start;
  std::u16string text;
  uint32_t size() const { return static_cast<uint32_t>(text.size()); }
  const cp_unit *data() const { return reinterpret_cast<const cp_unit *>(text.data()); }
};

Line line_of(const Document &doc, uint32_t offset) {
  int32_t line = doc.line_at(offset);
  uint32_t start = doc.line_start(line);
  return {start, doc.text(start, start + doc.line_length(line))};
}

bool space(char16_t u) { return unicode::is_white_space(u); }
bool word(char16_t u) { return unicode::is_word_unit(u); }

// Start of the grapheme holding col, or col itself on a boundary.
uint32_t grapheme_start(const Line &l, uint32_t col) {
  if (col == 0) return 0;
  if (col >= l.size()) return l.size();
  return unicode::prev_grapheme(l.data(), l.size(), col + 1);
}

// End of the grapheme holding col.
uint32_t grapheme_end(const Line &l, uint32_t col) {
  if (col >= l.size()) return l.size();
  return unicode::next_grapheme(l.data(), l.size(), grapheme_start(l, col));
}

}  // namespace

uint32_t next_grapheme(const Document &doc, uint32_t offset) {
  if (offset >= doc.length()) return doc.length();
  Line l = line_of(doc, offset);
  uint32_t col = offset - l.start;
  if (col >= l.size()) return offset + 1;
  return l.start + grapheme_end(l, col);
}

uint32_t prev_grapheme(const Document &doc, uint32_t offset) {
  if (offset == 0) return 0;
  uint32_t o = std::min(offset, doc.length());
  Line l = line_of(doc, o);
  uint32_t col = o - l.start;
  if (col == 0) return o - 1;
  return l.start + unicode::prev_grapheme(l.data(), l.size(), col);
}

uint32_t next_word_end(const Document &doc, uint32_t offset) {
  if (offset >= doc.length()) return doc.length();
  Line l = line_of(doc, offset);
  uint32_t col = offset - l.start;
  if (col >= l.size()) return offset + 1;
  while (col < l.size() && space(l.text[col])) col++;
  if (col >= l.size()) return l.start + col;
  if (word(l.text[col])) {
    while (col < l.size() && word(l.text[col])) col++;
    return l.start + col;
  }
  return l.start + grapheme_end(l, col);
}

uint32_t prev_word_start(const Document &doc, uint32_t offset) {
  if (offset == 0) return 0;
  uint32_t o = std::min(offset, doc.length());
  Line l = line_of(doc, o);
  uint32_t col = o - l.start;
  if (col == 0) return o - 1;
  while (col > 0 && space(l.text[col - 1])) col--;
  if (col == 0) return l.start;
  if (word(l.text[col - 1])) {
    while (col > 0 && word(l.text[col - 1])) col--;
    return l.start + col;
  }
  return l.start + grapheme_start(l, col - 1);
}

Range word_range_at(const Document &doc, uint32_t offset) {
  uint32_t o = std::min(offset, doc.length());
  Line l = line_of(doc, o);
  if (l.text.empty()) return {l.start, l.start};
  uint32_t col = std::min(o - l.start, l.size());
  if (col == l.size()) col--;
  char16_t c = l.text[col];
  bool (*cls)(char16_t) = word(c) ? word : space(c) ? space : nullptr;
  if (cls != nullptr) {
    uint32_t a = col;
    uint32_t b = col + 1;
    while (a > 0 && cls(l.text[a - 1])) a--;
    while (b < l.size() && cls(l.text[b])) b++;
    return {l.start + a, l.start + b};
  }
  // A punctuation grapheme is its own word. A word segmenter would merge "a.b" (UAX 29 MidNumLet).
  uint32_t a = grapheme_start(l, col);
  return {l.start + a, l.start + grapheme_end(l, a)};
}

}  // namespace codepad::movement
