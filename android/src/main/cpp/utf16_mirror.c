#include "utf16_mirror.h"

#include <stdlib.h>
#include <string.h>

Mirror *mirror_new(void) {
  return calloc(1, sizeof(Mirror));
}

void mirror_delete(Mirror *m) {
  if (!m) return;
  free(m->data);
  free(m);
}

int mirror_replace(Mirror *m, uint32_t start, uint32_t end, const uint16_t *text, uint32_t text_len) {
  if (start > m->length) start = m->length;
  if (end > m->length) end = m->length;
  if (start > end) {
    uint32_t t = start;
    start = end;
    end = t;
  }
  uint32_t new_len = m->length - (end - start) + text_len;
  if (new_len > m->capacity) {
    uint32_t cap = m->capacity ? m->capacity : 1024;
    while (cap < new_len) cap *= 2;
    uint16_t *grown = realloc(m->data, (size_t) cap * sizeof(uint16_t));
    if (!grown) return 0;
    m->data = grown;
    m->capacity = cap;
  }
  memmove(m->data + start + text_len, m->data + end, (size_t) (m->length - end) * sizeof(uint16_t));
  if (text_len) memcpy(m->data + start, text, (size_t) text_len * sizeof(uint16_t));
  m->length = new_len;
  return 1;
}

Mirror *mirror_copy(const Mirror *m) {
  Mirror *copy = mirror_new();
  if (!copy) return NULL;
  if (m->length && !mirror_replace(copy, 0, 0, m->data, m->length)) {
    mirror_delete(copy);
    return NULL;
  }
  return copy;
}
