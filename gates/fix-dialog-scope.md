# Gates: fix-dialog-scope

Scope: page-hook alert/confirm/prompt stubs only answer for the agent, never silently for the user; agent-owned tabs still never hang on a dialog.

- [x] G1: with no policy set, the stubs call the captured native alert/confirm/prompt and return their real result (not a forced true)
  CHECK: node -e 'const fs=require("fs");const vm=require("vm");const src=fs.readFileSync("packages/extension/src/page-hooks.ts","utf8");const m=src.match(/MAIN_WORLD_HOOKS = `([\s\S]*)`;\s*$/);if(!m){console.log("FAIL_NO_EXTRACT");process.exit(1)}const hookSrc=m[1];const calls={alert:0,confirm:0,prompt:0};const listeners={};const win={};win.window=win;win.location={href:"https://example.com"};win.console={log(){},info(){},warn(){},error(){},debug(){}};win.CustomEvent=function(type,init){this.type=type;this.detail=init&&init.detail};win.addEventListener=function(name,fn){(listeners[name]=listeners[name]||[]).push(fn)};win.dispatchEvent=function(ev){(listeners[ev.type]||[]).forEach(function(fn){fn(ev)})};win.alert=function(msg){calls.alert++;return undefined};win.confirm=function(msg){calls.confirm++;return false};win.prompt=function(msg,def){calls.prompt++;return "NATIVE_PROMPT_RESULT"};try{vm.runInContext(hookSrc, vm.createContext(win));const confirmResult=win.confirm("Delete everything?");const promptResult=win.prompt("q","d");win.alert("hi");const ok = calls.confirm===1 && confirmResult===false && calls.prompt===1 && promptResult==="NATIVE_PROMPT_RESULT" && calls.alert===1 && win.__deeporaxDialogs && win.__deeporaxDialogs.length===3;console.log(ok?"PASS":"FAIL:"+JSON.stringify({calls:calls,confirmResult:confirmResult,promptResult:promptResult}));}catch(e){console.log("FAIL_EXCEPTION:"+e.message)}'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G2: once a dialog policy has been pushed for the page, the stubs still answer per the policy instead of calling native
  CHECK: node -e 'const fs=require("fs");const vm=require("vm");const src=fs.readFileSync("packages/extension/src/page-hooks.ts","utf8");const m=src.match(/MAIN_WORLD_HOOKS = `([\s\S]*)`;\s*$/);if(!m){console.log("FAIL_NO_EXTRACT");process.exit(1)}const hookSrc=m[1];const calls={alert:0,confirm:0,prompt:0};const listeners={};const win={};win.window=win;win.location={href:"https://example.com"};win.console={log(){},info(){},warn(){},error(){},debug(){}};win.CustomEvent=function(type,init){this.type=type;this.detail=init&&init.detail};win.addEventListener=function(name,fn){(listeners[name]=listeners[name]||[]).push(fn)};win.dispatchEvent=function(ev){(listeners[ev.type]||[]).forEach(function(fn){fn(ev)})};win.alert=function(msg){calls.alert++;return undefined};win.confirm=function(msg){calls.confirm++;return false};win.prompt=function(msg,def){calls.prompt++;return "NATIVE_PROMPT_RESULT"};try{const ctx=vm.createContext(win);vm.runInContext(hookSrc, ctx);win.dispatchEvent(new win.CustomEvent("__deeporax_dialog_policy", {detail:{alert:"accept",confirm:true}}));const confirmResult=win.confirm("Delete everything?");const promptResult=win.prompt("q","d");win.alert("hi");const ok = calls.confirm===0 && confirmResult===true && calls.alert===0 && calls.prompt===0 && promptResult==="d";console.log(ok?"PASS":"FAIL:"+JSON.stringify({calls:calls,confirmResult:confirmResult,promptResult:promptResult}));}catch(e){console.log("FAIL_EXCEPTION:"+e.message)}'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G3: background pushes the default dialog policy right after both ownership-claim sites (createBackgroundTab, and the guarded onReplaced re-claim)
  CHECK: grep -A1 "cdp.setAgentTab(tab.id);" packages/extension/src/background.ts | grep -q "pushDefaultDialogPolicy(tab.id)" && grep -A2 "if (wasAgentTab) {" packages/extension/src/background.ts | grep -q "pushDefaultDialogPolicy(addedTabId)" && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G4: console capture is still installed unconditionally, independent of any dialog policy, and __deeporaxDialogPolicy starts unset
  CHECK: node -e 'const fs=require("fs");const vm=require("vm");const src=fs.readFileSync("packages/extension/src/page-hooks.ts","utf8");const m=src.match(/MAIN_WORLD_HOOKS = `([\s\S]*)`;\s*$/);if(!m){console.log("FAIL_NO_EXTRACT");process.exit(1)}const hookSrc=m[1];const listeners={};const win={};win.window=win;win.location={href:"https://example.com"};win.console={log(){},info(){},warn(){},error(){},debug(){}};win.CustomEvent=function(type,init){this.type=type;this.detail=init&&init.detail};win.addEventListener=function(name,fn){(listeners[name]=listeners[name]||[]).push(fn)};win.dispatchEvent=function(ev){(listeners[ev.type]||[]).forEach(function(fn){fn(ev)})};win.alert=function(){return undefined};win.confirm=function(){return false};win.prompt=function(){return null};try{vm.runInContext(hookSrc, vm.createContext(win));win.console.log("hello","world");const ok = win.__deeporaxDialogPolicy===undefined && Array.isArray(win.__deeporaxConsole) && win.__deeporaxConsole.length===1 && win.__deeporaxConsole[0].text==="hello world";console.log(ok?"PASS":"FAIL:"+JSON.stringify(win.__deeporaxConsole));}catch(e){console.log("FAIL_EXCEPTION:"+e.message)}'
  EXPECT: PASS
  EVIDENCE: PASS

- [x] G5: extension package typechecks
  CHECK: (cd packages/extension && bun run typecheck) >/dev/null 2>&1 && echo PASS || echo FAIL
  EXPECT: PASS
  EVIDENCE: PASS
