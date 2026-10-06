#!/usr/bin/env bash
# Builds the tree-sitter runtime, the JNI binding and every generated grammar into one host library
# so JUnit can exercise the syntax layer on the JVM without a device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/host"
mkdir -p "$OUT"

JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"
if [ ! -f "$JAVA_HOME/include/jni.h" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
fi
CC="${CC:-cc}"
case "$(uname -s)" in
  Darwin) JNI_OS=darwin ;;
  *) JNI_OS=linux ;;
esac

GRAMMAR_SRCS=()
DECLS=""
TABLE=""
COUNT=0
while IFS= read -r parser; do
  dir="$(dirname "$parser")"
  # Anchor on the return type: the external scanner declarations above it also end in (void).
  name="$(grep -o -m1 'TSLanguage \*tree_sitter_[a-z0-9_]*(void)' "$parser" | head -1 | sed 's/^.*\*tree_sitter_//; s/(void)$//')"
  if [ -z "$name" ]; then
    echo "cannot find the language symbol in $parser" >&2
    exit 1
  fi
  GRAMMAR_SRCS+=("$parser")
  if [ -f "$dir/scanner.c" ]; then GRAMMAR_SRCS+=("$dir/scanner.c"); fi
  DECLS+="const void *tree_sitter_${name}(void);"$'\n'
  TABLE+="  { \"${name}\", tree_sitter_${name} },"$'\n'
  COUNT=$((COUNT + 1))
done < <(find "$ROOT/languages" -path '*/grammar/*' -name parser.c -not -path '*/.cache/*' | sort)

LANG_C=()
while IFS= read -r f; do LANG_C+=("$f"); done < <(find "$ROOT/languages" -path '*/android/src/main/cpp/lang.c' -not -path '*/.cache/*' | sort)

cat > "$OUT/host_languages.c" <<EOC
#include <jni.h>
#include <stdint.h>
#include <string.h>
${DECLS}
typedef struct { const char *name; const void *(*fn)(void); } HostLanguage;
static const HostLanguage LANGUAGES[] = {
${TABLE}  { 0, 0 }
};
JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_syntax_TreeSitterNative_hostLanguage(JNIEnv *env, jclass cls, jstring jname) {
  (void) cls;
  const char *name = (*env)->GetStringUTFChars(env, jname, 0);
  jlong result = 0;
  for (const HostLanguage *l = LANGUAGES; l->name; l++) {
    if (strcmp(l->name, name) == 0) { result = (jlong) (intptr_t) l->fn(); break; }
  }
  (*env)->ReleaseStringUTFChars(env, jname, name);
  return result;
}
EOC

# The runtime calls fdopen and dup, which glibc hides under a strict -std=c11 without these macros.
"$CC" -shared -fPIC -std=c11 -O1 -w -fvisibility=hidden -DTREE_SITTER_HIDE_SYMBOLS \
  -D_POSIX_C_SOURCE=200809L -D_DEFAULT_SOURCE \
  -I"$JAVA_HOME/include" -I"$JAVA_HOME/include/$JNI_OS" \
  -I"$ROOT/cpp/tree-sitter/lib/include" -I"$ROOT/cpp/tree-sitter/lib/src" \
  "$ROOT/cpp/tree-sitter/lib/src/lib.c" \
  "$ROOT/android/src/main/cpp/treesitter_jni.c" \
  "$ROOT/android/src/main/cpp/utf16_mirror.c" \
  "$OUT/host_languages.c" "${LANG_C[@]}" "${GRAMMAR_SRCS[@]}" \
  -o "$OUT/libcodepadhost.so"

echo "built $OUT/libcodepadhost.so with $COUNT grammar(s)"
