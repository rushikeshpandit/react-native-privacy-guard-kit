# android/CMakeLists.txt
#
# This file is required for New Architecture.
# It creates the shared library target that autolinking.cpp links against,
# and — critically — exposes the codegen-generated headers as PUBLIC
# so the compiler can resolve RNSecureViewComponentDescriptor when
# compiling autolinking.cpp in the example app.

cmake_minimum_required(VERSION 3.13)
project(PrivacyGuardKit)

set(CMAKE_VERBOSE_MAKEFILE ON)

# The codegen output directory — set by the react gradle plugin
set(CODEGEN_DIR
  "${CMAKE_CURRENT_SOURCE_DIR}/build/generated/source/codegen"
)

# Glob all generated .cpp files
file(GLOB_RECURSE CODEGEN_SRCS
  "${CODEGEN_DIR}/jni/*.cpp"
)

# This target name MUST be: react_codegen_<libraryName>
# where libraryName matches react { libraryName } in build.gradle
# and codegenConfig.name in package.json.
# autolinking finds and links this target by exactly this name.
add_library(
  react_codegen_PrivacyGuardKitViewSpec
  SHARED
  ${CODEGEN_SRCS}
)

# PUBLIC include dirs so autolinking.cpp (in the app module)
# can #include <react/renderer/components/PrivacyGuardKitViewSpec/ComponentDescriptors.h>
target_include_directories(
  react_codegen_PrivacyGuardKitViewSpec
  PUBLIC
  "${CODEGEN_DIR}/jni"
  "${CODEGEN_DIR}/jni/react/renderer/components/PrivacyGuardKitViewSpec"
)

target_link_libraries(
  react_codegen_PrivacyGuardKitViewSpec
  ReactAndroid::jsi
  ReactAndroid::reactnative
)