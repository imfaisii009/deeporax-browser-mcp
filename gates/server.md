# Gates: server

Scope: mcp-server reports its real version, uses the OS temp dir, and its tool text matches the new extension behaviour.

- [x] G1: server version comes from package.json, not a literal
  CHECK: grep -c 'version: "0.1.0"' packages/mcp-server/src/index.ts; grep -c "package.json" packages/mcp-server/src/index.ts
  EXPECT: /^0\n[1-9]/
  EVIDENCE: 0 | 2

- [x] G2: TMP_ROOT uses os.tmpdir()
  CHECK: grep -c "tmpdir()" packages/mcp-server/src/tmp-store.ts; grep -c '"/tmp/' packages/mcp-server/src/tmp-store.ts
  EXPECT: /^[1-9]\n0/
  EVIDENCE: 1 | 0

- [x] G3: browser_resize describes viewport emulation and 0,0 reset
  CHECK: grep -n "browser_resize" -A 6 packages/mcp-server/src/tools.ts | grep -ci "emulat"
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G4: browser_handle_dialog accepts beforeunload
  CHECK: grep -c "beforeunload" packages/mcp-server/src/tools.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 5

- [x] G5: instructions mention the Stop/Resume bar
  CHECK: grep -c "Resume" packages/mcp-server/src/index.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G6: server typechecks
  CHECK: (cd packages/mcp-server && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit

- [x] G7: smoke test passes
  CHECK: bun run smoke 2>&1 | tail -3
  EXPECT: PASS
  EVIDENCE: browser_wait | PASS
