# Makefile

UNAME := $(shell uname -o 2>/dev/null)
GCC := gcc
SRC := src/serialTerminal.c

# Detect host platform
ifeq ($(UNAME),GNU/Linux)
  OUT := linux
else ifeq ($(UNAME),)
  OUT := darwin
else
  OUT := win32
endif

hide := @

# compile target source code
all: $(OUT)
	$(hide) $(GCC) $(SRC) -lpthread -o $(OUT)/serialTerminal

# Create output directory
$(OUT):
	$(hide) mkdir -p $(OUT)

