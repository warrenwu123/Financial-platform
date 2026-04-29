using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TerminalPro.API.Models;
using TerminalPro.API.Services;

namespace TerminalPro.API.Controllers
{
    // ─── Market Controller ─────────────────────────────────────────────────────
    [ApiController]
    [Route("api/v1/market")]
    public class MarketController : ControllerBase
    {
        private readonly IFinnhubService  _finnhub;
        private readonly IStatisticsService _stats;

        public MarketController(IFinnhubService finnhub, IStatisticsService stats)
        {
            _finnhub = finnhub;
            _stats   = stats;
        }

        /// <summary>Real-time quote for a single symbol</summary>
        [HttpGet("snapshot/{symbol}")]
        public async Task<IActionResult> Snapshot(string symbol)
        {
            var q = await _finnhub.GetQuoteAsync(symbol.ToUpperInvariant());
            if (q is null) return NotFound();
            return Ok(q);
        }

        /// <summary>OHLCV candle bars</summary>
        [HttpGet("candles/{symbol}")]
        public async Task<IActionResult> Candles(
            string symbol,
            [FromQuery] string resolution = "D",
            [FromQuery] long?  from       = null,
            [FromQuery] long?  to         = null)
        {
            var now  = DateTimeOffset.UtcNow;
            var fromDt = from.HasValue
                ? DateTimeOffset.FromUnixTimeSeconds(from.Value).UtcDateTime
                : now.AddMonths(-6).UtcDateTime;
            var toDt = to.HasValue
                ? DateTimeOffset.FromUnixTimeSeconds(to.Value).UtcDateTime
                : now.UtcDateTime;

            var bars = await _finnhub.GetCandlesAsync(symbol.ToUpperInvariant(), resolution, fromDt, toDt);
            return Ok(bars);
        }

        /// <summary>Company profile</summary>
        [HttpGet("profile/{symbol}")]
        public async Task<IActionResult> Profile(string symbol)
        {
            var profile = await _finnhub.GetProfileAsync(symbol.ToUpperInvariant());
            if (profile is null) return NotFound();
            return Ok(profile);
        }

        /// <summary>Key financial metrics (70+ ratios)</summary>
        [HttpGet("metrics/{symbol}")]
        public async Task<IActionResult> Metrics(string symbol)
        {
            var m = await _finnhub.GetMetricsAsync(symbol.ToUpperInvariant());
            if (m is null) return NotFound();
            return Ok(m);
        }

        /// <summary>Analyst buy/hold/sell recommendations</summary>
        [HttpGet("recommendations/{symbol}")]
        public async Task<IActionResult> Recommendations(string symbol)
        {
            var r = await _finnhub.GetRecommendationsAsync(symbol.ToUpperInvariant());
            return Ok(r);
        }

        /// <summary>Symbol search</summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q)) return BadRequest("q is required");
            // Use Finnhub /search endpoint via metrics as a passthrough
            var result = await _finnhub.GetProfileAsync(q.ToUpperInvariant());
            return Ok(result);
        }
    }

    // ─── News Controller ───────────────────────────────────────────────────────
    [ApiController]
    [Route("api/v1/news")]
    public class NewsController : ControllerBase
    {
        private readonly IFinnhubService      _finnhub;
        private readonly INewsScraperService  _scraper;

        public NewsController(IFinnhubService finnhub, INewsScraperService scraper)
        {
            _finnhub = finnhub;
            _scraper = scraper;
        }

        /// <summary>Company news (last N days)</summary>
        [HttpGet("ticker/{symbol}")]
        public async Task<IActionResult> CompanyNews(string symbol, [FromQuery] int days = 7)
        {
            var to   = DateTime.UtcNow;
            var from = to.AddDays(-days);
            var items = await _finnhub.GetCompanyNewsAsync(symbol.ToUpperInvariant(), from, to);
            return Ok(items);
        }

        /// <summary>General market news</summary>
        [HttpGet("market")]
        public async Task<IActionResult> MarketNews([FromQuery] string category = "general")
        {
            var items = await _scraper.GetMarketNewsAsync(category);
            return Ok(items);
        }

        /// <summary>AI sentiment summary for a ticker</summary>
        [HttpGet("sentiment/{symbol}")]
        public async Task<IActionResult> Sentiment(string symbol)
        {
            var s = await _scraper.GetSentimentAsync(symbol.ToUpperInvariant());
            return Ok(s);
        }
    }
}

namespace TerminalPro.API.Hubs
{
    // ─── SignalR Hub ──────────────────────────────────────────────────────────
    public class MarketHub : Hub
    {
        public async Task Subscribe(string symbol)
            => await Groups.AddToGroupAsync(Context.ConnectionId, symbol.ToUpperInvariant());

        public async Task Unsubscribe(string symbol)
            => await Groups.RemoveFromGroupAsync(Context.ConnectionId, symbol.ToUpperInvariant());

        public async Task SubscribeAll()
            => await Groups.AddToGroupAsync(Context.ConnectionId, "ALL");
    }
}

namespace TerminalPro.API.Services
{
    // ─── Background broadcaster ───────────────────────────────────────────────
    /// <summary>Pushes simulated live price ticks to SignalR clients every 2 seconds.</summary>
    public class LivePriceBroadcaster : BackgroundService
    {
        private readonly IHubContext<TerminalPro.API.Hubs.MarketHub> _hub;
        private readonly IFinnhubService _finnhub;
        private readonly ILogger<LivePriceBroadcaster> _logger;

        // Well-known symbols to broadcast
        private static readonly string[] Symbols =
        [
            "AAPL","MSFT","NVDA","JPM","TSLA","AMZN","GOOGL","META",
            "TCEHY","BABA","FXI","ASML","SAP","SHEL","TM"
        ];

        private readonly Dictionary<string, decimal> _lastPrices = new();
        private readonly Random _rng = new();

        public LivePriceBroadcaster(
            IHubContext<TerminalPro.API.Hubs.MarketHub> hub,
            IFinnhubService finnhub,
            ILogger<LivePriceBroadcaster> logger)
        {
            _hub     = hub;
            _finnhub = finnhub;
            _logger  = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken ct)
        {
            // Seed last-known prices from Finnhub quotes (best-effort)
            foreach (var sym in Symbols)
            {
                try
                {
                    var q = await _finnhub.GetQuoteAsync(sym);
                    if (q is not null) _lastPrices[sym] = q.C;
                }
                catch { /* ignore — will use 0 as seed */ }
            }

            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(2000, ct);

                foreach (var sym in Symbols)
                {
                    if (!_lastPrices.TryGetValue(sym, out var last)) last = 100m;
                    var tick  = (decimal)(_rng.NextDouble() - 0.5) * last * 0.0008m;
                    var price = Math.Round(last + tick, 2);
                    _lastPrices[sym] = price;

                    var update = new TickUpdate(sym, price, tick, (double)Math.Round(tick / last * 100, 3));
                    try
                    {
                        await _hub.Clients.Group(sym).SendAsync("Tick", update, ct);
                        await _hub.Clients.Group("ALL").SendAsync("MarketUpdate", update, ct);
                    }
                    catch (Exception ex) { _logger.LogDebug("Broadcast error: {msg}", ex.Message); }
                }
            }
        }
    }
}
