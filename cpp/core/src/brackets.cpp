#include "brackets.hpp"

#include <algorithm>
#include <string>
#include <unordered_map>
#include <vector>

#include "highlighter.hpp"
#include "styles.hpp"

namespace codepad {
namespace {

constexpr int32_t kStepLimit = 100000;
constexpr int32_t kWindowLines = 256;

char16_t partner_of(char16_t c) {
  switch (c) {
    case u'(':
      return u')';
    case u'[':
      return u']';
    case u'{':
      return u'}';
    case u')':
      return u'(';
    case u']':
      return u'[';
    case u'}':
      return u'{';
    default:
      return 0;
  }
}

// Whether an offset sits in a string or a comment, from the highlighter's own captures, in windows of lines.
class Skip {
 public:
  Skip(const Document &doc, const cp_snapshot *snapshot) : doc_(doc), snapshot_(snapshot) {}

  bool operator()(uint32_t offset) {
    if (snapshot_ == nullptr) return false;
    int32_t line = doc_.line_at(offset);
    int32_t lo = line / kWindowLines * kWindowLines;
    auto found = windows_.find(lo);
    if (found == windows_.end()) found = windows_.emplace(lo, spans(lo)).first;
    const std::vector<int32_t> &runs = found->second[static_cast<size_t>(line - lo)];
    auto column = static_cast<int32_t>(offset - doc_.line_start(line));
    for (size_t i = 0; i + 2 < runs.size(); i += 3) {
      if (column < runs[i]) return false;
      if (column < runs[i + 1]) return quoted(runs[i + 2]);
    }
    return false;
  }

 private:
  std::vector<std::vector<int32_t>> spans(int32_t lo) {
    int32_t count = std::min(kWindowLines, doc_.line_count() - lo);
    Lines lines = scan_lines(*snapshot_->text, doc_.line_start(lo), count);
    std::vector<int32_t> flat;
    highlight(*snapshot_, lines, 0, static_cast<size_t>(count), flat);
    std::vector<std::vector<int32_t>> out(static_cast<size_t>(count));
    size_t i = 0;
    for (auto &line : out) {
      auto n = static_cast<size_t>(flat[i++]) * 3;
      line.assign(flat.begin() + static_cast<ptrdiff_t>(i), flat.begin() + static_cast<ptrdiff_t>(i + n));
      i += n;
    }
    return out;
  }

  bool quoted(int32_t style) {
    auto found = quoted_.find(style);
    if (found != quoted_.end()) return found->second;
    std::string name = style >= 0 ? style_name(style) : std::string();
    bool yes = name.rfind("string", 0) == 0 || name.rfind("comment", 0) == 0;
    quoted_.emplace(style, yes);
    return yes;
  }

  const Document &doc_;
  const cp_snapshot *snapshot_;
  std::unordered_map<int32_t, std::vector<std::vector<int32_t>>> windows_;
  std::unordered_map<int32_t, bool> quoted_;
};

}  // namespace

BracketPair match_bracket(const Document &doc, uint32_t caret, const cp_snapshot *snapshot) {
  if (snapshot != nullptr && snapshot->revision != doc.revision()) snapshot = nullptr;
  Skip skip(doc, snapshot);
  auto len = static_cast<int32_t>(doc.length());
  auto c0 = static_cast<int32_t>(caret);
  int32_t at;
  if (c0 < len && partner_of(doc.unit_at(caret)) != 0 && !skip(caret)) {
    at = c0;
  } else if (c0 > 0 && c0 <= len && partner_of(doc.unit_at(caret - 1)) != 0 && !skip(caret - 1)) {
    at = c0 - 1;
  } else {
    return {};
  }
  char16_t c = doc.unit_at(static_cast<uint32_t>(at));
  char16_t partner = partner_of(c);
  int32_t step = c == u'(' || c == u'[' || c == u'{' ? 1 : -1;
  int32_t depth = 0;
  for (int32_t i = at, steps = 0; i >= 0 && i < len && steps < kStepLimit; i += step, steps++) {
    char16_t ch = doc.unit_at(static_cast<uint32_t>(i));
    if ((ch != c && ch != partner) || skip(static_cast<uint32_t>(i))) continue;
    if (ch == c) {
      depth++;
    } else if (--depth == 0) {
      return {at, i};
    }
  }
  return {};
}

}  // namespace codepad
