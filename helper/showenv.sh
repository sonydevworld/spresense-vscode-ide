#!/usr/bin/env bash

. $HOME/spresenseenv/setup

cat << EOF
{
    "path": "$PATH",
    "compiler": "$(dirname $(which arm-none-eabi-gcc))"
}
EOF
