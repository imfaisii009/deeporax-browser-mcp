# Gates: cdp

Scope: cdp.ts gains viewport emulation, focus emulation, Page.enable and CDP dialog auto-handling with the exact exports in PLAN.md.

- [x] G1: attach enables focus emulation
  CHECK: grep -c "Emulation.setFocusEmulationEnabled" packages/extension/src/cdp.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G2: attach enables the Page domain
  CHECK: grep -c '"Page.enable"' packages/extension/src/cdp.ts
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G3: setViewport and clearViewport exported
  CHECK: grep -cE "export async function (setViewport|clearViewport)\(" packages/extension/src/cdp.ts
  EXPECT: 2
  EVIDENCE: 2

- [x] G4: viewport uses device metrics override, not window resize
  CHECK: grep -c "Emulation.setDeviceMetricsOverride\|Emulation.clearDeviceMetricsOverride" packages/extension/src/cdp.ts; grep -c "windows.update" packages/extension/src/cdp.ts
  EXPECT: /^2\n0/
  EVIDENCE: 2 | 0

- [x] G5: dialog events are handled through CDP
  CHECK: grep -c "Page.javascriptDialogOpening" packages/extension/src/cdp.ts; grep -c "Page.handleJavaScriptDialog" packages/extension/src/cdp.ts
  EXPECT: /^[1-9]\n[1-9]/
  EVIDENCE: 1 | 1

- [x] G6: setDialogPolicy and takeDialogs exported with DialogPolicy/DialogRecord types
  CHECK: grep -cE "export (function (setDialogPolicy|takeDialogs)\(|type (DialogPolicy|DialogRecord) )" packages/extension/src/cdp.ts
  EXPECT: 4
  EVIDENCE: 4

- [x] G7: extension typechecks
  CHECK: (cd packages/extension && bun run typecheck) && echo TYPECHECK_OK
  EXPECT: TYPECHECK_OK
  EVIDENCE: TYPECHECK_OK | $ tsc --noEmit
