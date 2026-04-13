# TerminalPro — Bloomberg-Style Financial Terminal

A full-stack financial terminal built with **.NET 8** (ASP.NET Core Web API), **React 18** (Vite + TradingView Lightweight Charts), and a **Python** news scraper. Live market data via Finnhub, financial statements via FMP, AI analysis via Claude.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser  (port 80 in prod / 5173 in dev)           │
│  React 18 + Vite + TradingView Lightweight Charts   │
└──────────────────────┬──────────────────────────────┘
                       │ REST + SignalR
┌──────────────────────▼──────────────────────────────┐
│  .NET 8 ASP.NET Core Web API  (port 5000)           │
│  Controllers · Services · SignalR Hub               │
│  Caching (IMemoryCache) · Swagger                   │
└──────────┬─────────────────────┬───────────────────┘
           │ Finnhub / FMP       │ HTTP
    ┌──────▼──────┐     ┌────────▼────────┐
    │  Finnhub    │     │  Python Scraper │
    │  FMP API    │     │  FastAPI :8001  │
    └─────────────┘     └─────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TradingView Lightweight Charts v5 |
| Backend | .NET 8, ASP.NET Core, SignalR, IMemoryCache |
| Scraper | Python 3.11, FastAPI, Scrapling, Playwright |
| Data APIs | Finnhub (free: 60 req/min), FMP (free: 250 req/day) |
| AI | Anthropic Claude Sonnet 4 |
| Container | Docker, Docker Compose, Nginx |
| CI/CD | GitHub Actions |

---

## Project Structure

```
Financial-platform/
├── src/
│   ├── TerminalPro.API/              # .NET 8 Web API
│   │   ├── Controllers/
│   │   │   ├── ControllersAndHub.cs  # Market, News controllers + SignalR hub
│   │   │   └── FinancialsController.cs
│   │   ├── Services/
│   │   │   ├── FinnhubService.cs     # Finnhub API client (candles, metrics, news)
│   │   │   ├── FmpService.cs         # FMP API client (income, balance, cashflow)
│   │   │   ├── StatisticsService.cs  # Technical indicators (SMA, RSI, MACD, BB)
│   │   │   └── NewsScraperService.cs # Bridge to Python scraper
│   │   ├── Models/
│   │   │   └── Models.cs             # All record types
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── TerminalPro.API.csproj
│   └── TerminalPro.Scraper/          # Python FastAPI news scraper
│       ├── main.py
│       └── requirements.txt
├── frontend/                         # React + Vite
│   ├── src/
│   │   ├── App.jsx                   # Main application
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI
├── Dockerfile.api
├── Dockerfile.frontend
├── Dockerfile.scraper
├── docker-compose.yml                # Production
├── docker-compose.dev.yml            # Development (hot reload)
├── nginx.conf
├── TerminalPro.sln
└── .env.example
```

---

## Quick Start

### 1. Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- [Docker + Docker Compose](https://docs.docker.com/get-docker/)
- [Python 3.11+](https://python.org) (optional, for local scraper)

### 2. API Keys (all free)

| Service | URL | Used for |
|---|---|---|
| **Finnhub** | https://finnhub.io | Prices, OHLCV, metrics, news |
| **FMP** | https://financialmodelingprep.com | Financial statements |
| **Anthropic** | https://console.anthropic.com | AI analysis |

### 3. Configure

```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 4a. Run with Docker (recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger |
| Scraper | http://localhost:8001 |

### 4b. Run locally for development

```bash
# API
cd src/TerminalPro.API
dotnet restore
dotnet run

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Scraper (separate terminal, optional)
cd src/TerminalPro.Scraper
pip install -r requirements.txt
python main.py
```

### 4c. Development with Docker (hot reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

---

## API Reference

### Market (Finnhub-backed)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/market/snapshot/{symbol}` | Real-time quote |
| GET | `/api/v1/market/candles/{symbol}?resolution=D&from=…&to=…` | OHLCV bars |
| GET | `/api/v1/market/profile/{symbol}` | Company profile |
| GET | `/api/v1/market/recommendations/{symbol}` | Analyst ratings |
| GET | `/api/v1/market/search?q=apple` | Symbol search |

### Financials (FMP-backed)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/financials/{symbol}` | Full bundle: income + balance + cashflow + metrics |
| GET | `/api/v1/financials/{symbol}/income?period=annual&limit=5` | Income statements |
| GET | `/api/v1/financials/{symbol}/balance` | Balance sheets |
| GET | `/api/v1/financials/{symbol}/cashflow` | Cash flow statements |
| GET | `/api/v1/financials/{symbol}/metrics` | Key ratios (P/E, ROE, D/E…) |

### News

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/news/ticker/{symbol}` | Company news |
| GET | `/api/v1/news/market?market=US` | Market news |
| GET | `/api/v1/news/sentiment/{symbol}` | AI sentiment |

### SignalR

```
Hub URL:  /hubs/market
Invoke:   Subscribe("AAPL")  →  receive Tick events
          SubscribeAll()      →  receive MarketUpdate for all instruments
Events:   Tick, MarketUpdate
```

---

## Features

- **Candlestick charts** powered by TradingView Lightweight Charts v5
- **20 timeframes**: 1m → ALL (20yr), with intraday 1D/5D
- **Technical indicators**: SMA 20/50, EMA 20, Bollinger Bands, RSI, MACD, Volume
- **Financial statements**: Income, Balance Sheet, Cash Flow (live from FMP)
- **Key ratios**: P/E, P/S, P/B, EV/EBITDA, ROE, ROA, Beta (live from Finnhub)
- **Real-time news** with sentiment scoring (live from Finnhub)
- **AI Analysis**: 5-agent TradingAgents-inspired workflow (Fundamental, Technical, Sentiment, Risk, Trader)
- **Live prices**: SignalR-powered ticker with 2s updates
- **Global markets**: US (NYSE/NASDAQ), HK (HKEX), CN (ADRs), EU (LSE/XETRA)

---

## License

MIT
