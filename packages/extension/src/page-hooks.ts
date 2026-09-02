/**
 * Injected at document_start to capture console output and intercept dialogs
 * before page scripts run. Lives in the content-script isolated world for
 * console wrapping via the page's console is incomplete — we also bridge
 * window error events. For true page-console capture we inject a MAIN-world
 * script.
 */

export type ConsoleEntry = {
  level: string;
  text: string;
  ts: number;
  url?: string;
};

export type NetworkEntry = {
  id: string;
  method: string;
  url: string;
  status?: number;
  type?: string;
  ts: number;
  fromCache?: boolean;
};

const MAX_CONSOLE = 500;
const MAX_NETWORK = 500;

declare global {
  interface Window {
    __deeporaxConsole?: ConsoleEntry[];
    __deeporaxDialogPolicy?: {
      alert?: "accept" | "dismiss";
      confirm?: boolean;
      prompt?: string | null;
    };
    __deeporaxDialogs?: Array<{ type: string; message: string; ts: number }>;
  }
}

/** Content-script side buffer (also receives posts from MAIN world). */
export const consoleBuffer: ConsoleEntry[] = [];
export const networkBuffer: NetworkEntry[] = [];

export function pushConsole(entry: ConsoleEntry): void {
  consoleBuffer.push(entry);
  if (consoleBuffer.length > MAX_CONSOLE) {
    consoleBuffer.splice(0, consoleBuffer.length - MAX_CONSOLE);
  }
}

export function pushNetwork(entry: NetworkEntry): void {
  networkBuffer.push(entry);
  if (networkBuffer.length > MAX_NETWORK) {
    networkBuffer.splice(0, networkBuffer.length - MAX_NETWORK);
  }
}

export function clearConsole(): void {
  consoleBuffer.length = 0;
}

export function clearNetwork(): void {
  networkBuffer.length = 0;
}

export function listConsole(opts: {
  pattern?: string;
  level?: string;
  limit?: number;
}): ConsoleEntry[] {
  let items = consoleBuffer.slice();
  if (opts.level) {
    const lv = opts.level.toLowerCase();
    items = items.filter((e) => e.level === lv);
  }
  if (opts.pattern) {
    try {
      const re = new RegExp(opts.pattern, "i");
      items = items.filter((e) => re.test(e.text));
    } catch {
      const p = opts.pattern.toLowerCase();
      items = items.filter((e) => e.text.toLowerCase().includes(p));
    }
  }
  const limit = Math.min(opts.limit ?? 100, 500);
  return items.slice(-limit);
}

export function listNetwork(opts: {
  pattern?: string;
  type?: string;
  limit?: number;
}): NetworkEntry[] {
  let items = networkBuffer.slice();
  if (opts.type) {
    items = items.filter((e) => e.type === opts.type);
  }
  if (opts.pattern) {
    try {
      const re = new RegExp(opts.pattern, "i");
      items = items.filter((e) => re.test(e.url));
    } catch {
      const p = opts.pattern.toLowerCase();
      items = items.filter((e) => e.url.toLowerCase().includes(p));
    }
  }
  const limit = Math.min(opts.limit ?? 100, 500);
  return items.slice(-limit);
}

/**
 * MAIN-world bootstrap source (string). Injected via chrome.scripting so we
 * see page console.log and can stub dialogs.
 */
export const MAIN_WORLD_HOOKS = `(() => {
  if (window.__deeporaxHooksInstalled) return;
  window.__deeporaxHooksInstalled = true;
  window.__deeporaxConsole = window.__deeporaxConsole || [];
  window.__deeporaxDialogs = window.__deeporaxDialogs || [];
  // Left undefined until dialog_policy actually sets it, so the stubs below
  // can tell "nobody asked to control dialogs here" apart from "policy says
  // do nothing".

  const push = (level, args) => {
    try {
      const text = args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      const entry = { level, text: text.slice(0, 4000), ts: Date.now(), url: location.href };
      window.__deeporaxConsole.push(entry);
      if (window.__deeporaxConsole.length > 500) window.__deeporaxConsole.shift();
      window.dispatchEvent(new CustomEvent('__deeporax_console', { detail: entry }));
    } catch (_) {}
  };

  for (const level of ['log','info','warn','error','debug']) {
    const orig = console[level] && console[level].bind(console);
    console[level] = (...args) => {
      push(level, args);
      if (orig) return orig(...args);
    };
  }

  window.addEventListener('error', (ev) => {
    push('error', [ev.message + ' at ' + (ev.filename || '') + ':' + (ev.lineno || '')]);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    push('error', ['UnhandledRejection: ' + String(ev.reason)]);
  });

  // dialog_policy (dom-actions.ts) writes the policy in the isolated world,
  // a different window object than this MAIN-world script, so it has to
  // arrive here as an event instead of a direct property read.
  window.addEventListener('__deeporax_dialog_policy', (ev) => {
    window.__deeporaxDialogPolicy = Object.assign({}, window.__deeporaxDialogPolicy, ev.detail);
  });

  // No policy means nobody (agent or tool) has asked to control dialogs on
  // this page: fall through to the real function so the user sees their own
  // dialog and their own answer stands. This is the invariant every stub
  // below has to keep.
  const policy = () => window.__deeporaxDialogPolicy;
  const recordDialog = (entry) => {
    window.__deeporaxDialogs.push(entry);
    window.dispatchEvent(new CustomEvent('__deeporax_dialog', { detail: entry }));
  };
  const nativeAlert = window.alert;
  const nativeConfirm = window.confirm;
  const nativePrompt = window.prompt;
  window.alert = (message) => {
    recordDialog({ type: 'alert', message: String(message), ts: Date.now() });
    if (!policy()) return nativeAlert(message);
    return undefined;
  };
  window.confirm = (message) => {
    recordDialog({ type: 'confirm', message: String(message), ts: Date.now() });
    const p = policy();
    if (!p) return nativeConfirm(message);
    return p.confirm !== undefined ? Boolean(p.confirm) : true;
  };
  window.prompt = (message, def) => {
    recordDialog({ type: 'prompt', message: String(message), ts: Date.now() });
    const p = policy();
    if (!p) return nativePrompt(message, def);
    if (p.prompt === null) return null;
    if (typeof p.prompt === 'string') return p.prompt;
    return def ?? '';
  };
})();`;
