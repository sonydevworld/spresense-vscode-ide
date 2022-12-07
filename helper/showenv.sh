#!/usr/bin/env bash

. $HOME/spresenseenv/setup
echo $PATH
echo compiler:$(dirname $(which arm-none-eabi-gcc))
