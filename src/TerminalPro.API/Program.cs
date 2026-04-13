using TerminalPro.API.Services;
using TerminalPro.API.Hubs;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title       = "TerminalPro API",
        Version     = "v1",
        Description = "Financial terminal backend — Finnhub (prices) + FMP (financials)."
    });
});

// ── SignalR ───────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── Caching ───────────────────────────────────────────────────────────────────
builder.Services.AddMemoryCache();

// ── Named HTTP clients ────────────────────────────────────────────────────────
builder.Services.AddHttpClient("finnhub", c =>
{
    c.BaseAddress = new Uri("https://finnhub.io");
    c.DefaultRequestHeaders.Add("User-Agent", "TerminalPro/2.0");
    c.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient("fmp", c =>
{
    c.BaseAddress = new Uri("https://financialmodelingprep.com");
    c.DefaultRequestHeaders.Add("User-Agent", "TerminalPro/2.0");
    c.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options => options.AddPolicy("App", policy =>
    policy
        .WithOrigins("http://localhost", "http://localhost:80",
                     "http://localhost:5173", "http://localhost:4173")
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// ── App services ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IFinnhubService,   FinnhubService>();
builder.Services.AddSingleton<IFmpService,        FmpService>();
builder.Services.AddSingleton<IStatisticsService, StatisticsService>();
builder.Services.AddSingleton<INewsScraperService,NewsScraperService>();
builder.Services.AddHostedService<LivePriceBroadcaster>();
builder.Services.AddHealthChecks();

var app = builder.Build();

// ── Pipeline ──────────────────────────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "TerminalPro API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("App");
app.UseAuthorization();
app.MapControllers();
app.MapHub<MarketHub>("/hubs/market");
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run("http://0.0.0.0:5000");
