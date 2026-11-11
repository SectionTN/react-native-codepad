cmake_minimum_required(VERSION 3.13)
project(codepad_lang_xml C)
set(GRAMMAR ${CMAKE_SOURCE_DIR}/../grammar)

add_library(codepad_lang_xml SHARED
  src/main/cpp/lang.c
  ${GRAMMAR}/xml/src/parser.c
  ${GRAMMAR}/xml/src/scanner.c
  ${GRAMMAR}/dtd/src/parser.c
  ${GRAMMAR}/dtd/src/scanner.c
)

target_include_directories(codepad_lang_xml PRIVATE ${GRAMMAR}/xml/src)
target_include_directories(codepad_lang_xml PRIVATE ${GRAMMAR}/dtd/src)

# Parser tables are data. -O1 keeps large grammars from taking minutes to compile.
set_source_files_properties(${GRAMMAR}/xml/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
set_source_files_properties(${GRAMMAR}/dtd/src/parser.c PROPERTIES COMPILE_OPTIONS "-O1")
target_compile_options(codepad_lang_xml PRIVATE -std=c11 -O2 -fvisibility=hidden -w)
