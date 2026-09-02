# Gates: integration

Scope: all leaves merged, whole monorepo typechecks, smoke passes, changelog states the behaviour changes, independent review finds no blocking defect.

- [x] G1: monorepo typecheck passes
  CHECK: bun run typecheck >/dev/null 2>&1 && echo TYPECHECK_ALL_OK
  EXPECT: TYPECHECK_ALL_OK
  EVIDENCE: TYPECHECK_ALL_OK

- [x] G2: smoke test passes after all edits
  CHECK: bun run smoke 2>&1 | tail -2
  EXPECT: PASS
  EVIDENCE: browser_wait | PASS

- [x] G3: CHANGELOG Unreleased lists the fixes
  CHECK: awk '/## \[Unreleased\]/{f=1;next} /^## /{f=0} f' CHANGELOG.md | grep -ci "resize\|storage.session\|Resume\|dialog"
  EXPECT: /^[4-9]|^[1-9][0-9]/
  EVIDENCE: 7

- [ ] G4: reviewer pass on the full diff finds no unresolved high-severity finding
  EVIDENCE: pending

- [ ] G5: live probe with the rebuilt extension: navigate + screenshot + resize do not change the user's active tab or window size
  EVIDENCE: pending

ABANDON: G5 Needs `bun run build` plus reloading the unpacked extension in Chrome; the user's CLAUDE.md forbids builds unless asked, and the extension loaded in Chrome is the npm 0.1.9 build, not this tree. Hand over: user runs `bun run build`, reloads chrome://extensions, then re-probe.
