using System.Text.Json;

namespace TerminalPro.API.Models
{
    // ── Enums ─────────────────────────────────────────────────────────────────
    public enum Market { US, HK, CN, EU }

    // ── Market Data ───────────────────────────────────────────────────────────
    public record StockSnapshot
    {
        public string   Ticker    { get; init; } = "";
        public Market   Market    { get; init; }
        public double   Open      { get; init; }
        public double   High      { get; init; }
        public double   Low       { get; init; }
        public double   Close     { get; init; }
        public double   Volume    { get; init; }
        public double   PrevClose { get; init; }
        public double   Change    { get; init; }
        public double   ChangePct { get; init; }
        public double   LastPrice { get; init; }
        public DateTime Timestamp { get; init; }
    }

    public record OhlcBar
    {
        public DateTime Date   { get; init; }
        public decimal  Open   { get; init; }
        public decimal  High   { get; init; }
        public decimal  Low    { get; init; }
        public decimal  Close  { get; init; }
        public long     Volume { get; init; }
    }

    public record TickerDetails
    {
        public string Ticker   { get; init; } = "";
        public string Name     { get; init; } = "";
        public string Exchange { get; init; } = "";
        public double MarketCap { get; init; }
    }

    public record MarketStatus
    {
        public string Market      { get; init; } = "";
        public string ServerTime  { get; init; } = "";
    }

    // ── Quantitative Stats ────────────────────────────────────────────────────
    public record QuantStats
    {
        public string  Ticker       { get; init; } = "";
        public string  Range        { get; init; } = "";
        public string? Error        { get; init; }
        public double  AnnualReturn { get; init; }
        public double  AnnualVol    { get; init; }
        public double  Sharpe       { get; init; }
        public double  Sortino      { get; init; }
        public double  MaxDrawdown  { get; init; }
        public double  VaR95        { get; init; }
        public double  WinRate      { get; init; }
        public double  CAGR         { get; init; }
        public int     SampleDays   { get; init; }
    }

    // ── News ──────────────────────────────────────────────────────────────────
    public record NewsItem
    {
        public string       Id          { get; init; } = Guid.NewGuid().ToString();
        public string       Title       { get; init; } = "";
        public string       Summary     { get; init; } = "";
        public string       Source      { get; init; } = "";
        public string       Url         { get; init; } = "";
        public string       ImageUrl    { get; init; } = "";
        public DateTime     PublishedAt { get; init; }
        public string       Sentiment   { get; init; } = "neutral";
        public List<string> Tickers     { get; init; } = new();
    }

    public record SentimentSummary
    {
        public string   Ticker  { get; init; } = "";
        public int      Bullish { get; init; }
        public int      Bearish { get; init; }
        public int      Neutral { get; init; }
        public double   Score   { get; init; }
        public DateTime AsOf    { get; init; }
    }

    // ── Real-time broadcast ───────────────────────────────────────────────────
    public record TickUpdate(
        string  Ticker,
        decimal Price,
        decimal Change,
        double  ChangePct
    );

    // ── Finnhub models ────────────────────────────────────────────────────────
    public record FinnhubQuote(
        decimal C,    // current price
        decimal H,    // high of day
        decimal L,    // low of day
        decimal O,    // open
        decimal Pc,   // previous close
        decimal D,    // change
        decimal Dp    // change %
    );

    public record FinnhubCandleResponse(
        double[]? C, double[]? H, double[]? L, double[]? O,
        long[]? T,   long[]? V,  string?   S
    );

    public record FinnhubProfile(
        string? Name, string? Ticker, string? Exchange, string? Industry,
        string? Country, string? Currency, string? Ipo,
        double  MarketCapitalization, double ShareOutstanding,
        string? Logo, string? Phone, string? WebUrl
    );

    public record FinnhubMetrics(
        Dictionary<string, JsonElement>? Metric,
        string? Symbol
    );

    public record FinnhubFinancials(
        Dictionary<string, object>? Data,
        string? Symbol, string? Statement, string? Freq
    );

    public record FinnhubNewsItem(
        string? Category, long Datetime, string? Headline, long Id,
        string? Image,    string? Related, string? Source,
        string? Summary,  string? Url
    );

    public record FinnhubRecommendation(
        int Buy, int Hold, string? Period, int Sell,
        string? Symbol, int StrongBuy, int StrongSell
    );

    // ── FMP models ────────────────────────────────────────────────────────────
    public record FmpIncomeStatement(
        string? Date, string? Symbol, string? Period,
        long    Revenue, long CostOfRevenue, long GrossProfit,
        double  GrossProfitRatio, long OperatingExpenses, long OperatingIncome,
        long    Ebitda, long NetIncome, double NetIncomeRatio,
        double  Eps, double EpsDiluted, long InterestExpense, long IncomeTaxExpense
    );

    public record FmpBalanceSheet(
        string? Date, string? Symbol, string? Period,
        long    CashAndCashEquivalents, long NetReceivables, long Inventory,
        long    TotalCurrentAssets, long PropertyPlantEquipmentNet,
        long    Goodwill, long IntangibleAssets, long TotalAssets,
        long    ShortTermDebt, long TotalCurrentLiabilities,
        long    LongTermDebt, long TotalLiabilities,
        long    TotalStockholdersEquity, long TotalEquity
    );

    public record FmpCashFlowStatement(
        string? Date, string? Symbol, string? Period,
        long    NetIncome, long DepreciationAndAmortization,
        long    ChangeInWorkingCapital,
        long    NetCashProvidedByOperatingActivities,
        long    CapitalExpenditure, long Acquisitionsnet,
        long    NetCashUsedForInvestingActivites,
        long    CommonStockRepurchased, long DividendsPaid,
        long    NetCashUsedProvidedByFinancingActivities,
        long    FreeCashFlow
    );

    public record FmpKeyMetrics(
        string? Date, string? Symbol, string? Period,
        double  PeRatio, double PriceToSalesRatio, double PbRatio,
        double  EvToEbitda, double EvToSales, double ReturnOnEquity,
        double  ReturnOnAssets, double DebtToEquity, double CurrentRatio,
        double  DividendYield, double FreeCashFlowYield
    );

    public record FmpRatios(
        string? Date, string? Symbol, string? Period,
        double  GrossProfitMargin, double NetProfitMargin,
        double  OperatingProfitMargin, double ReturnOnEquity,
        double  ReturnOnAssets, double DebtEquityRatio,
        double  CurrentRatio, double QuickRatio,
        double  PriceEarningsRatio, double DividendYield
    );

    public record FmpProfile(
        string? Symbol, double Price, long MktCap, string? CompanyName,
        string? Exchange, string? Industry, string? Sector, string? Country,
        string? Description, string? Ceo, string? Website,
        double  Beta, double LastDiv, string? IpoDate
    );

    public record FinancialsResponse(
        string                    Symbol,
        List<FmpIncomeStatement>  IncomeStatements,
        List<FmpBalanceSheet>     BalanceSheets,
        List<FmpCashFlowStatement>CashFlows,
        List<FmpKeyMetrics>       KeyMetrics,
        List<FmpRatios>           Ratios,
        FinnhubMetrics?           FinnhubMetrics,
        bool                      IsLiveData,
        string                    DataSource
    );
}
