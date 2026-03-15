export interface DomSnapshot {
  url: string;
  title: string;
  buttons: ElementInfo[];
  links: ElementInfo[];
  inputs: InputInfo[];
  forms: FormInfo[];
  text_content: string;
}

interface ElementInfo {
  selector: string;
  text: string;
  visible: boolean;
}

interface InputInfo {
  selector: string;
  type: string;
  value: string;
  placeholder: string;
  visible: boolean;
}

interface FormInfo {
  selector: string;
  action: string;
  method: string;
  inputs: InputInfo[];
}

function isVisible(el: Element): boolean {
  const visible = el.checkVisibility?.() ?? true;
  if (!visible) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function buildSelector(el: Element): string {
  // Priority 1: id
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  // Priority 2: data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Priority 3: aria-label (if reasonably short and unique-ish)
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.length < 80) {
    return `[aria-label="${ariaLabel}"]`;
  }

  // Priority 4: tag + class path with nth-child, up to 3 ancestor levels
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .slice(0, 2)
    .map((c) => `.${CSS.escape(c)}`)
    .join('');

  // Try to find nth-child position among siblings of same tag
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName
    );
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      const parentTag = parent.tagName.toLowerCase();
      return `${parentTag} > ${tag}${classes}:nth-child(${idx})`;
    }
  }

  return `${tag}${classes}`;
}

function buildInputInfo(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): InputInfo {
  return {
    selector: buildSelector(el),
    type: el instanceof HTMLInputElement ? (el.type || 'text') : el.tagName.toLowerCase(),
    value: el instanceof HTMLSelectElement ? el.value : (el as HTMLInputElement | HTMLTextAreaElement).value || '',
    placeholder: (el as HTMLInputElement | HTMLTextAreaElement).placeholder || '',
    visible: isVisible(el),
  };
}

export function scrapeDom(): DomSnapshot {
  // Buttons
  const buttonEls = Array.from(
    document.querySelectorAll('button, [role="button"]')
  ).slice(0, 50);

  const buttons: ElementInfo[] = buttonEls.map((el) => ({
    selector: buildSelector(el),
    text: (el.textContent || '').trim().slice(0, 200),
    visible: isVisible(el),
  }));

  // Links
  const linkEls = Array.from(document.querySelectorAll('a[href]')).slice(0, 50);
  const links: ElementInfo[] = linkEls.map((el) => ({
    selector: buildSelector(el),
    text: (el.textContent || '').trim().slice(0, 200),
    visible: isVisible(el),
  }));

  // Inputs
  const inputEls = Array.from(
    document.querySelectorAll('input, textarea, select')
  ).slice(0, 30) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

  const inputs: InputInfo[] = inputEls.map(buildInputInfo);

  // Forms
  const formEls = Array.from(document.querySelectorAll('form')).slice(0, 10) as HTMLFormElement[];
  const forms: FormInfo[] = formEls.map((form) => {
    const formInputEls = Array.from(
      form.querySelectorAll('input, textarea, select')
    ).slice(0, 10) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

    return {
      selector: buildSelector(form),
      action: form.action || '',
      method: form.method || 'get',
      inputs: formInputEls.map(buildInputInfo),
    };
  });

  return {
    url: window.location.href,
    title: document.title,
    buttons,
    links,
    inputs,
    forms,
    text_content: document.body?.innerText?.slice(0, 3000) || '',
  };
}
