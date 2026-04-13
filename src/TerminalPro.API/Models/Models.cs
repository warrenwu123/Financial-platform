// TerminalPro.API/Models/Models.cs
namespace TerminalPro.API.Models
{
    // ─── Market Data ──────────────────────────────────────────────────────────
    public record StockSnapshot
    {
        public string Ticker    { get; init; } = "";
        public Market Market    { get; init; }
        public double Open      { get; init; }
        public double High      { get; init; }
        public double Low       { get; init; }
        public double Close     { get; init; }
        public double Volume    { get; init; }
        public double Vwap      { get; init; }
        public double PrevClose { get; init; }
        public double Change    { get; init; }
        public double ChangePct { get; init; }
        public double LastPrice { get; init; }
        public double BidPrice  { get; init; }
        public double AskPrice  { get; init; }
        public DateTime Timestamp { get; init; }
    }

    public record AggBar
    {
        public DateTime Timestamp { get; init; }
        public double Open      { get; init; }
        public double High      { get; init; }
        public double Low       { get; init; }
        public double Close     { get; init; }
        public double Volume    { get; init; }
        public double Vwap      { get; init; }
        public int    NumTrades { get; init; }
    }

    public record TickerDetails
    {
        public string Ticker             { get; init; } = "";
        public string Name               { get; init; } = "";
        public string Description        { get; init; } = "";
        public string Sic                { get; init; } = "";
        public string Exchange           { get; init; } = "";
        public string CurrencyName       { get; init; } = "";
        public double MarketCap          { get; init; }
        public double SharesOutstanding  { get; init; }
        public string HomepageUrl        { get; init; } = "";
        public string LogoUrl            { get; init; } = "";
        public string Locale             { get; init; } = "";
        public string Type               { get; init; } = "";
        public bool   Active             { get; init; }
    }

    public record Ticker
    {
        public string Symbol   { get; init; } = "";
        public string Name     { get; init; } = "";
        public string Market   { get; init; } = "";
        public string Locale   { get; init; } = "";
        public string Type     { get; init; } = "";
        public string Currency { get; init; } = "";
        public string Exchange { get; init; } = "";
    }

    public record MarketStatus
    {
        public string Market                         { get; init; } = "";
        public string ServerTime                     { get; init; } = "";
        public Dictionary<string, string> Exchanges  { get; init; } = new();
        public Dictionary<string, string> Currencies { get; init; } = new();
    }

    // ─── Quantitative Stats ───────────────────────────────────────────────────
    public record QuantStats
    {
        public string Ticker       { get; init; } = "";
        public string Range        { get; init; } = "";
        public string? Error       { get; init; }
        public double AnnualReturn { get; init; }
        public double AnnualVol    { get; init; }
        public double Sharpe       { get; init; }
        public double Sortino      { get; init; }
        public double Calmar       { get; init; }
        public double MaxDrawdown  { get; init; }
        public double VaR95        { get; init; }
        public double CVaR95       { get; init; }
        public double Skewness     { get; init; }
        public double Kurtosis     { get; init; }
        public double WinRate      { get; init; }
        public double CAGR         { get; init; }
        public double TotalReturn  { get; init; }
        public int    SampleDays   { get; init; }
    }

    // ─── Indicators ───────────────────────────────────────────────────────────
    public record IndicatorRequest
    {
        public int[]  SMA             { get; init; } = Array.Empty<int>();
        public int[]  EMA             { get; init; } = Array.Empty<int>();
        public int    RSI             { get; init; } = 14;
        public bool   BollingerBands  { get; init; } = true;
        public bool   MACD            { get; init; } = true;
        public int    ATR             { get; init; } = 14;
        public bool   Stochastic      { get; init; } = false;
        public int    StochPeriod     { get; init; } = 14;
        public bool   VWAP            { get; init; } = false;
    }

    public record IndicatorSet
    {
        public List<AggBar>         Bars       { get; init; } = new();
        public List<IndicatorSeries> Indicators { get; init; } = new();
    }

    public record IndicatorSeries
    {
        public string              Name   { get; init; } = "";
        public List<IndicatorPoint> Points { get; init; } = new();
    }

    public record IndicatorPoint
    {
        public DateTime Timestamp { get; init; }
        public double?  Value     { get; init; }
    }

    // ─── News ─────────────────────────────────────────────────────────────────
    public record NewsItem
    {
        public string       Id          { get; init; } = Guid.NewGuid().ToString();
        public string       Title       { get; init; } = "";
        public string       Summary     { get; init; } = "";
        public string       Source      { get; init; } = "";
        public string       Url         { get; init; } = "";
        public DateTime     PublishedAt { get; init; }
        public string       Type        { get; init; } = "news";  // news | analyst | research
        public string       Sentiment   { get; init; } = "neutral";
        public string       Market      { get; init; } = "US";
        public List<string> Tickers     { get; init; } = new();
        public List<string> Tags        { get; init; } = new();
    }

    public record SentimentSummary
    {
        public string   Ticker  { get; init; } = "";
        public int      Bullish { get; init; }
        public int      Bearish { get; init; }
        public int      Neutral { get; init; }
        public int      Total   { get; init; }
        public double   Score   { get; init; }  // -1 to +1
        public DateTime AsOf    { get; init; }
    }

    // ─── Correlation ──────────────────────────────────────────────────────────
    public record CorrelationMatrix
    {
        public List<string> Tickers { get; init; } = new();
        public double[,]    Matrix  { get; init; } = new double[0,0];
        public DateTime     AsOf    { get; init; }
    }

    // ─── Real-time broadcast ──────────────────────────────────────────────────
    public record TickUpdate
    {
        public string   Ticker    { get; init; } = "";
        public double   Price     { get; init; }
        public double   Change    { get; init; }
        public double   ChangePct { get; init; }
        public double   Volume    { get; init; }
        public DateTime Timestamp { get; init; }
    }
}

// ── Finnhub Models ────────────────────────────────────────────────────────────
namespace TerminalPro.API.Models;

public record FinnhubQuote(
    decimal C,   // current price
    decimal H,   // high of day
    decimal L,   // low of day
    decimal O,   // open
    decimal Pc,  // previous close
    decimal D,   // change
    decimal Dp   // change %
);

public record FinnhubCandleResponse(
    double[]? C, double[]? H, double[]? L, double[]? O,
    long[]? T, long[]? V, string? S
);

public record FinnhubProfile(
    string? Name, string? Ticker, string? Exchange, string? Industry,
    string? Country, string? Currency, string? Ipo, double MarketCapitalization,
    double ShareOutstanding, string? Logo, string? Phone, string? WebUrl
);

public record FinnhubMetrics(Dictionary<string, JsonElement>? Metric, string? Symbol);

public record FinnhubFinancials(
    Dictionary<string, object>? Data,
    string? Symbol, string? Statement, string? Freq
);

public record FinnhubNewsItem(
    string? Category, long Datetime, string? Headline, long Id,
    string? Image, string? Related, string? Source, string? Summary, string? Url
);

public record FinnhubRecommendation(
    int Buy, int Hold, int Period, int Sell, string? Symbol, int StrongBuy, int StrongSell
);

// ── FMP Models ────────────────────────────────────────────────────────────────
public record FmpIncomeStatement(
    string? Date, string? Symbol, string? Period, string? ReportedCurrency,
    long Revenue, long CostOfRevenue, long GrossProfit,
    double GrossProfitRatio, long OperatingExpenses, long OperatingIncome,
    double OperatingIncomeRatio, long Ebitda, long NetIncome,
    double NetIncomeRatio, double Eps, double EpsDiluted,
    long InterestExpense, long IncomeTaxExpense
);

public record FmpBalanceSheet(
    string? Date, string? Symbol, string? Period,
    long CashAndCashEquivalents, long NetReceivables, long Inventory,
    long TotalCurrentAssets, long PropertyPlantEquipmentNet,
    long Goodwill, long IntangibleAssets, long TotalAssets,
    long AccountPayables, long ShortTermDebt, long TotalCurrentLiabilities,
    long LongTermDebt, long TotalLiabilities,
    long TotalStockholdersEquity, long TotalEquity,
    long RetainedEarnings
);

public record FmpCashFlowStatement(
    string? Date, string? Symbol, string? Period,
    long NetIncome, long DepreciationAndAmortization,
    long ChangeInWorkingCapital, long NetCashProvidedByOperatingActivities,
    long CapitalExpenditure, long Acquisitionsnet,
    long NetCashUsedForInvestingActivites,
    long CommonStockRepurchased, long DividendsPaid,
    long NetCashUsedProvidedByFinancingActivities,
    long FreeCashFlow
);

public record FmpKeyMetrics(
    string? Date, string? Symbol, string? Period,
    double PeRatio, double PriceToSalesRatio, double PbRatio,
    double EvToEbitda, double EvToSales, double ReturnOnEquity,
    double ReturnOnAssets, double DebtToEquity, double CurrentRatio,
    double DividendYield, double FreeCashFlowYield, double EarningsYield
);

public record FmpRatios(
    string? Date, string? Symbol, string? Period,
    double GrossProfitMargin, double NetProfitMargin, double OperatingProfitMargin,
    double ReturnOnEquity, double ReturnOnAssets, double DebtEquityRatio,
    double CurrentRatio, double QuickRatio, double PriceEarningsRatio,
    double PriceToFreeCashFlowsRatio, double DividendYield
);

public record FmpProfile(
    string? Symbol, double Price, long MktCap, string? CompanyName,
    string? Exchange, string? Industry, string? Sector, string? Country,
    string? Description, string? Ceo, string? Website, double Beta,
    double LastDiv, string? IpoDate
);

// ── Aggregated financial response ─────────────────────────────────────────────
public record FinancialsResponse(
    string Symbol,
    List<FmpIncomeStatement> IncomeStatements,
    List<FmpBalanceSheet> BalanceSheets,
    List<FmpCashFlowStatement> CashFlows,
    List<FmpKeyMetrics> KeyMetrics,
    List<FmpRatios> Ratios,
    FinnhubMetrics? FinnhubMetrics,
    bool IsLiveData,
    string DataSource
);
