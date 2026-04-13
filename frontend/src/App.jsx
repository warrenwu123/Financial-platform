import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";

// ─── Global API key context — avoids prop-drilling the Finnhub key ─────────────
const ApiCtx = createContext({ finnhubKey: "" });

// ─── TradingView Dark Theme Colors ────────────────────────────────────────────
const TV = {
  // Exact TradingView dark theme palette
  bg:         "#131722",   // main background
  bg2:        "#1e222d",   // panel background
  bg3:        "#2a2e39",   // elevated surface
  bg4:        "#363a45",   // hover / border
  border:     "#2a2e39",
  borderHi:   "#363a45",
  text:       "#d1d4dc",   // primary text
  textDim:    "#787b86",   // secondary text
  textFaint:  "#4c525e",   // disabled
  textHi:     "#ffffff",
  // Brand / accent
  blue:       "#2962ff",   // TradingView blue
  blueLight:  "#5b9cf6",
  // Candle colors (TradingView defaults)
  bull:       "#26a69a",   // up candle
  bear:       "#ef5350",   // down candle
  bullBg:     "rgba(38,166,154,0.1)",
  bearBg:     "rgba(239,83,80,0.1)",
  // Indicator colors
  sma20:      "#f9a825",
  sma50:      "#7c4dff",
  ema:        "#00bcd4",
  bb:         "#e040fb",
  vol:        "#434651",
  macd:       "#2196f3",
  signal:     "#ff6d00",
  rsi:        "#7c4dff",
  // Grid
  grid:       "#1e222d",
  crosshair:  "#555",
  font:       "'Trebuchet MS','Helvetica Neue',Helvetica,Arial,sans-serif",
  mono:       "'Roboto Mono','Courier New',monospace",
};

// ─── Instruments ──────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  {sym:"AAPL",  name:"Apple Inc.",         mkt:"US",exch:"NASDAQ",sector:"Technology",    base:189.30,fmp:"AAPL", finnhub:"AAPL"},
  {sym:"MSFT",  name:"Microsoft Corp.",    mkt:"US",exch:"NASDAQ",sector:"Technology",    base:415.80,fmp:"MSFT", finnhub:"MSFT"},
  {sym:"NVDA",  name:"NVIDIA Corp.",       mkt:"US",exch:"NASDAQ",sector:"Semiconductors",base:878.40,fmp:"NVDA", finnhub:"NVDA"},
  {sym:"JPM",   name:"JPMorgan Chase",     mkt:"US",exch:"NYSE",  sector:"Financials",    base:199.20,fmp:"JPM",  finnhub:"JPM"},
  {sym:"TSLA",  name:"Tesla Inc.",         mkt:"US",exch:"NASDAQ",sector:"EV/Auto",       base:172.60,fmp:"TSLA", finnhub:"TSLA"},
  {sym:"AMZN",  name:"Amazon.com",         mkt:"US",exch:"NASDAQ",sector:"E-Commerce",    base:183.50,fmp:"AMZN", finnhub:"AMZN"},
  {sym:"GOOGL", name:"Alphabet Inc.",      mkt:"US",exch:"NASDAQ",sector:"Technology",    base:165.00,fmp:"GOOGL",finnhub:"GOOGL"},
  {sym:"META",  name:"Meta Platforms",     mkt:"US",exch:"NASDAQ",sector:"Technology",    base:520.00,fmp:"META", finnhub:"META"},
  {sym:"TCEHY", name:"Tencent Holdings",   mkt:"HK",exch:"HKEX",  sector:"Technology",    base:42.80, fmp:"TCEHY",finnhub:"TCEHY"},
  {sym:"BABA",  name:"Alibaba Group",      mkt:"HK",exch:"NYSE",  sector:"E-Commerce",    base:82.40, fmp:"BABA", finnhub:"BABA"},
  {sym:"FXI",   name:"iShares China ETF",  mkt:"CN",exch:"NYSE",  sector:"China Index",   base:26.80, fmp:"FXI",  finnhub:"FXI"},
  {sym:"ASML",  name:"ASML Holding NV",    mkt:"EU",exch:"NASDAQ",sector:"Semiconductors",base:910.50,fmp:"ASML", finnhub:"ASML"},
  {sym:"SAP",   name:"SAP SE",             mkt:"EU",exch:"NYSE",  sector:"Enterprise SW", base:218.40,fmp:"SAP",  finnhub:"SAP"},
  {sym:"SHEL",  name:"Shell PLC",          mkt:"EU",exch:"NYSE",  sector:"Energy",        base:66.20, fmp:"SHEL", finnhub:"SHEL"},
  {sym:"TM",    name:"Toyota Motor",       mkt:"EU",exch:"NYSE",  sector:"Automotive",    base:188.60,fmp:"TM",   finnhub:"TM"},
];

const MKT_FLAGS = {US:"🇺🇸",HK:"🇭🇰",CN:"🇨🇳",EU:"🇪🇺"};

// ─── Timeframes ───────────────────────────────────────────────────────────────
const TF_GROUPS = [
  {group:"INTRADAY",items:[
    {tf:"1m", label:"1m", gran:"minute", mins:1,   barCount:120},
    {tf:"5m", label:"5m", gran:"minute", mins:5,   barCount:100},
    {tf:"15m",label:"15m",gran:"minute", mins:15,  barCount:96},
    {tf:"30m",label:"30m",gran:"minute", mins:30,  barCount:48},
    {tf:"1h", label:"1H", gran:"hour",   mins:60,  barCount:72},
    {tf:"4h", label:"4H", gran:"hour",   mins:240, barCount:42},
    {tf:"1D", label:"1D", gran:"intraday1D",        barCount:78},
  ]},
  {group:"SWING",items:[
    {tf:"1W", label:"1W", gran:"day",    barCount:5},
    {tf:"1M", label:"1M", gran:"day",    barCount:22},
    {tf:"3M", label:"3M", gran:"day",    barCount:66},
    {tf:"6M", label:"6M", gran:"day",    barCount:130},
    {tf:"YTD",label:"YTD",gran:"day",    barCount:"ytd"},
  ]},
  {group:"LONG TERM",items:[
    {tf:"1Y", label:"1Y", gran:"week",   barCount:52},
    {tf:"2Y", label:"2Y", gran:"week",   barCount:104},
    {tf:"3Y", label:"3Y", gran:"week",   barCount:156},
    {tf:"5Y", label:"5Y", gran:"month",  barCount:60},
    {tf:"10Y",label:"10Y",gran:"month",  barCount:120},
    {tf:"MAX",label:"ALL",gran:"month",  barCount:240},
  ]},
];
const ALL_TFS = TF_GROUPS.flatMap(g=>g.items);
const getTFCfg = tf => ALL_TFS.find(t=>t.tf===tf) || ALL_TFS.find(t=>t.tf==="6M");

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────
function _mkRng(sym, tag="") {
  let h = 2166136261;
  for (const ch of sym+tag) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s>>>15), 1|s);
    t ^= t + Math.imul(t ^ (t>>>7), 61|t);
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  };
}

// ─── Bar cache + generator ────────────────────────────────────────────────────
const _barCache = {};

function genBars(tf, sym, base) {
  const key = `${sym}:${tf}`;
  if (_barCache[key]) return _barCache[key];

  const cfg = getTFCfg(tf);
  const { gran } = cfg;
  const rng = _mkRng(sym, tf);
  let barCount = cfg.barCount;
  if (barCount === "ytd") {
    const n = new Date(); barCount = Math.floor((n - new Date(n.getFullYear(),0,1))/86400000*5/7)||1;
  }

  const data = []; let p = base; const now = new Date();

  const bar = (vol=2e6) => {
    const v = p * 0.018;
    const o = p+(rng()-.5)*v, c = o+(rng()-.5)*v*1.6;
    return { o:+o.toFixed(4), h:+(Math.max(o,c)+rng()*v*.7).toFixed(4),
             l:+(Math.min(o,c)-rng()*v*.7).toFixed(4), c:+c.toFixed(4),
             vol:Math.floor(rng()*vol+vol*.2) };
  };

  if (gran==="intraday1D") {
    const s0 = new Date(now); s0.setHours(9,30,0,0);
    for (let i=0;i<78;i++) {
      const t = new Date(s0.getTime()+i*5*60000);
      const v=p*0.004;
      const o=p+(rng()-.5)*v, c=o+(rng()-.5)*v*1.4;
      p=c;
      data.push({time:Math.floor(t/1000),open:+o.toFixed(3),high:+(Math.max(o,c)+rng()*v*.4).toFixed(3),low:+(Math.min(o,c)-rng()*v*.4).toFixed(3),close:+c.toFixed(3),volume:Math.floor(rng()*1.5e6+5e4)});
    }
  } else if (gran==="minute"||gran==="hour") {
    const mins=cfg.mins||1;
    const s0=new Date(now); s0.setHours(9,30,0,0);
    for (let i=0;i<barCount;i++) {
      const t=new Date(s0.getTime()+i*mins*60000);
      const v=p*0.005*Math.sqrt(mins);
      const o=p+(rng()-.5)*v, c=o+(rng()-.5)*v*1.4;
      p=c;
      data.push({time:Math.floor(t/1000),open:+o.toFixed(3),high:+(Math.max(o,c)+rng()*v*.5).toFixed(3),low:+(Math.min(o,c)-rng()*v*.5).toFixed(3),close:+c.toFixed(3),volume:Math.floor(rng()*2e6+1e5)});
    }
  } else if (gran==="day") {
    for (let i=barCount;i>=0;i--) {
      const d=new Date(now); d.setDate(d.getDate()-i);
      if (d.getDay()===0||d.getDay()===6) continue;
      const b=bar(70e6); p=b.c;
      data.push({time:d.toISOString().slice(0,10),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.vol});
    }
  } else if (gran==="week") {
    for (let i=barCount;i>=0;i--) {
      const d=new Date(now); d.setDate(d.getDate()-i*7);
      const v=p*0.04;
      const o=p+(rng()-.5)*v, c=o+(rng()-.5)*v*2;
      p=c;
      data.push({time:d.toISOString().slice(0,10),open:+o.toFixed(2),high:+(Math.max(o,c)+rng()*v).toFixed(2),low:+(Math.min(o,c)-rng()*v).toFixed(2),close:+c.toFixed(2),volume:Math.floor(rng()*350e6+50e6)});
    }
  } else {
    for (let i=barCount;i>=0;i--) {
      const d=new Date(now); d.setMonth(d.getMonth()-i);
      const v=p*0.09;
      const o=p+(rng()-.5)*v, c=o+(rng()-.5)*v*2.2;
      p=c;
      data.push({time:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`,open:+o.toFixed(2),high:+(Math.max(o,c)+rng()*v*1.2).toFixed(2),low:+(Math.min(o,c)-rng()*v*1.2).toFixed(2),close:+c.toFixed(2),volume:Math.floor(rng()*1e9+2e8)});
    }
  }

  const result = typeof barCount==="number" ? data.slice(-barCount) : data;
  _barCache[key] = result;
  return result;
}

// ─── Indicator math ───────────────────────────────────────────────────────────
function calcSMA(data, n) {
  return data.map((d,i) => {
    if (i<n-1) return null;
    const avg = data.slice(i-n+1,i+1).reduce((s,x)=>s+x.close,0)/n;
    return {time:d.time, value:+avg.toFixed(3)};
  }).filter(Boolean);
}

function calcEMA(data, n) {
  const k=2/(n+1); let e=data[0]?.close||0;
  return data.map((d,i) => {
    e = i===0 ? d.close : d.close*k+e*(1-k);
    return {time:d.time, value:+e.toFixed(3)};
  });
}

function calcBB(data, n=20, mult=2) {
  const upper=[], mid=[], lower=[];
  data.forEach((d,i) => {
    if (i<n-1) return;
    const sl=data.slice(i-n+1,i+1), m=sl.reduce((s,x)=>s+x.close,0)/n;
    const sd=Math.sqrt(sl.reduce((s,x)=>s+(x.close-m)**2,0)/n);
    upper.push({time:d.time,value:+(m+mult*sd).toFixed(3)});
    mid.push({time:d.time,value:+m.toFixed(3)});
    lower.push({time:d.time,value:+(m-mult*sd).toFixed(3)});
  });
  return {upper,mid,lower};
}

function calcRSI(data, n=14) {
  return data.map((d,i) => {
    if (i<n) return null;
    const ch=data.slice(i-n+1,i+1).map((x,j,a)=>j===0?0:x.close-a[j-1].close);
    const g=ch.filter(c=>c>0).reduce((s,c)=>s+c,0)/n;
    const l=Math.abs(ch.filter(c=>c<0).reduce((s,c)=>s+c,0))/n;
    return {time:d.time,value:+(l===0?100:100-100/(1+g/l)).toFixed(2)};
  }).filter(Boolean);
}

function calcMACD(data) {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macdLine = data.map((d, i) => ({
    time:  d.time,
    value: +(ema12[i].value - ema26[i].value).toFixed(4),
    close: +(ema12[i].value - ema26[i].value).toFixed(4), // for calcEMA input
  }));
  const rawSignal = calcEMA(macdLine, 9); // calcEMA reads .close
  const signalLine = rawSignal.map((s, i) => ({ time: macdLine[i].time, value: s.value }));
  const hist = macdLine.map((d, i) => ({
    time:  d.time,
    value: +(d.value - signalLine[i].value).toFixed(4),
    color: (d.value - signalLine[i].value) >= 0 ? TV.bull : TV.bear,
  }));
  return { macdLine, signalLine, hist };
}

function calcVolume(data) {
  return data.map(d=>({time:d.time,value:d.volume,color:d.close>=d.open?TV.bull+"99":TV.bear+"99"}));
}

// ─── Finnhub live fetch ───────────────────────────────────────────────────────
function finnhubParams(tf) {
  const now = Math.floor(Date.now()/1000), D=86400;
  const map={
    "1m":{res:"1",from:now-D},"5m":{res:"5",from:now-D},
    "15m":{res:"15",from:now-2*D},"30m":{res:"30",from:now-3*D},
    "1h":{res:"60",from:now-5*D},"4h":{res:"60",from:now-14*D},
    "1D":{res:"5",from:now-D},"1W":{res:"D",from:now-7*D},
    "1M":{res:"D",from:now-30*D},"3M":{res:"D",from:now-90*D},
    "6M":{res:"D",from:now-180*D},
    "YTD":{res:"D",from:new Date(new Date().getFullYear(),0,1)/1000|0},
    "1Y":{res:"W",from:now-365*D},"2Y":{res:"W",from:now-730*D},
    "3Y":{res:"W",from:now-1095*D},"5Y":{res:"M",from:now-1825*D},
    "10Y":{res:"M",from:now-3650*D},"MAX":{res:"M",from:now-7300*D},
  };
  return map[tf]||map["6M"];
}

async function fetchFinnhubCandles(symbol, tf, apiKey) {
  const {res,from}=finnhubParams(tf);
  const to=Math.floor(Date.now()/1000);
  const r=await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${res}&from=${from}&to=${to}&token=${apiKey}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j=await r.json();
  if (j.s!=="ok"||!j.c?.length) throw new Error(j.s==="no_data"?"no_data":"empty");
  return j.t.map((t,i)=>({
    time:["D","W","M"].includes(res)?new Date(t*1000).toISOString().slice(0,10):t,
    open:+j.o[i].toFixed(4),high:+j.h[i].toFixed(4),
    low:+j.l[i].toFixed(4),close:+j.c[i].toFixed(4),volume:j.v[i]||0,
  }));
}

// ─── Finnhub: financial metrics (key ratios, 70+ fields) ──────────────────────
// Endpoint: GET /stock/metric?symbol=AAPL&metric=all
// Free tier: yes · Cache: 1 hour
async function fetchFinnhubMetrics(symbol, apiKey) {
  const r = await fetch(
    `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.metric) throw new Error("No metric data");
  const m = j.metric;
  // Normalise into the same shape FinancialsTab expects for ratioCards
  return {
    pe:          m["peNormalizedAnnual"]?.toFixed(1)  ?? m["peTTM"]?.toFixed(1)       ?? "—",
    fwdPe:       m["peForwardAnnual"]?.toFixed(1)    ?? "—",
    ps:          m["psTTM"]?.toFixed(1)               ?? "—",
    pb:          m["pbAnnual"]?.toFixed(1)            ?? "—",
    evEbitda:    m["evEbitda"]?.toFixed(1)            ?? "—",
    roe:         m["roeRfy"]?.toFixed(1)              ?? m["roeTTM"]?.toFixed(1)       ?? "—",
    roa:         m["roaRfy"]?.toFixed(1)              ?? m["roaTTM"]?.toFixed(1)       ?? "—",
    divYield:    m["dividendYieldIndicatedAnnual"]?.toFixed(2) ?? "0.00",
    eps:         m["epsTTM"]?.toFixed(2)              ?? "—",
    beta:        m["beta"]?.toFixed(2)                ?? "—",
    wk52hi:      m["52WeekHigh"]?.toFixed(2)          ?? "—",
    wk52lo:      m["52WeekLow"]?.toFixed(2)           ?? "—",
    mktCap:      m["marketCapitalization"]            ?? null,   // in millions
    revenueGrowth: m["revenueGrowthTTMYoy"]?.toFixed(1) ?? "—",
    grossMargin: m["grossMarginTTM"]?.toFixed(1)      ?? "—",
    netMargin:   m["netProfitMarginTTM"]?.toFixed(1)  ?? "—",
    currentRatio:m["currentRatioAnnual"]?.toFixed(2)  ?? "—",
    debtEquity:  m["totalDebt/totalEquityAnnual"]?.toFixed(2) ?? "—",
  };
}

// ─── Finnhub: basic financials (income, balance, cashflow — normalised) ────────
// Endpoint: GET /stock/financials?symbol=AAPL&statement=ic&freq=annual
// Note: structured statements (as-reported) need premium; basic-financials is free
async function fetchFinnhubBasicFinancials(symbol, apiKey) {
  const r = await fetch(
    `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.series?.annual) throw new Error("No annual series");
  const ann = j.series.annual;

  // Helper: extract N most-recent values from a series array [{period,v}]
  const extract = (key, n=5) => (ann[key] || [])
    .sort((a,b) => b.period.localeCompare(a.period))
    .slice(0, n)
    .map(x => ({ year: x.period.slice(0,4), value: x.v }));

  const revenues     = extract("revenue");
  const grossProfits = extract("grossProfit");
  const ebitdas      = extract("ebitda");
  const netIncomes   = extract("netIncome");
  const epsList      = extract("eps");
  const totalAssets  = extract("totalAssets");
  const totalDebt    = extract("totalDebt");
  const cashflow     = extract("freeCashFlow");
  const capex        = extract("capitalExpenditures");

  const years = revenues.map(x => x.year).filter(Boolean);
  if (!years.length) throw new Error("Empty series");

  const income = years.map((yr, i) => {
    const rev  = revenues[i]?.value      ?? 0;
    const gp   = grossProfits[i]?.value  ?? 0;
    const ebit = ebitdas[i]?.value       ?? 0;
    const ni   = netIncomes[i]?.value    ?? 0;
    return {
      year: "FY" + yr,
      revenue:    rev,
      grossProfit:gp,
      ebit,
      netIncome:  ni,
      eps:        epsList[i]?.value?.toFixed(2) ?? "—",
      grossMargin: rev ? +(gp/rev*100).toFixed(1) : 0,
      ebitMargin:  rev ? +(ebit/rev*100).toFixed(1) : 0,
      netMargin:   rev ? +(ni/rev*100).toFixed(1) : 0,
    };
  });

  const balance = years.map((yr, i) => ({
    year:           "FY" + yr,
    totalAssets:    totalAssets[i]?.value   ?? 0,
    longTermDebt:   totalDebt[i]?.value     ?? 0,
    totalLiabilities:0, totalEquity:0,
    cash:0, accountsReceivable:0, inventory:0,
    debtToEquity:"—", currentRatio:"—",
  }));

  const cf = years.map((yr, i) => ({
    year:         "FY" + yr,
    freeCashFlow: cashflow[i]?.value ?? 0,
    capex:        -(capex[i]?.value ?? 0),
    operatingCF:  (cashflow[i]?.value ?? 0) + (capex[i]?.value ?? 0),
    dividendsPaid:0, buybacks:0,
    netIncome:    netIncomes[i]?.value ?? 0,
    da:0,
    fcfMargin: revenues[i]?.value ? +((cashflow[i]?.value??0)/revenues[i].value*100).toFixed(1) : 0,
  }));

  return { income, balance, cashflow: cf };
}

// ─── Finnhub: company news ────────────────────────────────────────────────────
// Endpoint: GET /company-news?symbol=AAPL&from=2025-01-01&to=2025-04-13
// Free tier: yes · Returns up to 50 articles per call
async function fetchFinnhubNews(symbol, apiKey, days = 7) {
  const to   = new Date();
  const from = new Date(to - days * 86400000);
  const fmt  = d => d.toISOString().slice(0, 10);
  const r = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const articles = await r.json();
  if (!Array.isArray(articles) || articles.length === 0) throw new Error("no_data");

  return articles.slice(0, 30).map((a, i) => ({
    id:       a.id || i,
    src:      a.source || "Unknown",
    title:    a.headline || "",
    body:     a.summary  || "",
    url:      a.url      || "",
    image:    a.image    || "",
    ago:      timeAgo(a.datetime * 1000),
    ts:       a.datetime * 1000,
    // Finnhub doesn't provide sentiment — derive from headline keywords
    sent:     deriveSentiment(a.headline || ""),
    tags:     [symbol],
  }));
}

// ─── Finnhub: general market news (fallback when no symbol) ───────────────────
async function fetchFinnhubMarketNews(apiKey, category = "general") {
  const r = await fetch(
    `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const articles = await r.json();
  if (!Array.isArray(articles)) throw new Error("no_data");
  return articles.slice(0, 20).map((a, i) => ({
    id: a.id || i,
    src: a.source || "Unknown",
    title: a.headline || "",
    body: a.summary || "",
    url: a.url || "",
    image: a.image || "",
    ago: timeAgo(a.datetime * 1000),
    ts: a.datetime * 1000,
    sent: deriveSentiment(a.headline || ""),
    tags: [],
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return s + "s";
  if (s < 3600) return Math.floor(s/60) + "m";
  if (s < 86400)return Math.floor(s/3600) + "h";
  return Math.floor(s/86400) + "d";
}

function deriveSentiment(headline) {
  const h = headline.toLowerCase();
  const bullWords = ["beat","beats","raises","upgrade","buy","bullish","surge","jump","gains","record","strong","positive","growth","profit","outperform","rally","soar","boost"];
  const bearWords = ["miss","misses","cut","downgrade","sell","bearish","drop","fall","loss","weak","negative","decline","warning","below","concern","slump","sink","risk"];
  const bs = bullWords.filter(w => h.includes(w)).length;
  const bb = bearWords.filter(w => h.includes(w)).length;
  if (bs > bb) return "bullish";
  if (bb > bs) return "bearish";
  return "neutral";
}


function _buildFinancials(sym, base) {
  const rng=_mkRng(sym), rev=base*0.55e8;
  const yrs=["FY2024","FY2023","FY2022","FY2021","FY2020"];
  const income=yrs.map((yr,i)=>{
    const r=rev*(1-i*.07)*(0.92+rng()*.16), cogs=r*(0.38+rng()*.08), gross=r-cogs;
    const opex=r*(0.18+rng()*.06), ebit=gross-opex, tax=ebit*.18, net=ebit-r*.01-tax;
    return {year:yr,revenue:r,cogs,grossProfit:gross,opex,ebit,netIncome:net,
      eps:+(net/(base*1.5e8)).toFixed(2),grossMargin:+(gross/r*100).toFixed(1),
      ebitMargin:+(ebit/r*100).toFixed(1),netMargin:+(net/r*100).toFixed(1)};
  });
  const balance=yrs.map((yr,i)=>{
    const a=rev*(1.8-i*.05)*(0.9+rng()*.2);
    const cash=a*(0.12+rng()*.08),ar=a*(0.1+rng()*.05),inv=a*(0.05+rng()*.03);
    const curL=a*(0.15+rng()*.05),ltD=a*(0.2+rng()*.1),totL=curL+ltD+a*.05;
    return {year:yr,cash,accountsReceivable:ar,inventory:inv,currentAssets:cash+ar+inv,
      ppe:a*(0.25+rng()*.1),totalAssets:a,currentLiabilities:curL,longTermDebt:ltD,
      totalLiabilities:totL,totalEquity:a-totL,debtToEquity:+(ltD/(a-totL)).toFixed(2),
      currentRatio:+((cash+ar+inv)/curL).toFixed(2)};
  });
  const cashflow=yrs.map((yr,i)=>{
    const ni=income[i].netIncome, da=rev*(0.04+rng()*.02)*(1-i*.06);
    const opCF=ni+da+ni*(-(rng()*.1));
    const capex=-(rev*(0.05+rng()*.04)*(1-i*.05));
    const fcf=opCF+capex;
    return {year:yr,netIncome:ni,da,operatingCF:opCF,capex,
      dividendsPaid:-(ni*.15),buybacks:-(ni*.1),freeCashFlow:fcf,
      fcfMargin:+(fcf/rev*100).toFixed(1)};
  });
  const rr=_mkRng(sym,"_r");
  const ratios={pe:+(18+rr()*22).toFixed(1),fwdPe:+(15+rr()*18).toFixed(1),
    ps:+(4+rr()*8).toFixed(1),pb:+(2+rr()*12).toFixed(1),
    evEbitda:+(10+rr()*20).toFixed(1),roe:+(12+rr()*30).toFixed(1),
    roa:+(4+rr()*14).toFixed(1),divYield:+(rr()*2.5).toFixed(2)};
  return {income,balance,cashflow,ratios};
}
const MOCK_FINANCIALS=Object.fromEntries(INSTRUMENTS.map(i=>[i.sym,_buildFinancials(i.sym,i.base)]));

// ─── News data ────────────────────────────────────────────────────────────────
const NEWS_FEED=[
  {id:1,src:"Goldman Sachs",type:"analyst",ago:"1h",sent:"bullish",mkt:"US",sym:"NVDA",title:"NVDA: Raising PT to $1,100 on Blackwell Upside",body:"We raise our 12-month price target following better-than-expected Blackwell chip yield rates and accelerating hyperscaler capex.",tags:["NVDA","AI","PT Raise"]},
  {id:2,src:"Bloomberg",type:"news",ago:"2h",sent:"neutral",mkt:"US",sym:"ALL",title:"Fed Minutes Show Officials Split on Rate Cuts",body:"Federal Reserve meeting minutes revealed significant disagreement among officials about when conditions will be appropriate to begin easing policy.",tags:["Fed","Macro","Rates"]},
  {id:3,src:"Morgan Stanley",type:"analyst",ago:"3h",sent:"bearish",mkt:"HK",sym:"BABA",title:"Alibaba: Downgrade to Equal-Weight",body:"We downgrade BABA on continued uncertainty around SAMR regulatory posture and intensifying domestic competition.",tags:["BABA","China","Downgrade"]},
  {id:4,src:"Reuters",type:"news",ago:"4h",sent:"bullish",mkt:"EU",sym:"ASML",title:"ASML Books Record Litho Orders on AI Demand",body:"ASML reported a record order intake of EUR 9.2bn in Q4, driven by strong demand for High-NA EUV lithography systems.",tags:["ASML","EUV","Semis"]},
  {id:5,src:"JPMorgan",type:"analyst",ago:"5h",sent:"bullish",mkt:"HK",sym:"TCEHY",title:"China Internet: Tactical Buy on PBOC Stimulus",body:"Following PBOC 50bp RRR cut we see tactical upside of 15-20% in HK-listed China internet.",tags:["TCEHY","China","Stimulus"]},
  {id:6,src:"FT",type:"news",ago:"6h",sent:"neutral",mkt:"EU",sym:"ALL",title:"ECB Signals Cautious Path on Sticky Inflation",body:"ECB officials signalled a data-dependent approach to rate cuts after Eurozone services inflation came in above target.",tags:["ECB","Europe","Macro"]},
  {id:7,src:"Barclays",type:"analyst",ago:"8h",sent:"bullish",mkt:"US",sym:"MSFT",title:"US Tech: AI Infrastructure Cycle Has Years of Runway",body:"CIO survey confirms AI budgets are up 35% YoY. We model $250bn in AI infrastructure spend by 2027E.",tags:["MSFT","NVDA","AI"]},
];

// ─── Number formatters ────────────────────────────────────────────────────────
const fmtNum=(n,c=true)=>{
  if (n==null||isNaN(n)) return "—";
  const abs=Math.abs(n),s=n<0?"-":"";
  if (!c) return s+"$"+abs.toLocaleString("en-US",{maximumFractionDigits:0});
  if (abs>=1e12) return s+"$"+(abs/1e12).toFixed(2)+"T";
  if (abs>=1e9)  return s+"$"+(abs/1e9).toFixed(2)+"B";
  if (abs>=1e6)  return s+"$"+(abs/1e6).toFixed(2)+"M";
  return s+"$"+abs.toFixed(0);
};
const pct=v=>v==null?"—":(v>0?"+":"")+v.toFixed(1)+"%";
const priceColor=v=>v>=0?TV.bull:TV.bear;

// ══════════════════════════════════════════════════════════════════════════════
// TV CHART COMPONENT — lightweight-charts v5
// Key fix: lightweight-charts needs an explicit pixel height on the container.
// autoSize:true alone fails when the parent is a flex child with no resolved px height.
// Solution: ResizeObserver on the wrapper → explicit width/height on the inner div.
// ══════════════════════════════════════════════════════════════════════════════
function TVChart({ data, indicators }) {
  const wrapRef      = useRef(null);   // outer flex container (no explicit size)
  const innerRef     = useRef(null);   // inner div given explicit px size
  const chartRef     = useRef(null);
  const seriesRefs   = useRef({});
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Measure the flex wrapper, then give inner div those exact pixels
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Create chart once inner div has real pixels
  useEffect(() => {
    if (!innerRef.current || size.w === 0 || size.h === 0) return;
    if (chartRef.current) return; // already created

    const chart = createChart(innerRef.current, {
      width:  size.w,
      height: size.h,
      layout: {
        background: { type:"solid", color:TV.bg },
        textColor: TV.textDim,
        fontFamily: TV.font,
        fontSize: 11,
      },
      grid: {
        vertLines: { color:TV.grid, style:1 },
        horzLines: { color:TV.grid, style:1 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color:TV.crosshair, labelBackgroundColor:TV.bg3 },
        horzLine: { color:TV.crosshair, labelBackgroundColor:TV.bg3 },
      },
      rightPriceScale: {
        borderColor: TV.border,
        textColor: TV.textDim,
        scaleMargins: { top:0.08, bottom:0.25 },
      },
      timeScale: {
        borderColor: TV.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
        fixLeftEdge: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor:      TV.bull,
      downColor:    TV.bear,
      borderVisible: false,
      wickUpColor:  TV.bull,
      wickDownColor:TV.bear,
    });
    seriesRefs.current.candles = candles;

    // Volume overlaid at bottom 20% of the same pane
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat:     { type:"volume" },
      priceScaleId:    "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top:0.82, bottom:0 },
    });
    seriesRefs.current.volume = volume;

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = {};
    };
  }, [size.w > 0 && size.h > 0]); // only run once we have real size

  // Resize chart when container changes
  useEffect(() => {
    if (chartRef.current && size.w > 0 && size.h > 0) {
      chartRef.current.resize(size.w, size.h);
    }
  }, [size.w, size.h]);

  // Update data + indicators whenever they change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.length) return;
    const s = seriesRefs.current;

    s.candles?.setData(data);
    s.volume?.setData(calcVolume(data));

    // Remove old indicator series
    ["sma20","sma50","ema20","bbU","bbM","bbL"].forEach(k => {
      if (s[k]) { try { chart.removeSeries(s[k]); } catch {} delete s[k]; }
    });

    if (indicators.sma20) {
      s.sma20 = chart.addSeries(LineSeries, { color:TV.sma20, lineWidth:1, priceLineVisible:false, lastValueVisible:true, crosshairMarkerVisible:false });
      s.sma20.setData(calcSMA(data, 20));
    }
    if (indicators.sma50) {
      s.sma50 = chart.addSeries(LineSeries, { color:TV.sma50, lineWidth:1, priceLineVisible:false, lastValueVisible:true, crosshairMarkerVisible:false });
      s.sma50.setData(calcSMA(data, 50));
    }
    if (indicators.ema20) {
      s.ema20 = chart.addSeries(LineSeries, { color:TV.ema, lineWidth:1, priceLineVisible:false, lastValueVisible:true, crosshairMarkerVisible:false });
      s.ema20.setData(calcEMA(data, 20));
    }
    if (indicators.bb) {
      const { upper, mid, lower } = calcBB(data);
      const bbOpt = { color:TV.bb, lineWidth:1, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false };
      s.bbU = chart.addSeries(LineSeries, { ...bbOpt, lineStyle:2 }); s.bbU.setData(upper);
      s.bbM = chart.addSeries(LineSeries, { ...bbOpt });              s.bbM.setData(mid);
      s.bbL = chart.addSeries(LineSeries, { ...bbOpt, lineStyle:2 }); s.bbL.setData(lower);
    }

    chart.timeScale().fitContent();
  }, [data, indicators]);

  return (
    <div ref={wrapRef} style={{ width:"100%", height:"100%", overflow:"hidden" }}>
      <div ref={innerRef} style={{ width:size.w, height:size.h }}/>
    </div>
  );
}


// ─── Sub-chart (RSI / MACD / Volume) — ResizeObserver + destroy/recreate ─────
function TVSubChart({ data, type }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const chartRef = useRef(null);
  const [size, setSize] = useState({ w:0, h:0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!innerRef.current || size.w === 0 || size.h === 0 || !data?.length) return;

    // Destroy previous chart cleanly
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(innerRef.current, {
      width: size.w, height: size.h,
      layout: { background:{type:"solid",color:TV.bg}, textColor:TV.textDim, fontFamily:TV.font, fontSize:10 },
      grid: { vertLines:{color:TV.grid,style:1}, horzLines:{color:TV.grid,style:1} },
      crosshair: { mode:1, vertLine:{color:TV.crosshair,labelBackgroundColor:TV.bg3}, horzLine:{color:TV.crosshair,labelBackgroundColor:TV.bg3} },
      rightPriceScale: { borderColor:TV.border, textColor:TV.textDim, scaleMargins:{top:0.05,bottom:0.05} },
      timeScale: { borderColor:TV.border, timeVisible:true, secondsVisible:false },
      handleScroll:true, handleScale:true,
    });
    chartRef.current = chart;

    if (type === "RSI") {
      const rsiData = calcRSI(data);
      const rsi = chart.addSeries(LineSeries, { color:TV.rsi, lineWidth:1.5, priceLineVisible:false, lastValueVisible:true });
      rsi.setData(rsiData);
      const times = data.map(d => d.time);
      const ob = chart.addSeries(LineSeries, { color:"rgba(239,83,80,0.35)", lineWidth:1, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false });
      ob.setData(times.map(t => ({ time:t, value:70 })));
      const os = chart.addSeries(LineSeries, { color:"rgba(38,166,154,0.35)", lineWidth:1, priceLineVisible:false, lastValueVisible:false, crosshairMarkerVisible:false });
      os.setData(times.map(t => ({ time:t, value:30 })));
    } else if (type === "MACD") {
      const { hist, macdLine, signalLine } = calcMACD(data);
      const h = chart.addSeries(HistogramSeries, { priceLineVisible:false, lastValueVisible:false });
      h.setData(hist);
      const m = chart.addSeries(LineSeries, { color:TV.macd, lineWidth:1.2, priceLineVisible:false, lastValueVisible:true });
      m.setData(macdLine);
      const sig = chart.addSeries(LineSeries, { color:TV.signal, lineWidth:1.2, priceLineVisible:false, lastValueVisible:true });
      sig.setData(signalLine);
    } else {
      const v = chart.addSeries(HistogramSeries, { priceLineVisible:false, lastValueVisible:true });
      v.setData(calcVolume(data));
    }
    chart.timeScale().fitContent();

    return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [data, type, size.w, size.h]);

  return (
    <div ref={wrapRef} style={{ width:"100%", height:"100%", overflow:"hidden" }}>
      <div ref={innerRef} style={{ width:size.w, height:size.h }}/>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// WATCHLIST PANEL
// ══════════════════════════════════════════════════════════════════════════════
function WatchlistPanel({ instruments, live, selected, onSelect, width }) {
  const [mktFilter, setMktFilter] = useState("ALL");
  const filtered = instruments.filter(i=>mktFilter==="ALL"||i.mkt===mktFilter);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:TV.bg2,borderRight:`1px solid ${TV.border}`}}>
      {/* Market filter */}
      <div style={{padding:"6px 8px",borderBottom:`1px solid ${TV.border}`,display:"flex",gap:2}}>
        {["ALL","US","HK","CN","EU"].map(m=>(
          <button key={m} onClick={()=>setMktFilter(m)} style={{
            flex:1,padding:"3px 0",fontSize:10,cursor:"pointer",fontFamily:TV.font,
            background:mktFilter===m?TV.blue:"transparent",
            border:`1px solid ${mktFilter===m?TV.blue:TV.border}`,
            color:mktFilter===m?TV.textHi:TV.textDim,borderRadius:2,
          }}>{m}</button>
        ))}
      </div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",borderBottom:`1px solid ${TV.border}`}}>
        <span style={{fontSize:10,color:TV.textFaint,fontWeight:600}}>SYMBOL</span>
        <span style={{fontSize:10,color:TV.textFaint}}>LAST / CHG%</span>
      </div>
      {/* List */}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.map(ins=>{
          const d=live[ins.sym]||{price:ins.base,pct:0};
          const up=d.pct>=0, active=selected.sym===ins.sym;
          return (
            <div key={ins.sym} onClick={()=>onSelect(ins)}
              style={{padding:"7px 10px",cursor:"pointer",display:"flex",
                justifyContent:"space-between",alignItems:"center",
                background:active?TV.bg3:"transparent",
                borderLeft:`2px solid ${active?TV.blue:"transparent"}`,
                borderBottom:`1px solid ${TV.border}20`}}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.background=TV.bg3+"80";}}
              onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:active?TV.textHi:TV.text}}>{ins.sym}</div>
                <div style={{fontSize:9,color:TV.textFaint,marginTop:1,
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:width-90}}>
                  {ins.name}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:TV.textHi,fontVariantNumeric:"tabular-nums"}}>{d.price?.toFixed(2)}</div>
                <div style={{fontSize:9,color:up?TV.bull:TV.bear}}>{up?"+":""}{d.pct?.toFixed(2)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCIALS TAB
// ══════════════════════════════════════════════════════════════════════════════
function FinancialsTab({ inst }) {
  const { finnhubKey } = useContext(ApiCtx);
  const [tab, setTab]         = useState("INCOME");
  const [liveMetrics, setLiveMetrics] = useState(null);   // from /stock/metric
  const [liveStatements, setLiveStatements] = useState(null); // from series.annual
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [dataSource, setDataSource] = useState("mock");

  // Fetch from Finnhub whenever symbol or API key changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLiveMetrics(null); setLiveStatements(null); setError("");
      if (!finnhubKey?.trim()) { setDataSource("mock"); return; }

      setLoading(true);
      try {
        // Both calls share the same /stock/metric endpoint (it includes series.annual)
        const [metrics, statements] = await Promise.all([
          fetchFinnhubMetrics(inst.sym, finnhubKey),
          fetchFinnhubBasicFinancials(inst.sym, finnhubKey),
        ]);
        if (cancelled) return;
        setLiveMetrics(metrics);
        setLiveStatements(statements);
        setDataSource("live");
      } catch (e) {
        if (cancelled) return;
        // Graceful fallback: show mock data + error note
        setError(e.message.includes("No annual series")
          ? "Annual series not available for this symbol on free tier — showing mock data"
          : `Finnhub error: ${e.message} — showing mock data`);
        setDataSource("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [inst.sym, finnhubKey]);

  // Use live data if available, else fall back to mock
  const mock = MOCK_FINANCIALS[inst.sym] || MOCK_FINANCIALS["AAPL"];
  const fin  = liveStatements || mock;

  // Key ratio cards — prefer live metrics, fall back to mock ratios
  const m = liveMetrics;
  const mr = mock.ratios;
  const fmtMktCap = v => v == null ? "—" : v >= 1e6 ? "$"+(v/1e6).toFixed(2)+"T" : v >= 1e3 ? "$"+(v/1e3).toFixed(1)+"B" : "$"+v.toFixed(0)+"M";
  const ratioCards = [
    { l:"P/E (TTM)",   v: m ? (m.pe    !== "—" ? m.pe+"x"    : "—") : mr.pe+"x" },
    { l:"Fwd P/E",     v: m ? (m.fwdPe !== "—" ? m.fwdPe+"x" : "—") : mr.fwdPe+"x" },
    { l:"P/S (TTM)",   v: m ? (m.ps    !== "—" ? m.ps+"x"    : "—") : mr.ps+"x" },
    { l:"P/B",         v: m ? (m.pb    !== "—" ? m.pb+"x"    : "—") : mr.pb+"x" },
    { l:"EV/EBITDA",   v: m ? (m.evEbitda !== "—" ? m.evEbitda+"x" : "—") : mr.evEbitda+"x" },
    { l:"ROE",         v: m ? (m.roe   !== "—" ? m.roe+"%"   : "—") : mr.roe+"%" },
    { l:"ROA",         v: m ? (m.roa   !== "—" ? m.roa+"%"   : "—") : mr.roa+"%" },
    { l:"Gross Margin",v: m ? (m.grossMargin !== "—" ? m.grossMargin+"%" : "—") : mr.roe+"%" },
    { l:"Net Margin",  v: m ? (m.netMargin   !== "—" ? m.netMargin+"%"   : "—") : mr.roa+"%" },
    { l:"Div Yield",   v: m ? m.divYield+"%" : mr.divYield+"%" },
    { l:"52W High",    v: m ? (m.wk52hi !== "—" ? "$"+m.wk52hi : "—") : "$"+(inst.base*1.38).toFixed(2) },
    { l:"52W Low",     v: m ? (m.wk52lo !== "—" ? "$"+m.wk52lo : "—") : "$"+(inst.base*0.68).toFixed(2) },
    { l:"Beta",        v: m ? m.beta : "—" },
    { l:"Mkt Cap",     v: m ? fmtMktCap(m.mktCap) : "—" },
    { l:"EPS (TTM)",   v: m ? (m.eps !== "—" ? "$"+m.eps : "—") : "$"+mr.pe },
  ];

  const Cell = ({ v, pct: isPct, bold, raw }) => {
    let display;
    if (raw)        display = v ?? "—";
    else if (isPct) display = v == null ? "—" : (v > 0 ? "+" : "") + (+v).toFixed(1) + "%";
    else            display = fmtNum(v);
    return (
      <td style={{ textAlign:"right", padding:"5px 10px", fontSize:11,
        color: isPct && v != null ? (v >= 0 ? TV.bull : TV.bear) : TV.text,
        fontWeight: bold ? 600 : 400,
        borderBottom: `1px solid ${TV.border}20`, whiteSpace:"nowrap", fontFamily:TV.mono }}>
        {display}
      </td>
    );
  };

  const Row = ({ label, values, pct, bold, indent, raw }) => (
    <tr>
      <td style={{ padding:`5px 10px 5px ${indent?"22px":"10px"}`, fontSize: 10,
        fontWeight: bold ? 600 : 400, color: bold ? TV.textHi : TV.textDim,
        borderBottom:`1px solid ${TV.border}20`, whiteSpace:"nowrap" }}>
        {label}
      </td>
      {values.map((v, i) => <Cell key={i} v={v} pct={pct} bold={bold} raw={raw} />)}
    </tr>
  );

  const years = fin.income.map(r => r.year);

  const incomeRows = [
    { label:"Revenue",      bold:true,   values: fin.income.map(r => r.revenue) },
    { label:"Gross Profit", indent:true, values: fin.income.map(r => r.grossProfit) },
    { label:"Gross Margin", indent:true, pct:true, values: fin.income.map(r => +r.grossMargin||null) },
    { label:"EBIT",         bold:true,   values: fin.income.map(r => r.ebit) },
    { label:"EBIT Margin",  indent:true, pct:true, values: fin.income.map(r => +r.ebitMargin||null) },
    { label:"Net Income",   bold:true,   values: fin.income.map(r => r.netIncome) },
    { label:"Net Margin",   indent:true, pct:true, values: fin.income.map(r => +r.netMargin||null) },
    { label:"EPS (Diluted)",indent:true, raw:true, values: fin.income.map(r => r.eps) },
  ];
  const balanceRows = [
    { label:"Cash",                indent:true, values: fin.balance.map(r => r.cash) },
    { label:"Accounts Receivable", indent:true, values: fin.balance.map(r => r.accountsReceivable) },
    { label:"Total Assets",        bold:true,   values: fin.balance.map(r => r.totalAssets) },
    { label:"Total Liabilities",   bold:true,   values: fin.balance.map(r => r.totalLiabilities) },
    { label:"Total Equity",        bold:true,   values: fin.balance.map(r => r.totalEquity) },
    { label:"Long-Term Debt",      indent:true, values: fin.balance.map(r => r.longTermDebt) },
    { label:"D/E Ratio",           indent:true, raw:true, values: fin.balance.map(r => r.debtToEquity) },
    { label:"Current Ratio",       indent:true, raw:true, values: fin.balance.map(r => r.currentRatio) },
  ];
  const cashRows = [
    { label:"Operating CF",   bold:true,   values: fin.cashflow.map(r => r.operatingCF) },
    { label:"Capex",          indent:true, values: fin.cashflow.map(r => r.capex) },
    { label:"Free Cash Flow", bold:true,   values: fin.cashflow.map(r => r.freeCashFlow) },
    { label:"FCF Margin",     indent:true, pct:true, values: fin.cashflow.map(r => +r.fcfMargin||null) },
    { label:"Dividends Paid", indent:true, values: fin.cashflow.map(r => r.dividendsPaid) },
    { label:"Buybacks",       indent:true, values: fin.cashflow.map(r => r.buybacks) },
  ];
  const rows = tab === "INCOME" ? incomeRows : tab === "BALANCE" ? balanceRows : cashRows;

  return (
    <div style={{ flex:1, overflowY:"auto", background:TV.bg }}>

      {/* Source bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"5px 12px", background:TV.bg2, borderBottom:`1px solid ${TV.border}`,
        fontSize:9, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color: dataSource==="live" ? TV.bull : TV.textFaint }}>
            {dataSource==="live" ? "● LIVE" : "○ MOCK"} · {dataSource==="live" ? "Finnhub API" : "Simulated data"}
          </span>
          {loading && <span style={{ color:TV.blue }}>⟳ Loading…</span>}
          {error && <span style={{ color:"#f9a825" }} title={error}>⚠ {error.slice(0,60)}{error.length>60?"…":""}</span>}
        </div>
        {!finnhubKey && (
          <span style={{ color:TV.textFaint }}>
            Set Finnhub API key (○ MOCK DATA button) for live financials
          </span>
        )}
      </div>

      {/* KPI ratio grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:1,
        borderBottom:`1px solid ${TV.border}`, background:TV.border }}>
        {ratioCards.map(rc => (
          <div key={rc.l} style={{ padding:"9px 12px", background:TV.bg2 }}>
            <div style={{ fontSize:9, color:TV.textFaint, marginBottom:3 }}>{rc.l}</div>
            <div style={{ fontSize:14, fontWeight:600, color:TV.textHi, fontFamily:TV.mono }}>{rc.v}</div>
          </div>
        ))}
      </div>

      {/* Statement tab selector */}
      <div style={{ display:"flex", borderBottom:`1px solid ${TV.border}`, background:TV.bg2 }}>
        {[["INCOME","Income Stmt"],["BALANCE","Balance Sheet"],["CASHFLOW","Cash Flow"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:"8px 16px", background:"none", border:"none", cursor:"pointer",
            fontFamily:TV.font, fontSize:11,
            borderBottom:`2px solid ${tab===k ? TV.blue : "transparent"}`,
            color: tab===k ? TV.textHi : TV.textDim,
          }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:TV.font }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:"6px 10px", fontSize:10,
                color:TV.textFaint, borderBottom:`1px solid ${TV.border}`, fontWeight:400 }}>METRIC</th>
              {years.map(y => (
                <th key={y} style={{ textAlign:"right", padding:"6px 10px", fontSize:10,
                  color:TV.blue, borderBottom:`1px solid ${TV.border}`, fontWeight:600 }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map((row, i) => <Row key={i} {...row} />)}</tbody>
        </table>
      </div>

      {/* Attribution */}
      <div style={{ padding:"8px 12px", fontSize:8, color:TV.textFaint,
        borderTop:`1px solid ${TV.border}`, marginTop:8 }}>
        {dataSource==="live"
          ? "Data: Finnhub.io — /stock/metric (key ratios) + series.annual (statements). Annual series requires Finnhub Starter+ for full statement detail."
          : "Simulated data. Add your Finnhub API key to load real financials. Free tier: 60 req/min · global stocks · key ratios."}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// NEWS PANEL — Finnhub /company-news + /news (market) with mock fallback
// ══════════════════════════════════════════════════════════════════════════════
function NewsPanel({ inst }) {
  const { finnhubKey } = useContext(ApiCtx);
  const [news, setNews]       = useState([]);
  const [sel, setSel]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [dataSource, setDataSource] = useState("mock");
  const [days, setDays]       = useState(7);  // date range selector

  useEffect(() => {
    let cancelled = false;
    setSel(null);

    async function load() {
      // Always show mock immediately so the panel isn't blank
      setNews(NEWS_FEED.filter(n => n.sym === "ALL" || n.sym === inst.sym));
      setDataSource("mock");
      setError("");

      if (!finnhubKey?.trim()) return;

      setLoading(true);
      try {
        const articles = await fetchFinnhubNews(inst.sym, finnhubKey, days);
        if (cancelled) return;
        if (articles.length > 0) {
          setNews(articles);
          setDataSource("live");
        } else {
          // Try market news as fallback
          const mktNews = await fetchFinnhubMarketNews(finnhubKey, "general");
          if (cancelled) return;
          setNews(mktNews);
          setDataSource("live");
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.message === "no_data"
          ? `No company news found for ${inst.sym} in last ${days} days`
          : `Finnhub: ${e.message}`);
        setDataSource("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [inst.sym, finnhubKey, days]);

  const sentColor = s => s === "bullish" ? TV.bull : s === "bearish" ? TV.bear : "#f9a825";

  // Article detail view
  if (sel) return (
    <div style={{ flex:1, overflowY:"auto", background:TV.bg }}>
      <div style={{ padding:"10px 14px", borderBottom:`1px solid ${TV.border}`,
        background:TV.bg2, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={() => setSel(null)} style={{ background:"none", border:"none",
          color:TV.blue, cursor:"pointer", fontSize:11, fontFamily:TV.font }}>← Back</button>
        <span style={{ fontSize:9, color:TV.textFaint }}>{sel.src} · {sel.ago}</span>
        {sel.url && (
          <a href={sel.url} target="_blank" rel="noreferrer"
            style={{ marginLeft:"auto", fontSize:9, color:TV.blue, textDecoration:"none" }}>
            Open ↗
          </a>
        )}
      </div>
      {sel.image && (
        <div style={{ height:180, overflow:"hidden", background:TV.bg3 }}>
          <img src={sel.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { e.target.style.display = "none"; }}/>
        </div>
      )}
      <div style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ fontSize:9, padding:"2px 7px", borderRadius:2,
            background: sentColor(sel.sent)+"20", color: sentColor(sel.sent) }}>
            {sel.sent}
          </span>
          {sel.tags.map(t => (
            <span key={t} style={{ fontSize:9, padding:"2px 7px", background:TV.bg3,
              color:TV.textDim, borderRadius:2 }}>{t}</span>
          ))}
        </div>
        <div style={{ fontSize:15, fontWeight:600, color:TV.textHi,
          lineHeight:1.5, marginBottom:12 }}>{sel.title}</div>
        <div style={{ fontSize:12, color:TV.text, lineHeight:1.8 }}>{sel.body}</div>
      </div>
    </div>
  );

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:TV.bg }}>

      {/* Toolbar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"5px 12px", background:TV.bg2, borderBottom:`1px solid ${TV.border}`,
        fontSize:9, flexShrink:0, gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color: dataSource==="live" ? TV.bull : TV.textFaint }}>
            {dataSource==="live" ? "● LIVE" : "○ MOCK"} · {dataSource==="live" ? "Finnhub" : "Sample data"}
          </span>
          {loading && <span style={{ color:TV.blue }}>⟳ Fetching…</span>}
          {error && <span style={{ color:"#f9a825" }} title={error}>⚠ {error.slice(0,55)}{error.length>55?"…":""}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ color:TV.textFaint }}>Range:</span>
          {[3,7,14,30].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding:"1px 6px", fontSize:9, cursor:"pointer", fontFamily:TV.font,
              background: days===d ? TV.blue : "transparent",
              border:`1px solid ${days===d ? TV.blue : TV.border}`,
              color: days===d ? TV.textHi : TV.textDim, borderRadius:2,
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {news.length === 0 && !loading && (
          <div style={{ padding:32, textAlign:"center", color:TV.textFaint, fontSize:11 }}>
            {finnhubKey ? `No news for ${inst.sym}` : "Add Finnhub API key for live news"}
          </div>
        )}
        {news.map(n => (
          <div key={n.id} onClick={() => setSel(n)}
            style={{ padding:"10px 14px", cursor:"pointer",
              borderBottom:`1px solid ${TV.border}`,
              borderLeft:`3px solid ${sentColor(n.sent)}` }}
            onMouseEnter={e => e.currentTarget.style.background = TV.bg2}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:10, color:TV.textFaint, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"60%" }}>{n.src}</span>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                <span style={{ fontSize:9, color:sentColor(n.sent),
                  padding:"1px 5px", background:sentColor(n.sent)+"15", borderRadius:2 }}>
                  {n.sent}
                </span>
                <span style={{ fontSize:9, color:TV.textFaint }}>{n.ago}</span>
              </div>
            </div>
            <div style={{ fontSize:11, color:TV.textHi, lineHeight:1.4, fontWeight:500 }}>
              {n.title}
            </div>
            {n.body && (
              <div style={{ fontSize:10, color:TV.textDim, marginTop:4, lineHeight:1.4,
                display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
                overflow:"hidden" }}>
                {n.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Attribution */}
      <div style={{ padding:"5px 12px", fontSize:8, color:TV.textFaint,
        borderTop:`1px solid ${TV.border}`, flexShrink:0 }}>
        {dataSource==="live"
          ? `Finnhub.io /company-news · ${news.length} articles · sentiment derived from headlines`
          : "Sample news data. Set Finnhub API key for live company news."}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// AI ANALYSIS PAGE
// ══════════════════════════════════════════════════════════════════════════════
const AGENT_ROLES=[
  {id:"fundamental",label:"Fundamental Analyst",icon:"📊",color:"#2196f3",desc:"Valuation, earnings, balance sheet, FCF"},
  {id:"technical",  label:"Technical Analyst",  icon:"📈",color:TV.bull,  desc:"Price action, indicators, trend"},
  {id:"sentiment",  label:"Sentiment Analyst",  icon:"🧠",color:TV.sma50, desc:"News, macro, analyst consensus"},
  {id:"risk",       label:"Risk Manager",       icon:"🛡️",color:TV.sma20, desc:"Downside scenarios, position sizing"},
  {id:"trader",     label:"Lead Trader",        icon:"⚡",color:TV.bear,  desc:"Final BUY / HOLD / SELL decision"},
];

function AnalysisPage() {
  const [sym, setSym]       = useState(null);
  const [search, setSearch] = useState("");
  const [focus, setFocus]   = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [depth, setDepth]   = useState("standard");
  const [running, setRunning]=useState(false);
  const [results, setResults]=useState({});
  const [finalRec,setFinalRec]=useState(null);
  const [activeAgent,setActive]=useState(null);
  const abortRef=useRef(null);

  const inst=sym?INSTRUMENTS.find(i=>i.sym===sym)||INSTRUMENTS[0]:null;
  const fin=inst?MOCK_FINANCIALS[inst.sym]||MOCK_FINANCIALS["AAPL"]:null;
  const allStocks=INSTRUMENTS;
  const res2=search.length>0?allStocks.filter(s=>s.sym.toLowerCase().includes(search.toLowerCase())||s.name.toLowerCase().includes(search.toLowerCase())):[];

  function buildPrompt(agentId, ins, f) {
    const finCtx=f?`Revenue ${fmtNum(f.income[0].revenue)}, Net Margin ${f.income[0].netMargin}%, P/E ${f.ratios.pe}x, FCF ${fmtNum(f.cashflow[0].freeCashFlow)}, ROE ${f.ratios.roe}%`:"";
    const base=`You are a senior ${agentId} at a top investment firm. Analyse ${ins.sym} (${ins.name}), ${ins.exch}, ~$${ins.base}. ${finCtx}. ${depth==="deep"?"Detailed 400-500w.":"Concise 200-300w."} Use markdown headers and bullets. End with a one-line verdict.`;
    const prompts={
      fundamental:`${base}\n## Fundamental Analysis\nCover: revenue growth quality, margin trends, balance sheet leverage, FCF, valuation vs peers, key risks, intrinsic value estimate.`,
      technical:`${base}\n## Technical Analysis\nCover: trend structure, support ~$${(ins.base*.92).toFixed(0)} / resistance ~$${(ins.base*1.08).toFixed(0)}, RSI/MACD positioning, volume profile, near-term target and invalidation.`,
      sentiment:`${base}\n## Sentiment & News\nCover: recent catalysts, analyst consensus, sector tailwinds/headwinds, insider signals, upcoming events.`,
      risk:`${base}\n## Risk/Reward Assessment\nCover: bull/base/bear scenarios with probabilities, key risks, position sizing 1-5%, stop-loss level, R:R ratio.`,
      trader:`${base}\n## FINAL TRADING DECISION\nSynthesize all analysis. Deliver: **Decision**: BUY/HOLD/SELL, **Conviction**: High/Med/Low, **Entry**: price range, **Target**: 12m PT, **Stop**: level, **Size**: % portfolio, **Thesis**: one sentence, **Key risk**: one thing to watch.`,
    };
    return prompts[agentId]||base;
  }

  async function runAnalysis() {
    if (!inst) return;
    if (!apiKey.trim()) return;
    setRunning(true); setResults({}); setFinalRec(null);
    abortRef.current=new AbortController();
    const agentsToRun=depth==="quick"?["fundamental","technical","trader"]:AGENT_ROLES.map(a=>a.id);
    for (const agentId of agentsToRun) {
      if (abortRef.current.signal.aborted) break;
      setActive(agentId);
      setResults(p=>({...p,[agentId]:{status:"running",text:""}}));
      try {
        const r=await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",signal:abortRef.current.signal,
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:depth==="deep"?1200:800,
            messages:[{role:"user",content:buildPrompt(agentId,inst,fin)}]}),
        });
        if (!r.ok){const e=await r.json().catch(()=>({}));setResults(p=>({...p,[agentId]:{status:"error",text:`Error ${r.status}: ${e?.error?.message||"Check key"}`}}));continue;}
        const data=await r.json();
        const text=data.content?.find(b=>b.type==="text")?.text||"";
        setResults(p=>({...p,[agentId]:{status:"done",text}}));
        if (agentId==="trader"){
          const m=text.match(/\*\*Decision\*\*[:\s]*([A-Z]+)/i);
          const pt=text.match(/\*\*Target\*\*[:\s]*[~$]?([\d,.]+)/i);
          if(m) setFinalRec({decision:m[1].toUpperCase(),target:pt?.[1]});
        }
      } catch(e){if(e.name!=="AbortError")setResults(p=>({...p,[agentId]:{status:"error",text:String(e)}}));}
    }
    setActive(null);setRunning(false);
  }

  function renderMd(text) {
    return text.split("\n").map((line,i)=>{
      if(line.startsWith("## ")) return <div key={i} style={{color:TV.blue,fontWeight:600,fontSize:12,margin:"10px 0 4px",borderBottom:`1px solid ${TV.border}`,paddingBottom:3}}>{line.slice(3)}</div>;
      if(line.startsWith("- ")||line.startsWith("* ")){
        const parts=line.slice(2).split(/\*\*(.+?)\*\*/);
        return <div key={i} style={{display:"flex",gap:6,marginBottom:3}}><span style={{color:TV.blue,flexShrink:0}}>•</span><span style={{fontSize:11,color:TV.text,lineHeight:1.6}}>{parts.map((p,j)=>j%2===1?<strong key={j} style={{color:TV.textHi}}>{p}</strong>:p)}</span></div>;
      }
      if(/^\d+\./.test(line)){const parts=line.replace(/^\d+\.\s*/,"").split(/\*\*(.+?)\*\*/);return <div key={i} style={{display:"flex",gap:6,marginBottom:4}}><span style={{color:TV.blue,fontSize:11}}>{line.match(/^\d+/)[0]}.</span><span style={{fontSize:11,color:TV.text,lineHeight:1.6}}>{parts.map((p,j)=>j%2===1?<strong key={j} style={{color:TV.textHi}}>{p}</strong>:p)}</span></div>;}
      if(line.trim()==="") return <div key={i} style={{height:5}}/>;
      const parts=line.split(/\*\*(.+?)\*\*/);
      return <div key={i} style={{fontSize:11,color:TV.text,lineHeight:1.6,marginBottom:2}}>{parts.map((p,j)=>j%2===1?<strong key={j} style={{color:TV.textHi}}>{p}</strong>:p)}</div>;
    });
  }

  const decCol=finalRec?.decision==="BUY"?TV.bull:finalRec?.decision==="SELL"?TV.bear:TV.sma20;

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden",background:TV.bg,minHeight:0}}>
      {/* Sidebar */}
      <div style={{width:240,flexShrink:0,background:TV.bg2,borderRight:`1px solid ${TV.border}`,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 10px 6px"}}>
          <div style={{fontSize:10,color:TV.textFaint,fontWeight:600,letterSpacing:"0.08em",marginBottom:8}}>AI ANALYSIS</div>
          <div style={{position:"relative"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              onFocus={()=>setFocus(true)} onBlur={()=>setTimeout(()=>setFocus(false),180)}
              placeholder="Search symbol…"
              style={{width:"100%",background:TV.bg3,border:`1px solid ${focus?TV.blue:TV.border}`,
                color:TV.textHi,padding:"6px 10px",borderRadius:3,fontSize:11,outline:"none",fontFamily:TV.font}}/>
            {res2.length>0&&focus&&(
              <div style={{position:"absolute",top:"calc(100% + 3px)",left:0,right:0,background:TV.bg3,
                border:`1px solid ${TV.border}`,borderRadius:3,zIndex:200,maxHeight:200,overflowY:"auto"}}>
                {res2.map(s=>(
                  <div key={s.sym} onMouseDown={()=>{setSym(s.sym);setSearch("");}}
                    style={{padding:"7px 10px",cursor:"pointer",display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${TV.border}20`}}
                    onMouseEnter={e=>e.currentTarget.style.background=TV.bg4}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{color:TV.blue,fontWeight:600,fontSize:11}}>{s.sym}</span>
                    <span style={{color:TV.textDim,fontSize:10}}>{s.exch}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 6px"}}>
          <div style={{fontSize:9,color:TV.textFaint,padding:"6px 4px 3px",fontWeight:600}}>STOCKS</div>
          {INSTRUMENTS.map(s=>{
            const active=sym===s.sym;
            return(
              <div key={s.sym} onClick={()=>setSym(s.sym)}
                style={{padding:"6px 8px",cursor:"pointer",borderRadius:2,marginBottom:1,
                  background:active?TV.bg3:"transparent",border:`1px solid ${active?TV.blue+"40":"transparent"}`}}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background=TV.bg3+"80";}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:active?TV.blue:TV.textHi,fontWeight:600,fontSize:11}}>{s.sym}</span>
                  <span style={{fontSize:9,color:TV.textFaint}}>{MKT_FLAGS[s.mkt]}</span>
                </div>
                <div style={{fontSize:9,color:TV.textFaint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</div>
              </div>
            );
          })}
        </div>
        {/* Settings */}
        <div style={{borderTop:`1px solid ${TV.border}`,padding:"10px"}}>
          <div style={{fontSize:9,color:TV.textFaint,fontWeight:600,marginBottom:6}}>DEPTH</div>
          <div style={{display:"flex",gap:3,marginBottom:10}}>
            {["quick","standard","deep"].map(d=>(
              <button key={d} onClick={()=>setDepth(d)} style={{flex:1,padding:"4px 0",cursor:"pointer",fontFamily:TV.font,
                fontSize:9,borderRadius:2,textTransform:"capitalize",
                background:depth===d?TV.blue:"transparent",border:`1px solid ${depth===d?TV.blue:TV.border}`,
                color:depth===d?TV.textHi:TV.textDim}}>
                {d}
              </button>
            ))}
          </div>
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
            placeholder="Anthropic API key…"
            style={{width:"100%",background:TV.bg3,border:`1px solid ${apiKey?TV.bull:TV.border}`,
              color:TV.textHi,padding:"5px 8px",borderRadius:2,fontSize:10,outline:"none",fontFamily:TV.mono,marginBottom:8}}/>
          <button onClick={running?()=>abortRef.current?.abort():runAnalysis} disabled={!sym}
            style={{width:"100%",padding:"8px 0",cursor:sym?"pointer":"not-allowed",fontFamily:TV.font,
              fontSize:11,fontWeight:600,borderRadius:3,border:"none",
              background:running?TV.bear:sym?TV.blue:TV.bg3,color:TV.textHi,transition:"all 0.15s"}}>
            {running?"⬛ Stop":"▶ Run Analysis"}
          </button>
        </div>
      </div>

      {/* Main */}
      {!inst ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{fontSize:28,opacity:0.3}}>🔬</div>
          <div style={{fontSize:13,color:TV.textDim}}>Select a stock to begin AI analysis</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",maxWidth:420}}>
            {AGENT_ROLES.map(a=><div key={a.id} style={{padding:"5px 10px",background:TV.bg2,border:`1px solid ${a.color}40`,borderRadius:3,fontSize:10,color:a.color}}>{a.icon} {a.label}</div>)}
          </div>
        </div>
      ):(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Header */}
          <div style={{padding:"10px 16px",background:TV.bg2,borderBottom:`1px solid ${TV.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                <span style={{fontSize:18,fontWeight:700,color:TV.textHi}}>{inst.sym}</span>
                <span style={{fontSize:11,color:TV.textDim}}>{inst.name}</span>
                <span style={{fontSize:10,padding:"1px 6px",background:TV.bg3,color:TV.textDim,borderRadius:2}}>{inst.exch}</span>
              </div>
              <div style={{fontSize:10,color:TV.textFaint,marginTop:2}}>~${inst.base} · {inst.sector}</div>
            </div>
            {finalRec&&<div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:700,color:decCol,letterSpacing:"0.1em"}}>{finalRec.decision}</div>
              {finalRec.target&&<div style={{fontSize:10,color:TV.textDim}}>PT: <span style={{color:TV.textHi}}>${finalRec.target}</span></div>}
            </div>}
          </div>
          {/* Agent tabs */}
          <div style={{display:"flex",background:TV.bg2,borderBottom:`1px solid ${TV.border}`,flexShrink:0,overflowX:"auto"}}>
            {AGENT_ROLES.filter(a=>depth==="quick"?["fundamental","technical","trader"].includes(a.id):true).map((a,i,arr)=>{
              const res=results[a.id];
              const isActive=activeAgent===a.id;
              const isDone=res?.status==="done";
              const isErr=res?.status==="error";
              return(
                <div key={a.id} style={{flex:1,minWidth:110,padding:"8px 10px",
                  borderRight:i<arr.length-1?`1px solid ${TV.border}`:"none",
                  borderBottom:`2px solid ${isActive?a.color:isDone?a.color+"80":"transparent"}`,
                  background:isActive?a.color+"0a":"transparent",cursor:isDone||isErr?"default":"default"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:11}}>{a.icon}</span>
                    <span style={{fontSize:8,padding:"1px 4px",borderRadius:2,
                      background:isActive?a.color+"30":isDone?TV.bull+"20":isErr?TV.bear+"20":TV.bg3,
                      color:isActive?a.color:isDone?TV.bull:isErr?TV.bear:TV.textFaint}}>
                      {isActive?"…":isDone?"✓":isErr?"✗":"—"}
                    </span>
                  </div>
                  <div style={{fontSize:9,color:isActive?a.color:isDone?TV.textHi:TV.textDim,fontWeight:isDone||isActive?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.label}</div>
                </div>
              );
            })}
          </div>
          {/* Results */}
          <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
            {Object.keys(results).length===0&&!running&&(
              <div style={{textAlign:"center",padding:"40px 20px",color:TV.textDim,fontSize:11}}>
                Click Run Analysis to start.{!apiKey&&<span style={{color:TV.bear}}> Enter Anthropic API key first.</span>}
              </div>
            )}
            {AGENT_ROLES.filter(a=>results[a.id]).filter(a=>depth==="quick"?["fundamental","technical","trader"].includes(a.id):true).map(a=>{
              const res=results[a.id];
              return(
                <div key={a.id} style={{marginBottom:12,background:TV.bg2,border:`1px solid ${TV.border}`,borderLeft:`3px solid ${a.color}`,borderRadius:2}}>
                  <div style={{padding:"6px 12px",display:"flex",justifyContent:"space-between",background:a.color+"08",borderBottom:`1px solid ${TV.border}`}}>
                    <span style={{fontSize:10,fontWeight:600,color:a.color}}>{a.icon} {a.label.toUpperCase()}</span>
                    <span style={{fontSize:9,color:res.status==="done"?TV.bull:res.status==="error"?TV.bear:a.color}}>
                      {res.status==="done"?"Complete":res.status==="error"?"Error":"Analysing…"}
                    </span>
                  </div>
                  <div style={{padding:"10px 14px"}}>
                    {res.status==="running"&&<div style={{fontSize:10,color:a.color}}>Working…</div>}
                    {res.status==="error"&&<div style={{fontSize:11,color:TV.bear}}>{res.text}</div>}
                    {res.status==="done"&&renderMd(res.text)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage]         = useState("HOME");
  const [inst, setInst]         = useState(INSTRUMENTS[0]);
  const [tf, setTf]             = useState("6M");
  const [chartTab, setChartTab] = useState("CHART");  // CHART | FINANCIALS | NEWS | STATISTICS
  const [subChart, setSubChart] = useState("VOLUME");
  const [indicators, setIndicators] = useState({sma20:false,sma50:false,ema20:false,bb:false});
  const [chartType, setChartType]   = useState("Candles");
  const [live, setLive]         = useState({});
  const [candles, setCandles]   = useState([]);
  const [dataSource, setDataSource] = useState("mock");
  const [finnhubKey, setFinnhubKey] = useState(()=>localStorage.getItem("fh_key")||"");
  const [searchQ, setSearchQ]   = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [time, setTime]         = useState(new Date());
  const [watchlistW, setWatchlistW] = useState(200);
  const dragging = useRef(false);

  // Watchlist drag resize
  useEffect(()=>{
    const onMove=e=>{if(!dragging.current)return;setWatchlistW(w=>Math.max(150,Math.min(320,w+e.movementX)));};
    const onUp=()=>{dragging.current=false;};
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[]);

  // Clock
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);

  // Live prices
  useEffect(()=>{
    const init={};
    INSTRUMENTS.forEach(ins=>{const d=(Math.random()-.47)*ins.base*.025;
      init[ins.sym]={price:+(ins.base+d).toFixed(2),change:+d.toFixed(2),pct:+((d/ins.base)*100).toFixed(2)};});
    setLive(init);
    const iv=setInterval(()=>setLive(prev=>{
      const u={...prev};
      INSTRUMENTS.forEach(ins=>{
        const tick=(Math.random()-.5)*ins.base*.0008,np=+(u[ins.sym].price+tick).toFixed(2);
        u[ins.sym]={...u[ins.sym],price:np,change:+(np-ins.base).toFixed(2),pct:+((np-ins.base)/ins.base*100).toFixed(2)};
      });return u;
    }),2000);
    return()=>clearInterval(iv);
  },[]);

  // Chart data
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      if (finnhubKey.trim()) {
        try {
          const raw=await fetchFinnhubCandles(inst.sym,tf,finnhubKey.trim());
          if (!cancelled&&raw.length>0){setCandles(raw);setDataSource("live");return;}
        } catch(e){console.warn("Finnhub:",e.message);}
      }
      if (!cancelled){setCandles(genBars(tf,inst.sym,inst.base));setDataSource("mock");}
    }
    load();return()=>{cancelled=true;};
  },[inst,tf,finnhubKey]);

  const ld=live[inst.sym]||{price:inst.base,change:0,pct:0};
  const isUp=ld.change>=0;
  const searchResults=searchQ.length>0?INSTRUMENTS.filter(i=>i.sym.toLowerCase().includes(searchQ.toLowerCase())||i.name.toLowerCase().includes(searchQ.toLowerCase())):[];

  // Indicator toggle button
  const IndToggle=({id,label,color})=>(
    <button onClick={()=>setIndicators(p=>({...p,[id]:!p[id]}))} style={{
      padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:TV.font,
      background:indicators[id]?color+"20":"transparent",
      border:`1px solid ${indicators[id]?color:TV.border}`,
      color:indicators[id]?color:TV.textDim,borderRadius:2,
    }}>{label}</button>
  );

  return (
    <ApiCtx.Provider value={{ finnhubKey }}>
    <div style={{background:TV.bg,height:"100vh",color:TV.text,fontFamily:TV.font,fontSize:12,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── TOP NAV BAR ── */}
      <div style={{height:44,background:TV.bg2,borderBottom:`1px solid ${TV.border}`,display:"flex",alignItems:"center",padding:"0 12px",gap:0,flexShrink:0}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:20,flexShrink:0}}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect width="20" height="20" rx="3" fill={TV.blue}/>
            <path d="M4 14l4-8 4 8" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            <circle cx="15" cy="7" r="2" fill="white"/>
          </svg>
          <span style={{fontSize:13,fontWeight:700,color:TV.textHi,letterSpacing:"0.05em"}}>TerminalPro</span>
        </div>

        {/* Page tabs */}
        {[{id:"HOME",l:"Chart"},{id:"ANALYSIS",l:"AI Analysis"}].map(p=>(
          <button key={p.id} onClick={()=>setPage(p.id)} style={{
            height:"100%",padding:"0 14px",background:"none",border:"none",cursor:"pointer",
            fontFamily:TV.font,fontSize:12,
            color:page===p.id?TV.textHi:TV.textDim,
            borderBottom:`2px solid ${page===p.id?TV.blue:"transparent"}`,
            transition:"color 0.1s",
          }}>{p.l}</button>
        ))}

        <div style={{flex:1}}/>

        {/* Exchange status */}
        <div style={{display:"flex",gap:12,alignItems:"center",marginRight:12}}>
          {[{l:"NYSE",o:true},{l:"NASDAQ",o:true},{l:"LSE",o:true}].map(m=>(
            <div key={m.l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:m.o?TV.bull:TV.textFaint,boxShadow:m.o?`0 0 4px ${TV.bull}`:""}}/>
              <span style={{fontSize:10,color:m.o?TV.textDim:TV.textFaint}}>{m.l}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{position:"relative",marginRight:12}}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            onFocus={()=>setSearchFocus(true)} onBlur={()=>setTimeout(()=>setSearchFocus(false),180)}
            placeholder="🔍  Symbol, eg. AAPL"
            style={{background:TV.bg3,border:`1px solid ${searchFocus?TV.blue:TV.border}`,color:TV.textHi,
              padding:"5px 10px",borderRadius:3,fontSize:11,width:190,outline:"none",fontFamily:TV.font}}/>
          {searchResults.length>0&&searchFocus&&(
            <div style={{position:"absolute",top:"calc(100%+4px)",left:0,right:0,background:TV.bg3,
              border:`1px solid ${TV.border}`,borderRadius:3,zIndex:300,overflow:"hidden"}}>
              {searchResults.map(r=>(
                <div key={r.sym} onMouseDown={()=>{setInst(r);setSearchQ("");}}
                  style={{padding:"7px 10px",cursor:"pointer",display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${TV.border}20`}}
                  onMouseEnter={e=>e.currentTarget.style.background=TV.bg4}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{color:TV.blue,fontWeight:600}}>{r.sym}</span>
                  <span style={{color:TV.textDim,fontSize:10}}>{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Finnhub key badge */}
        <button onClick={()=>setFinnhubKey(k=>{if(k){localStorage.removeItem("fh_key");return "";}else{const nk=prompt("Enter Finnhub API key (from finnhub.io):")||"";localStorage.setItem("fh_key",nk);return nk;}})}
          style={{padding:"4px 10px",background:"none",border:`1px solid ${finnhubKey?TV.bull+"60":TV.border}`,
            color:finnhubKey?TV.bull:TV.textFaint,cursor:"pointer",fontFamily:TV.font,fontSize:9,borderRadius:2,marginRight:10}}>
          {finnhubKey?"● LIVE":"○ MOCK"} DATA
        </button>

        <span style={{fontSize:10,color:TV.textFaint,fontFamily:TV.mono,letterSpacing:"0.05em"}}>
          {time.toLocaleTimeString("en-US",{hour12:false})}
        </span>
      </div>

      {/* ── TICKER BAR ── */}
      {page==="HOME"&&(
        <div style={{height:28,background:TV.bg,borderBottom:`1px solid ${TV.border}`,overflow:"hidden",display:"flex",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",animation:"marquee 55s linear infinite",whiteSpace:"nowrap"}}>
            {[...INSTRUMENTS,...INSTRUMENTS].map((ins,i)=>{
              const d=live[ins.sym]||{price:ins.base,pct:0};const up=(d.pct||0)>=0;
              return(
                <span key={i} onClick={()=>{setInst(ins);}} style={{padding:"0 14px",fontSize:10,borderRight:`1px solid ${TV.border}`,display:"flex",gap:6,alignItems:"center",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background=TV.bg2}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{color:TV.textHi,fontWeight:600}}>{ins.sym}</span>
                  <span style={{color:TV.textHi,fontFamily:TV.mono}}>{d.price?.toFixed(2)}</span>
                  <span style={{color:up?TV.bull:TV.bear,fontFamily:TV.mono}}>{up?"+":""}{d.pct?.toFixed(2)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PAGE ROUTER ── */}
      {page==="ANALYSIS" ? <AnalysisPage/> : (
        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

          {/* WATCHLIST */}
          <div style={{width:watchlistW,flexShrink:0}}>
            <WatchlistPanel instruments={INSTRUMENTS} live={live} selected={inst} onSelect={setInst} width={watchlistW}/>
          </div>

          {/* Drag handle */}
          <div onMouseDown={()=>{dragging.current=true;}} style={{width:4,flexShrink:0,cursor:"col-resize",background:TV.border,transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=TV.blue}
            onMouseLeave={e=>e.currentTarget.style.background=TV.border}/>

          {/* MAIN CHART AREA */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

            {/* Symbol header */}
            <div style={{padding:"8px 14px",background:TV.bg2,borderBottom:`1px solid ${TV.border}`,flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                  <span style={{fontSize:20,fontWeight:700,color:TV.textHi}}>{inst.sym}</span>
                  <span style={{fontSize:11,color:TV.textDim}}>{inst.name}</span>
                  <span style={{fontSize:10,padding:"1px 6px",background:TV.bg3,color:TV.textDim,borderRadius:2}}>{inst.exch}</span>
                  <span style={{fontSize:10,padding:"1px 6px",background:isUp?TV.bull+"15":TV.bear+"15",
                    color:isUp?TV.bull:TV.bear,borderRadius:2}}>{MKT_FLAGS[inst.mkt]} {inst.mkt}</span>
                </div>
                <div style={{display:"flex",alignItems:"baseline",gap:12}}>
                  <span style={{fontSize:24,fontWeight:700,color:TV.textHi,fontFamily:TV.mono,letterSpacing:"-0.02em"}}>{ld.price?.toFixed(2)}</span>
                  <span style={{fontSize:13,color:isUp?TV.bull:TV.bear,fontWeight:600}}>
                    {isUp?"+":""}{ld.change?.toFixed(2)} ({isUp?"+":""}{ld.pct?.toFixed(2)}%)
                  </span>
                  <span style={{fontSize:9,color:dataSource==="live"?TV.bull:TV.textFaint,padding:"2px 6px",
                    background:dataSource==="live"?TV.bull+"15":TV.bg3,borderRadius:2}}>
                    {dataSource==="live"?"● LIVE":"○ MOCK"}
                  </span>
                </div>
              </div>
            </div>

            {/* Toolbar: chart type + timeframes + indicators */}
            <div style={{background:TV.bg2,borderBottom:`1px solid ${TV.border}`,flexShrink:0}}>
              {/* Row 1: tabs + timeframes */}
              <div style={{display:"flex",alignItems:"center",padding:"0 10px",borderBottom:`1px solid ${TV.border}`,height:34,gap:0}}>
                {/* Chart tabs */}
                {["CHART","FINANCIALS","NEWS","STATISTICS"].map(t=>(
                  <button key={t} onClick={()=>setChartTab(t)} style={{
                    height:"100%",padding:"0 12px",background:"none",border:"none",cursor:"pointer",
                    fontFamily:TV.font,fontSize:11,
                    color:chartTab===t?TV.textHi:TV.textDim,
                    borderBottom:`2px solid ${chartTab===t?TV.blue:"transparent"}`,
                  }}>{t}</button>
                ))}
                <div style={{width:1,height:18,background:TV.border,margin:"0 8px"}}/>
                {/* Timeframes — scrollable */}
                <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto",scrollbarWidth:"none",flex:1}}>
                  {TF_GROUPS.map((grp,gi)=>(
                    <div key={grp.group} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      {gi>0&&<div style={{width:1,height:14,background:TV.border,margin:"0 4px"}}/>}
                      {grp.items.map(item=>(
                        <button key={item.tf} onClick={()=>setTf(item.tf)} style={{
                          padding:"2px 7px",fontSize:10,cursor:"pointer",fontFamily:TV.font,
                          marginRight:1,flexShrink:0,height:24,
                          background:tf===item.tf?TV.blue:"transparent",
                          border:"1px solid transparent",
                          color:tf===item.tf?TV.textHi:TV.textDim,
                          borderRadius:2,fontWeight:tf===item.tf?600:400,
                        }}>{item.label}</button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* Row 2: indicators (only on CHART) */}
              {chartTab==="CHART"&&(
                <div style={{display:"flex",alignItems:"center",padding:"4px 10px",gap:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:TV.textFaint,marginRight:4}}>Indicators</span>
                  <IndToggle id="sma20" label="SMA 20" color={TV.sma20}/>
                  <IndToggle id="sma50" label="SMA 50" color={TV.sma50}/>
                  <IndToggle id="ema20" label="EMA 20" color={TV.ema}/>
                  <IndToggle id="bb"    label="BB(20)" color={TV.bb}/>
                  <div style={{width:1,height:14,background:TV.border,margin:"0 4px"}}/>
                  <span style={{fontSize:10,color:TV.textFaint,marginRight:4}}>Sub</span>
                  {["VOLUME","MACD","RSI"].map(s=>(
                    <button key={s} onClick={()=>setSubChart(s)} style={{
                      padding:"3px 9px",fontSize:10,cursor:"pointer",fontFamily:TV.font,
                      background:subChart===s?TV.bg4:"transparent",border:`1px solid ${subChart===s?TV.borderHi:TV.border}`,
                      color:subChart===s?TV.textHi:TV.textDim,borderRadius:2,
                    }}>{s}</button>
                  ))}
                  <div style={{marginLeft:"auto",fontSize:9,color:TV.textFaint}}>{candles.length} bars</div>
                </div>
              )}
            </div>

            {/* Content area */}
            {chartTab==="CHART"&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
                <div style={{flex:3,minHeight:0}}>
                  <TVChart data={candles} indicators={indicators} subChart={subChart}/>
                </div>
                <div style={{height:120,borderTop:`1px solid ${TV.border}`,flexShrink:0}}>
                  <TVSubChart data={candles} type={subChart}/>
                </div>
              </div>
            )}

            {chartTab==="FINANCIALS"&&<FinancialsTab inst={inst}/>}
            {chartTab==="NEWS"&&<NewsPanel inst={inst}/>}

            {chartTab==="STATISTICS"&&(
              <div style={{flex:1,overflowY:"auto",padding:16}}>
                <div style={{fontSize:11,color:TV.textFaint,marginBottom:12}}>STATISTICS · {inst.sym} · {tf}</div>
                {(()=>{
                  const fin=MOCK_FINANCIALS[inst.sym];
                  const items=[
                    ["P/E Ratio",fin.ratios.pe+"x"],["P/S Ratio",fin.ratios.ps+"x"],
                    ["EV/EBITDA",fin.ratios.evEbitda+"x"],["ROE",fin.ratios.roe+"%"],
                    ["ROA",fin.ratios.roa+"%"],["Div Yield",fin.ratios.divYield+"%"],
                    ["Revenue (FY24)",fmtNum(fin.income[0].revenue)],
                    ["Net Income",fmtNum(fin.income[0].netIncome)],
                    ["Net Margin",fin.income[0].netMargin+"%"],
                    ["FCF",fmtNum(fin.cashflow[0].freeCashFlow)],
                    ["Total Assets",fmtNum(fin.balance[0].totalAssets)],
                    ["D/E Ratio",fin.balance[0].debtToEquity+"x"],
                  ];
                  return(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                      {items.map(([l,v])=>(
                        <div key={l} style={{padding:"10px 12px",background:TV.bg2,border:`1px solid ${TV.border}`,borderRadius:3}}>
                          <div style={{fontSize:9,color:TV.textFaint,marginBottom:4}}>{l}</div>
                          <div style={{fontSize:15,fontWeight:600,color:TV.textHi,fontFamily:TV.mono}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${TV.bg};}
        ::-webkit-scrollbar-thumb{background:${TV.bg4};border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:${TV.borderHi};}
        input::placeholder{color:${TV.textFaint};}
        button:hover{opacity:0.9;}
      `}</style>
    </div>
    </ApiCtx.Provider>
  );
}
