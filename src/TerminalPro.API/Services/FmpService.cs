using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using TerminalPro.API.Models;

namespace TerminalPro.API.Services;

// ─────────────────────────────────────────────────────────────────────────────
// Financial Modeling Prep (FMP) Service
//   FREE tier: 250 req/day, historical prices, income/balance/cashflow (30yr)
//   Sign up: https://financialmodelingprep.com  →  set Fmp:ApiKey in appsettings.json
//
// Covered endpoints:
//   /v3/income-statement/{sym}       → annual / quarterly income statements
//   /v3/balance-sheet-statement/{sym}→ balance sheet
//   /v3/cash-flow-statement/{sym}    → cash flow statement
//   /v3/key-metrics/{sym}            → P/E, EV/EBITDA, ROE, FCF yield, etc.
//   /v3/financial-ratios/{sym}       → 50+ financial ratios
//   /v3/historical-price-full/{sym}  → OHLCV daily (fallback to Finnhub)
//   /v3/profile/{sym}                → company profile
//   /v3/analyst-stock-recommendations/{sym}
// ─────────────────────────────────────────────────────────────────────────────

public interface IFmpService
{
    Task<List<FmpIncomeStatement>> GetIncomeStatementsAsync(string symbol, string period = "annual", int limit = 5);
    Task<List<FmpBalanceSheet>> GetBalanceSheetsAsync(string symbol, string period = "annual", int limit = 5);
    Task<List<FmpCashFlowStatement>> GetCashFlowsAsync(string symbol, string period = "annual", int limit = 5);
    Task<List<FmpKeyMetrics>> GetKeyMetricsAsync(string symbol, string period = "annual", int limit = 5);
    Task<List<FmpRatios>> GetRatiosAsync(string symbol, string period = "annual", int limit = 5);
    Task<FmpProfile?> GetProfileAsync(string symbol);
}

public class FmpService : IFmpService
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly string _apiKey;
    private const string BASE = "https://financialmodelingprep.com/api";

    public FmpService(IHttpClientFactory factory, IMemoryCache cache, IConfiguration config)
    {
        _http   = factory.CreateClient("fmp");
        _cache  = cache;
        _apiKey = config["Fmp:ApiKey"] ?? "";  // empty = mock data mode
    }

    private string Url(string path, string extra = "") =>
        $"{BASE}{path}?apikey={_apiKey}{extra}";

    private async Task<T?> GetAsync<T>(string url, TimeSpan? ttl = null) where T : class
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;
        if (ttl.HasValue && _cache.TryGetValue(url, out T? hit)) return hit;
        try
        {
            var res = await _http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync();
            var obj  = JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (obj != null && ttl.HasValue) _cache.Set(url, obj, ttl.Value);
            return obj;
        }
        catch { return null; }
    }

    public Task<List<FmpIncomeStatement>?> GetISRaw(string s, string p, int n) =>
        GetAsync<List<FmpIncomeStatement>>(Url($"/v3/income-statement/{s}", $"&period={p}&limit={n}"), TimeSpan.FromHours(6));

    public async Task<List<FmpIncomeStatement>> GetIncomeStatementsAsync(string symbol, string period = "annual", int limit = 5) =>
        await GetISRaw(symbol, period, limit) ?? [];

    public async Task<List<FmpBalanceSheet>> GetBalanceSheetsAsync(string symbol, string period = "annual", int limit = 5) =>
        await GetAsync<List<FmpBalanceSheet>>(Url($"/v3/balance-sheet-statement/{symbol}", $"&period={period}&limit={limit}"), TimeSpan.FromHours(6)) ?? [];

    public async Task<List<FmpCashFlowStatement>> GetCashFlowsAsync(string symbol, string period = "annual", int limit = 5) =>
        await GetAsync<List<FmpCashFlowStatement>>(Url($"/v3/cash-flow-statement/{symbol}", $"&period={period}&limit={limit}"), TimeSpan.FromHours(6)) ?? [];

    public async Task<List<FmpKeyMetrics>> GetKeyMetricsAsync(string symbol, string period = "annual", int limit = 5) =>
        await GetAsync<List<FmpKeyMetrics>>(Url($"/v3/key-metrics/{symbol}", $"&period={period}&limit={limit}"), TimeSpan.FromHours(6)) ?? [];

    public async Task<List<FmpRatios>> GetRatiosAsync(string symbol, string period = "annual", int limit = 5) =>
        await GetAsync<List<FmpRatios>>(Url($"/v3/ratios/{symbol}", $"&period={period}&limit={limit}"), TimeSpan.FromHours(6)) ?? [];

    public async Task<FmpProfile?> GetProfileAsync(string symbol) =>
        (await GetAsync<List<FmpProfile>>(Url($"/v3/profile/{symbol}"), TimeSpan.FromHours(24)))?.FirstOrDefault();
}
