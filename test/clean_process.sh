#!/bin/sh

# This script cleanup zombies for chromedriver and headless chromium-browser process.
# CAUTION: This script kill all of chromium-browser, also your chromium browser in normal usage.

pkill chromedriver
pkill -f chromium-browser
