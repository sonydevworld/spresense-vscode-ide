############################################################################
#              THIS FILE IS AUTO GENERATED. DO NOT MODIFY                  #
############################################################################

# SPRESENSE_IDE_VERSION := 1.1.0

# Local flags
LOCAL_CELFFLAGS := $(CELFFLAGS)

-include $(TOPDIR)/Make.defs
-include $(SDKDIR)/Make.defs

WORKER_FOLDER_NAME := $(notdir $(shell pwd))
WORKER_NAME := $(shell echo $(WORKER_FOLDER_NAME) | sed s/_worker$$//)

WORKER_DIR := $(SDKDIR)$(DELIM)modules$(DELIM)asmp$(DELIM)worker
WORKER_LIB := $(WORKER_DIR)$(DELIM)libasmpw$(LIBEXT)

LDLIBPATH +=  -L $(WORKER_DIR)
LDLIBS += -lasmpw

BIN = $(OUTDIR)/$(WORKER_NAME)
DBG = $(APPDIR)/$(WORKER_FOLDER_NAME)/$(WORKER_NAME).debug

CELFFLAGS += -Og
CELFFLAGS += -I$(APPDIR)
CELFFLAGS += -I$(WORKER_DIR)
CELFFLAGS += $(LOCAL_CELFFLAGS)

CSRCS += $(wildcard *.c) $(wildcard */*.c)

AOBJS += $(ASRCS:.S=$(OBJEXT))
COBJS += $(CSRCS:.c=$(OBJEXT))

# Suppress option
ifeq ($(V),1)
export Q :=
else
ifeq ($(V),2)
export Q :=
else
export Q := @
endif
endif

# Build worker elf file
all: $(BIN)

# Build ASMP Worker
depend:
	$(Q) $(MAKE) -C $(WORKER_DIR) TOPDIR="$(TOPDIR)" SDKDIR="$(SDKDIR)" depend

$(WORKER_LIB): depend
	$(Q) $(MAKE) -C $(WORKER_DIR) TOPDIR="$(TOPDIR)" SDKDIR="$(SDKDIR)"

# Build worker
$(COBJS): %$(OBJEXT): %.c
	@echo "CC: $<"
	$(Q) $(CC) -c $(CELFFLAGS) $< -o $@

$(AOBJS): %$(OBJEXT): %.S
	@echo "AS: $<"
	$(Q) $(CC) -c $(AFLAGS) $< -o $@

$(BIN): $(WORKER_LIB) $(COBJS) $(AOBJS)
	@echo "LD: $<"
	$(Q) $(LD) $(LDRAWELFFLAGS) $(LDLIBPATH) -o $(DBG) $(ARCHCRT0OBJ) $^ $(LDLIBS)
	$(Q) $(STRIP) -d -o $@ $(DBG)

# Clean all built files
clean:
	$(Q) $(MAKE) -C $(WORKER_DIR) TOPDIR="$(TOPDIR)" SDKDIR="$(SDKDIR)" clean
	$(call DELFILE, $(BIN) $(DBG) $(wildcard *.o) $(wildcard */*.o))
	$(call CLEAN)

distclean: clean
