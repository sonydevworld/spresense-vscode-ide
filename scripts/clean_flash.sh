#!/bin/bash

# Temporary
# Get platform type
case "$(uname -s)" in
	Linux*)
		PLATFORM=linux
		;;
	Darwin*)
		PLATFORM=macos
		;;
	CYGWIN*|MINGW32*|MSYS*)
		PLATFORM=windows
		;;
	*)
		echo "ERROR: Unknown platform"
		echo ""
		show_help
		;;
esac

# Option handler
SPRESENSE_SDK_PATH=""
SPRESENSE_PORT=""
while getopts s:c: OPT
do
	case $OPT in
		's' ) SPRESENSE_SDK_PATH=${OPTARG};;
		'c' ) SPRESENSE_PORT=${OPTARG};;
	esac
done

echo "SPRESENSE_SDK_PATH=${SPRESENSE_SDK_PATH}"
echo "SPRESENSE_PORT=${SPRESENSE_PORT}"

${SPRESENSE_SDK_PATH}/sdk/tools/${PLATFORM}/flash_writer -s -c ${SPRESENSE_PORT} -d -e nuttx
