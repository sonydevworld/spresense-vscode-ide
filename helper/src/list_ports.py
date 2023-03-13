#!/usr/bin/env python3

from serial.tools.list_ports import comports

if __name__ == '__main__':
    for p, d, id in sorted(comports()):
        print(f'{p}: {d}')
