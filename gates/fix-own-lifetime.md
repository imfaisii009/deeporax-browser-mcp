# Gates: fix-own-lifetime

Scope: naming a tab (browser_tabs with sessionOnly:false, resolveTabId, getTab) must never equal owning it. Three background.ts operations that change a named tab's lifetime, rendering, or resource behavior are gated to cdp.isAgentTab, matching the boundary dialog_policy already enforces. Reading and clicking a named tab stays intentionally ungated.

- [x] G1: the tabs close guard exists and runs before chrome.tabs.remove
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const lines=src.split("\n");const guardLine=lines.findIndex(l=>l.includes("this session can only close tabs it opened"));const removeLine=lines.findIndex((l,i)=>i>guardLine&&l.includes("await chrome.tabs.remove(id)"));const ok=guardLine!==-1&&removeLine!==-1&&guardLine<removeLine;console.log(ok?"PASS":"FAIL:"+JSON.stringify({guardLine,removeLine}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G2: the resize guard exists and runs before both cdp.clearViewport (the 0,0 path) and cdp.setViewport
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const lines=src.split("\n");const guardLine=lines.findIndex(l=>l.includes("this session can only resize tabs it opened"));const clearLine=lines.findIndex((l,i)=>i>guardLine&&l.includes("await cdp.clearViewport(id)"));const setLine=lines.findIndex((l,i)=>i>guardLine&&l.includes("await cdp.setViewport(id"));const ok=guardLine!==-1&&clearLine!==-1&&setLine!==-1&&guardLine<clearLine&&clearLine<setLine;console.log(ok?"PASS":"FAIL:"+JSON.stringify({guardLine,clearLine,setLine}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G3: the asset-blocking re-apply in chrome.tabs.onUpdated is gated on cdp.isAgentTab and skips (return) rather than throws
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const lines=src.split("\n");const listenerIdx=lines.findIndex(l=>l.includes("chrome.tabs.onUpdated.addListener"));const guardIdx=lines.findIndex((l,i)=>i>listenerIdx&&l.includes("if (!cdp.isAgentTab(tabId)) return;"));const throwsInGuard=guardIdx!==-1&&lines[guardIdx].includes("throw");const ok=listenerIdx!==-1&&guardIdx!==-1&&guardIdx>listenerIdx&&(guardIdx-listenerIdx)<10&&!throwsInGuard;console.log(ok?"PASS":"FAIL:"+JSON.stringify({listenerIdx,guardIdx,throwsInGuard}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G4: reading and clicking a named tab stay ungated - screenshot, the click/type interaction block, and the snapshot/get_text block (which shares code with dialog_policy) carry no unconditional isAgentTab check
  CHECK: node -e 'const fs=require("fs");const src=fs.readFileSync("packages/extension/src/background.ts","utf8");const lines=src.split("\n");function idx(re,from){return lines.findIndex((l,i)=>(from===undefined||i>from)&&re.test(l));}const shotStart=idx(/^\s*case "screenshot": \{/);const clickStart=idx(/^\s*case "click":/, shotStart);const evalStart=idx(/^\s*case "evaluate": \{/, clickStart);const dialogsBlockStart=idx(/^\s*case "snapshot":/, evalStart);const actMatchesStart=idx(/^\s*case "act_matches": \{/, dialogsBlockStart);const shotBlock=lines.slice(shotStart, clickStart).join("\n");const clickBlock=lines.slice(clickStart, evalStart).join("\n");const dialogsBlock=lines.slice(dialogsBlockStart, actMatchesStart);const codeLines=dialogsBlock.filter(l=>!/^\s*\/\//.test(l));const badLines=codeLines.filter(l=>/isAgentTab/.test(l) && !/dialog_policy/.test(l));const ok=[shotStart,clickStart,evalStart,dialogsBlockStart,actMatchesStart].every(x=>x!==-1)&&!/isAgentTab/.test(shotBlock)&&!/isAgentTab/.test(clickBlock)&&badLines.length===0;console.log(ok?"PASS":"FAIL:"+JSON.stringify({shotStart,clickStart,evalStart,dialogsBlockStart,actMatchesStart,badLines}));'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G5: extension package typechecks
  CHECK: (cd packages/extension && bun run typecheck) >/dev/null 2>&1 && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS
