# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Native `alert`/`confirm`/`prompt`/`beforeunload` dialogs are answered by
  the debugger (`Page.javascriptDialogOpening`) per the `browser_handle_dialog`
  policy and recorded, so a dialog on a strict-CSP page can no longer freeze
  the tab for the full command timeout
- `browser_handle_dialog` accepts `beforeunload` (default: leave the page)
- The on-page bar shows a **Resume** button after the user presses Stop; the
  agent still cannot clear a Stop itself
- Agent tabs get `Emulation.setFocusEmulationEnabled` so pages that check
  `document.hasFocus()` behave while the tab stays in the background
- `browser_act_matches`: one-shot click/hover/type on every element matching a
  text/role pattern (for repeated Reply/Follow/checkbox UIs) instead of N
  screenshot or click loops
- Snapshots list **REPEATED PATTERNS** (role+name groups with counts and sample
  refs) and MCP instructions steer agents toward snapshot + act_matches over
  screenshot-driven loops
- `browser_find` accepts optional `role` and `exactName` filters
- Popup toggle **Block heavy assets** (on by default; user can turn off): agent
  tabs fail Image, Media, and Font requests via CDP Fetch so pages reach a
  usable DOM faster. Document, script, XHR/fetch, and stylesheets still load.
  Preference is stored in `chrome.storage.local` and re-armed on navigation for
  session tabs
- Opening the extension for the first time opens
  `https://store.deeporax.com/browser-mcp`
- Each chat gets its own `sessionId`, current tab, and Chrome tab group
  (distinct color). Isolation keys off `CLAUDE_CODE_SESSION_ID` (and similar
  host env vars) so two chats sharing one MCP process still stay separate; falls
  back to process id only when no conversation id is present
- A second chat no longer inherits or steals the first chat's tabs;
  `browser_tabs` list defaults to this session only
- Tab group titles are short topics from the URL (e.g. `X · post`) or optional
  `groupLabel` on navigate/tabs
- `browser_tabs` action=list accepts `sessionOnly` (default true for isolation)
- MCP instructions and `browser_status` now spell out anti-loop rules: never
  retry a dead tab id, treat `navigated:false` and `trusted:false` as stop
  signals, keep waits short, re-snapshot after DOM changes

### Fixed

- Answering a page's dialogs automatically is now limited to tabs the session
  opened. `browser_handle_dialog` used to reach a named tab's dialog policy
  through a path that never checked ownership, so pointing the agent at one
  of the user's own tabs could still arm dialog auto-answering there
- The debugger no longer takes over dialogs or focus on a tab the agent does
  not own. Previously, a tab the agent had merely screenshotted or read could
  lose Chrome's native "Leave site? Changes you made may not be saved" prompt
  for the rest of its life, with the extension silently answering it instead
  — a data-loss risk on the user's own tabs. Chrome's own dialogs and focus
  behavior are now left alone on non-agent tabs. The rule is tighter now too:
  a tab only becomes agent-controlled when the extension opened it for that
  session, so pointing the agent at an existing tab by id lets it read and
  click that tab but leaves that tab's own dialogs and focus alone
- The agent can no longer close or resize a tab the session did not open.
  `browser_tabs action=close` and `browser_resize` used to act on any tab id
  the agent named, including one it was only pointed at, so it could end a
  user tab's lifetime or warp its rendered size. Both now refuse unless the
  session opened that tab. Heavy-asset blocking also no longer follows the
  agent onto one of the user's own tabs it merely named
- Viewport emulation from `browser_resize` is now cleared automatically when
  the agent lets go of a tab, instead of leaving the page rendered at a
  warped size forever
- `browser_handle_dialog` can now actually control `alert()`. It gained an
  `alert: "accept" | "dismiss"` option, and the choice is really sent to the
  page instead of being dropped
- The dialog policy now reaches the page's own `alert`/`confirm`/`prompt`. It
  used to be written into the content script's isolated world while the code
  answering the dialog ran in the page's main world, so `accept` and
  `promptText` never took effect and the dialog log always came back empty
- Ordinary browsing is no longer affected by the extension. With the
  extension installed but no agent working on a page, that page's own
  `alert`, `confirm`, and `prompt` behave normally and the user's own answer
  stands. Previously `confirm()` was answered yes silently on every page,
  agent-controlled or not
- Stop now survives navigation and a service-worker restart. It is
  remembered per tab in the background and re-armed on every page load, so
  the agent cannot resume just because the page changed. Only the user's
  Resume clears it
- Stop now also blocks the actions the background drives directly through
  the debugger — coordinate clicks, key presses, navigation, back/forward/
  reload, script evaluation, and resize. These used to bypass the on-page
  Stop entirely. Read-only calls (snapshot, text, screenshot, console,
  network, status, tabs) keep working so the agent can still report that it
  was stopped
- Screenshots keep working after a Stop: the overlay's own status and
  hide/restore calls are no longer blocked by the Stop gate
- Sessions (current tab, group, title, color) now persist in
  `chrome.storage.session`, so a service-worker restart no longer opens a new
  tab and group on the next navigate
- `browser_resize` emulates the viewport on the agent tab via the debugger
  instead of resizing the user's browser window; `0,0` clears the emulation
- Session tab groups are expanded only when created; the agent no longer
  re-expands a group the user collapsed on every action
- New agent tabs open in the window that already holds the session's group,
  are marked `autoDiscardable:false` so Chrome does not discard them under
  memory pressure, and `tabs.onReplaced` remaps a swapped tab id
- If no normal window exists, navigate creates an unfocused window instead of
  failing
- Removed the implicit "last session" fallback in the background: every call
  is keyed by its own `sessionId`
- MCP server reports the package version instead of `0.1.0`
- Temp artifacts use `os.tmpdir()` instead of a hardcoded `/tmp` path
- Popup hint no longer suggests snapshotting the user's current tab
- Agent navigate / new-tab / screenshot no longer steal focus from the tab you
  are using. Work continues in the session group in the background; only the
  install welcome page still opens focused
- Stale or closed tab ids are rejected immediately with a clear error instead of
  being remembered and retried. Resolution falls back to the Deeporax session
  group before the last-focused window (which is often the IDE, not the task)
- Navigate no longer burns a 30s bridge timeout on a hung load. It waits up to
  15s, then returns the actual URL with `loadTimedOut` / `navigated` so agents
  can stop looping on a false success
- `browser_wait` defaults and hard caps are tighter (default 10s, max 20s) so
  idle waits cannot park the extension for a full minute

### Fixed (earlier)

- A debugger conflict no longer blocks interaction. When DevTools is open on a tab,
  or another debugger owns it, clicks, typing and the rest now run as synthetic
  events from the isolated world, and the result says the input was untrusted and
  why, instead of the call failing. Typing that way is written through the native
  value setter and read back, and modifier chords report that they cannot run
  rather than looking like they worked
- `chrome.debugger.attach` reporting "already attached" was taken as success even
  when DevTools owned the session, so every later command failed with a misleading
  "the session dropped, this input may or may not have been delivered". The
  extension now probes the session to find out whether it is really ours
- Network capture and trusted input each kept their own record of which tabs were
  attached, so the two paths could fight over one tab. They now share one

### Added (earlier)

- Setup instructions for Cursor, Windsurf, VS Code (Copilot), Zed, Cline, Roo Code,
  Continue, Gemini CLI, Codex CLI, opencode, Goose, JetBrains, Warp, and LM Studio,
  plus ready-made config files in `configs/`
- Runner options for Bun, pnpm, Yarn, Deno, and global installs
- Troubleshooting section covering the common failure modes

## [0.1.2] - 2026-07-31

### Fixed

- The published package pointed users at `packages/extension/dist`, a monorepo path
  that does not exist in an npm install. Tools now report the real bundled folder
- A stale server from an earlier session could hold the bridge port forever. A
  starting server now asks the incumbent to yield, then binds
- `bin` used `./dist/index.js`, which npm rejected and silently dropped on publish,
  leaving the package with no runnable command

### Added

- Brand-matched extension icon
- `release` script that bumps every version file in lockstep
- Publish on push to `main` when the version changes

## [0.1.0] - 2026-07-31

Initial public release.

### Added

- MCP server (`deeporax-browser-mcp`) with stdio transport for Claude Code / Claude Desktop
- Chrome MV3 extension with WebSocket bridge on `127.0.0.1:17373`
- 32 browser tools: navigate, tabs, snapshot, screenshot, click, click_xy, type,
  press_key, hover, drag, select_option, scroll, wait, evaluate, find, get_text,
  get_html, get_bounding_box, fill_form, file_upload, highlight, console, network,
  handle_dialog, resize, batch, overlay, clear_tmp, back, forward, reload, status
- Accessibility-style DOM snapshots with stable element refs (`e1`, `e2`, ...)
- Viewport PNG screenshots via `captureVisibleTab`
- Agent control overlay: pulsing orange border, status pill with a Stop button, and a
  synthetic cursor that animates to each target before the click fires
- Console and network capture per tab, with regex filtering
- Snapshots and screenshots written to `/tmp/deeporax-browser-mcp`, auto-pruned after
  30 minutes and capped at 40 files per kind
- npm-publishable package that bundles the unpacked extension
- Example MCP host configs under `configs/`
- CI workflow (typecheck, smoke, pack dry-run)
- Release workflow (npm publish + extension zip asset)

[Unreleased]: https://github.com/imfaisii009/deeporax-browser-mcp/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/imfaisii009/deeporax-browser-mcp/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/imfaisii009/deeporax-browser-mcp/releases/tag/v0.1.0
