# Gates: overlay

Scope: user-side Resume after Stop, clearer stop error for the agent, honest popup hint.

- [x] G1: overlay bar offers a Resume button after Stop
  CHECK: grep -c "Resume" packages/extension/src/agent-overlay.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 2

- [x] G2: Resume calls resetStop and dispatches __deeporax_agent_resume
  CHECK: grep -c "__deeporax_agent_resume" packages/extension/src/agent-overlay.ts; grep -c "resetStop\|stopped = false" packages/extension/src/agent-overlay.ts
  EXPECT: /^[1-9]\n[1-9]/
  EVIDENCE: 1 | 4

- [x] G3: stop error tells the agent about the Resume button and not to retry
  CHECK: grep -n "stopped by the user" packages/extension/src/dom-actions.ts | grep -c "Resume"
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G4: popup hint no longer promises the user's current tab
  CHECK: grep -c "snapshot my current tab" packages/extension/src/popup.ts
  EXPECT: 0
  EVIDENCE: 0

- [x] G5: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit
