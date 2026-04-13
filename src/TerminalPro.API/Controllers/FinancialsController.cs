using Microsoft.AspNetCore.Mvc;
using TerminalPro.API.Models;
using TerminalPro.API.Services;

namespace TerminalPro.API.Controllers;

// ─────────────────────────────────────────────────────────────────────────────
// Financials Controller
//   GET /api/v1/financials/{symbol}?period=annual&limit=5
//       → Income statements + Balance sheets + Cash flows + Key metrics
//         Primary: FMP (free 250 req/day) with Finnhub metrics overlay
//         Fallback: mock data when no API key configured
//
//   GET /api/v1/financials/{symbol}/income?period=annual&limit=5
//   GET /api/v1/financials/{symbol}/balance?period=annual&limit=5
//   GET /api/v1/financials/{symbol}/cashflow?period=annual&limit=5
//   GET /api/v1/financials/{symbol}/metrics
// ─────────────────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/v1/financials")]
public class FinancialsController : ControllerBase
{
    private readonly IFmpService _fmp;
    private readonly IFinnhubService _finnhub;

    public FinancialsController(IFmpService fmp, IFinnhubService finnhub)
    {
        _fmp     = fmp;
        _finnhub = finnhub;
    }

    /// <summary>Full financials bundle: income + balance + cashflow + metrics + ratios</summary>
    [HttpGet("{symbol}")]
    public async Task<IActionResult> GetAll(
        string symbol,
        [FromQuery] string period = "annual",
        [FromQuery] int limit = 5)
    {
        symbol = symbol.ToUpperInvariant();

        var (income, balance, cashflow, metrics, ratios, finnhubMetrics) = await (
            _fmp.GetIncomeStatementsAsync(symbol, period, limit),
            _fmp.GetBalanceSheetsAsync(symbol, period, limit),
            _fmp.GetCashFlowsAsync(symbol, period, limit),
            _fmp.GetKeyMetricsAsync(symbol, period, limit),
            _fmp.GetRatiosAsync(symbol, period, limit),
            _finnhub.GetMetricsAsync(symbol)
        ).WhenAll();

        bool isLive = income.Count > 0;
        string src  = isLive ? "FMP + Finnhub" : "Mock data (configure Fmp:ApiKey and Finnhub:ApiKey)";

        return Ok(new FinancialsResponse(
            symbol, income, balance, cashflow, metrics, ratios, finnhubMetrics, isLive, src
        ));
    }

    [HttpGet("{symbol}/income")]
    public async Task<IActionResult> GetIncome(string symbol, [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetIncomeStatementsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/balance")]
    public async Task<IActionResult> GetBalance(string symbol, [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetBalanceSheetsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/cashflow")]
    public async Task<IActionResult> GetCashflow(string symbol, [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetCashFlowsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/metrics")]
    public async Task<IActionResult> GetMetrics(string symbol, [FromQuery] string period = "annual", [FromQuery] int limit = 5)
    {
        symbol = symbol.ToUpperInvariant();
        var (fmpMetrics, finnhubMetrics) = await (
            _fmp.GetKeyMetricsAsync(symbol, period, limit),
            _finnhub.GetMetricsAsync(symbol)
        ).WhenAll();
        return Ok(new { fmpMetrics, finnhubMetrics });
    }
}

// Tuple deconstruct helper for parallel async
file static class TaskExtensions
{
    public static async Task<(T1,T2,T3,T4,T5,T6)> WhenAll<T1,T2,T3,T4,T5,T6>(
        this (Task<T1> t1, Task<T2> t2, Task<T3> t3, Task<T4> t4, Task<T5> t5, Task<T6> t6) tasks)
    {
        await Task.WhenAll(tasks.t1, tasks.t2, tasks.t3, tasks.t4, tasks.t5, tasks.t6);
        return (tasks.t1.Result, tasks.t2.Result, tasks.t3.Result, tasks.t4.Result, tasks.t5.Result, tasks.t6.Result);
    }

    public static async Task<(T1,T2)> WhenAll<T1,T2>(this (Task<T1> t1, Task<T2> t2) tasks)
    {
        await Task.WhenAll(tasks.t1, tasks.t2);
        return (tasks.t1.Result, tasks.t2.Result);
    }
}
