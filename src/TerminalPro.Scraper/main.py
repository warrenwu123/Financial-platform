#!/usr/bin/env python3
"""
TerminalPro Intelligence Scraper
Powered by Scrapling (https://github.com/D4Vinci/Scrapling) + Claude AI

Sources covered:
  US:  Reuters, CNBC, MarketWatch, Seeking Alpha, Barrons
  HK:  SCMP (South China Morning Post), HKEJ
  CN:  Caixin Global, China Daily Business
  EU:  FT, Reuters Europe, Handelsblatt (EN)
  IB:  Goldman Sachs Insights, JPMorgan Research, Morgan Stanley Ideas,
       Barclays Research, UBS Outlook, Citi Research

Install:
  pip install scrapling[playwright] fastapi uvicorn anthropic aiohttp

Run:
  python scraper/main.py
"""

import asyncio, hashlib, re, os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import anthropic

# ── Scrapling ─────────────────────────────────────────────────────────────────
try:
    from scrapling.defaults import AsyncFetcher
    from scrapling import PlayWrightFetcher
    SCRAPLING_OK = True
except ImportError:
    print("[WARN] pip install scrapling[playwright] && scrapling install")
    SCRAPLING_OK = False

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="TerminalPro Scraper", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

AI = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ── Source Registry ───────────────────────────────────────────────────────────
SOURCES = {
    # ─ US ─────────────────────────────────────────────────────────────────────
    "reuters_markets":  { "url": "https://www.reuters.com/finance/markets",     "market": "US" },
    "cnbc_markets":     { "url": "https://www.cnbc.com/markets/",               "market": "US" },
    "marketwatch":      { "url": "https://www.marketwatch.com/markets",         "market": "US" },
    "barrons":          { "url": "https://www.barrons.com/market-data",         "market": "US" },
    # ─ HK / Asia ──────────────────────────────────────────────────────────────
    "scmp_business":    { "url": "https://www.scmp.com/business",               "market": "HK" },
    "reuters_asia":     { "url": "https://www.reuters.com/world/asia-pacific/", "market": "HK" },
    # ─ China ──────────────────────────────────────────────────────────────────
    "caixin_global":    { "url": "https://www.caixinglobal.com/latest-news/",   "market": "CN" },
    # ─ Europe ─────────────────────────────────────────────────────────────────
    "reuters_europe":   { "url": "https://www.reuters.com/world/europe/",       "market": "EU" },
    "ft_markets":       { "url": "https://www.ft.com/markets",                  "market": "EU" },
    # ─ Investment Banks (public insights) ─────────────────────────────────────
    "gs_insights":      { "url": "https://www.goldmansachs.com/insights/",      "market": "US", "type": "analyst" },
    "jpm_insights":     { "url": "https://www.jpmorgan.com/insights/research",  "market": "US", "type": "analyst" },
    "ms_ideas":         { "url": "https://www.morganstanley.com/ideas",         "market": "US", "type": "analyst" },
}

# Seeking Alpha ticker page (requires stealth)
SA_TEMPLATE = "https://seekingalpha.com/symbol/{ticker}/analysis"
REUTERS_SEARCH = "https://www.reuters.com/search/news?blob={query}&sortBy=date"

# ── Fetcher wrapper ───────────────────────────────────────────────────────────
async def fetch(url: str, stealth: bool = True) -> str:
    """Fetch page content using Scrapling (stealth mode optional)."""
    if not SCRAPLING_OK:
        return ""
    try:
        fetcher = AsyncFetcher(auto_match=True, stealth=stealth, network_idle=True)
        page = await fetcher.get(url)
        return page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        print(f"[FETCH ERROR] {url}: {e}")
        return ""

# ── AI Content Extractor ──────────────────────────────────────────────────────
def ai_extract(html: str, source: str, context: str = "") -> list[dict]:
    """Use Claude to extract structured articles from raw HTML."""
    if not html or not AI.api_key:
        return []
    prompt = f"""Extract financial news articles from this HTML.
Source: {source}
{f'Context / search term: {context}' if context else ''}

For each article return JSON with:
  title, summary (2-3 sentences), url, published_at (ISO), type ("analyst" or "news"), sentiment ("bullish"/"bearish"/"neutral")

Return ONLY a JSON array. No markdown. Empty array if nothing found.

HTML (first 10000 chars):
{html[:10000]}"""

    try:
        msg = AI.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = msg.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            import json
            return json.loads(match.group())
    except Exception as e:
        print(f"[AI EXTRACT ERROR] {source}: {e}")
    return []


def ai_sentiment_batch(titles: list[str]) -> list[str]:
    """Classify headlines in bulk."""
    if not titles or not AI.api_key:
        return ["neutral"] * len(titles)
    prompt = f"""Classify each headline for equity markets: bullish, bearish, or neutral.
Return ONLY a JSON array of strings, same length as input.

{chr(10).join(f'{i}: {t[:200]}' for i, t in enumerate(titles))}"""
    try:
        import json
        msg = AI.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        match = re.search(r'\[.*\]', msg.content[0].text, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return result if len(result) == len(titles) else ["neutral"] * len(titles)
    except Exception as e:
        print(f"[SENTIMENT ERROR] {e}")
    return ["neutral"] * len(titles)


# ── Polygon news (fallback, requires API key) ─────────────────────────────────
async def polygon_news(ticker: str, limit: int = 20) -> list[dict]:
    api_key = os.environ.get("POLYGON_API_KEY", "")
    if not api_key:
        return []
    import aiohttp
    url = f"https://api.polygon.io/v2/reference/news?ticker={ticker}&limit={limit}&apiKey={api_key}"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url) as r:
                data = await r.json()
        return [
            {
                "id":           n.get("id", hashlib.md5(n["title"].encode()).hexdigest()),
                "title":        n["title"],
                "summary":      n.get("description", ""),
                "source":       n.get("author") or n.get("publisher", {}).get("name", "Polygon"),
                "url":          n.get("article_url", ""),
                "published_at": n.get("published_utc", datetime.utcnow().isoformat()),
                "type":         "news",
                "sentiment":    "neutral",
                "market":       "US",
                "tickers":      n.get("tickers", [ticker]),
                "tags":         n.get("keywords", [])[:5],
            }
            for n in data.get("results", [])
        ]
    except Exception as e:
        print(f"[POLYGON NEWS ERROR] {ticker}: {e}")
        return []


# ── Scrapers ──────────────────────────────────────────────────────────────────
async def scrape_ticker(ticker: str, limit: int) -> list[dict]:
    tasks = [
        polygon_news(ticker, limit),
        _scrape_source("reuters_markets", ticker),
        _scrape_seeking_alpha(ticker),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles = []
    for r in results:
        if isinstance(r, list):
            articles.extend(r)
    return articles


async def scrape_market(category: str, market: str, limit: int) -> list[dict]:
    market_sources = {
        "US": ["reuters_markets", "cnbc_markets", "gs_insights", "jpm_insights"],
        "HK": ["scmp_business", "reuters_asia"],
        "CN": ["caixin_global", "reuters_asia"],
        "EU": ["reuters_europe", "ft_markets"],
    }.get(market.upper(), ["reuters_markets"])

    tasks = [_scrape_source(src, category) for src in market_sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles = []
    for r in results:
        if isinstance(r, list):
            articles.extend(r)
    return articles


async def scrape_analyst(ticker: str, limit: int) -> list[dict]:
    tasks = [
        _scrape_source("gs_insights", ticker),
        _scrape_source("jpm_insights", ticker),
        _scrape_source("ms_ideas", ticker),
        _scrape_seeking_alpha(ticker),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles = []
    for r in results:
        if isinstance(r, list):
            articles.extend([a for a in r if a.get("type") == "analyst"])
    return articles


async def _scrape_source(source_key: str, context: str = "") -> list[dict]:
    cfg = SOURCES.get(source_key, {})
    if not cfg:
        return []
    html = await fetch(cfg["url"])
    items = ai_extract(html, source_key, context)
    for item in items:
        item.setdefault("market", cfg.get("market", "US"))
        item.setdefault("type",   cfg.get("type", "news"))
        item.setdefault("source", source_key.replace("_", " ").title())
        item.setdefault("id",     hashlib.md5(item.get("title", "").encode()).hexdigest())
    return items


async def _scrape_seeking_alpha(ticker: str) -> list[dict]:
    url = SA_TEMPLATE.format(ticker=ticker.lower())
    html = await fetch(url, stealth=True)  # SA requires stealth
    items = ai_extract(html, "Seeking Alpha", ticker)
    for item in items:
        item["type"] = "analyst"
        item["source"] = "Seeking Alpha"
        item.setdefault("id", hashlib.md5(item.get("title", "").encode()).hexdigest())
    return items


def deduplicate(articles: list[dict]) -> list[dict]:
    seen, unique = set(), []
    for a in articles:
        key = a.get("title", "")[:55].lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(a)
    return unique


def enrich_sentiment(articles: list[dict]) -> list[dict]:
    no_sent = [i for i, a in enumerate(articles) if a.get("sentiment") in (None, "neutral", "")]
    if no_sent:
        titles = [articles[i]["title"] for i in no_sent]
        sentiments = ai_sentiment_batch(titles)
        for idx, sent in zip(no_sent, sentiments):
            articles[idx]["sentiment"] = sent
    return articles


# ── API Endpoints ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "scrapling": SCRAPLING_OK, "ai": bool(AI.api_key), "ts": datetime.utcnow().isoformat()}

@app.get("/news/ticker")
async def news_ticker(ticker: str, limit: int = 20):
    articles = await scrape_ticker(ticker, limit)
    articles = deduplicate(articles)
    articles = enrich_sentiment(articles)
    articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    return articles[:limit]

@app.get("/news/market")
async def news_market(category: str = "general", market: str = "US", limit: int = 30):
    articles = await scrape_market(category, market, limit)
    articles = deduplicate(articles)
    articles = enrich_sentiment(articles)
    articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    return articles[:limit]

@app.get("/analyst")
async def analyst(ticker: str, limit: int = 10):
    articles = await scrape_analyst(ticker, limit)
    articles = deduplicate(articles)
    articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    return articles[:limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
