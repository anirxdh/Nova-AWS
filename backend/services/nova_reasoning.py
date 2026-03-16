import base64
import json
import os
import re
import time

import httpx

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Max chars for DOM snapshot JSON to stay under token limits
DOM_SNAPSHOT_MAX_CHARS = 12000


def _extract_json(text: str) -> dict | list | None:
    """Extract JSON from LLM response, handling markdown code blocks and extra text."""
    # Strategy 1: Direct parse
    try:
        parsed = json.loads(text.strip())
        return parsed
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from markdown code block
    code_block = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if code_block:
        try:
            parsed = json.loads(code_block.group(1).strip())
            return parsed
        except json.JSONDecodeError:
            pass

    # Strategy 3: Find the first complete JSON object { ... }
    brace_start = text.find('{')
    if brace_start != -1:
        depth = 0
        for i in range(brace_start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    try:
                        parsed = json.loads(text[brace_start:i + 1])
                        return parsed
                    except json.JSONDecodeError:
                        break

    # Strategy 4: Find JSON array [ ... ]
    bracket_start = text.find('[')
    if bracket_start != -1:
        depth = 0
        for i in range(bracket_start, len(text)):
            if text[i] == '[':
                depth += 1
            elif text[i] == ']':
                depth -= 1
                if depth == 0:
                    try:
                        parsed = json.loads(text[bracket_start:i + 1])
                        return parsed
                    except json.JSONDecodeError:
                        break

    return None


def _get_groq_key() -> str:
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set in backend/.env")
    return key


def _truncate_dom(dom_snapshot: dict) -> dict:
    """Truncate DOM snapshot to stay under token limits."""
    dom_json = json.dumps(dom_snapshot)
    if len(dom_json) <= DOM_SNAPSHOT_MAX_CHARS:
        return dom_snapshot

    # Progressively trim: text_content first, then lists/tables, then trim arrays
    trimmed = dict(dom_snapshot)

    # 1. Truncate text_content
    if "text_content" in trimmed:
        trimmed["text_content"] = trimmed["text_content"][:2000]

    # 2. Remove less critical fields
    for field in ["tables", "lists", "images", "headings"]:
        if field in trimmed and len(json.dumps(trimmed)) > DOM_SNAPSHOT_MAX_CHARS:
            trimmed[field] = trimmed[field][:3] if isinstance(trimmed[field], list) else trimmed[field]

    # 3. Trim large arrays (keep first 15 items)
    for field in ["buttons", "links", "inputs", "products"]:
        if field in trimmed and isinstance(trimmed[field], list) and len(trimmed[field]) > 15:
            trimmed[field] = trimmed[field][:15]

    return trimmed


CONTINUE_SYSTEM_PROMPT = """You are ScreenSense, a screen-aware AI execution agent in a Chrome extension.
You are CONTINUING a multi-step task that is already in progress.

You receive FOUR inputs:
1. A screenshot of the user's current browser tab (AFTER the last action was taken)
2. A DOM snapshot — a JSON object with REAL CSS selectors for every interactive element on the page
3. The user's original command
4. A numbered list of actions already completed

CRITICAL RULES:
- You MUST use the EXACT CSS selectors from the DOM snapshot. NEVER guess or make up selectors.
- The DOM snapshot contains: buttons[], links[], inputs[], forms[], text_content, url, title
- Each element has a "selector" field — USE IT EXACTLY as provided.
- Look at the NEW screenshot and DOM snapshot to determine what happened after the last action.
- If the task appears complete, signal done. Do NOT continue unnecessarily.

RESPONSE FORMAT — respond with ONE JSON object only, no markdown, no explanation:

IMPORTANT: Always include a "reasoning" field explaining your assessment of the current page state and your decision.

For TASK COMPLETE (the task appears to be done):
{"type": "done", "reasoning": "The search results are now showing USB-C cables. The task is complete.", "summary": "Brief description of what was accomplished"}

For MORE ACTIONS NEEDED (the task requires more steps):
{"type": "steps", "reasoning": "Search results are loaded. I can see the cheapest option. I'll click on it.", "actions": [...]}

For COMMUNICATING SOMETHING (you need to tell the user something about what happened):
{"type": "answer", "reasoning": "I can see the relevant information in the page content.", "text": "your message"}

SUPPORTED ACTIONS (use exact selectors from DOM snapshot):
Every action MUST include a "speak" field — a 3-5 word phrase spoken aloud to the user (e.g., "Opening Amazon", "Searching protein bars", "Adding to cart").

- click: {"action": "click", "selector": "<from DOM>", "description": "Click the X button", "speak": "Clicking X"}
- type: {"action": "type", "selector": "<from DOM>", "value": "text", "description": "Type X into Y", "speak": "Searching for X"}
- navigate: {"action": "navigate", "url": "https://...", "description": "Navigate to X", "speak": "Opening X"}
- scroll: {"action": "scroll", "direction": "up|down|top|bottom", "description": "Scroll", "speak": "Scrolling down"}
- extract: {"action": "extract", "selector": "<from DOM>", "description": "Get text from X", "speak": "Reading text"}

DECISION GUIDELINES:
- Return EXACTLY ONE action at a time. You'll get fresh DOM and screenshot after each action.
- Think about the user's FULL goal. Only signal "done" when ALL items/tasks in the request are complete.
- NEVER signal "done" if there are still unfinished items. If the user asked for 3 products, you must add ALL 3 before signaling "done".
- If search results are showing but the user wanted to click/select/add something → respond with "steps"
- If an action FAILED (you'll see "FAILED:" in the history), try a DIFFERENT selector or approach.
- Do NOT get stuck in loops — if the EXACT same action has been tried 3+ times, skip that item and move to the next one.
- NEVER treat remaining items as "separate tasks." Complete EVERYTHING the user asked for in one session.

IMPORTANT SELECTOR RULES:
- NEVER use auto-generated IDs like #a-autoid-0, #a-autoid-1, etc. — these are random and often point to wrong elements.
- For "Add to Cart" buttons, use #add-to-cart-button or button text containing "Add to Cart".
- For product links on search results, use href-based selectors (a[href*="/dp/"]) or product title links.
- After adding an item to cart, use the search bar to find the NEXT item. Don't scroll on the cart page.

MULTI-STEP TASK EXAMPLES:
- "Add cheapest USB-C cable to cart" → search → find cheapest → click product → click Add to Cart → done
- "Write an email to john about meeting" → click compose → type to field → type subject → type body → click send → done
- "Find and open the first search result" → type query → click search → click first result → done

NAVIGATION CONTEXT:
- If a previous action was "Page navigated", you are now on a NEW page. Look at the current URL and DOM to understand where you are.
- After navigation, continue with the next step of the user's goal (e.g., search for the product).
- The DOM snapshot and screenshot now show the NEW page, not the old one."""

SYSTEM_PROMPT = """You are ScreenSense, a screen-aware AI execution agent in a Chrome extension.

You receive THREE inputs:
1. A screenshot of the user's current browser tab
2. A DOM snapshot — a JSON object with REAL CSS selectors for every interactive element on the page
3. A voice command from the user

CRITICAL RULES:
- You MUST use the EXACT CSS selectors from the DOM snapshot. NEVER guess or make up selectors.
- The DOM snapshot contains: buttons[], links[], inputs[], forms[], text_content, url, title
- Each element has a "selector" field — USE IT EXACTLY as provided.
- If the user asks about content visible on the page or in the DOM, ALWAYS answer based on what you see. You have full knowledge of the page from both the screenshot AND the DOM snapshot.
- If the user wants to do something on a DIFFERENT website, use the navigate action to go there first.
- You CAN navigate to any website. Use navigate action with the full URL.

RESPONSE FORMAT — respond with ONE JSON object only, no markdown, no explanation:

IMPORTANT: Always include a "reasoning" field in your JSON response with a 1-2 sentence explanation of your decision.

For QUESTIONS (user asks about the page):
{"type": "answer", "reasoning": "I can see the price displayed in the product details section", "text": "your answer"}

For TASKS (user wants you to do something on the page):
{"type": "steps", "reasoning": "I see a search box at the top of the page. I'll type the query and click search.", "actions": [...]}

SUPPORTED ACTIONS (use exact selectors from DOM snapshot):
Every action MUST include a "speak" field — a 3-5 word phrase spoken aloud to the user (e.g., "Opening Amazon", "Searching protein bars", "Adding to cart").

- click: {"action": "click", "selector": "<from DOM>", "description": "Click the X button", "speak": "Clicking X"}
- type: {"action": "type", "selector": "<from DOM>", "value": "text", "description": "Type X into Y", "speak": "Searching for X"}
- navigate: {"action": "navigate", "url": "https://...", "description": "Navigate to X", "speak": "Opening X"}
- scroll: {"action": "scroll", "direction": "up|down|top|bottom", "description": "Scroll", "speak": "Scrolling down"}
- extract: {"action": "extract", "selector": "<from DOM>", "description": "Get text from X", "speak": "Reading text"}

CRITICAL RULES:
- Return EXACTLY ONE action at a time. After each action, you'll get a fresh screenshot and DOM with updated selectors.
- Always scroll commands MUST return type "steps" with a scroll action — NEVER return "done" or "answer" for scroll requests.
- NEVER return "done" on the first call unless the task is literally already complete on the current page.
- Be FAST and DECISIVE. One action, move forward.

IMPORTANT: Always look at the DOM snapshot FIRST to find the right selector. The screenshot helps you understand what the user sees, but the DOM snapshot has the actual selectors you must use."""


def _call_groq(system_prompt: str, user_content: list[dict]) -> str:
    """Call Groq chat completions API with vision support. Retries on rate limit."""
    api_key = _get_groq_key()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(3):
        resp = httpx.post(GROQ_API_URL, headers=headers, json=payload, timeout=60.0)

        if resp.status_code == 401:
            raise ValueError("Groq API key is invalid — check GROQ_API_KEY in backend/.env")

        if resp.status_code == 429:
            # Rate limited — wait and retry
            wait = 2.0 * (attempt + 1)
            print(f"[ScreenSense] Groq rate limited, waiting {wait}s (attempt {attempt + 1}/3)")
            time.sleep(wait)
            continue

        if resp.status_code != 200:
            raise ValueError(f"Groq API error ({resp.status_code}): {resp.text[:500]}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]

    raise ValueError("Groq rate limit exceeded after 3 retries — wait a moment and try again")


def reason_about_page(command: str, screenshot_base64: str, dom_snapshot: dict) -> dict:
    """Reason about the current page using Groq vision.

    Args:
        command: The user's voice command text.
        screenshot_base64: Base64-encoded PNG screenshot (raw base64, no data URI prefix).
        dom_snapshot: Structured DOM data with interactive elements and their CSS selectors.

    Returns:
        A dict with either:
        - {"type": "answer", "text": "..."} for questions
        - {"type": "steps", "actions": [...]} for task commands
    """
    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{screenshot_base64}",
            },
        },
        {
            "type": "text",
            "text": f"DOM Snapshot:\n{json.dumps(_truncate_dom(dom_snapshot))}",
        },
        {
            "type": "text",
            "text": f"User command: {command}",
        },
    ]

    try:
        response_text = _call_groq(SYSTEM_PROMPT, user_content)

        parsed = _extract_json(response_text)
        if parsed is not None:
            if isinstance(parsed, list):
                return {"type": "steps", "actions": parsed}
            if isinstance(parsed, dict) and "type" in parsed:
                return parsed
            return {"type": "answer", "text": response_text}
        return {"type": "answer", "text": response_text}

    except Exception as e:
        raise ValueError(f"Reasoning failed: {e}") from e


def reason_continue(
    original_command: str,
    action_history: list[dict],
    screenshot_base64: str,
    dom_snapshot: dict,
) -> dict:
    """Continue reasoning about a multi-step task after actions have been taken."""
    # Compress action history for long chains
    if len(action_history) > 5:
        older = action_history[:-3]
        recent = action_history[-3:]
        older_summary = f"Previously completed {len(older)} actions: " + ", ".join(
            entry.get('description', 'Unknown')[:40] for entry in older
        )
        formatted_history = older_summary + "\n\nRecent actions:\n" + "\n".join(
            f"{len(older) + i + 1}. {entry.get('description', 'Unknown action')} -> {entry.get('result', 'Unknown result')}"
            for i, entry in enumerate(recent)
        )
    elif action_history:
        formatted_history = "\n".join(
            f"{i + 1}. {entry.get('description', 'Unknown action')} -> {entry.get('result', 'Unknown result')}"
            for i, entry in enumerate(action_history)
        )
    else:
        formatted_history = "(no actions taken yet)"

    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{screenshot_base64}",
            },
        },
        {
            "type": "text",
            "text": f"DOM Snapshot:\n{json.dumps(_truncate_dom(dom_snapshot))}",
        },
        {
            "type": "text",
            "text": (
                f"Original command: {original_command}\n\n"
                f"Actions completed so far:\n{formatted_history}\n\n"
                f"What should I do next? If the task is complete, respond with type 'done'."
            ),
        },
    ]

    try:
        response_text = _call_groq(CONTINUE_SYSTEM_PROMPT, user_content)

        parsed = _extract_json(response_text)
        if parsed is not None:
            if isinstance(parsed, list):
                return {"type": "steps", "actions": parsed}
            if isinstance(parsed, dict) and "type" in parsed:
                return parsed
            return {"type": "done", "summary": response_text}
        return {"type": "done", "summary": response_text}

    except Exception as e:
        raise ValueError(f"Continue reasoning failed: {e}") from e
