"""
Config for DB and Vanna. All LLM calls use AWS Bedrock via backend.bedrock_credentials.
"""

from pathlib import Path

from backend import bedrock_credentials

ROOT = Path(__file__).resolve().parent.parent

# SQL Database (SQLite)
SQLITE_PATH = str(ROOT / "db" / "morning_blotter.db")

# LLM: Bedrock only (credentials in backend/bedrock_credentials.env)
AWS_ACCESS_KEY_ID = bedrock_credentials.AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = bedrock_credentials.AWS_SECRET_ACCESS_KEY
AWS_REGION = bedrock_credentials.AWS_REGION
BEDROCK_MODEL_ID = bedrock_credentials.BEDROCK_MODEL_ID


def is_llm_configured() -> bool:
    return bedrock_credentials.is_configured()
