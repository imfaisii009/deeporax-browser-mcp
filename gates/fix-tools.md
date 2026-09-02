# Gates: fix-tools

Scope: browser_handle_dialog can actually control alert(), and its description matches what it sends.

- [x] G1: the tool takes an alert parameter
  CHECK: grep -c "alert:" packages/mcp-server/src/tools.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 2

- [x] G2: the alert choice is threaded into the policy sent to the extension
  CHECK: grep -n -A 22 '"browser_handle_dialog"' packages/mcp-server/src/tools.ts | grep -c "alert"
  EXPECT: /^[2-9]/
  EVIDENCE: 4

- [x] G3: server typechecks and smoke passes
  CHECK: (cd packages/mcp-server && bun run typecheck) >/dev/null 2>&1 && bun run smoke 2>&1 | tail -1
  EXPECT: PASS
  EVIDENCE: PASS
