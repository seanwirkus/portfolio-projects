cmake_minimum_required(VERSION 3.5)

# Use the local components folder for drivers (RGB LCD, LVGL, etc.)
set(EXTRA_COMPONENT_DIRS "components")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
add_compile_options("-Wno-attributes")
project(FreewayFrenzy)
