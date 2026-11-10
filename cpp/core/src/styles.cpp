#include "styles.hpp"

#include <cstring>
#include <mutex>
#include <unordered_map>
#include <vector>

#include "codepad.h"

namespace codepad {
namespace {

struct Table {
  std::mutex mutex;
  std::unordered_map<std::string, int32_t> ids;
  std::vector<std::string> names;
};

Table &table() {
  static Table instance;
  return instance;
}

}  // namespace

int32_t style_id(std::string_view name) {
  Table &t = table();
  std::lock_guard lock(t.mutex);
  auto [it, inserted] = t.ids.try_emplace(std::string(name), static_cast<int32_t>(t.names.size()));
  if (inserted) t.names.emplace_back(name);
  return it->second;
}

std::string style_name(int32_t id) {
  Table &t = table();
  std::lock_guard lock(t.mutex);
  if (id < 0 || static_cast<size_t>(id) >= t.names.size()) return {};
  return t.names[static_cast<size_t>(id)];
}

}  // namespace codepad

extern "C" int32_t cp_style_id(const char *name) { return codepad::style_id(name ? name : ""); }

extern "C" uint32_t cp_style_name(int32_t id, char *out, uint32_t cap) {
  std::string name = codepad::style_name(id);
  auto length = static_cast<uint32_t>(name.size());
  if (out && cap > length) std::memcpy(out, name.c_str(), length + 1);
  return length;
}
