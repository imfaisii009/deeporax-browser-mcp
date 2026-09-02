# Gates: fix-background

Scope: the user's Stop lives in the background, survives navigation and service-worker restarts,
gates every CDP-driven action, and cdp only takes over tabs the agent owns.

- [x] G1: background answers the three stop messages from the content script
  CHECK: grep -c -e 'deeporax-agent-stop' -e 'deeporax-agent-resume' -e 'deeporax-agent-stop-state' packages/extension/src/background.ts
  EXPECT: /^[3-9]/
  EVIDENCE: 3

- [x] G2: per-tab stop state is persisted in chrome.storage.session, not only in memory
  CHECK: grep -n -A 4 'STOPPED_KEY' packages/extension/src/background.ts | grep -c 'storage.session'
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G3: CDP-driven input is refused while the tab is stopped
  CHECK: grep -n -B 6 -e 'case "click_xy"' -e 'case "press_key"' packages/extension/src/background.ts | grep -c -i 'stop'
  EXPECT: /^[1-9]/
  EVIDENCE: 2

- [x] G4: cdp ownership is claimed for agent tabs and released when they go away
  CHECK: grep -c -e 'setAgentTab' -e 'releaseAgentTab' packages/extension/src/background.ts
  EXPECT: /^[2-9]/
  EVIDENCE: 4

- [x] G5: stopping a tab is cleared only by the user, never by navigation
  CHECK: grep -n -A 8 'deeporax-agent-resume' packages/extension/src/background.ts | grep -c -e 'delete' -e 'false'
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G6: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) >/dev/null 2>&1 && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G7: evaluate and resize refuse to run while the tab is stopped
  CHECK: grep -n -A 12 -e 'case "evaluate"' -e 'case "resize"' packages/extension/src/background.ts | grep -c 'assertNotStopped'
  EXPECT: /^[2-9]/
  EVIDENCE: 2

- [x] G8: read-only observation still works while stopped
  CHECK: grep -n -A 10 -e 'case "screenshot"' -e 'case "snapshot"' packages/extension/src/background.ts | grep -c 'assertNotStopped'
  EXPECT: ^0$
  EVIDENCE: 0

- [x] G9: rememberTab no longer claims cdp ownership (naming a tabId is not handing it over)
  CHECK: awk '/^function rememberTab\(/,/^}/' packages/extension/src/background.ts | grep -c 'setAgentTab'
  EXPECT: ^0$
  EVIDENCE: 0

- [x] G10: ownership is claimed only at tab-creation / user-gesture sites (createBackgroundTab, the sole
  function that creates an agent tab — covering openTabForSession and the tabs action "new" path that
  calls it — and the tabs.onReplaced re-claim, which is guarded by isAgentTab(removedTabId) so it only
  carries forward a claim that already existed). No popup-driven "use this tab" gesture exists in
  popup.ts, so no site was added for one.
  CHECK: grep -c 'cdp\.setAgentTab(' packages/extension/src/background.ts
  EXPECT: ^2$
  EVIDENCE: 2
