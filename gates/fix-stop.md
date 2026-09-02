# Gates: fix-stop

Scope: Stop survives navigation, the overlay's own capture/status actions are never blocked by Stop, and the dialog policy reaches the MAIN world hooks that answer confirm()/prompt().

- [x] G1: overlay relays stop and resume to the background
  CHECK: grep -c "deeporax-agent-stop\|deeporax-agent-resume" packages/extension/src/content.ts
  EXPECT: /^[2-9]|^[1-9][0-9]/
  EVIDENCE: 3

- [x] G2: content script re-arms Stop on load from background state
  CHECK: grep -c "deeporax-agent-stop-state" packages/extension/src/content.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G3: overlay bookkeeping actions bypass the stop gate
  CHECK: grep -n -B 6 "stopped by the user in this tab" packages/extension/src/dom-actions.ts | grep -c "hide_for_capture\|OVERLAY_ALWAYS\|method === \"overlay\""
  EXPECT: /^[1-9]/
  EVIDENCE: 3

- [x] G4: dialog policy crosses into the MAIN world
  CHECK: grep -c "__deeporax_dialog_policy" packages/extension/src/page-hooks.ts packages/extension/src/dom-actions.ts | awk -F: '{s+=$2} END {print (s>=2)}'
  EXPECT: 1
  EVIDENCE: 1

- [x] G5: a stop marker survives a page load
  CHECK: grep -c "resetStop\|setStopped" packages/extension/src/agent-overlay.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 3

- [x] G6: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit
