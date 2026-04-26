using System.Text.Json;
using TerminalPro.API.Models;

namespace TerminalPro.API.Services;

public interface INewsScraperService
{
    Task<List<NewsItem>>    GetMarketNewsAsync(string category = "general");
    Task<SentimentSummary> GetSentimentAsync(string symbol);
}

public class NewsScraperService : INewsScraperService
{
    private readonly HttpClient   _http;
    private readonly ILogger<NewsScraperService> _logger;
    private readonly string       _scraperUrl;

    public NewsScraperService(
        IHttpClientFactory factory,
        ILogger<NewsScraperService> logger,
        IConfiguration config)
    {
        _http       = factory.CreateClient();
        _logger     = logger;
        _scraperUrl = config["ScraperService:Url"] ?? "http://scraper:8001";
    }

    public async Task<List<NewsItem>> GetMarketNewsAsync(string category = "general")
    {
        try
        {
            var res = await _http.GetAsync($"{_scraperUrl}/news/market?category={category}");
            if (!res.IsSuccessStatusCode) return [];
            var json  = await res.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<NewsItem>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Scraper unavailable: {msg}", ex.Message);
            return [];
        }
    }

    public async Task<SentimentSummary> GetSentimentAsync(string symbol)
    {
        try
        {
            var res = await _http.GetAsync($"{_scraperUrl}/news/sentiment/{symbol}");
            if (!res.IsSuccessStatusCode) return EmptySentiment(symbol);
            var json = await res.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<SentimentSummary>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? EmptySentiment(symbol);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Scraper unavailable: {msg}", ex.Message);
            return EmptySentiment(symbol);
        }
    }

    private static SentimentSummary EmptySentiment(string symbol) =>
        new() { Ticker = symbol, AsOf = DateTime.UtcNow };
}
