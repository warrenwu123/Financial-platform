using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using TerminalPro.API.Models;

namespace TerminalPro.API.Services;

public interface IFinnhubService
{
    Task<FinnhubQuote?>              GetQuoteAsync(string symbol);
    Task<List<OhlcBar>>              GetCandlesAsync(string symbol, string resolution, DateTime from, DateTime to);
    Task<FinnhubProfile?>            GetProfileAsync(string symbol);
    Task<FinnhubMetrics?>            GetMetricsAsync(string symbol);
    Task<FinnhubFinancials?>         GetFinancialsAsync(string symbol, string statement = "ic");
    Task<List<FinnhubNewsItem>>      GetCompanyNewsAsync(string symbol, DateTime from, DateTime to);
    Task<List<FinnhubRecommendation>>GetRecommendationsAsync(string symbol);
}

public class FinnhubService : IFinnhubService
{
    private readonly HttpClient    _http;
    private readonly IMemoryCache  _cache;
    private readonly string        _apiKey;
    private const    string        BASE = "https://finnhub.io/api/v1";

    public FinnhubService(IHttpClientFactory factory, IMemoryCache cache, IConfiguration config)
    {
        _http   = factory.CreateClient("finnhub");
        _cache  = cache;
        _apiKey = config["Finnhub:ApiKey"] ?? "";   // empty = no live data, still serves mock
    }

    private string Url(string path, string extra = "") =>
        $"{BASE}{path}?token={_apiKey}{extra}";

    private async Task<T?> GetAsync<T>(string url, TimeSpan? ttl = null) where T : class
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;
        if (ttl.HasValue && _cache.TryGetValue(url, out T? hit)) return hit;
        try
        {
            var res = await _http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync();
            var obj  = JsonSerializer.Deserialize<T>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (obj != null && ttl.HasValue) _cache.Set(url, obj, ttl.Value);
            return obj;
        }
        catch { return null; }
    }

    public Task<FinnhubQuote?> GetQuoteAsync(string symbol) =>
        GetAsync<FinnhubQuote>(Url("/quote", $"&symbol={symbol}"), TimeSpan.FromSeconds(15));

    public async Task<List<OhlcBar>> GetCandlesAsync(
        string symbol, string resolution, DateTime from, DateTime to)
    {
        var fromTs = ((DateTimeOffset)from).ToUnixTimeSeconds();
        var toTs   = ((DateTimeOffset)to).ToUnixTimeSeconds();
        var url    = Url("/stock/candle",
            $"&symbol={symbol}&resolution={resolution}&from={fromTs}&to={toTs}");
        var raw = await GetAsync<FinnhubCandleResponse>(url, TimeSpan.FromMinutes(5));
        if (raw?.S != "ok" || raw.C == null) return [];

        return raw.C.Select((c, i) => new OhlcBar
        {
            Date   = DateTimeOffset.FromUnixTimeSeconds(raw.T![i]).DateTime,
            Open   = (decimal)raw.O![i],
            High   = (decimal)raw.H![i],
            Low    = (decimal)raw.L![i],
            Close  = (decimal)c,
            Volume = raw.V![i],
        }).ToList();
    }

    public Task<FinnhubProfile?> GetProfileAsync(string symbol) =>
        GetAsync<FinnhubProfile>(Url("/stock/profile2", $"&symbol={symbol}"),
            TimeSpan.FromHours(24));

    public Task<FinnhubMetrics?> GetMetricsAsync(string symbol) =>
        GetAsync<FinnhubMetrics>(Url("/stock/metric", $"&symbol={symbol}&metric=all"),
            TimeSpan.FromHours(1));

    public Task<FinnhubFinancials?> GetFinancialsAsync(string symbol, string statement = "ic") =>
        GetAsync<FinnhubFinancials>(
            Url("/stock/financials", $"&symbol={symbol}&statement={statement}&freq=annual"),
            TimeSpan.FromHours(6));

    public async Task<List<FinnhubNewsItem>> GetCompanyNewsAsync(
        string symbol, DateTime from, DateTime to)
    {
        var url = Url("/company-news",
            $"&symbol={symbol}&from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}");
        return await GetAsync<List<FinnhubNewsItem>>(url, TimeSpan.FromMinutes(30)) ?? [];
    }

    public async Task<List<FinnhubRecommendation>> GetRecommendationsAsync(string symbol)
    {
        var url = Url("/stock/recommendation", $"&symbol={symbol}");
        return await GetAsync<List<FinnhubRecommendation>>(url, TimeSpan.FromHours(6)) ?? [];
    }
}
