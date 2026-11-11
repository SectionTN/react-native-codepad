project(codepad)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME codepad)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)
set(TS_DIR ${CMAKE_SOURCE_DIR}/../cpp/tree-sitter/lib)
set(CORE_DIR ${CMAKE_SOURCE_DIR}/../cpp/core)
set(PCRE2_DIR ${CMAKE_SOURCE_DIR}/../cpp/pcre2/src)
file(GLOB CORE_SOURCES CONFIGURE_DEPENDS ${CORE_DIR}/src/*.cpp)
file(GLOB PCRE2_SOURCES CONFIGURE_DEPENDS ${PCRE2_DIR}/*.c)

add_library(${PACKAGE_NAME} SHARED
  src/main/cpp/cpp-adapter.cpp
  src/main/cpp/core_jni.cpp
  ${TS_DIR}/src/lib.c
  ${CORE_SOURCES}
  ${PCRE2_SOURCES}
)

# Keep the runtime private to libcodepad.so. Language packages carry their own parser tables.
set_source_files_properties(${TS_DIR}/src/lib.c PROPERTIES COMPILE_OPTIONS
  "-std=c11;-O2;-fvisibility=hidden;-DTREE_SITTER_HIDE_SYMBOLS;-w")
set_source_files_properties(src/main/cpp/core_jni.cpp PROPERTIES COMPILE_OPTIONS
  "-O2;-fvisibility=hidden;-DTREE_SITTER_HIDE_SYMBOLS")
# The core and PCRE2 run on every keystroke, so they stay at -O2 in debug builds too, and stay private.
if(PCRE2_SOURCES)
  set_source_files_properties(${PCRE2_SOURCES} PROPERTIES COMPILE_OPTIONS
    "-std=c11;-O2;-fvisibility=hidden;-DPCRE2_CODE_UNIT_WIDTH=16;-DHAVE_CONFIG_H;-w")
endif()
if(CORE_SOURCES)
  set_source_files_properties(${CORE_SOURCES} PROPERTIES COMPILE_OPTIONS
    "-O2;-fvisibility=hidden;-DTREE_SITTER_HIDE_SYMBOLS;-DPCRE2_CODE_UNIT_WIDTH=16")
endif()

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/codepad+autolinking.cmake)

target_include_directories(${PACKAGE_NAME} PRIVATE src/main/cpp ../cpp ${TS_DIR}/include ${TS_DIR}/src ${CORE_DIR}/include ${PCRE2_DIR})

find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
)
