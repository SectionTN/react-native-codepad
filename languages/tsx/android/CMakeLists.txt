cmake_minimum_required(VERSION 3.13)
project(codepad_lang_tsx C)
set(GRAMMAR ${CMAKE_SOURCE_DIR}/../grammar)

add_library(codepad_lang_tsx SHARED
  src/main/cpp/lang.c
  ${GRAMMAR}/tsx/src/parser.c
  ${GRAMMAR}/tsx/src/scanner.c
)

target_include_directories(codepad_lang_tsx PRIVATE ${GRAMMAR}/tsx/src)

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
set_source_files_properties(${GRAMMAR}/tsx/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
target_compile_options(codepad_lang_tsx PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
