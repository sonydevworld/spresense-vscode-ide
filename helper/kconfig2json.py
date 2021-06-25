############################################################################
# helper/kconfig2json.py
#
#   Copyright 2019, 2021 Sony Semiconductor Solutions Corporation
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
#
# 1. Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in
#    the documentation and/or other materials provided with the
#    distribution.
# 3. Neither the name of Sony Semiconductor Solutions Corporation nor
#    the names of its contributors may be used to endorse or promote
#    products derived from this software without specific prior written
#    permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
# "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
# LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
# FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
# COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
# BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
# OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
# AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
# LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
# ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.
#
############################################################################

import sys
import os
import argparse
import json
import logging
import re

from kconfiglib import * # pylint: disable=unused-wildcard-import

def _expr_str(sc):
    # Replace choice reference to 'y'. Because they are reference from child to parent choice config.
    return re.sub(r'<choice.*?>', 'y', expr_str(sc))

def make_default_list(defaults):
    ret = []
    for default, cond in defaults:
        if type(default) is tuple:
            logging.debug('Default is reference {}'.format(default))
            ret.append({"name": None, "default": expr_str(default), "cond": _expr_str(cond)})
        else:
            ret.append({"name": default.name, "default": default.str_value, "cond": _expr_str(cond)})
    return ret

# This function is for 'select' and 'imply' list
def make_select_list(selects):
    ret = []
    for symbol, cond in selects:
        ret.append({"symbol": symbol.name, "cond": _expr_str(cond)})
    return ret

def make_range_list(ranges):
    ret = []
    for _min, _max, cond in ranges:
        ret.append({"min": _min.str_value, "max": _max.str_value, "cond": _expr_str(cond)})
    return ret

def lazydecode(string):
    if sys.version_info[0] < 3:
        return string.decode('utf-8', errors='replace').encode('utf-8')
    else:
        return string.encode('utf-8', errors='replace').decode('utf-8')

def is_skip_node(node):
    if node.filename.startswith('arch'):
        if not (node.filename == 'arch/Kconfig') and not ('arm' in node.filename):
            return True
    if node.filename.startswith('boards'):
        if not (node.filename == 'boards/Kconfig') and not ('cxd56' in node.filename):
            return True
    return False

def build_nodetree(node, nodelist):
    while node:
        d = {}
        if node.item == MENU:
            d['type'] = MENU
        elif node.item == COMMENT:
            d['type'] = COMMENT
        elif isinstance(node.item, Symbol):
            # Skip environment variable node
            if node.item.env_var is not None:
                node = node.next
                continue

            # XXX: Ignore Kconfig files other than Arm architecture.
            # This logic needs to avoid multiple option definitions (e.g. ARCH_BOARD),
            # especially architecture Kconfig files.
            # In Spresense VS Code extension, it causes that the failure of lost some configuration.
            #
            # The multiple definitions may works fine in kconfig-conf tools, but we can't because of
            # optimized processing in the extension.

            if is_skip_node(node):
                logging.info(' {}: {} has been skipped'.format(node.filename, node.item.name))
                node = node.next
                continue

            #
            # 'type' is int as:
            # 3 = BOOL
            # 24 = HEX
            # 27 = INT
            # 47 = STRING
            # 48 = TRISTATE
            #
            # We use type as int for reduce string size in JSON.
            #

            d['type'] = node.item.orig_type
            d['name'] = node.item.name
            d['value'] = node.item.str_value
            d['user_value'] = node.item.user_value

            if node.item is node.item.kconfig.modules:
                d['modules'] = True

            if node.is_menuconfig:
                d['menuconfig'] = True

            rd = _expr_str(node.item.rev_dep)
            if rd != "n":
                d['rev_dep'] = rd
            wrd = _expr_str(node.item.weak_rev_dep)
            if wrd != "n":
                d['weak_rev_dep'] = wrd

        elif isinstance(node.item, Choice):
            d['type'] = 4 # _T_CHOICE
            d['user_value'] = node.item.user_value
        else:
            raise RuntimeError('Unknown or unsupported node {}'.format(node))

        # Save dependency, skip if no dependency (only 'y')
        dep = _expr_str(node.dep)
        if dep != 'y':
            d['dep'] = _expr_str(node.dep)

        # Preevaluate dependency status
        d['visible'] = TRI_TO_STR[expr_value(node.dep)]

        if node.prompt:
            d['prompt'] = node.prompt[0] # prompt text

        if len(node.defaults) > 0:
            d['defaults'] = make_default_list(node.defaults)
        if len(node.selects) > 0:
            d['selects'] = make_select_list(node.selects)
        if len(node.implies) > 0:
            d['implies'] = make_select_list(node.implies)
        if len(node.ranges) > 0:
            d['ranges'] = make_range_list(node.ranges)

        if hasattr(node, "help") and isinstance(node.help, str):
            d['help'] = lazydecode(node.help)

        nodelist.append(d)

        if node.list is not None:
            d['children'] = []
            build_nodetree(node.list, d['children'])

        # Check choice node has some child nodes after choice option.
        # No child node will happens when choice options ignored by architecture exclusion logic
        # in above.
        # If choice has no children, it can not be use, so remove from output json.

        if d['type'] == 4 and len(d['children']) == 0:
            logging.info('Choice "{}" ({}) is no children, optimize remove.'.format(d['prompt'], node.filename))
            nodelist.remove(d)

        node = node.next

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Create JSON from Kconfig')
    parser.add_argument('-o', '--output', type=str, nargs=1, help='Output file')
    parser.add_argument('-d', '--debug', action='store_true')
    parser.add_argument('-v', '--verbose', action='store_true')
    parser.add_argument('kconfig', metavar='<Kconfig file>', type=str, nargs='?',
                        default='Kconfig', help='Path to Kconfig')
    opts = parser.parse_args()

    kconf = Kconfig(opts.kconfig, warn=False)
    if opts.verbose:
        kconf.enable_warnings()
    kconf.load_config()

    # Create root node
    node = kconf.top_node
    d = { "prompt": node.prompt[0],
          "cond": expr_str(node.prompt[1]),
          "children": []
    }

    if opts.verbose:
        logging.basicConfig(level=logging.INFO)
    if opts.debug:
        logging.basicConfig(level=logging.DEBUG)

    if node.list is not None:
        build_nodetree(node.list, d['children'])

    if opts.output:
        f = open(opts.output[0], 'w')
    else:
        f = sys.stdout

    # f.write('var menudata = ' + json.dumps(d) + ';\n')
    if opts.debug:
        f.write(json.dumps(d, indent=4))
    else:
        f.write(json.dumps(d))

    f.close()
