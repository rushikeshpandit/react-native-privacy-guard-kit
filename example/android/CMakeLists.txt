# android/CMakeLists.txt
# Registers the codegen-generated Fabric ComponentDescriptor for RNSecureView
# so autolinking.cpp can resolve RNSecureViewComponentDescriptor.

cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

# The library name must match the one referenced in build.gradle
project(PrivacyGuardKit)

# Path where codegen deposits generated C++ headers/sources for this library
set(CODEGEN_OUTPUT_DIR
    "${CMAKE_CURRENT_SOURCE_DIR}/build/generated/source/codegen"
)

# Include the codegen-generated headers so the descriptor is visible
include_directories(
    "${CODEGEN_OUTPUT_DIR}/jni"
    "${CODEGEN_OUTPUT_DIR}/jni/react/renderer/components/PrivacyGuardKitViewSpec"
)

# The generated .cpp files that implement the descriptor, props, shadow nodes
file(GLOB CODEGEN_SRCS
    "${CODEGEN_OUTPUT_DIR}/jni/*.cpp"
    "${CODEGEN_OUTPUT_DIR}/jni/react/renderer/components/PrivacyGuardKitViewSpec/*.cpp"
)

add_library(
    react_codegen_PrivacyGuardKitViewSpec   # must match the target autolinking looks for
    SHARED
    ${CODEGEN_SRCS}
)

target_include_directories(
    react_codegen_PrivacyGuardKitViewSpec
    PUBLIC
    "${CODEGEN_OUTPUT_DIR}/jni"
    "${CODEGEN_OUTPUT_DIR}/jni/react/renderer/components/PrivacyGuardKitViewSpec"
)

target_link_libraries(
    react_codegen_PrivacyGuardKitViewSpec
    ReactAndroid::jsi
    ReactAndroid::reactnative
)