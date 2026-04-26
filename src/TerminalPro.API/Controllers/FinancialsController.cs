using Microsoft.AspNetCore.Mvc;
using TerminalPro.API.Models;
using TerminalPro.API.Services;

namespace TerminalPro.API.Controllers;

[ApiController]
[Route("api/v1/financials")]
public class FinancialsController : ControllerBase
{
    private readonly IFmpService      _fmp;
    private readonly IFinnhubService  _finnhub;

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
        [FromQuery] int    limit  = 5)
    {
        symbol = symbol.ToUpperInvariant();

        var incomeTask   = _fmp.GetIncomeStatementsAsync(symbol, period, limit);
        var balanceTask  = _fmp.GetBalanceSheetsAsync(symbol, period, limit);
        var cashflowTask = _fmp.GetCashFlowsAsync(symbol, period, limit);
        var metricsTask  = _fmp.GetKeyMetricsAsync(symbol, period, limit);
        var ratiosTask   = _fmp.GetRatiosAsync(symbol, period, limit);
        var fhMetricTask = _finnhub.GetMetricsAsync(symbol);

        await Task.WhenAll(incomeTask, balanceTask, cashflowTask,
                           metricsTask, ratiosTask, fhMetricTask);

        bool isLive = incomeTask.Result.Count > 0;
        return Ok(new FinancialsResponse(
            symbol,
            incomeTask.Result,
            balanceTask.Result,
            cashflowTask.Result,
            metricsTask.Result,
            ratiosTask.Result,
            fhMetricTask.Result,
            isLive,
            isLive ? "FMP + Finnhub" : "No API keys configured — set Fmp:ApiKey and Finnhub:ApiKey"
        ));
    }

    [HttpGet("{symbol}/income")]
    public async Task<IActionResult> GetIncome(string symbol,
        [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetIncomeStatementsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/balance")]
    public async Task<IActionResult> GetBalance(string symbol,
        [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetBalanceSheetsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/cashflow")]
    public async Task<IActionResult> GetCashflow(string symbol,
        [FromQuery] string period = "annual", [FromQuery] int limit = 5) =>
        Ok(await _fmp.GetCashFlowsAsync(symbol.ToUpperInvariant(), period, limit));

    [HttpGet("{symbol}/metrics")]
    public async Task<IActionResult> GetMetrics(string symbol,
        [FromQuery] string period = "annual", [FromQuery] int limit = 5)
    {
        symbol = symbol.ToUpperInvariant();
        var fmpMetrics     = await _fmp.GetKeyMetricsAsync(symbol, period, limit);
        var finnhubMetrics = await _finnhub.GetMetricsAsync(symbol);
        return Ok(new { fmpMetrics, finnhubMetrics });
    }
}
