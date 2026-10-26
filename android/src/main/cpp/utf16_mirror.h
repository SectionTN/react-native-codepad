#ifndef CODEPAD_UTF16_MIRROR_H
#define CODEPAD_UTF16_MIRROR_H

#include <stdint.h>

// Contiguous UTF-16 copy of the document, owned by the syntax thread, read by TSInput.
typedef struct {
  uint16_t *data;
  uint32_t length;
  uint32_t capacity;
} Mirror;

Mirror *mirror_new(void);
void mirror_delete(Mirror *m);
int mirror_replace(Mirror *m, uint32_t start, uint32_t end, const uint16_t *text, uint32_t text_len);
// NULL when the allocation fails.
Mirror *mirror_copy(const Mirror *m);

#endif
