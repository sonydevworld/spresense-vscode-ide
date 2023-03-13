# Build executable the python scripts

If you not installed `pyinstaller`, install before create executable.

```
python3 -m pip install pyinstaller
```

Just type following instruction to build.

```
pyinstaller --onefile list_ports.py
```

Then `dist/list_ports` is created (or list_ports.exe, on windows), copy it to appropriate OS directory.

NOTE: pyinstaller just create the executable for host PC. So we need to run above command on each platforms.
