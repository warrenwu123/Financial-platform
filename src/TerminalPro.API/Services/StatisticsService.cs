using TerminalPro.API.Models;

namespace TerminalPro.API.Services;

public interface IStatisticsService
{
    List<double> SMA(IList<OhlcBar> bars, int period);
    List<double> EMA(IList<OhlcBar> bars, int period);
    List<double> RSI(IList<OhlcBar> bars, int period = 14);
    (List<double> upper, List<double> mid, List<double> lower) BollingerBands(IList<OhlcBar> bars, int period = 20, double mult = 2.0);
    (List<double> macd, List<double> signal, List<double> hist) MACD(IList<OhlcBar> bars, int fast = 12, int slow = 26, int sig = 9);
}

public class StatisticsService : IStatisticsService
{
    public List<double> SMA(IList<OhlcBar> bars, int period)
    {
        var closes = bars.Select(b => (double)b.Close).ToList();
        return closes.Select((_, i) =>
            i < period - 1 ? double.NaN
            : closes.Skip(i - period + 1).Take(period).Average()
        ).ToList();
    }

    public List<double> EMA(IList<OhlcBar> bars, int period)
    {
        var closes = bars.Select(b => (double)b.Close).ToList();
        double k = 2.0 / (period + 1);
        double e = closes[0];
        return closes.Select((v, i) =>
        {
            e = i == 0 ? v : v * k + e * (1 - k);
            return e;
        }).ToList();
    }

    public List<double> RSI(IList<OhlcBar> bars, int period = 14)
    {
        var closes = bars.Select(b => (double)b.Close).ToList();
        return closes.Select((_, i) =>
        {
            if (i < period) return double.NaN;
            var changes = closes.Skip(i - period + 1).Take(period)
                .Zip(closes.Skip(i - period).Take(period), (a, b) => a - b).ToList();
            double g = changes.Where(c => c > 0).DefaultIfEmpty(0).Average();
            double l = Math.Abs(changes.Where(c => c < 0).DefaultIfEmpty(0).Average());
            return l == 0 ? 100 : 100 - 100 / (1 + g / l);
        }).ToList();
    }

    public (List<double> upper, List<double> mid, List<double> lower)
        BollingerBands(IList<OhlcBar> bars, int period = 20, double mult = 2.0)
    {
        var closes = bars.Select(b => (double)b.Close).ToList();
        var upper = new List<double>();
        var mid   = new List<double>();
        var lower = new List<double>();
        for (int i = 0; i < closes.Count; i++)
        {
            if (i < period - 1) { upper.Add(double.NaN); mid.Add(double.NaN); lower.Add(double.NaN); continue; }
            var sl = closes.Skip(i - period + 1).Take(period).ToList();
            double m  = sl.Average();
            double sd = Math.Sqrt(sl.Average(v => Math.Pow(v - m, 2)));
            upper.Add(m + mult * sd);
            mid.Add(m);
            lower.Add(m - mult * sd);
        }
        return (upper, mid, lower);
    }

    public (List<double> macd, List<double> signal, List<double> hist)
        MACD(IList<OhlcBar> bars, int fast = 12, int slow = 26, int sig = 9)
    {
        var ema12 = EMA(bars, fast);
        var ema26 = EMA(bars, slow);
        var macd   = ema12.Zip(ema26, (a, b) => a - b).ToList();
        double k = 2.0 / (sig + 1); double e = macd[0];
        var signal = macd.Select((v, i) => { e = i == 0 ? v : v * k + e * (1 - k); return e; }).ToList();
        var hist   = macd.Zip(signal, (m, s) => m - s).ToList();
        return (macd, signal, hist);
    }
}
