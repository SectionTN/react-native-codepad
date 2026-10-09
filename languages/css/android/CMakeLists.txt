cmake_minimum_required(VERSION 3.13)
project(codepad_lang_css C)
set(GRAMMAR ${CMAKE_SOURCE_DIR}/../grammar)

add_library(codepad_lang_css SHARED
  src/main/cpp/lang.c
  ${GRAMMAR}/src/parser.c
  ${GRAMMAR}/src/scanner.c
)

target_include_directories(codepad_lang_css PRIVATE ${GRAMMAR}/src)

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
set_source_files_properties(${GRAMMAR}/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
target_compile_options(codepad_lang_css PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
