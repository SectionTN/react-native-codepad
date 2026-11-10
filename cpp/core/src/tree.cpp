#include "tree.hpp"

namespace codepad {
namespace {

struct ParseContext {
  const std::atomic<int> *flag;
  int64_t deadline;
  const cp_host *host;
};

const char *read_text(void *payload, uint32_t byte_index, TSPoint, uint32_t *bytes_read) {
  auto *text = static_cast<const std::u16string *>(payload);
  uint32_t total = bytes(static_cast<int64_t>(text->size()));
  if (byte_index >= total) {
    *bytes_read = 0;
    return "";
  }
  *bytes_read = total - byte_index;
  return reinterpret_cast<const char *>(text->data()) + byte_index;
}

bool progress(TSParseState *state) {
  auto *context = static_cast<ParseContext *>(state->payload);
  if (context->flag && context->flag->load(std::memory_order_relaxed)) return true;
  return context->deadline > 0 && context->host->now_micros(context->host->ctx) >= context->deadline;
}

}  // namespace

TSTree *parse(TSParser *parser, const TSTree *old_tree, const std::u16string &text, const std::atomic<int> *flag,
              int64_t budget_micros, const cp_host &host) {
  TSInput input;
  input.payload = const_cast<std::u16string *>(&text);
  input.read = read_text;
  input.encoding = TSInputEncodingUTF16LE;
  input.decode = nullptr;
  ParseContext context{flag, budget_micros > 0 ? host.now_micros(host.ctx) + budget_micros : 0, &host};
  TSParseOptions options;
  options.payload = &context;
  options.progress_callback = progress;
  return ts_parser_parse_with_options(parser, old_tree, input, options);
}

}  // namespace codepad
