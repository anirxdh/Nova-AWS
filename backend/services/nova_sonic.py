import base64
import json
import os

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio using Amazon Nova Sonic via Bedrock invoke_model."""
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

    # Determine Bedrock audio media type from mime_type
    if "webm" in mime_type:
        audio_format = "webm"
    elif "ogg" in mime_type:
        audio_format = "ogg"
    elif "mp4" in mime_type:
        audio_format = "mp4"
    elif "wav" in mime_type:
        audio_format = "wav"
    else:
        audio_format = "webm"

    try:
        # Nova Sonic uses converse_stream with audio content for speech-to-text.
        # We send audio bytes directly and collect the text output.
        response = client.converse_stream(
            modelId="amazon.nova-sonic-v1:0",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "audio": {
                                "format": audio_format,
                                "source": {"bytes": audio_bytes},
                            }
                        }
                    ],
                }
            ],
            inferenceConfig={"maxTokens": 1024},
        )

        # Collect transcript from streamed response events
        transcript_parts = []
        for event in response["stream"]:
            if "contentBlockDelta" in event:
                delta = event["contentBlockDelta"]["delta"]
                if "text" in delta:
                    transcript_parts.append(delta["text"])

        transcript = "".join(transcript_parts).strip()
        if not transcript:
            raise ValueError(
                "No transcript produced — audio may be too short or unclear"
            )
        return transcript

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
                f"and Nova Sonic model access is enabled: {error_msg}"
            ) from e
        if error_code == "ValidationException":
            raise ValueError(
                f"Bedrock validation error — audio format may not be supported: {error_msg}"
            ) from e
        raise ValueError(f"AWS Bedrock error ({error_code}): {error_msg}") from e
    except Exception as e:
        raise ValueError(f"Transcription failed: {e}") from e
