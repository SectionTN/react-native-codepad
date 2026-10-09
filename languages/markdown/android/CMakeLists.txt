cmake_minimum_required(VERSION 3.13)
project(codepad_lang_markdown C)
set(GRAMMAR ${CMAKE_SOURCE_DIR}/../grammar)

add_library(codepad_lang_markdown SHARED
  src/main/cpp/lang.c
  ${GRAMMAR}/tree-sitter-markdown/src/parser.c
  ${GRAMMAR}/tree-sitter-markdown/src/scanner.c
  ${GRAMMAR}/tree-sitter-markdown-inline/src/parser.c
  ${GRAMMAR}/tree-sitter-markdown-inline/src/scanner.c
)

target_include_directories(codepad_lang_markdown PRIVATE ${GRAMMAR}/tree-sitter-markdown/src)
target_include_directories(codepad_lang_markdown PRIVATE ${GRAMMAR}/tree-sitter-markdown-inline/src)

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
set_source_files_properties(${GRAMMAR}/tree-sitter-markdown/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
set_source_files_properties(${GRAMMAR}/tree-sitter-markdown-inline/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
target_compile_options(codepad_lang_markdown PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
