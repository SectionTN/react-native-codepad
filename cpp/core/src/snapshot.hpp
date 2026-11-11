#pragma once

#include <memory>
#include <string>
#include <vector>

#include "language.hpp"
#include "text.hpp"
#include "tree.hpp"

namespace codepad {

// One injected tree. A carried tree's own positions lag the text by shift units, and a combined
// tree keeps the unit pairs it covers in clip, since its nodes can span the gaps between them.
struct InjectedTree {
  const cp_language *language;
  Tree tree;
  int32_t start;
  int32_t end;
  int32_t shift = 0;
  std::vector<int32_t> clip;
};

}  // namespace codepad

// An immutable parse result for one revision. It owns its trees and shares the text it was parsed from.
struct cp_snapshot {
  int32_t revision = 0;
  const cp_language *language = nullptr;
  codepad::Tree tree;
  std::vector<codepad::InjectedTree> injected;  // sorted by start
  codepad::SharedText text;
  // The attach it was parsed for: a snapshot from before the latest attach is dropped before the host sees it.
  uint64_t epoch = 0;
  int32_t based_on = -1;
  std::vector<int32_t> changed;
  int32_t latency_ms = 0;
  int32_t fresh = 0;
  int32_t reused = 0;
  int32_t carried = 0;
};
