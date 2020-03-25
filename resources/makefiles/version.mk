# SDK Version definition

SDK_VERSION_STR=$(shell grep -oP "(?<=^SDK_VERSION=\"SDK).*(?=\")" $(SDKDIR)/tools/mkversion.sh)
SDK_VERSION_MAJ=$(shell echo $(SDK_VERSION_STR) | cut -d "." -f 1)
SDK_VERSION_MIN=$(shell echo $(SDK_VERSION_STR) | cut -d "." -f 2)
SDK_VERSION_PAT=$(shell echo $(SDK_VERSION_STR) | cut -d "." -f 3)

