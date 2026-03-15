/**
 * DOM Action Executor — Phase 9
 *
 * Executes structured DOM actions (click, type, navigate, extract, scroll)
 * with a strict allowlist, selector sanitization, and rate limiting.
 */

export interface ActionRequest {
  actionType: string;
  selector?: string;
  value?: string;
  url?: string;
  direction?: string;
  description: string;
}

export interface ActionResult {
  ok: boolean;
  summary: string;
  error?: string;
  extractedText?: string;
}

// ─── Allowlist ────────────────────────────────────────────────────────────────

const ALLOWED_ACTIONS = new Set(['click', 'type', 'navigate', 'extract', 'scroll']);

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let lastActionTime = 0;
const MIN_ACTION_INTERVAL_MS = 300;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastActionTime;
  if (elapsed < MIN_ACTION_INTERVAL_MS) {
    const waitMs = MIN_ACTION_INTERVAL_MS - elapsed;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  lastActionTime = Date.now();
}

// ─── Selector sanitizer ───────────────────────────────────────────────────────

const DANGEROUS_SELECTOR_PATTERNS = [
  /javascript:/i,
  /<script/i,
  /on\w+=\s*['"]/i, // onclick=', onerror="
  /`/,
];

function sanitizeSelector(selector: string): { ok: boolean; error?: string } {
  for (const pattern of DANGEROUS_SELECTOR_PATTERNS) {
    if (pattern.test(selector)) {
      return { ok: false, error: `Dangerous selector pattern detected: ${pattern}` };
    }
  }
  // Test that the selector is syntactically valid
  try {
    document.querySelector(selector);
  } catch (e) {
    return { ok: false, error: `Invalid selector syntax: ${(e as Error).message}` };
  }
  return { ok: true };
}

function queryElement(selector: string): { el: Element | null; error?: string } {
  const sanitized = sanitizeSelector(selector);
  if (!sanitized.ok) {
    return { el: null, error: sanitized.error };
  }
  try {
    const el = document.querySelector(selector);
    return { el };
  } catch (e) {
    return { el: null, error: (e as Error).message };
  }
}

// ─── Action implementations ───────────────────────────────────────────────────

async function actionClick(selector: string): Promise<ActionResult> {
  const { el, error } = queryElement(selector);
  if (error) return { ok: false, summary: '', error };
  if (!el) return { ok: false, summary: '', error: `Element not found: ${selector}` };

  (el as HTMLElement).click();
  const label = el.textContent?.trim().slice(0, 50) || selector;
  return { ok: true, summary: `Clicked '${label}'` };
}

async function actionTypeText(selector: string, value: string): Promise<ActionResult> {
  const { el, error } = queryElement(selector);
  if (error) return { ok: false, summary: '', error };
  if (!el) return { ok: false, summary: '', error: `Element not found: ${selector}` };

  const input = el as HTMLInputElement;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, summary: `Typed '${value.slice(0, 30)}' into ${selector}` };
}

async function actionNavigate(url: string): Promise<ActionResult> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, summary: '', error: `Unsafe URL scheme — only http:// and https:// are allowed: ${url}` };
  }
  window.location.href = url;
  return { ok: true, summary: `Navigating to ${url}` };
}

async function actionExtract(selector: string): Promise<ActionResult> {
  const { el, error } = queryElement(selector);
  if (error) return { ok: false, summary: '', error };
  if (!el) return { ok: false, summary: '', error: `Element not found: ${selector}` };

  const text = el.textContent?.trim() ?? '';
  return {
    ok: true,
    summary: `Extracted text from ${selector}: '${text.slice(0, 100)}'`,
    extractedText: text,
  };
}

async function actionScroll(selectorOrDirection: string): Promise<ActionResult> {
  const dir = selectorOrDirection.toLowerCase();

  if (dir === 'up') {
    window.scrollBy({ top: -300, behavior: 'smooth' });
    return { ok: true, summary: `Scrolled up` };
  }
  if (dir === 'down') {
    window.scrollBy({ top: 300, behavior: 'smooth' });
    return { ok: true, summary: `Scrolled down` };
  }
  if (dir === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { ok: true, summary: `Scrolled to top` };
  }
  if (dir === 'bottom') {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return { ok: true, summary: `Scrolled to bottom` };
  }

  // Treat as selector
  const { el, error } = queryElement(selectorOrDirection);
  if (error) return { ok: false, summary: '', error };
  if (!el) return { ok: false, summary: '', error: `Element not found: ${selectorOrDirection}` };

  (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  return { ok: true, summary: `Scrolled to ${selectorOrDirection}` };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function executeAction(request: ActionRequest): Promise<ActionResult> {
  const { actionType, selector, value, url, direction } = request;

  // 1. Allowlist check
  if (!ALLOWED_ACTIONS.has(actionType)) {
    return { ok: false, summary: '', error: `Unknown action type: ${actionType}` };
  }

  // 2. Rate limiting
  await enforceRateLimit();

  // 3. Dispatch to implementation
  try {
    switch (actionType) {
      case 'click':
        if (!selector) return { ok: false, summary: '', error: 'selector is required for click' };
        return await actionClick(selector);

      case 'type':
        if (!selector) return { ok: false, summary: '', error: 'selector is required for type' };
        return await actionTypeText(selector, value ?? '');

      case 'navigate':
        if (!url) return { ok: false, summary: '', error: 'url is required for navigate' };
        return await actionNavigate(url);

      case 'extract':
        if (!selector) return { ok: false, summary: '', error: 'selector is required for extract' };
        return await actionExtract(selector);

      case 'scroll':
        return await actionScroll(direction ?? selector ?? 'down');

      default:
        return { ok: false, summary: '', error: `Unknown action type: ${actionType}` };
    }
  } catch (e) {
    return { ok: false, summary: '', error: (e as Error).message };
  }
}
