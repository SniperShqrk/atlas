#!/usr/bin/env python3
"""
Re-applies the manual Sentry fixes that `expo prebuild` always wipes, since
this app has no Sentry org/DSN configured yet:
  1. The "Upload Debug Symbols to Sentry" build phase's default script,
     replaced with a harmless no-op.
  2. Source-map auto-upload during the JS bundle phase, disabled via
     SENTRY_DISABLE_AUTO_UPLOAD in ios/.xcode.env.
Safe to run more than once.
"""
import re
import sys

PBXPROJ = "ios/ATLAS.xcodeproj/project.pbxproj"
NOOP_SCRIPT = "echo 'Skipping Sentry debug symbol upload (no DSN/org configured yet)'"

with open(PBXPROJ) as f:
    content = f.read()

# Find the "Upload Debug Symbols to Sentry" shell-script phase block, then
# replace only its shellScript value, whatever the plugin regenerated it to.
pattern = re.compile(
    r'(name = "Upload Debug Symbols to Sentry";.*?shellScript = )"(?:[^"\\]|\\.)*"(;)',
    re.DOTALL,
)

match = pattern.search(content)
if not match:
    print("Could not find the Sentry build phase - check it manually in Xcode.")
    sys.exit(1)

new_content = pattern.sub(lambda m: m.group(1) + '"' + NOOP_SCRIPT + '"' + m.group(2), content, count=1)

with open(PBXPROJ, "w") as f:
    f.write(new_content)

print("Sentry debug-symbols phase patched to a no-op.")

XCODE_ENV = "ios/.xcode.env"
DISABLE_LINE = "export SENTRY_DISABLE_AUTO_UPLOAD=true"

with open(XCODE_ENV) as f:
    env_content = f.read()

if DISABLE_LINE not in env_content:
    lines = [
        "",
        "# No Sentry org/project configured yet - the default @sentry/react-native",
        "# build phase fails without one (\"An organization ID or slug is required\").",
        "# Skip source-map auto-upload until Sentry is actually set up.",
        DISABLE_LINE,
        "",
    ]
    env_content += "\n".join(lines)
    with open(XCODE_ENV, "w") as f:
        f.write(env_content)
    print("Source-map auto-upload disabled in .xcode.env.")
else:
    print("Source-map auto-upload already disabled in .xcode.env.")
