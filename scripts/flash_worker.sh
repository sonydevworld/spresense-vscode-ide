#!/usr/bin/env bash

SDKPATH=$1
FPORT=$2
FBAUD=$3

if [ -n \"`ls out/worker/ 2>/dev/null`\" ]; then
	${SDKPATH}/sdk/tools/flash.sh -w \
	                              -c ${FPORT} \
	                              -b ${FBAUD} \
	                              out/worker/*
fi
