############################################################################
# helper/kconfig2json.py
#
#   Copyright 2019 Sony Semiconductor Solutions Corporation
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

from kconfiglib import * # pylint: disable=unused-wildcard-import

def _expr_str(sc):
    return expr_str(sc).replace("<choice>", "y")

def make_default_list(defaults):
    ret = []
    for default, cond in defaults:
        if type(default) is tuple:
            ret.append({"name": "", "default": expr_str(default), "cond": _expr_str(cond)})
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

            d['type'] = node.item.type
            d['name'] = node.item.name
            d['value'] = node.item.str_value
            d['user_value'] = node.item.user_value

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

        # Preevaluate dependency status
        d['dep'] = TRI_TO_STR[expr_value(node.dep)]

        if node.prompt:
            d['prompt'] = node.prompt[0] # prompt text
            d['cond'] = _expr_str(node.prompt[1])  # visible condition

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

        node = node.next

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Create JSON from Kconfig')
    parser.add_argument('-o', '--output', type=str, nargs=1, help='Output file')
    parser.add_argument('-d', '--debug', action='store_true')
    parser.add_argument('kconfig', metavar='<Kconfig file>', type=str, nargs='?',
                        default='Kconfig', help='Path to Kconfig')
    opts = parser.parse_args()

    kconf = Kconfig(opts.kconfig, warn=False)
    kconf.load_config()

    # Create root node
    node = kconf.top_node
    d = { "prompt": node.prompt[0],
          "cond": expr_str(node.prompt[1]),
          "children": []
    }

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
