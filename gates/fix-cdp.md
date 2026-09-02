# Gates: fix-cdp

Scope: cdp.ts only touches tabs the agent owns — no Page.enable, focus emulation, dialog answering or viewport override on the user's own tabs — and viewport overrides are cleaned up.

- [x] G1: cdp tracks agent-owned tabs and exports the setters
  CHECK: grep -cE "export function (setAgentTab|releaseAgentTab)\(" packages/extension/src/cdp.ts
  EXPECT: 2
  EVIDENCE: 2

- [x] G2: prime() only runs on owned tabs
  CHECK: grep -n -A 12 "async function prime" packages/extension/src/cdp.ts | grep -c "agentTabs.has\|isAgentTab"
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G3: the dialog listener ignores tabs the agent does not own
  CHECK: grep -n -A 12 "Page.javascriptDialogOpening" packages/extension/src/cdp.ts | grep -c "agentTabs.has\|isAgentTab"
  EXPECT: /^[1-9]/
  EVIDENCE: 2

- [x] G4: viewport override is cleared when a tab is forgotten or released
  CHECK: grep -n -A 10 "export function forget" packages/extension/src/cdp.ts | grep -c "viewport\|Viewport"
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G5: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit
