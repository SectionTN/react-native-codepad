export const c = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 64

/* A tiny line buffer, the kind of thing an editor starts from. */
typedef struct {
  char *text;
  size_t length;
} Line;

static Line *make_line(const char *text) {
  Line *line = malloc(sizeof(Line));
  if (line == NULL) return NULL;
  line->length = strlen(text);
  line->text = strdup(text);
  return line;
}

int main(void) {
  Line *lines[MAX_LINES] = { 0 };
  lines[0] = make_line("hello");
  for (int i = 0; i < MAX_LINES && lines[i] != NULL; i++) {
    printf("%d: %s (%zu)\\n", i, lines[i]->text, lines[i]->length);
    free(lines[i]->text);
    free(lines[i]);
  }
  return 0;
}
`;
