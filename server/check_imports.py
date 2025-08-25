import sys
import app
import app.main

print("app package:", app.__file__)
print("app.main module:", app.main.__file__)
print("sys.path:")
for p in sys.path:
    print("  ", p)