#!/usr/bin/env bash

SPKFILES=$@

for spk in ${SPKFILES[@]}
do
	if [ ! -f "${spk}" ]; then
		echo "ERROR: SPK file '${spk}' missing."
		echo "Please build the project first."
		exit 1
	fi
done
