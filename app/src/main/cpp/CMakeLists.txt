cmake_minimum_required(VERSION 3.22.1)
project(zdrx CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(zdrx SHARED core.cpp net.cpp esp.cpp aim.cpp bridge.cpp)

target_compile_options(zdrx PRIVATE -O2 -fvisibility=hidden -Wall -Wextra -ffast-math)

find_library(log-lib log)
target_link_libraries(zdrx ${log-lib})
