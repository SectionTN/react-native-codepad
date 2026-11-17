#!/bin/bash
# Builds the CodePad core for the browser with Emscripten.
#   cpp/web/build.sh                          lib/web/codepad.{js,wasm} and lib/web/grammar-imports.json
#   cpp/web/build.sh --test                   build/web-test/codepad.{js,wasm} with the test hooks
#   cpp/web/build.sh --grammar <src> <out>    one grammar side module from <src>/parser.c and scanner.c
#   cpp/web/build.sh --names                  lib/web with WASM function names, for bench profiles only
set -euo pipefail

EMSCRIPTEN_VERSION=7.0.0
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WEB=$ROOT/cpp/web
TS=$ROOT/cpp/tree-sitter/lib
PC=$ROOT/cpp/pcre2/src
CORE=$ROOT/cpp/core
OPT=-O2

if ! command -v emcc >/dev/null; then
  echo "emcc not found: install Emscripten $EMSCRIPTEN_VERSION" >&2
  exit 1
fi
found=$(emcc --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ "$found" != "$EMSCRIPTEN_VERSION" ]; then
  echo "Emscripten $EMSCRIPTEN_VERSION is required, found $found" >&2
  exit 1
fi

if [ "${1:-}" = --grammar ]; then
  src=$2
  out=$3
  srcs=("$src/parser.c")
  [ -f "$src/scanner.c" ] && srcs+=("$src/scanner.c")
  mkdir -p "$(dirname "$out")"
  emcc $OPT -fPIC -sSIDE_MODULE=1 -std=c11 -w -I"$src" "${srcs[@]}" -o "$out"
  exit 0
fi

OUT=$ROOT/lib/web
OBJ=$ROOT/build/web/obj
CORE_DEFS=
LINK_EXTRA=
if [ "${1:-}" = --names ]; then
  LINK_EXTRA=--profiling-funcs
  echo "Building lib/web with function names for bench profiles. Run cpp/web/build.sh again before shipping." >&2
fi
if [ "${1:-}" = --test ]; then
  OUT=$ROOT/build/web-test
  OBJ=$ROOT/build/web-test/obj
  CORE_DEFS=-DCODEPAD_TEST_HOOKS
fi
rm -rf "$OBJ"
mkdir -p "$OBJ" "$OUT"

compile() {
  local src=$1
  local obj
  obj=$OBJ/$(basename "$(dirname "$src")")_$(basename "$src").o
  case $src in
    */lib.c)
      emcc -c $OPT -fPIC -std=c11 -D_POSIX_C_SOURCE=200809L -fvisibility=hidden -DTREE_SITTER_HIDE_SYMBOLS -w \
        -I"$TS/include" -I"$TS/src" "$src" -o "$obj" ;;
    "$PC"/*)
      emcc -c $OPT -fPIC -std=c11 -fvisibility=hidden -DPCRE2_CODE_UNIT_WIDTH=16 -DHAVE_CONFIG_H -w -I"$PC" \
        "$src" -o "$obj" ;;
    *)
      em++ -c $OPT -fPIC -std=c++20 -fvisibility=hidden -DTREE_SITTER_HIDE_SYMBOLS -DPCRE2_CODE_UNIT_WIDTH=16 \
        $CORE_DEFS -I"$ROOT/cpp" -I"$TS/include" -I"$TS/src" -I"$CORE/include" -I"$PC" "$src" -o "$obj" ;;
  esac
}
export -f compile
export OBJ OPT TS PC CORE ROOT CORE_DEFS

{ echo "$TS/src/lib.c"; ls "$PC"/*.c; ls "$CORE"/src/*.cpp; echo "$WEB/host.cpp"; } |
  xargs -P 8 -I{} bash -c 'compile "$1"' _ {}

exports=$(sed 's/^/_/' "$WEB/exports.txt" | paste -sd, -)
em++ $OPT $LINK_EXTRA -sMAIN_MODULE=2 -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -sMODULARIZE=1 \
  -sEXPORT_NAME=createCodepadCore -sENVIRONMENT=web,node \
  -sEXPORTED_FUNCTIONS="$exports" \
  -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAPU16,HEAP32,UTF8ToString,stringToNewUTF8 \
  "$OBJ"/*.o -o "$OUT/codepad.js"

if [ "$OUT" = "$ROOT/lib/web" ]; then
  sed 's/.*/"&"/' "$WEB/exports.txt" | paste -sd, - | sed 's/.*/[&]/' >"$OUT/grammar-imports.json"
fi
ls -l "$OUT/codepad.js" "$OUT/codepad.wasm"
