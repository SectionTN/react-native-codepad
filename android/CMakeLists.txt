project(codepad)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME codepad)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)
set(TS_DIR ${CMAKE_SOURCE_DIR}/../cpp/tree-sitter/lib)

add_library(${PACKAGE_NAME} SHARED
  src/main/cpp/cpp-adapter.cpp
  src/main/cpp/treesitter_jni.c
  src/main/cpp/utf16_mirror.c
  ${TS_DIR}/src/lib.c
)

# Keep the runtime private to libcodepad.so. Language packages carry their own parser tables.
set_source_files_properties(${TS_DIR}/src/lib.c PROPERTIES COMPILE_OPTIONS
  "-std=c11;-O2;-fvisibility=hidden;-DTREE_SITTER_HIDE_SYMBOLS;-w")
set_source_files_properties(src/main/cpp/treesitter_jni.c src/main/cpp/utf16_mirror.c PROPERTIES COMPILE_OPTIONS
  "-std=c11;-O2;-fvisibility=hidden;-DTREE_SITTER_HIDE_SYMBOLS")

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/codepad+autolinking.cmake)

target_include_directories(${PACKAGE_NAME} PRIVATE src/main/cpp ../cpp ${TS_DIR}/include ${TS_DIR}/src)

find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
)
