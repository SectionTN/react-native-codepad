#include "unicode.hpp"

namespace codepad::unicode {
namespace {

uint8_t lookup(const Range *ranges, uint32_t count, uint32_t cp) {
  uint32_t lo = 0;
  uint32_t hi = count;
  while (lo < hi) {
    uint32_t mid = (lo + hi) / 2;
    if (ranges[mid].last < cp) {
      lo = mid + 1;
    } else if (ranges[mid].first > cp) {
      hi = mid;
    } else {
      return ranges[mid].value;
    }
  }
  return 0;
}

bool pictographic(uint32_t cp) {
  return cp >= 0xA9 && lookup(kExtendedPictographic, kExtendedPictographicCount, cp) != 0;
}

Incb conjunct(uint32_t cp) {
  return cp < 0x300 ? kIncbNone : static_cast<Incb>(lookup(kIndicConjunctBreak, kIndicConjunctBreakCount, cp));
}

bool high(cp_unit u) { return u >= 0xD800 && u <= 0xDBFF; }
bool low(cp_unit u) { return u >= 0xDC00 && u <= 0xDFFF; }

// The code point starting at i and its length in units. A lone surrogate stands for itself.
uint32_t decode(const cp_unit *text, uint32_t length, uint32_t i, uint32_t &units) {
  cp_unit u = text[i];
  if (high(u) && i + 1 < length && low(text[i + 1])) {
    units = 2;
    return 0x10000 + ((static_cast<uint32_t>(u) - 0xD800) << 10) + (text[i + 1] - 0xDC00);
  }
  units = 1;
  return u;
}

// Start of the code point that ends at i.
uint32_t before(const cp_unit *text, uint32_t i) {
  if (i >= 2 && low(text[i - 1]) && high(text[i - 2])) return i - 2;
  return i - 1;
}

bool hangul(Gcb g) { return g == kL || g == kV || g == kT || g == kLV || g == kLVT; }
bool control(Gcb g) { return g == kControl || g == kCR || g == kLF; }

// The state the extended rules (GB9c, GB11, GB12 and GB13) carry from the code points already read.
struct Carry {
  uint32_t regional = 0;
  bool pictograph = false;
  bool pictograph_zwj = false;
  bool consonant = false;
  bool linker = false;

  void take(uint32_t cp, Gcb g) {
    regional = g == kRegional ? regional + 1 : 0;
    bool pict = pictographic(cp);
    pictograph_zwj = g == kZWJ && pictograph;
    pictograph = pict || (pictograph && g == kExtend);
    Incb c = conjunct(cp);
    if (c == kIncbConsonant) {
      consonant = true;
      linker = false;
    } else if (consonant && c == kIncbLinker) {
      linker = true;
    } else if (!(consonant && c == kIncbExtend)) {
      consonant = false;
      linker = false;
    }
  }
};

bool joins(Gcb a, Gcb b, uint32_t cp_b, const Carry &carry) {
  if (a == kCR && b == kLF) return true;
  if (control(a) || control(b)) return false;
  if (a == kL && (b == kL || b == kV || b == kLV || b == kLVT)) return true;
  if ((a == kLV || a == kV) && (b == kV || b == kT)) return true;
  if ((a == kLVT || a == kT) && b == kT) return true;
  if (b == kExtend || b == kZWJ || b == kSpacingMark || a == kPrepend) return true;
  if (carry.consonant && carry.linker && conjunct(cp_b) == kIncbConsonant) return true;
  if (carry.pictograph_zwj && pictographic(cp_b)) return true;
  return a == kRegional && b == kRegional && carry.regional % 2 == 1;
}

// True when the boundary rules decide a break at i without looking at anything before the code point ending there.
bool safe_start(const cp_unit *text, uint32_t length, uint32_t i) {
  if (i == 0) return true;
  uint32_t units = 0;
  uint32_t a = decode(text, length, before(text, i), units);
  uint32_t b = decode(text, length, i, units);
  Gcb ga = grapheme_break(a);
  Gcb gb = grapheme_break(b);
  if (ga == kCR && gb == kLF) return false;
  if (control(ga) || control(gb)) return true;
  if (ga == kPrepend || gb == kExtend || gb == kZWJ || gb == kSpacingMark || gb == kRegional) return false;
  if (hangul(ga) && hangul(gb)) return false;
  if (ga == kZWJ && pictographic(b)) return false;
  return !(conjunct(b) == kIncbConsonant && conjunct(a) != kIncbNone);
}

}  // namespace

Gcb grapheme_break(uint32_t cp) {
  if (cp < 0x80) {
    if (cp == '\r') return kCR;
    if (cp == '\n') return kLF;
    return cp < 0x20 || cp == 0x7F ? kControl : kOther;
  }
  return static_cast<Gcb>(lookup(kGraphemeBreak, kGraphemeBreakCount, cp));
}

bool is_white_space(uint32_t cp) { return lookup(kWhiteSpace, kWhiteSpaceCount, cp) != 0; }

bool is_word_unit(cp_unit u) {
  return (u >= 'a' && u <= 'z') || (u >= 'A' && u <= 'Z') || (u >= '0' && u <= '9') || u == '_';
}

uint32_t next_grapheme(const cp_unit *text, uint32_t length, uint32_t offset) {
  if (offset >= length) return length;
  uint32_t units = 0;
  uint32_t cp = decode(text, length, offset, units);
  Gcb g = grapheme_break(cp);
  Carry carry;
  carry.take(cp, g);
  uint32_t i = offset + units;
  while (i < length) {
    uint32_t next = decode(text, length, i, units);
    Gcb gn = grapheme_break(next);
    if (!joins(g, gn, next, carry)) break;
    carry.take(next, gn);
    g = gn;
    i += units;
  }
  return i;
}

uint32_t prev_grapheme(const cp_unit *text, uint32_t length, uint32_t offset) {
  if (offset == 0) return 0;
  if (offset > length) offset = length;
  uint32_t start = before(text, offset);
  while (!safe_start(text, length, start)) start = before(text, start);
  uint32_t last = start;
  for (uint32_t i = start; i < offset;) {
    last = i;
    i = next_grapheme(text, length, i);
  }
  return last;
}

}  // namespace codepad::unicode

#ifdef CODEPAD_TEST_HOOKS
extern "C" uint32_t cp_test_grapheme_breaks(const cp_unit *text, uint32_t length, uint32_t *out, uint32_t cap) {
  uint32_t n = 0;
  uint32_t i = 0;
  if (n < cap) out[n] = 0;
  n++;
  while (i < length) {
    i = codepad::unicode::next_grapheme(text, length, i);
    if (n < cap) out[n] = i;
    n++;
  }
  return n;
}

extern "C" uint32_t cp_test_grapheme_breaks_backward(const cp_unit *text, uint32_t length, uint32_t *out,
                                                     uint32_t cap) {
  uint32_t n = 0;
  uint32_t i = length;
  if (n < cap) out[n] = i;
  n++;
  while (i > 0) {
    i = codepad::unicode::prev_grapheme(text, length, i);
    if (n < cap) out[n] = i;
    n++;
  }
  return n;
}

extern "C" int32_t cp_test_white_space(uint32_t code_point) {
  return codepad::unicode::is_white_space(code_point) ? 1 : 0;
}
#endif
