#!/usr/bin/env bash

CMD=$1
SDKPATH=$2
FPORT=$3
FBAUD=$4

if [ -n \"`ls out/worker/ 2>/dev/null`\" ]; then
	${SDKPATH}/sdk/tools/flash.sh -w \
	                              -c ${FPORT} \
	                              -b ${FBAUD} \
	                              out/worker/*
fi
