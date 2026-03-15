import base64
import json
import os

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

SYSTEM_PROMPT = """You are ScreenSense, a screen-aware AI assistant embedded in a Chrome extension. You receive:
1. A screenshot of the user's current browser tab
2. A DOM snapshot with interactive elements (buttons, links, inputs, forms) and their CSS selectors
3. A voice command from the user

Your job:
- If the user is asking a QUESTION about what they see, respond with a JSON object: {"type": "answer", "text": "your answer here"}
- If the user is giving a TASK command (e.g., "click add to cart", "search for headphones"), respond with a JSON object: {"type": "steps", "actions": [{"action": "click", "selector": "#add-to-cart", "description": "Click the Add to Cart button"}, ...]}

Supported action types: click, type, navigate, scroll
- click: {"action": "click", "selector": "CSS selector", "description": "what this does"}
- type: {"action": "type", "selector": "CSS selector", "value": "text to type", "description": "what this does"}
- navigate: {"action": "navigate", "url": "URL to navigate to", "description": "what this does"}
- scroll: {"action": "scroll", "direction": "up|down", "description": "what this does"}

Use the DOM snapshot selectors when available. Respond ONLY with the JSON object, no markdown, no explanation."""


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
