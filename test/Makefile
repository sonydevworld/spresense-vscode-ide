
SPRESENSEDIR = ../../../../spresense
KCONFIG2JSON = python3 ../helper/kconfig2json.py

.PHONY: kernel sdk nuttxmenu.js sdkmenu.js
all: kernel sdk

kernel: nuttxmenu.js
sdk: sdkmenu.js

nuttxmenu.js:
	@ $(MAKE) -C $(SPRESENSEDIR)/nuttx dirlinks >/dev/null
	@ echo 'var nuttxmenudata = ' > $@
	@ srctree=$(SPRESENSEDIR)/nuttx APPSDIR=../sdk/tools/empty_apps $(KCONFIG2JSON) >> $@
	@ echo ';' >> $@

sdkmenu.js:
	@ (cd $(SPRESENSEDIR)/sdk; ./tools/config.py default)
	@ echo 'var sdkmenudata = ' > $@
	@ srctree=$(SPRESENSEDIR)/sdk SDKDIR=. $(KCONFIG2JSON) .kconfig.tmp >> $@
	@ echo ';' >> $@
