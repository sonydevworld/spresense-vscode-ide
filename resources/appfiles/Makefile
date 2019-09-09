-include $(TOPDIR)/Make.defs
-include $(SDKDIR)/Make.defs

CONFIG___APP_NAME___PRIORITY ?= SCHED_PRIORITY_DEFAULT
CONFIG___APP_NAME___STACKSIZE ?= 2048

APPNAME = __app_name__
PRIORITY = $(CONFIG___APP_NAME___PRIORITY)
STACKSIZE = $(CONFIG___APP_NAME___STACKSIZE)

ASRCS =
CSRCS = $(wildcard *.c) $(wildcard */*.c)
CXXSRCS = $(wildcard *.cpp) $(wildcard */*.cpp) $(wildcard *.cxx) $(wildcard */*.cxx)
MAINSRC = __app_name___main.c

CFLAGS += $(foreach inc,$(wildcard ../*/include),-I$(inc))
CXXFLAGS += $(foreach inc,$(wildcard ../*/include),-I$(inc))

CONFIG___APP_NAME___PROGNAME ?= __app_name__$(EXEEXT)
PROGNAME = $(CONFIG___APP_NAME___PROGNAME)

include $(APPDIR)/Application.mk
