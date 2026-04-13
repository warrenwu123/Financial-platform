// TerminalPro.API/Services/NewsScraperService.cs
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TerminalPro.API.Models;

namespace TerminalPro.API.Services
{
    public interface INewsScraperService
    {
        Task<List<NewsItem>> GetNewsForTickerAsync(string ticker, int limit = 20);
        Task<List<NewsItem>> GetMarketNewsAsync(string category = "general", string market = "US", int limit = 30);
        Task<List<NewsItem>> GetAnalystReportsAsync(string ticker, int limit = 10);
        Task<SentimentSummary> GetSentimentAsync(string ticker);
    }

    public class NewsScraperService : INewsScraperService
    {
        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NewsScraperService> _logger;
        private readonly string _polygonKey;
        private readonly string _scraperUrl;
        private readonly string _anthropicKey;

        // ── Sources scraped by Python Scrapling microservice ──────────────────
        // Reuters, FT, Bloomberg (public), Seeking Alpha, MarketWatch, CNBC,
        // Goldman Sachs Insights, JPMorgan Research, Morgan Stanley Ideas,
        // Barclays Research, UBS Research (public), SCMP (Asia/HK)

        public NewsScraperService(IHttpClientFactory factory, IMemoryCache cache,
            IConfiguration config, ILogger<NewsScraperService> logger)
        {
            _http         = factory.CreateClient();
            _cache        = cache;
            _logger       = logger;
            _polygonKey   = config["Polygon:ApiKey"] ?? "";
            _scraperUrl   = config["ScraperService:Url"] ?? "http://localhost:8001";
            _anthropicKey = config["Anthropic:ApiKey"] ?? "";
        }

        public async Task<List<NewsItem>> GetNewsForTickerAsync(string ticker, int limit = 20)
        {
            var key = $"news_ticker_{ticker}";
            if (_cache.TryGetValue(key, out List<NewsItem> cached)) return cached;

            var results = new List<NewsItem>();

            // 1. Polygon.io news endpoint (free tier has news for US tickers)
            results.AddRange(await FetchPolygonNewsAsync(ticker, limit));

            // 2. Scrapling microservice for additional sources
            try { results.AddRange(await FetchScrapedAsync($"/news/ticker?ticker={ticker}&limit={limit}")); }
            catch (Exception ex) { _logger.LogWarning(ex, "Scraper unavailable for {Ticker}", ticker); }

            // 3. AI sentiment enrichment via Anthropic Claude
            if (!string.IsNullOrEmpty(_anthropicKey))
                results = await EnrichSentimentAsync(results);

            var final = results.OrderByDescending(n => n.PublishedAt)
                               .DistinctBy(n => n.Title[..Math.Min(60, n.Title.Length)])
                               .Take(limit).ToList();

            _cache.Set(key, final, TimeSpan.FromMinutes(5));
            return final;
        }

        public async Task<List<NewsItem>> GetMarketNewsAsync(string category = "general",
            string market = "US", int limit = 30)
        {
            var key = $"news_market_{market}_{category}";
            if (_cache.TryGetValue(key, out List<NewsItem> cached)) return cached;

            var results = new List<NewsItem>();
            try { results = await FetchScrapedAsync($"/news/market?category={category}&market={market}&limit={limit}"); }
            catch { results = await FetchPolygonNewsAsync("SPY", limit); } // fallback

            if (!string.IsNullOrEmpty(_anthropicKey))
                results = await EnrichSentimentAsync(results);

            _cache.Set(key, results, TimeSpan.FromMinutes(10));
            return results;
        }

        public async Task<List<NewsItem>> GetAnalystReportsAsync(string ticker, int limit = 10)
        {
            var key = $"analyst_{ticker}";
            if (_cache.TryGetValue(key, out List<NewsItem> cached)) return cached;

            var results = new List<NewsItem>();
            try { results = await FetchScrapedAsync($"/analyst?ticker={ticker}&limit={limit}"); }
            catch (Exception ex) { _logger.LogWarning(ex, "Analyst scraper unavailable for {Ticker}", ticker); }

            _cache.Set(key, results, TimeSpan.FromMinutes(30));
            return results;
        }

        public async Task<SentimentSummary> GetSentimentAsync(string ticker)
        {
            var news = await GetNewsForTickerAsync(ticker, 50);
            return new SentimentSummary
            {
                Ticker  = ticker,
                Bullish = news.Count(n => n.Sentiment == "bullish"),
                Bearish = news.Count(n => n.Sentiment == "bearish"),
                Neutral = news.Count(n => n.Sentiment == "neutral"),
                Total   = news.Count,
                Score   = news.Count > 0
                    ? (double)(news.Count(n => n.Sentiment == "bullish") -
                               news.Count(n => n.Sentiment == "bearish")) / news.Count : 0,
                AsOf    = DateTime.UtcNow,
            };
        }

        // ─── Private: Polygon news endpoint ──────────────────────────────────
        // Polygon /v2/reference/news?ticker=AAPL&limit=50
        private async Task<List<NewsItem>> FetchPolygonNewsAsync(string ticker, int limit)
        {
            if (string.IsNullOrEmpty(_polygonKey)) return new();
            var url = $"https://api.polygon.io/v2/reference/news?ticker={Uri.EscapeDataString(ticker)}&limit={limit}&apiKey={_polygonKey}";
            try
            {
                var resp = await _http.GetStringAsync(url);
                var json = JsonDocument.Parse(resp);
                if (!json.RootElement.TryGetProperty("results", out var results)) return new();

                return results.EnumerateArray().Select(n => new NewsItem
                {
                    Id          = n.TryGetProperty("id", out var id) ? id.GetString()! : Guid.NewGuid().ToString(),
                    Title       = n.GetProperty("title").GetString()!,
                    Summary     = n.TryGetProperty("description", out var d) ? d.GetString()! : "",
                    Source      = n.TryGetProperty("author", out var au) ? au.GetString()!
                                : n.TryGetProperty("publisher", out var pub) ? pub.GetProperty("name").GetString()! : "Polygon News",
                    Url         = n.TryGetProperty("article_url", out var url2) ? url2.GetString()! : "",
                    PublishedAt = n.TryGetProperty("published_utc", out var pu)
                        ? DateTime.Parse(pu.GetString()!) : DateTime.UtcNow,
                    Type        = "news",
                    Sentiment   = "neutral",
                    Market      = "US",
                    Tickers     = n.TryGetProperty("tickers", out var t)
                        ? t.EnumerateArray().Select(x => x.GetString()!).ToList() : new() { ticker },
                    Tags        = n.TryGetProperty("keywords", out var kw)
                        ? kw.EnumerateArray().Select(x => x.GetString()!).Take(5).ToList() : new(),
                }).ToList();
            }
            catch (Exception ex) { _logger.LogError(ex, "Polygon news failed for {Ticker}", ticker); return new(); }
        }

        // ─── Private: Scrapling microservice ─────────────────────────────────
        private async Task<List<NewsItem>> FetchScrapedAsync(string path)
        {
            var resp = await _http.GetStringAsync($"{_scraperUrl}{path}");
            return JsonSerializer.Deserialize<List<NewsItem>>(resp, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? new();
        }

        // ─── Private: Claude AI sentiment batch ───────────────────────────────
        private async Task<List<NewsItem>> EnrichSentimentAsync(List<NewsItem> items)
        {
            var batch = items.Take(25).ToList(); // batch limit
            if (batch.Count == 0) return items;

            var headlines = string.Join("\n", batch.Select((n, i) => $"{i}: {n.Title}"));
            var prompt = $@"Classify each financial headline as bullish, bearish, or neutral for equity markets.
Return ONLY a JSON array of {{""i"":index,""s"":""bullish|bearish|neutral""}} objects.
Headlines:
{headlines}";

            try
            {
                var payload = JsonSerializer.Serialize(new
                {
                    model = "claude-haiku-4-5-20251001",
                    max_tokens = 800,
                    messages = new[] { new { role = "user", content = prompt } }
                });
                var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
                req.Headers.Add("x-api-key", _anthropicKey);
                req.Headers.Add("anthropic-version", "2023-06-01");
                req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                var resp = await _http.SendAsync(req);
                var respText = await resp.Content.ReadAsStringAsync();
                var respJson = JsonDocument.Parse(respText);
                var content  = respJson.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "[]";

                // Extract JSON array from response
                var match = System.Text.RegularExpressions.Regex.Match(content, @"\[.*?\]", System.Text.RegularExpressions.RegexOptions.Singleline);
                if (match.Success)
                {
                    var arr = JsonDocument.Parse(match.Value).RootElement.EnumerateArray()
                        .ToDictionary(x => x.GetProperty("i").GetInt32(), x => x.GetProperty("s").GetString() ?? "neutral");
                    return items.Select((n, i) => i < batch.Count && arr.TryGetValue(i, out var s)
                        ? n with { Sentiment = s } : n).ToList();
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Claude sentiment enrichment failed"); }
            return items;
        }
    }
}
