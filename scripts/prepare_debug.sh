#!/usr/bin/env bash

EXT=
if [ "$2" = "windows" ]; then
  EXT=.exe
fi
$1/sdk/tools/$2/flash_writer$EXT -s -c $3 -d -e nuttx
