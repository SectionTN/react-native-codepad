#include "autoclose.hpp"

#include "unicode.hpp"

namespace codepad::autoclose {
namespace {

char16_t closer_of(char16_t c) {
  switch (c) {
    case u'(':
      return u')';
    case u'[':
      return u']';
    case u'{':
      return u'}';
    case u'"':
    case u'\'':
    case u'`':
      return c;
    default:
      return 0;
  }
}

bool quote(char16_t c) { return c == u'"' || c == u'\'' || c == u'`'; }

bool is_closer(char16_t c) { return c == u')' || c == u']' || c == u'}' || quote(c); }

bool allowed_next(char16_t c) { return c == u')' || c == u']' || c == u'}' || c == u',' || c == u';'; }

}  // namespace

Action action_for(const Document &doc, uint32_t sel_min, uint32_t sel_max, int32_t head, char16_t typed,
                  const Settings &settings) {
  if (!settings.auto_close) return {};
  char16_t closer = closer_of(typed);
  if (sel_min != sel_max) return closer != 0 ? Action{Kind::kWrap, typed, closer} : Action{};
  uint32_t caret = static_cast<uint32_t>(head);
  char16_t next = caret < doc.length() ? doc.unit_at(caret) : u'\n';
  char16_t prev = caret > 0 ? doc.unit_at(caret - 1) : u'\n';
  if (next == typed && ((closer == 0 && is_closer(typed)) || quote(typed))) return {Kind::kSkipCloser, 0, 0};
  if (closer == 0) return {};
  bool next_ok = next == u'\n' || unicode::is_white_space(next) || allowed_next(next);
  bool prev_ok = !quote(typed) || !unicode::is_word_unit(prev);
  return next_ok && prev_ok ? Action{Kind::kInsertPair, typed, closer} : Action{};
}

bool deletes_pair(const Document &doc, uint32_t caret) {
  if (caret == 0 || caret >= doc.length()) return false;
  char16_t closer = closer_of(doc.unit_at(caret - 1));
  return closer != 0 && closer == doc.unit_at(caret);
}

}  // namespace codepad::autoclose
