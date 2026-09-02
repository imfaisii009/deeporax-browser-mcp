# PLAN: deeporax-browser-mcp reliability audit and fixes (unlazy, tree 5, orchestrated)

Goal: the agent never disturbs the tab or window the user is working in, state survives
service-worker restarts, native dialogs cannot freeze a tab, and the server is portable.

## Audit findings (HEAD 41a8974, extension 0.1.21)

Installed extension in the user's Chrome is **0.1.9** (`~/.bun/install/global/node_modules/deeporax-browser-mcp`),
twelve releases behind HEAD. Some complaints may be that stale build. HEAD still has these loose ends:

Focus / window
- F1 `placeInSessionGroup` sends `collapsed:false` on every call. Re-expands the group the user collapsed, every action.
- F2 `resize` calls `chrome.windows.update` on the window that holds the agent tab = the user's window.
- F3 `openTabForSession` ignores which window the session group lives in; with no normal window it throws.
- F4 Agent tabs are discardable. Chrome discards background tabs under memory pressure; content script + debugger vanish, `onReplaced` is not handled.
- F5 No focus emulation: pages that check `document.hasFocus()` misbehave in a background tab.

State
- S1 `sessions` map lives only in service-worker memory. SW restart => next navigate opens a new tab + group (tab sprawl, orphan groups).
- S2 `activeSessionId` global is mutated inside `sessionOf()`; any caller that omits sessionId gets whichever session ran last.

Dialogs / stop
- D1 alert/confirm/prompt/beforeunload are stubbed only by MAIN-world hooks injected via `new Function`, which strict-CSP pages block. A real dialog then blocks CDP for the 30 s command timeout.
- D2 Overlay Stop has no user-side resume; only a page reload clears it. Agent error text says "ask them to resume" with no way to do so.

Server
- V1 `index.ts` reports version `0.1.0`; package is 0.1.21.
- V2 `TMP_ROOT` is hardcoded `/tmp/...` (breaks on Windows).
- V3 Tool text: `browser_resize` says it resizes the window; popup hint says "snapshot my current tab" which the agent cannot do by design.

Known, not fixed (Chrome limits): debugger infobar appears in the window holding the agent tab; rAF and timers throttle in hidden tabs. Heavy-asset blocking is on by default, so screenshots lack images (user toggle exists).

## Tree (depth 5)

1 Reliable extension
  1.1 Focus discipline ................ leaves: cdp (F2 API, F5), background (F1–F4)
    1.1.1 tab/group placement (F1, F3)      1.1.1.x grep gates + typecheck
    1.1.2 viewport emulation (F2)
    1.1.3 discard protection (F4)
    1.1.4 focus emulation (F5)
  1.2 State survival .................. leaf: background (S1, S2)
    1.2.1 chrome.storage.session persistence
    1.2.2 explicit session ids only
  1.3 Dialogs and Stop ................ leaves: cdp (D1 API), background (D1 routing), overlay (D2)
    1.3.1 CDP dialog auto-handling
    1.3.2 Resume button on overlay
  1.4 Server hygiene .................. leaf: server (V1–V3)
  1.5 Integration ..................... leaf: integration (branch gates)

## Contract (interfaces; leaves must match exactly)

### cdp.ts (leaf `cdp`) — new exports
```ts
export async function setViewport(tabId: number, size: { width: number; height: number }): Promise<void>;
  // Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor: 0, mobile: false }
export async function clearViewport(tabId: number): Promise<void>;
  // Emulation.clearDeviceMetricsOverride
export type DialogPolicy = { alert?: "accept" | "dismiss"; confirm?: boolean; prompt?: string | null; beforeunload?: boolean };
export function setDialogPolicy(tabId: number, policy: DialogPolicy): DialogPolicy; // merges, returns effective
export type DialogRecord = { type: string; message: string; ts: number; handled: "accept" | "dismiss"; promptText?: string; via: "cdp" };
export function takeDialogs(tabId: number, clear?: boolean): DialogRecord[];
```
attach() side effects after a successful attach (both fresh and "already attached, ours"):
`Page.enable`, `Emulation.setFocusEmulationEnabled {enabled:true}` (both best-effort, errors swallowed).
`Page.javascriptDialogOpening` handler: default policy accept everything (confirm true, prompt returns defaultPrompt, beforeunload accept); records a DialogRecord (cap 50 per tab); calls `Page.handleJavaScriptDialog`.

### background.ts (leaf `background`)
- `sessionOf(sessionId: string)` requires an id; `activeSessionId` deleted. Every caller passes `sid`.
- Sessions persisted to `chrome.storage.session` under key `sessions` (object keyed by sessionId, same AgentSession shape). Loaded once at SW start into a `sessionsReady` promise; `handleMethod` and `tabs.onRemoved` await it. Saved (fire-and-forget) at the end of every handleMethod and in onRemoved/onReplaced.
- `placeInSessionGroup`: `collapsed:false` only when a group is created. On reuse, update title/color only if changed; never touch `collapsed`.
- `openTabForSession`: create the tab in the window of the session's existing group when it exists (`windowId`); if `chrome.tabs.create` fails because no normal window exists, `chrome.windows.create({ url, focused: false })` and continue. After creating, `chrome.tabs.update(id, { autoDiscardable: false })`.
- `chrome.tabs.onReplaced(added, removed)`: remap `currentTabId` in every session, move net/fetch bookkeeping, `cdp.forget(removed)`.
- `resize`: `cdp.attach` then `cdp.setViewport`; width/height 0 => `cdp.clearViewport`; never `chrome.windows.update`. If attach fails, throw the attach reason.
- `dialog_policy`: also `cdp.setDialogPolicy(id, policy)` (best-effort attach first). `dialogs`: merge `cdp.takeDialogs(id, clear)` into the page list.
- Stop message from content script (`{type:"agent-stopped"}`) is optional; not required.

### agent-overlay.ts / dom-actions.ts / popup.ts (leaf `overlay`)
- After Stop, the bar shows a `Resume` button (user-only). Clicking it calls `resetStop()`, restores the label, dispatches `__deeporax_agent_resume`.
- Stop error text: "Agent control was stopped by the user in this tab. They can press Resume on the on-page bar; do not retry until they do."
- `browser_overlay` tool keeps show/status only (agent cannot resume — deliberate).
- popup hint: `open example.com and take a snapshot`.

### mcp-server (leaf `server`)
- `index.ts`: version read from `../package.json` relative to `dist/` (`path.resolve(__dirname, "..", "package.json")`), fallback "0.0.0".
- `tmp-store.ts`: `TMP_ROOT = join(os.tmpdir(), "deeporax-browser-mcp")`.
- `tools.ts`: `browser_resize` text = viewport emulation on the agent tab via the debugger, user's window untouched, `width:0,height:0` clears; `browser_handle_dialog` gains `beforeunload: boolean` (default true) and says native dialogs are also auto-handled by the debugger; instructions gain one sentence about the on-page Stop/Resume bar.

## Status log (append only)
- 2026-09-02 plan written; wave 1 = cdp, overlay, server (parallel); wave 2 = background; wave 3 = integration.
- 2026-09-02 wave 1 done: cdp 7/7, overlay 5/5, server 7/7. prime() switched to raw sendCommand (reattach recursion guard). background leaf + wave-1 reviewer dispatched.
- 2026-09-02 wave-1 review: 2 red (dead cdp exports until background wires them: expected, in progress), 1 yellow (default dialog auto-accept: kept, matches existing page hooks; agent tabs only), 1 yellow (tools.ts /tmp text) fixed with TMP_ROOT.
- 2026-09-02 background 9/9; parent hardened resize-clear, tab-create retry without windowId, onReplaced/onUpdated await hydration. Integration G1-G3 met. G5 abandoned (build forbidden without ask). Background reviewer pending.
- 2026-09-02 an adversarial multi-agent review of the reliability pass ran, and it produced 7 confirmed findings (5 high, 2 medium) after 6 candidate findings were refuted. Four fix leaves ran to close the confirmed findings: cdp (agent-tab ownership so the debugger only owns dialogs and focus on tabs the agent actually controls, plus viewport-emulation cleanup on tab release), the stop/dialog bridge (content, overlay, dom-actions, page-hooks — carrying the dialog policy into the page's own `alert`/`confirm`/`prompt`, and making Stop persist across navigation and block debugger-driven actions), tools (the `alert` accept/dismiss policy), and background (per-tab persisted stop state, CDP action gating, and the cdp ownership wiring). The gate files all came back met: `gates/fix-cdp.md` (5), `gates/fix-stop.md` (6), `gates/fix-tools.md` (3), and `gates/fix-background.md` (8). `gates/integration.md` G5 remains ABANDONED, because verifying the live behavior needs a build plus reloading the unpacked extension in Chrome, and the user's instructions forbid that without an explicit ask.
