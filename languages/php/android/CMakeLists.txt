cmake_minimum_required(VERSION 3.13)
project(codepad_lang_php C)
set(GRAMMAR ${CMAKE_SOURCE_DIR}/../grammar)

add_library(codepad_lang_php SHARED
  src/main/cpp/lang.c
  ${GRAMMAR}/php/src/parser.c
  ${GRAMMAR}/php/src/scanner.c
  ${GRAMMAR}/php_only/src/parser.c
  ${GRAMMAR}/php_only/src/scanner.c
)

target_include_directories(codepad_lang_php PRIVATE ${GRAMMAR}/php/src)
target_include_directories(codepad_lang_php PRIVATE ${GRAMMAR}/php_only/src)

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
set_source_files_properties(${GRAMMAR}/php/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
set_source_files_properties(${GRAMMAR}/php_only/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
target_compile_options(codepad_lang_php PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
