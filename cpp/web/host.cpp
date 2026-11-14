// The browser side of the CodePad core: one thread, the engine's worker and main queues drained by the page's pump.
#include <codepad.h>
#include <dlfcn.h>
#include <emscripten/emscripten.h>

#include <cstring>
#include <deque>
#include <map>
#include <memory>
#include <string>
#include <vector>

#define CPW extern "C" EMSCRIPTEN_KEEPALIVE

namespace {

struct Work {
  void (*fn)(void *);
  void *arg;
};

struct Editor {
  int32_t index = -1;
  cp_editor *editor = nullptr;
  cp_engine *engine = nullptr;
  cp_layout *layout = nullptr;
  cp_snapshot *snapshot = nullptr;
  int32_t snapshots = 0;
  double clock = -1;
  bool closed = false;
  std::vector<int32_t> changes;
  std::vector<cp_unit> text;
};

std::deque<Work> worker_q;
std::deque<Work> main_q;
std::map<std::string, const cp_language *> languages;
std::string last_error;
// Snapshots the host holds, for the leak checks of the test build.
int32_t held = 0;
// A closed editor keeps its slot until the engine's final post, which still reaches its context.
std::vector<std::unique_ptr<Editor>> editors;

Editor *at(int32_t e) {
  if (e < 0 || e >= static_cast<int32_t>(editors.size()) || !editors[e] || editors[e]->closed) return nullptr;
  return editors[e].get();
}

void schedule(void *, void (*fn)(void *), void *arg) { worker_q.push_back({fn, arg}); }
void post_main(void *, void (*fn)(void *), void *arg) { main_q.push_back({fn, arg}); }
int64_t now_micros(void *) { return static_cast<int64_t>(emscripten_get_now() * 1000.0); }

int64_t now_millis(void *ctx) {
  double clock = static_cast<Editor *>(ctx)->clock;
  return static_cast<int64_t>(clock >= 0 ? clock : emscripten_get_now());
}

const cp_language *resolve(void *, const char *id) {
  auto it = languages.find(id ? id : "");
  return it == languages.end() ? nullptr : it->second;
}

void on_change(void *ctx, const cp_change *c, const cp_unit *removed, const cp_unit *inserted, int32_t origin) {
  auto *ed = static_cast<Editor *>(ctx);
  auto removed_at = static_cast<int32_t>(ed->text.size());
  if (c->removed_len > 0) ed->text.insert(ed->text.end(), removed, removed + c->removed_len);
  auto inserted_at = static_cast<int32_t>(ed->text.size());
  if (c->inserted_len > 0) ed->text.insert(ed->text.end(), inserted, inserted + c->inserted_len);
  ed->changes.insert(ed->changes.end(),
                     {c->start, c->removed_len, c->inserted_len, c->revision, origin, removed_at, inserted_at});
}

void release(Editor *ed) {
  if (!ed->snapshot) return;
  cp_engine_release(ed->engine, ed->snapshot);
  ed->snapshot = nullptr;
  held--;
}

void on_snapshot(void *ctx, cp_snapshot *snapshot) {
  auto *ed = static_cast<Editor *>(ctx);
  if (!snapshot) {
    editors[ed->index].reset();
    return;
  }
  if (ed->closed) {
    cp_engine_release(nullptr, snapshot);
    return;
  }
  release(ed);
  ed->snapshot = snapshot;
  ed->snapshots++;
  held++;
}

}  // namespace

CPW const char *cpw_error(void) { return last_error.c_str(); }

// Registers a grammar side module already written to the file system. Returns 1, or 0 with cpw_error set.
CPW int32_t cpw_language_load(const char *id, const char *path, const char *symbol, const char *highlights,
                              const char *injections) {
  if (languages.count(id)) return 1;
  void *handle = dlopen(path, RTLD_NOW | RTLD_LOCAL);
  if (!handle) {
    last_error = dlerror();
    return 0;
  }
  auto fn = reinterpret_cast<const void *(*)()>(dlsym(handle, symbol));
  if (!fn) {
    last_error = std::string(path) + " has no symbol " + symbol;
    return 0;
  }
  if (!injections) injections = "";
  char error[512] = {0};
  cp_language *language =
      cp_language_load(id, fn(), highlights, static_cast<uint32_t>(strlen(highlights)), injections,
                       static_cast<uint32_t>(strlen(injections)), error, sizeof error);
  if (!language) {
    last_error = error;
    return 0;
  }
  languages[id] = language;
  return 1;
}

// Opens an editor with its engine and layout attached and returns its index.
CPW int32_t cpw_open(const cp_unit *text, uint32_t length, int64_t budget_micros) {
  int32_t index = 0;
  while (index < static_cast<int32_t>(editors.size()) && editors[index]) index++;
  if (index == static_cast<int32_t>(editors.size())) editors.emplace_back();
  editors[index] = std::make_unique<Editor>();
  Editor *ed = editors[index].get();
  ed->index = index;
  cp_editor_host editor_host{ed, now_millis, on_change, nullptr};
  ed->editor = cp_editor_new(&editor_host, text, length);
  ed->layout = cp_layout_new();
  cp_editor_attach_layout(ed->editor, ed->layout);
  cp_host host{ed, schedule, post_main, now_micros, resolve};
  ed->engine = cp_engine_new(&host, budget_micros, on_snapshot);
  cp_editor_attach(ed->editor, ed->engine);
  return index;
}

// Frees the editor now. Its engine frees itself in later pumps.
CPW void cpw_close(int32_t e) {
  Editor *ed = at(e);
  if (!ed) return;
  cp_editor_attach(ed->editor, nullptr);
  release(ed);
  cp_engine_close(ed->engine);
  ed->engine = nullptr;
  ed->closed = true;
  cp_editor_attach_layout(ed->editor, nullptr);
  cp_layout_free(ed->layout);
  cp_editor_free(ed->editor);
  ed->layout = nullptr;
  ed->editor = nullptr;
  ed->changes.clear();
  ed->text.clear();
}

// An id with no loaded language clears it, so the editor draws plain text. Returns 1 when the id was found.
CPW int32_t cpw_set_language(int32_t e, const char *id) {
  Editor *ed = at(e);
  if (!ed) return 0;
  const cp_language *language = resolve(nullptr, id);
  cp_engine_set_language(ed->engine, language);
  return language ? 1 : 0;
}

CPW cp_editor *cpw_editor(int32_t e) {
  Editor *ed = at(e);
  return ed ? ed->editor : nullptr;
}

CPW cp_layout *cpw_layout(int32_t e) {
  Editor *ed = at(e);
  return ed ? ed->layout : nullptr;
}

CPW cp_snapshot *cpw_snapshot(int32_t e) {
  Editor *ed = at(e);
  return ed ? ed->snapshot : nullptr;
}

CPW int32_t cpw_snapshot_count(int32_t e) {
  Editor *ed = at(e);
  return ed ? ed->snapshots : 0;
}

// Pins the editor's history clock to millis, for tests. Below zero follows the page clock again.
CPW void cpw_set_clock(int32_t e, double millis) {
  if (Editor *ed = at(e)) ed->clock = millis;
}

// Runs worker work, then main work, until both queues are empty or budget_ms is spent. Returns the items left.
CPW int32_t cpw_pump(double budget_ms) {
  double end = emscripten_get_now() + budget_ms;
  while ((!worker_q.empty() || !main_q.empty()) && emscripten_get_now() < end) {
    std::deque<Work> &q = !worker_q.empty() ? worker_q : main_q;
    Work w = q.front();
    q.pop_front();
    w.fn(w.arg);
  }
  return static_cast<int32_t>(worker_q.size() + main_q.size());
}

// Moves the changes since the last call into out, 7 ints each: start, removed length, inserted length, revision,
// origin, then the offsets of the removed and inserted units in text. Returns the ints needed and sets *text_len
// to the units needed. Nothing moves unless both fit.
CPW uint32_t cpw_take_changes(int32_t e, int32_t *out, uint32_t cap, cp_unit *text, uint32_t text_cap,
                              uint32_t *text_len) {
  Editor *ed = at(e);
  if (!ed) {
    *text_len = 0;
    return 0;
  }
  auto ints = static_cast<uint32_t>(ed->changes.size());
  auto units = static_cast<uint32_t>(ed->text.size());
  *text_len = units;
  if (ints > cap || units > text_cap) return ints;
  std::copy(ed->changes.begin(), ed->changes.end(), out);
  std::copy(ed->text.begin(), ed->text.end(), text);
  ed->changes.clear();
  ed->text.clear();
  return ints;
}

#ifdef CODEPAD_TEST_HOOKS
CPW int32_t cpw_test_held_snapshots(void) { return held; }

// Slots still taken, closed ones waiting for their engine's final post included.
CPW int32_t cpw_test_slots(void) {
  int32_t n = 0;
  for (auto &ed : editors) n += ed ? 1 : 0;
  return n;
}
#endif
