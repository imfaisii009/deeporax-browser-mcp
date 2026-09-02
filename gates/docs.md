# Gates: docs

Scope: README and store listing match the new behaviour (viewport emulation, dialog handling, Stop/Resume, session persistence, OS temp dir).

- [x] G1: README no longer says resize changes the browser window
  CHECK: grep -ci "resize the browser window\|resizes the window" README.md
  EXPECT: /^0/
  EVIDENCE: 0

- [x] G2: README documents the Stop/Resume bar
  CHECK: grep -c "Resume" README.md
  EXPECT: /^[1-9]/
  EVIDENCE: 2

- [x] G3: no hardcoded /tmp path claim in user-facing docs
  CHECK: grep -c "/tmp/deeporax-browser-mcp" README.md docs/chrome-web-store-listing.md | awk -F: '{s+=$2} END {print s}'
  EXPECT: /^0$/
  EVIDENCE: 0

- [x] G4: store listing states the agent works in its own background tab group and does not take over the user's tab
  CHECK: grep -ci "background" docs/chrome-web-store-listing.md
  EXPECT: /^[1-9]/
  EVIDENCE: 1
