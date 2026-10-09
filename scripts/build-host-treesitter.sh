#!/usr/bin/env bash
# Builds the tree-sitter runtime, the JNI binding and every generated grammar into one host library
# so JUnit can exercise the syntax layer on the JVM without a device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/host"
OBJ="$OUT/obj"
mkdir -p "$OBJ"

JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}"
if [ ! -f "$JAVA_HOME/include/jni.h" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
fi
CC="${CC:-cc}"
case "$(uname -s)" in
  Darwin) JNI_OS=darwin; JOBS=$(sysctl -n hw.ncpu) ;;
  *) JNI_OS=linux; JOBS=$(nproc) ;;
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
export CC OBJ ROOT
export CFLAGS="-fPIC -std=c11 -w -fvisibility=hidden -DTREE_SITTER_HIDE_SYMBOLS -D_POSIX_C_SOURCE=200809L -D_DEFAULT_SOURCE -I$JAVA_HOME/include -I$JAVA_HOME/include/$JNI_OS -I$ROOT/cpp/tree-sitter/lib/include -I$ROOT/cpp/tree-sitter/lib/src"

object_for() { echo "$OBJ/$(echo "${1#"$ROOT/"}" | tr '/' '_').o"; }

# One object per source, rebuilt only when the source is newer than it.
compile_one() {
  local opt=$1 src=$2
  local obj
  obj="$OBJ/$(echo "${src#"$ROOT/"}" | tr '/' '_').o"
  if [ -f "$obj" ] && [ ! "$src" -nt "$obj" ]; then return; fi
  # shellcheck disable=SC2086
  "$CC" -c $CFLAGS "$opt" -I"$(dirname "$src")" "$src" -o "$obj"
}
export -f compile_one

# Parser tables are data, so -O0 compiles them fastest; biggest files first keep the pool busy to the end.
JOBS_FILE="$OUT/compile.jobs"
: > "$JOBS_FILE"
OBJS=()
for src in "$ROOT/cpp/tree-sitter/lib/src/lib.c" "$ROOT/android/src/main/cpp/treesitter_jni.c" \
  "$ROOT/android/src/main/cpp/utf16_mirror.c" "$OUT/host_languages.c" "${LANG_C[@]}"; do
  echo "-O1 $src" >> "$JOBS_FILE"
  OBJS+=("$(object_for "$src")")
done
while IFS= read -r src; do
  case "$src" in
    */parser.c) echo "-O0 $src" >> "$JOBS_FILE" ;;
    *) echo "-O1 $src" >> "$JOBS_FILE" ;;
  esac
  OBJS+=("$(object_for "$src")")
done < <(ls -S "${GRAMMAR_SRCS[@]}")
xargs -P "$JOBS" -L 1 bash -c 'compile_one "$1" "$2"' _ < "$JOBS_FILE"

"$CC" -shared -fPIC "${OBJS[@]}" -o "$OUT/libcodepadhost.so"

echo "built $OUT/libcodepadhost.so with $COUNT grammar(s)"
