// TerminalPro.API/Services/StatisticsService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TerminalPro.API.Models;

namespace TerminalPro.API.Services
{
    public interface IStatisticsService
    {
        Task<IndicatorSet> ComputeIndicatorsAsync(List<AggBar> bars, IndicatorRequest req);
        Task<CorrelationMatrix> ComputeCorrelationAsync(Dictionary<string, List<AggBar>> data);
    }

    public class StatisticsService : IStatisticsService
    {
        public Task<IndicatorSet> ComputeIndicatorsAsync(List<AggBar> bars, IndicatorRequest req)
        {
            var closes = bars.Select(b => b.Close).ToList();
            var highs  = bars.Select(b => b.High).ToList();
            var lows   = bars.Select(b => b.Low).ToList();
            var vols   = bars.Select(b => b.Volume).ToList();
            var series = new List<IndicatorSeries>();

            // ── SMA ──
            foreach (var p in req.SMA)
                series.Add(Ts("SMA_" + p, bars, SMA(closes, p)));

            // ── EMA ──
            foreach (var p in req.EMA)
                series.Add(Ts("EMA_" + p, bars, EMA(closes, p)));

            // ── Bollinger Bands ──
            if (req.BollingerBands)
            {
                var (upper, mid, lower) = BB(closes, 20, 2.0);
                series.Add(Ts("BB_Upper", bars, upper));
                series.Add(Ts("BB_Mid",   bars, mid));
                series.Add(Ts("BB_Lower", bars, lower));
                series.Add(Ts("BB_Width", bars, upper.Zip(lower, (u, l) =>
                    u.HasValue && l.HasValue ? (double?)(u.Value - l.Value) : null).ToList()));
            }

            // ── RSI ──
            if (req.RSI > 0)
                series.Add(Ts($"RSI_{req.RSI}", bars, RSI(closes, req.RSI)));

            // ── MACD ──
            if (req.MACD)
            {
                var (macd, signal, hist) = MACD(closes, 12, 26, 9);
                series.Add(Ts("MACD",      bars, macd));
                series.Add(Ts("MACD_Signal", bars, signal));
                series.Add(Ts("MACD_Hist", bars, hist));
            }

            // ── ATR ──
            if (req.ATR > 0)
                series.Add(Ts($"ATR_{req.ATR}", bars, ATR(highs, lows, closes, req.ATR)));

            // ── Stochastic ──
            if (req.Stochastic)
            {
                var (stochK, stochD) = Stochastic(highs, lows, closes, req.StochPeriod);
                series.Add(Ts($"Stoch_K_{req.StochPeriod}", bars, stochK));
                series.Add(Ts($"Stoch_D_{req.StochPeriod}", bars, stochD));
            }

            // ── VWAP ──
            if (req.VWAP)
                series.Add(Ts("VWAP", bars, VWAP(bars)));

            // ── Williams %R ──
            series.Add(Ts("WilliamsR_14", bars, WilliamsR(highs, lows, closes, 14)));

            // ── OBV ──
            series.Add(Ts("OBV", bars, OBV(closes, vols)));

            return Task.FromResult(new IndicatorSet { Bars = bars, Indicators = series });
        }

        public Task<CorrelationMatrix> ComputeCorrelationAsync(Dictionary<string, List<AggBar>> data)
        {
            var tickers = data.Keys.ToList();
            var returnsMap = data.ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value.Zip(kvp.Value.Skip(1), (a, b) => (b.Close - a.Close) / a.Close).ToArray()
            );
            int minLen = returnsMap.Values.Min(r => r.Length);
            var matrix = new double[tickers.Count, tickers.Count];

            for (int i = 0; i < tickers.Count; i++)
            for (int j = 0; j < tickers.Count; j++)
                matrix[i, j] = Math.Round(Corr(
                    returnsMap[tickers[i]].Take(minLen).ToArray(),
                    returnsMap[tickers[j]].Take(minLen).ToArray()), 4);

            return Task.FromResult(new CorrelationMatrix
            {
                Tickers = tickers,
                Matrix  = matrix,
                AsOf    = DateTime.UtcNow,
            });
        }

        // ─── Math Implementations ─────────────────────────────────────────────

        private static List<double?> SMA(List<double> src, int p)
            => src.Select((_, i) => i < p - 1 ? (double?)null
                : +(src.Skip(i - p + 1).Take(p).Average())).ToList();

        private static List<double?> EMA(List<double> src, int p)
        {
            var k = 2.0 / (p + 1); double e = src[0];
            return src.Select((v, i) => { e = i == 0 ? v : v * k + e * (1 - k); return (double?)e; }).ToList();
        }

        private static (List<double?> upper, List<double?> mid, List<double?> lower) BB(
            List<double> src, int p, double mult)
        {
            var upper = new List<double?>(); var mid = new List<double?>(); var lower = new List<double?>();
            for (int i = 0; i < src.Count; i++)
            {
                if (i < p - 1) { upper.Add(null); mid.Add(null); lower.Add(null); continue; }
                var sl = src.Skip(i - p + 1).Take(p).ToArray();
                double m = sl.Average();
                double sd = Math.Sqrt(sl.Select(v => Math.Pow(v - m, 2)).Sum() / p);
                mid.Add(m); upper.Add(m + mult * sd); lower.Add(m - mult * sd);
            }
            return (upper, mid, lower);
        }

        private static List<double?> RSI(List<double> src, int p)
        {
            var result = new List<double?>();
            for (int i = 0; i < src.Count; i++)
            {
                if (i < p) { result.Add(null); continue; }
                var ch = Enumerable.Range(i - p + 1, p).Select(j => src[j] - src[j - 1]).ToArray();
                var ag = ch.Where(c => c > 0).DefaultIfEmpty(0).Average();
                var al = Math.Abs(ch.Where(c => c < 0).DefaultIfEmpty(0).Average());
                result.Add(al == 0 ? 100 : Math.Round(100 - 100 / (1 + ag / al), 2));
            }
            return result;
        }

        private static (List<double?> macd, List<double?> signal, List<double?> hist) MACD(
            List<double> src, int fast, int slow, int sig)
        {
            var ef = EMA(src, fast); var es = EMA(src, slow);
            var ml = ef.Zip(es, (f, s) => f.HasValue && s.HasValue ? (double?)(f.Value - s.Value) : null).ToList();
            var slSrc = ml.Select(v => v ?? 0.0).ToList();
            var signal = EMA(slSrc, sig);
            var hist = ml.Zip(signal, (m, s) => m.HasValue && s.HasValue ? (double?)(m.Value - s.Value) : null).ToList();
            return (ml, signal, hist);
        }

        private static List<double?> ATR(List<double> h, List<double> l, List<double> c, int p)
        {
            var tr = new List<double> { h[0] - l[0] };
            for (int i = 1; i < c.Count; i++)
                tr.Add(Math.Max(h[i] - l[i], Math.Max(Math.Abs(h[i] - c[i - 1]), Math.Abs(l[i] - c[i - 1]))));
            return SMA(tr, p);
        }

        private static (List<double?> K, List<double?> D) Stochastic(
            List<double> h, List<double> l, List<double> c, int p)
        {
            var K = c.Select((_, i) =>
            {
                if (i < p - 1) return (double?)null;
                var sl = Enumerable.Range(i - p + 1, p);
                double lo = sl.Min(j => l[j]), hi = sl.Max(j => h[j]);
                return hi == lo ? 50 : (double?)Math.Round(100 * (c[i] - lo) / (hi - lo), 2);
            }).ToList();
            var D = SMA(K.Select(v => v ?? 0.0).ToList(), 3);
            return (K, D);
        }

        private static List<double?> VWAP(List<AggBar> bars)
        {
            double cumPV = 0, cumV = 0;
            return bars.Select(b =>
            {
                var tp = (b.High + b.Low + b.Close) / 3;
                cumPV += tp * b.Volume; cumV += b.Volume;
                return cumV > 0 ? (double?)(cumPV / cumV) : null;
            }).ToList();
        }

        private static List<double?> WilliamsR(List<double> h, List<double> l, List<double> c, int p)
            => c.Select((_, i) =>
            {
                if (i < p - 1) return (double?)null;
                var sl = Enumerable.Range(i - p + 1, p);
                double lo = sl.Min(j => l[j]), hi = sl.Max(j => h[j]);
                return hi == lo ? -50 : (double?)Math.Round(-100 * (hi - c[i]) / (hi - lo), 2);
            }).ToList();

        private static List<double?> OBV(List<double> c, List<double> v)
        {
            double obv = 0;
            return c.Select((_, i) =>
            {
                if (i == 0) { obv = v[i]; return (double?)obv; }
                obv += c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0;
                return (double?)obv;
            }).ToList();
        }

        private static double Corr(double[] x, double[] y)
        {
            int n = Math.Min(x.Length, y.Length);
            double mx = x.Take(n).Average(), my = y.Take(n).Average();
            double num  = x.Take(n).Zip(y.Take(n), (a, b) => (a - mx) * (b - my)).Sum();
            double sdx  = Math.Sqrt(x.Take(n).Select(a => Math.Pow(a - mx, 2)).Sum());
            double sdy  = Math.Sqrt(y.Take(n).Select(b => Math.Pow(b - my, 2)).Sum());
            return sdx * sdy == 0 ? 0 : num / (sdx * sdy);
        }

        private static IndicatorSeries Ts(string name, List<AggBar> bars, List<double?> vals)
            => new()
            {
                Name   = name,
                Points = bars.Zip(vals, (b, v) => new IndicatorPoint { Timestamp = b.Timestamp, Value = v }).ToList(),
            };
    }
}
