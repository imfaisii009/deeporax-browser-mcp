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

- [x] G4: reviewer pass on the full diff finds no unresolved high-severity finding
  EVIDENCE: MET. Final judgment pass. The two findings the previous pass left
  open are now fixed and verified in the live source, each guard sitting
  *before* the effect it guards:

  1. `browser_tabs action=close`: background.ts:920 `if (!cdp.isAgentTab(id))
  throw new Error(...)` runs before `chrome.tabs.remove(id)` at
  background.ts:925, and `cdp.releaseAgentTab(id)` is called right after.

  2. `browser_resize`: background.ts:1431 `if (!cdp.isAgentTab(id)) throw
  new Error(...)` runs before `assertScriptable`, before the `width===0 &&
  height===0` clear branch (background.ts:1445-1446), and before
  `cdp.setViewport(id, ...)` (background.ts:1453).

  The three previously-fixed defects re-verified and still hold: (a)
  ownership claim — the only two call sites of `cdp.setAgentTab` remain
  `createBackgroundTab()` (background.ts:1870, right after `chrome.tabs.create`)
  and the `onReplaced` reclaim (background.ts:2014-2017), which reads
  `cdp.isAgentTab(removedTabId)` *before* `cdp.forget()` clears it and only
  re-claims `if (wasAgentTab)`; `rememberTab()` (background.ts:287-292) still
  makes no `setAgentTab` call, comment explains why. (b) native fallback —
  `page-hooks.ts`'s `policy()` returns `window.__deeporaxDialogPolicy`
  (undefined until `dialog_policy` runs), each stub captures the native
  function first and falls through to it when unset; `prime()` (cdp.ts:134)
  and the `Page.javascriptDialogOpening` listener (cdp.ts:803) both
  independently gate on `agentTabs.has(tabId)`. (c) dialog-policy gate —
  `case "dialog_policy"` (background.ts:1137) throws unless
  `cdp.isAgentTab(id)`, before `assertScriptable`/`injectMainHooks` and the
  `cdp.setDialogPolicy`/`safeDom(id, "dialog_policy", ...)` calls that follow.

  A fourth guard, not previously enumerated, was found already fixed in this
  same diff and independently verified: the `chrome.tabs.onUpdated`
  asset-blocking re-arm listener now has `if (!cdp.isAgentTab(tabId))
  return;` at background.ts:2030, before the owned-group lookup and before
  the fallthrough `void applyAssetBlocking(tabId)` at background.ts:2057.
  This closes the "lower-severity" gap the previous pass left open, where
  `rememberTab()` setting `currentTabId` for *any* named tab let a
  merely-named tab (e.g. via `evaluate`) get heavy-asset blocking applied on
  its future navigations. The `currentTabId` bookkeeping is unchanged and
  still not an ownership claim, but this listener no longer reaches it for a
  non-owned tab id at all.

  Read/click paths confirmed still ungated (the product's intended power):
  `screenshot` (background.ts:953, own case, no guard), `snapshot`,
  `get_text`, `get_html`, `file_upload`, `overlay`, and `dialogs` share one
  switch case with `dialog_policy` but the ownership check is scoped to
  `method === "dialog_policy"` only (background.ts:1137), so those six stay
  open on any named tab; `evaluate`, `navigate`, `back`/`forward`/`reload`,
  and the click/type/press_key/hover/scroll/drag/select_option/fill_form
  block only gained `assertNotStopped` (the unrelated Stop feature in this
  same diff), no ownership check.

  Step 2 hunt, across the whole uncommitted diff (`agent-overlay.ts`,
  `background.ts`, `cdp.ts`, `content.ts`, `dom-actions.ts`, `page-hooks.ts`,
  `packages/mcp-server/src/tools.ts` — `popup.ts`, `mcp-server/index.ts` and
  `mcp-server/tmp-store.ts` carry no uncommitted changes this round) plus the
  specific areas named as unlooked-at, found nothing of comparable severity:
  - Popup message handlers (popup.ts): only `get-status` / `reconnect` /
    `set-block-heavy-assets`, none touch a tabId.
  - WebSocket/bridge surface (background.ts `connect()`/`onServerMessage`,
    lines 73-152): dispatches into the same `handleMethod`/`handleMethodInner`
    already audited above; no separate tab-ownership decision is made here.
  - First-install/welcome path (background.ts:2079-2085): the
    `chrome.tabs.create` for `INSTALL_WELCOME_URL` never calls
    `cdp.setAgentTab`, so that tab is not agent-owned and stays exempt from
    close/resize/dialog control, as intended.
  - `chrome.debugger.onDetach` (cdp.ts:855-861, background.ts:1970-1975):
    only clears `attached`/`viewportOverridden`/`netEnabled`/
    `fetchBlockedTabs` bookkeeping; never grants or changes `agentTabs`
    membership.
  - `chrome.debugger.onEvent` (cdp.ts network handlers): unchanged by this
    diff, carries no tab-ownership logic; the one `onEvent` branch this diff
    touches is the dialog listener already covered under (b) above.
  - Session teardown: no explicit session-end message exists; cleanup runs
    through `chrome.tabs.onRemoved` (background.ts:1976-1990), which already
    calls `cdp.releaseAgentTab(tabId)` and clears `currentTabId`.
  - mcp-server tab-id resolution (`tools.ts`, `index.ts`, `tmp-store.ts`):
    the `tools.ts` diff only adds an `alert: "accept"|"dismiss"` option to
    the `dialog_policy` tool input; `index.ts` and `tmp-store.ts` contain no
    tab-id logic at all — tab resolution is entirely `resolveTabId()` on the
    extension side, already covered above.
  - `case "batch"` (background.ts:1463+): re-enters `handleMethod` per
    sub-action, so a nested `resize`/`close`/`dialog_policy` still hits the
    same switch-case guards — no bypass.
  - `interact.ts`/`dom-channel.ts` (the shared `safeDom`/`domCall` plumbing
    behind `fill_form`/`field_probe`/`field_force_set`): never passes
    `"dialog_policy"`, `"resize"`, or `"close"` as a method, so it cannot
    reach a guarded effect around the switch-case checks.

  No unresolved finding of this class remains. G4 met.

- [ ] G5: live probe with the rebuilt extension: navigate + screenshot + resize do not change the user's active tab or window size
  EVIDENCE: pending

ABANDON: G5 Needs `bun run build` plus reloading the unpacked extension in Chrome; the user's CLAUDE.md forbids builds unless asked, and the extension loaded in Chrome is the npm 0.1.9 build, not this tree. Hand over: user runs `bun run build`, reloads chrome://extensions, then re-probe.
