# Gates: fix-dialog-owner

Scope: the JS-hook dialog_policy path (background.ts) is gated to tabs this session owns (cdp.isAgentTab), matching the boundary cdp.ts already enforces for Page.enable/focus and native dialog answering. The dialogs read path stays ungated.

- [x] G1: the ownership check exists on the dialog_policy path and runs before anything is dispatched to the page (before injectMainHooks and before safeDom)
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const lines=src.split("\n");const guardLine=lines.findIndex(l=>l.includes("method === \"dialog_policy\" && !cdp.isAgentTab(id)"));const safeDomLine=lines.findIndex(l=>l.includes("await safeDom(id, method, params)"));const injectLine=lines.findIndex((l,i)=>i>guardLine&&i<safeDomLine&&l.includes("injectMainHooks(id)"));const ok=guardLine!==-1&&safeDomLine!==-1&&injectLine!==-1&&guardLine<injectLine&&injectLine<safeDomLine;console.log(ok?"PASS":"FAIL:"+JSON.stringify({guardLine,injectLine,safeDomLine}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G2: the dialogs read path is NOT gated by the new ownership check
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const guardOk=/method === "dialog_policy" && !cdp\.isAgentTab\(id\)/.test(src);const m=src.match(/if \(method === "dialogs"\) \{[\s\S]*?\n      \}/);const block=m?m[0]:"";const ungated=block.length>0&&!/isAgentTab/.test(block);console.log(guardOk&&ungated?"PASS":"FAIL:"+JSON.stringify({guardOk,blockFound:block.length>0}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G3: the error text names the offending tab id and the way out (open a session tab / browser_tabs action=new)
  CHECK: grep -A2 "Dialog control only applies to tabs this session opened" packages/extension/src/background.ts | tr -d '\n' | grep -q "Tab \${id} belongs to the user" && grep -A2 "Dialog control only applies to tabs this session opened" packages/extension/src/background.ts | tr -d '\n' | grep -q "browser_tabs action=new" && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G4: an owned tab's dialog_policy behavior is untouched - the guard only fires when isAgentTab is false, so the existing "push it even if attach failed" try/catch still runs unconditionally for owned tabs
  CHECK: grep -n -A10 'if (method === "dialog_policy") {' packages/extension/src/background.ts | grep -c "cdp.attach(id)"
  EXPECT: /^[1-9]/
  EVIDENCE: 1

- [x] G5: extension package typechecks
  CHECK: (cd packages/extension && bun run typecheck) >/dev/null 2>&1 && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS
