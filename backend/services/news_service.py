"""
Market news fetching service.
Uses NEWS_API_KEY from environment (.env.local or bedrock_credentials.env).
"""

from __future__ import annotations

import os
from typing import Any


def get_news_api_key() -> str:
    """Return NEWS_API_KEY from environment."""
    return (os.environ.get("NEWS_API_KEY") or "").strip()


def fetch_market_news(query: str = "fixed income bonds", limit: int = 5) -> list[dict[str, Any]]:
    """
    Fetch market news from external API.
    Returns list of { title, url, source, published_at, snippet }.
    Requires NEWS_API_KEY in environment.
    """
    api_key = get_news_api_key()
    if not api_key:
        return []

    try:
        import urllib.request
        import urllib.parse
        import json

        encoded = urllib.parse.quote(query)
        url = f"https://newsapi.org/v2/everything?q={encoded}&apiKey={api_key}&pageSize={limit}&sortBy=publishedAt&language=en"
        req = urllib.request.Request(url, headers={"User-Agent": "MorningBlotter/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        articles = data.get("articles", [])
        return [
            {
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "source": a.get("source", {}).get("name", ""),
                "published_at": a.get("publishedAt", ""),
                "snippet": (a.get("description") or "")[:200],
            }
            for a in articles[:limit]
        ]
    except Exception:
        return []
