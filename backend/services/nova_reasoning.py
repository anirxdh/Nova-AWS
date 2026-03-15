import base64
import json
import os

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

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
- click: {"action": "click", "selector": "<from DOM snapshot>", "description": "Click the X button"}
- type: {"action": "type", "selector": "<from DOM snapshot>", "value": "text to type", "description": "Type X into Y"}
- navigate: {"action": "navigate", "url": "https://...", "description": "Navigate to X"}
- scroll: {"action": "scroll", "direction": "up|down|top|bottom", "description": "Scroll the page"}
  - Use "bottom" to scroll all the way to the bottom of the page
  - Use "top" to scroll to the top
  - Use "down" to scroll one screen down, "up" for one screen up
  - To scroll to a specific element: {"action": "scroll", "selector": "<from DOM snapshot>", "description": "Scroll to X"}
- extract: {"action": "extract", "selector": "<from DOM snapshot>", "description": "Get text from X"}

DECISION GUIDELINES:
- Think about the user's FULL goal. "Add the highest-rated USB-C cable to cart" means: search → find highest rated → click it → click Add to Cart. Searching alone is NOT complete.
- Only signal "done" when the user's ENTIRE goal has been achieved, NOT just after the first visible page change.
- If search results are showing but the user wanted to click/select/add something, respond with "steps" to continue.
- If a form was filled but not submitted, respond with "steps" to submit it.
- If the page still needs more interaction to complete the user's goal → respond with "steps"
- If the last action failed or the page looks wrong → you may suggest corrective steps with "steps"
- Do NOT get stuck in loops — if the EXACT same action has been tried 3+ times with no change, signal "done"
- When in doubt, prefer "steps" over "done" — it's better to do one extra action than to stop too early

MULTI-STEP TASK EXAMPLES:
- "Add cheapest USB-C cable to cart" → search → find cheapest → click product → click Add to Cart → done
- "Write an email to john about meeting" → click compose → type to field → type subject → type body → click send → done
- "Find and open the first search result" → type query → click search → click first result → done"""

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
- Only say you can't help if the user asks you to do something on a COMPLETELY DIFFERENT website or app (like "send an email" when on Amazon).

RESPONSE FORMAT — respond with ONE JSON object only, no markdown, no explanation:

IMPORTANT: Always include a "reasoning" field in your JSON response with a 1-2 sentence explanation of your decision. This helps the user understand what you're doing.

For QUESTIONS (user asks about the page):
{"type": "answer", "reasoning": "I can see the price displayed in the product details section", "text": "your answer"}

For TASKS (user wants you to do something on the page):
{"type": "steps", "reasoning": "I see a search box at the top of the page. I'll type the query and click search.", "actions": [...]}

SUPPORTED ACTIONS (use exact selectors from DOM snapshot):
- click: {"action": "click", "selector": "<from DOM snapshot>", "description": "Click the X button"}
- type: {"action": "type", "selector": "<from DOM snapshot>", "value": "text to type", "description": "Type X into Y"}
- navigate: {"action": "navigate", "url": "https://...", "description": "Navigate to X"}
- scroll: {"action": "scroll", "direction": "up|down|top|bottom", "description": "Scroll the page"}
  - Use "bottom" to scroll all the way to the bottom of the page
  - Use "top" to scroll to the top
  - Use "down" to scroll one screen down, "up" for one screen up
  - To scroll to a specific element: {"action": "scroll", "selector": "<from DOM snapshot>", "description": "Scroll to X"}
- extract: {"action": "extract", "selector": "<from DOM snapshot>", "description": "Get text from X"}

EXAMPLES:
User: "search for wireless headphones"
DOM has: inputs: [{"selector": "#twotabsearchtextbox", "type": "text", "value": ""}]
Response: {"type": "steps", "reasoning": "I see the Amazon search box. I'll type the query and submit.", "actions": [{"action": "type", "selector": "#twotabsearchtextbox", "value": "wireless headphones", "description": "Type 'wireless headphones' into search box"}, {"action": "click", "selector": "#nav-search-submit-button", "description": "Click the search button"}]}

User: "scroll down to see reviews"
Response: {"type": "steps", "reasoning": "The user wants to scroll down to see reviews below the fold.", "actions": [{"action": "scroll", "direction": "down", "description": "Scroll down to see more content"}]}

User: "scroll to the bottom of the page"
Response: {"type": "steps", "reasoning": "The user wants to see the bottom of the page.", "actions": [{"action": "scroll", "direction": "bottom", "description": "Scroll to bottom of page"}]}

User: "what is the price?"
Response: {"type": "answer", "reasoning": "I can see the price in the product details.", "text": "The price is $29.99"}

User: "add the highest rated USB-C cable to my cart"
Response: {"type": "steps", "reasoning": "First I need to search for USB-C cables, then I'll find the highest rated one.", "actions": [{"action": "type", "selector": "#twotabsearchtextbox", "value": "USB-C cable", "description": "Type 'USB-C cable' into search box"}, {"action": "click", "selector": "#nav-search-submit-button", "description": "Click the search button"}]}

CRITICAL RULES FOR MULTI-STEP TASKS:
- If the user's command involves multiple steps (search + click + add to cart), plan the FIRST batch of actions and the agent loop will call you again after execution to continue.
- Always scroll commands MUST return type "steps" with a scroll action — NEVER return "done" or "answer" for scroll requests.
- NEVER return "done" on the first call unless the task is literally already complete on the current page.

IMPORTANT: Always look at the DOM snapshot FIRST to find the right selector. The screenshot helps you understand what the user sees, but the DOM snapshot has the actual selectors you must use."""


def reason_about_page(command: str, screenshot_base64: str, dom_snapshot: dict) -> dict:
    """Reason about the current page using Nova 2 Lite via the Bedrock converse API.

    Args:
        command: The user's voice command text.
        screenshot_base64: Base64-encoded PNG screenshot (raw base64, no data URI prefix).
        dom_snapshot: Structured DOM data with interactive elements and their CSS selectors.

    Returns:
        A dict with either:
        - {"type": "answer", "text": "..."} for questions
        - {"type": "steps", "actions": [...]} for task commands
    """
    aws_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "us-east-1")

    if not aws_key or not aws_secret or aws_key == "your-key-here":
        raise ValueError(
            "AWS credentials not configured — set AWS_ACCESS_KEY_ID and "
            "AWS_SECRET_ACCESS_KEY in backend/.env"
        )

    try:
        client = boto3.client(
            "bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
    except Exception as e:
        raise ValueError(f"Failed to create AWS client: {e}") from e

    # Decode the base64 screenshot to raw bytes for the Bedrock image block
    try:
        screenshot_bytes = base64.b64decode(screenshot_base64)
    except Exception as e:
        raise ValueError(f"Invalid screenshot_base64 — failed to decode: {e}") from e

    # Build the user message with three content blocks:
    # 1. Screenshot image block
    # 2. DOM snapshot as JSON text
    # 3. User command as text
    user_message_content = [
        {
            "image": {
                "format": "png",
                "source": {"bytes": screenshot_bytes},
            }
        },
        {
            "text": f"DOM Snapshot:\n{json.dumps(dom_snapshot, indent=2)}"
        },
        {
            "text": f"User command: {command}"
        },
    ]

    try:
        response = client.converse(
            modelId="us.amazon.nova-lite-v1:0",
            system=[{"text": SYSTEM_PROMPT}],
            messages=[
                {
                    "role": "user",
                    "content": user_message_content,
                }
            ],
            inferenceConfig={"maxTokens": 2048},
        )

        response_text = response["output"]["message"]["content"][0]["text"]

        # Attempt to parse the response as JSON
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, dict) and "type" in parsed:
                return parsed
            # Valid JSON but missing 'type' field — wrap it
            return {"type": "answer", "text": response_text}
        except json.JSONDecodeError:
            # Nova returned plain text instead of JSON — wrap as answer fallback
            return {"type": "answer", "text": response_text}

    except (NoCredentialsError, PartialCredentialsError) as e:
        raise ValueError(
            "AWS credentials are invalid or incomplete — check backend/.env"
        ) from e
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_msg = e.response["Error"]["Message"]
        if error_code in ("AccessDeniedException", "UnauthorizedException"):
            raise ValueError(
                f"AWS access denied — ensure the IAM user has Bedrock permissions "
                f"and Nova Lite model access is enabled: {error_msg}"
            ) from e
        if error_code == "ValidationException":
            raise ValueError(
                f"Bedrock validation error — request format may be invalid: {error_msg}"
            ) from e
        raise ValueError(f"AWS Bedrock error ({error_code}): {error_msg}") from e
    except Exception as e:
        raise ValueError(f"Reasoning failed: {e}") from e


def reason_continue(
    original_command: str,
    action_history: list[dict],
    screenshot_base64: str,
    dom_snapshot: dict,
) -> dict:
    """Continue reasoning about a multi-step task after actions have been taken.

    Args:
        original_command: The user's original voice command.
        action_history: List of dicts with 'description' and 'result' keys for each completed action.
        screenshot_base64: Base64-encoded PNG screenshot (raw base64, no data URI prefix) AFTER actions.
        dom_snapshot: Structured DOM data with interactive elements and their CSS selectors.

    Returns:
        A dict with either:
        - {"type": "done", "summary": "..."} when the task is complete
        - {"type": "steps", "actions": [...]} when more actions are needed
        - {"type": "answer", "text": "..."} when Nova wants to communicate something
    """
    aws_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "us-east-1")

    if not aws_key or not aws_secret or aws_key == "your-key-here":
        raise ValueError(
            "AWS credentials not configured — set AWS_ACCESS_KEY_ID and "
            "AWS_SECRET_ACCESS_KEY in backend/.env"
        )

    try:
        client = boto3.client(
            "bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
    except Exception as e:
        raise ValueError(f"Failed to create AWS client: {e}") from e

    # Decode the base64 screenshot to raw bytes for the Bedrock image block
    try:
        screenshot_bytes = base64.b64decode(screenshot_base64)
    except Exception as e:
        raise ValueError(f"Invalid screenshot_base64 — failed to decode: {e}") from e

    # Compress action history for long chains to reduce token usage
    if len(action_history) > 5:
        # Summarize older actions, keep last 3 in detail
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

    # Build the user message with content blocks:
    # 1. Screenshot image block (page state AFTER last action)
    # 2. DOM snapshot as JSON text
    # 3. Context: original command + action history + next-step question
    user_message_content = [
        {
            "image": {
                "format": "png",
                "source": {"bytes": screenshot_bytes},
            }
        },
        {
            "text": f"DOM Snapshot:\n{json.dumps(dom_snapshot, indent=2)}"
        },
        {
            "text": (
                f"Original command: {original_command}\n\n"
                f"Actions completed so far:\n{formatted_history}\n\n"
                f"What should I do next? If the task is complete, respond with type 'done'."
            )
        },
    ]

    try:
        response = client.converse(
            modelId="us.amazon.nova-lite-v1:0",
            system=[{"text": CONTINUE_SYSTEM_PROMPT}],
            messages=[
                {
                    "role": "user",
                    "content": user_message_content,
                }
            ],
            inferenceConfig={"maxTokens": 2048},
        )

        response_text = response["output"]["message"]["content"][0]["text"]

        # Attempt to parse the response as JSON
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, dict) and "type" in parsed:
                return parsed
            # Valid JSON but missing 'type' field — assume done (continuation fallback)
            return {"type": "done", "summary": response_text}
        except json.JSONDecodeError:
            # Nova returned plain text instead of JSON — assume task is done
            return {"type": "done", "summary": response_text}

    except (NoCredentialsError, PartialCredentialsError) as e:
        raise ValueError(
            "AWS credentials are invalid or incomplete — check backend/.env"
        ) from e
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_msg = e.response["Error"]["Message"]
        if error_code in ("AccessDeniedException", "UnauthorizedException"):
            raise ValueError(
                f"AWS access denied — ensure the IAM user has Bedrock permissions "
                f"and Nova Lite model access is enabled: {error_msg}"
            ) from e
        if error_code == "ValidationException":
            raise ValueError(
                f"Bedrock validation error — request format may be invalid: {error_msg}"
            ) from e
        raise ValueError(f"AWS Bedrock error ({error_code}): {error_msg}") from e
    except Exception as e:
        raise ValueError(f"Continue reasoning failed: {e}") from e
