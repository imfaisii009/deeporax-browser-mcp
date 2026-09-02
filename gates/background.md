# Gates: background

Scope: background.ts stops disturbing the user's window, persists sessions across service-worker restarts, routes dialogs and resize through cdp.ts per PLAN.md contract.

- [x] G1: groups are expanded only when created
  CHECK: grep -c "collapsed: false" packages/extension/src/background.ts
  EXPECT: 1
  EVIDENCE: 1

- [x] G2: agent tabs are not discardable
  CHECK: grep -c "autoDiscardable: false" packages/extension/src/background.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G3: replaced tabs are remapped
  CHECK: grep -c "tabs.onReplaced" packages/extension/src/background.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G4: sessions persist in chrome.storage.session and are awaited before handling
  CHECK: grep -c "storage.session" packages/extension/src/background.ts; grep -c "await sessionsReady" packages/extension/src/background.ts
  EXPECT: /^[1-9]\n[1-9]/
  EVIDENCE: 2 | 2

- [x] G5: no implicit last-session fallback
  CHECK: grep -c "activeSessionId" packages/extension/src/background.ts
  EXPECT: 0
  EVIDENCE: 0

- [x] G6: resize emulates the viewport and never resizes the window
  CHECK: grep -c "windows.update" packages/extension/src/background.ts; grep -c "cdp.setViewport\|cdp.clearViewport" packages/extension/src/background.ts
  EXPECT: /^0\n[1-9]/
  EVIDENCE: 0 | 2

- [x] G7: tab creation targets the session's window and survives having no window
  CHECK: grep -c "windows.create" packages/extension/src/background.ts; grep -c "windowId" packages/extension/src/background.ts
  EXPECT: /^[1-9]\n[1-9]/
  EVIDENCE: 1 | 8

- [x] G8: dialog policy and dialog log go through cdp
  CHECK: grep -c "cdp.setDialogPolicy" packages/extension/src/background.ts; grep -c "cdp.takeDialogs" packages/extension/src/background.ts
  EXPECT: /^[1-9]\n[1-9]/
  EVIDENCE: 1 | 1

- [x] G9: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit
