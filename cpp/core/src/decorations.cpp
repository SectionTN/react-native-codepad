#include "decorations.hpp"

#include <algorithm>
#include <limits>

namespace codepad {
namespace {

constexpr size_t kEditLog = 256;

struct Breaks {
  int32_t count = 0;
  int32_t first = -1;
};

Breaks breaks(const std::u16string &s) {
  Breaks b;
  for (size_t i = 0; i < s.size(); i++) {
    if (s[i] != u'\n') continue;
    if (b.first < 0) b.first = static_cast<int32_t>(i);
    b.count++;
  }
  return b;
}

}  // namespace

EditSpan EditSpan::of(const Change &change, const Document &doc) {
  auto a = static_cast<int32_t>(change.start);
  auto n = static_cast<int32_t>(change.inserted.size());
  auto old_end = static_cast<int32_t>(change.end());
  int32_t start_line = doc.line_at(a);
  int32_t after = a + n;
  int32_t end_line_end = old_end + (static_cast<int32_t>(doc.line_end(doc.line_at(after))) - after);
  Breaks removed = breaks(change.removed);
  Breaks inserted = breaks(change.inserted);
  return EditSpan{a,
                  old_end,
                  n,
                  start_line,
                  static_cast<int32_t>(doc.line_start(start_line)),
                  removed.first < 0 ? end_line_end : a + removed.first,
                  start_line + removed.count,
                  end_line_end,
                  inserted.count,
                  change.revision};
}

std::optional<cp_decoration> EditSpan::map(const cp_decoration &d) const {
  cp_decoration out = d;
  if (d.kind != CP_DECORATION_UNDERLINE) {
    int32_t line = d.a;
    int32_t mapped;
    if (line < start_line) {
      mapped = line;
    } else if (line > end_line) {
      mapped = line + inserted_lines - (end_line - start_line);
    } else {
      // Lines strictly inside the span end inside the removed text, so old_end stands in for their end.
      int32_t x = line == end_line ? end_line_end : line == start_line ? start_line_end : old_end;
      if (x <= start) {
        mapped = line;
      } else if (x > old_end) {
        mapped = start_line + inserted_lines;
      } else {
        bool gone = line != start_line || (start == start_line_start && old_end > x);
        mapped = gone ? -1 : start_line;
      }
    }
    if (mapped < 0) return std::nullopt;
    out.a = mapped;
    return out;
  }
  // The underline table from the decorations spec, first matching row wins.
  int32_t s = d.a;
  int32_t e = d.b;
  int32_t delta = new_length - (old_end - start);
  int32_t ns;
  int32_t ne;
  if (start == old_end && start == s) {
    ns = s + new_length;
    ne = e + new_length;
  } else if (start == old_end && start == e) {
    ns = s;
    ne = e;
  } else if (old_end <= s) {
    ns = s + delta;
    ne = e + delta;
  } else if (start >= e) {
    ns = s;
    ne = e;
  } else if (s <= start && old_end <= e) {
    ns = s;
    ne = e + delta;
  } else if (start <= s && e <= old_end) {
    return std::nullopt;
  } else if (start < s) {
    ns = start + new_length;
    ne = e + delta;
  } else {
    ns = s;
    ne = start;
  }
  if (ns >= ne) return std::nullopt;
  out.a = ns;
  out.b = ne;
  return out;
}

void Decorations::replace(std::vector<cp_decoration> items) {
  items_ = std::move(items);
  version_++;
}

void Decorations::edited(const Change &change, const Document &doc) {
  EditSpan span = EditSpan::of(change, doc);
  if (edits_.size() == kEditLog) edits_.pop_front();
  edits_.push_back(span);
  if (items_.empty()) return;
  std::vector<cp_decoration> mapped;
  mapped.reserve(items_.size());
  for (const cp_decoration &d : items_) {
    if (auto m = span.map(d)) mapped.push_back(*m);
  }
  replace(std::move(mapped));
}

void Decorations::reset(int32_t floor) {
  if (!items_.empty()) replace({});
  edits_.clear();
  floor_ = floor;
}

bool Decorations::set(const cp_decoration *items, uint32_t count, int32_t revision, const Document &doc) {
  bool past = revision >= 0 && revision < doc.revision();
  if (past) {
    if (revision < floor_) return false;
    int32_t oldest = edits_.empty() ? std::numeric_limits<int32_t>::max() : edits_.front().revision;
    if (oldest > revision + 1) return false;
  }
  auto length = static_cast<int32_t>(doc.length());
  std::vector<cp_decoration> list;
  list.reserve(count);
  for (uint32_t i = 0; i < count; i++) {
    std::optional<cp_decoration> d = items[i];
    if (past) {
      for (const EditSpan &span : edits_) {
        if (d && span.revision > revision) d = span.map(*d);
      }
    }
    if (!d) continue;
    if (d->kind == CP_DECORATION_UNDERLINE) {
      d->a = std::clamp(d->a, 0, length);
      d->b = std::clamp(d->b, 0, length);
      if (d->a >= d->b) continue;
    } else if (d->a < 0 || d->a >= doc.line_count() || (d->kind == CP_DECORATION_GAP && d->b < 1)) {
      continue;
    }
    list.push_back(*d);
  }
  replace(std::move(list));
  return true;
}

}  // namespace codepad
