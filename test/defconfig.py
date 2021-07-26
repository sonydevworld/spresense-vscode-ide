#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys
import re
import logging

# XXX: This code taken from spresense/sdk/tools/config.py.
# I hope this logic to be shared with extension (TypeScript) or config.py.

is_not_set = re.compile(r'^# (?P<symbol>.*) is not set')
is_config = re.compile(r'(?P<symbol>^CONFIG_.*)=(?P<value>.*)')

# Path to apps directory from nuttx
APPSDIR = '"../sdk/apps"'

class Defconfig:

    def __init__(self, sdkdir, name=None):
        if name is None:
            name = 'default'
        self.sdkdir = os.path.abspath(sdkdir)
        self.path = self._get_fullpath(name)
        self.load()

    def _get_fullpath(self, name):
        # XXX: Only SDK2.0 or above
        return os.path.join(self.sdkdir, 'configs', name, 'defconfig')

    def __is_hostenv(self, string):
        if re.match(r'[# ]*(CONFIG_|)HOST_LINUX', string): return True
        if re.match(r'[# ]*(CONFIG_|)HOST_WINDOWS', string): return True
        if re.match(r'[# ]*(CONFIG_|)HOST_MACOS', string): return True
        if re.match(r'[# ]*(CONFIG_|)HOST_OTHER', string): return True
        if re.match(r'[# ]*(CONFIG_|)WINDOWS_NATIVE', string): return True
        if re.match(r'[# ]*(CONFIG_|)WINDOWS_CYGWIN', string): return True
        if re.match(r'[# ]*(CONFIG_|)WINDOWS_MSYS', string): return True
        if re.match(r'[# ]*(CONFIG_|)WINDOWS_UBUNTU', string): return True
        if re.match(r'[# ]*(CONFIG_|)WINDOWS_OTHER', string): return True
        if re.match(r'[# ]*(CONFIG_|)SIM_X8664_MICROSOFT', string): return True
        if re.match(r'[# ]*(CONFIG_|)SIM_X8664_SYSTEMV', string): return True
        return False

    def load(self):
        self.opts = {}
        with open(self.path, 'r') as f:
            for line in f:
                if self.__is_hostenv(line):
                    continue

                m = is_not_set.match(line.strip())
                if m:
                    sym = m.group('symbol').replace('CONFIG_', '', 1)
                    self.opts[sym] = 'n'
                else:
                    m = is_config.match(line)
                    if m:
                        sym = m.group('symbol').replace('CONFIG_', '', 1)
                        self.opts[sym] = m.group('value')
                    else:
                        logging.debug('[IGNORE]: %s' % line.strip())

    def tweak_platform(self, platform=None):
        # We need tweak options related to host environment.
        # This process is needed by NuttX build system.
        # See nuttx/tools/configure.sh.

        if platform is None:
            platform = os.uname()[0] # Same as uname -s

        if re.match(r'Darwin.*', platform):
            self.opts['HOST_MACOS'] = 'y'
        elif re.match(r'CYGWIN_.*', platform):
            self.opts['HOST_WINDOWS'] = 'y'
            self.opts['TOOLCHAIN_WINDOWS'] = 'y'
            self.opts['WINDOWS_CYGWIN'] = 'y'
        elif re.match(r'MSYS_.*', platform):
            self.opts['HOST_WINDOWS'] = 'y'
            self.opts['TOOLCHAIN_WINDOWS'] = 'y'
            self.opts['WINDOWS_MSYS'] = 'y'
        elif re.match(r'MINGW.*', platform):
            raise RuntimeError("MinGW currently not supported.")
        else:
            self.opts['HOST_LINUX'] = 'y'

    def apply(self, opt):
        if opt.startswith('-') or opt.startswith('+'):
            # Apply single option tweak from command line
            self.__apply_config(opt)
        else:
            path = self._get_fullpath(opt)
            logging.debug("Apply defconfig %s" % path)
            with open(path, 'r') as f:
                for line in f:
                    self.__apply_config(line.rstrip())

    def __apply_config(self, config):
        val = ''
        if '=' in config:
            sym, val = config[1:].split('=')
        else:
            sym = config[1:]

        if self.__is_hostenv(sym):
            logging.debug('Ignore host environment option %s' % sym)
            return

        if config.startswith('+'):
            logging.debug("Add CONFIG_%s" % sym)
            if val == '':
                val = 'y'
            if sym in self.opts:
                logging.info("Overwrite CONFIG_%s to %s" % (sym, val))
            self.opts[sym] = val
        elif config.startswith('-'):
            logging.debug("Remove CONFIG_%s" % sym)
            if sym not in self.opts:
                logging.debug("CONFIG_%s is already removed." % sym)
                return
            if self.opts[sym] != val:
                logging.info("CONFIG_%s value mismatch '%s' != '%s'", sym, self.opts[sym], val)
            del self.opts[sym]
        elif config.startswith(' '):
            old, new = val.split('->')
            logging.debug("Change CONFIG_%s %s -> %s" % (sym, old, new))
            if sym not in self.opts:
                raise RuntimeError("Fatal: Applying defconfig not proceed")
            if self.opts[sym] != old:
                logging.info("Overwrite CONFIG_%s %s -> %s" % (sym, self.opts[sym], new))
            self.opts[sym] = new
        else:
            logging.debug('Unsupported config pattern "%s"' % config)

    def saveas(self, path):
        if 'HOST_WINDOWS' not in self.opts and 'HOST_LINUX' not in self.opts and 'HOST_MACOS' not in self.opts:
            self.tweak_platform()
        self.opts['APPS_DIR'] = APPSDIR

        with open(path, 'w') as f:
            for sym, val in self.opts.items():
                if val == 'n':
                    print('# CONFIG_%s is not set' % sym, file=f)
                else:
                    print('CONFIG_%s=%s' % (sym, val), file=f)

    def stringify(self, sep='\\n'):
        if 'HOST_WINDOWS' not in self.opts and 'HOST_LINUX' not in self.opts and 'HOST_MACOS' not in self.opts:
            self.tweak_platform()
        self.opts['APPS_DIR'] = APPSDIR

        ret = ''
        for sym, val in self.opts.items():
            if val == 'n':
                ret += '# CONFIG_%s is not set%s' % (sym, sep)
            else:
                ret += 'CONFIG_%s=%s%s' % (sym, val, sep)
        return ret

    def __repr__(self):
        return '%s (%s)' % (self.__class__.__name__, self.path)

if __name__ == '__main__':

    logging.basicConfig(level=logging.DEBUG)
    
    c = Defconfig('.harness/spresense/sdk')
    c.apply('examples/hello')
    print(c.stringify())
    
