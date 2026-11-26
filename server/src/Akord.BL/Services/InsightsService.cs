using Akord.DAL;
using Akord.DAL.Models;
using Microsoft.EntityFrameworkCore;

namespace Akord.BL.Services;

public record ChurnFactor(string Label, string Value, double Impact);
public record ChurnPrediction(int StudentId, string Name, double Probability, string Level, IReadOnlyList<ChurnFactor> Factors, string Action);
public record ForecastPoint(string Month, decimal? Actual, decimal? Forecast, decimal? Low, decimal? High);

public interface IInsightsService
{
    Task<IReadOnlyList<ChurnPrediction>> ChurnAsync(DateOnly today, CancellationToken ct = default);
    Task<IReadOnlyList<ForecastPoint>> ForecastAsync(int horizon, CancellationToken ct = default);
}

public class InsightsService(AkordDbContext db) : IInsightsService
{
    // Logistic-regression weights (same model as the web client, so both sides agree).
    private const double Bias = -2.4, WRecent = 3.6, WTrend = 2.4, WLate = 0.35, WUnpaid = 1.1, WTenure = -0.03, WLevel = -0.15;

    public async Task<IReadOnlyList<ChurnPrediction>> ChurnAsync(DateOnly today, CancellationToken ct = default)
    {
        var month = today.ToString("yyyy-MM");
        var students = await db.Students.Include(s => s.Family).Include(s => s.Attendance)
            .Where(s => s.Status == StudentStatus.Active).ToListAsync(ct);
        var payments = await db.Payments.ToListAsync(ct);

        return students.Select(s =>
        {
            var att = s.Attendance.OrderBy(a => a.Date).ToList();
            var recent = att.TakeLast(4).ToList();
            var older = att.Take(Math.Max(0, att.Count - 4)).ToList();
            static double Rate(List<Attendance> xs) => xs.Count == 0 ? 0 : xs.Count(a => a.Status == AttendanceStatus.Absent) / (double)xs.Count;
            var recentAbsence = Rate(recent);
            var trend = Math.Max(0, recentAbsence - Rate(older));

            var fam = payments.Where(p => p.FamilyId == s.FamilyId).OrderBy(p => p.Month).ToList();
            var late = fam.TakeLast(6).Count(p => p.PaidAt is { Day: > 10 });
            var unpaid = fam.Any(p => p.Month == month && p.PaidAt is null) ? 1 : 0;
            var tenure = (today.DayNumber - s.StartDate.DayNumber) / 30.4;

            var factors = new List<ChurnFactor>
            {
                new("היעדרויות בחודש האחרון", $"{recentAbsence:P0}", WRecent * recentAbsence),
                new("עלייה בהיעדרויות", $"+{trend:P0}", WTrend * trend),
                new("תשלומים באיחור", late.ToString(), WLate * late),
                new("החודש לא שולם", unpaid == 1 ? "כן" : "לא", WUnpaid * unpaid),
                new("ותק", $"{tenure:0} חודשים", WTenure * Math.Min(tenure, 36)),
                new("רמת נגינה", s.Level.ToString(), WLevel * s.Level),
            }.OrderByDescending(f => Math.Abs(f.Impact)).ToList();

            var p = 1 / (1 + Math.Exp(-(Bias + factors.Sum(f => f.Impact))));
            var level = p > 0.55 ? "high" : p > 0.3 ? "medium" : "low";
            // Recommendation follows the strongest factor that raises the risk.
            var driver = factors.FirstOrDefault(f => f.Impact > 0)?.Label ?? "";
            var action = level == "low" ? "אין צורך בפעולה"
                : driver.Contains("היעדרויות") ? "שיחה אישית עם ההורים והצעת שעה אחרת"
                : driver.Contains("תשלומים") || driver.Contains("שולם") ? "הצעת פריסת תשלומים או הנחת אחים"
                : "שיחת מוטיבציה עם המורה";
            return new ChurnPrediction(s.Id, $"{s.FirstName} {s.Family.LastName}", p, level, factors, action);
        }).OrderByDescending(x => x.Probability).ToList();
    }

    public async Task<IReadOnlyList<ForecastPoint>> ForecastAsync(int horizon, CancellationToken ct = default)
    {
        var series = (await db.Payments.Select(p => new { p.Month, p.Amount }).ToListAsync(ct))
            .GroupBy(p => p.Month).OrderBy(g => g.Key).Select(g => (Month: g.Key, Total: (double)g.Sum(x => x.Amount))).ToList();
        return Forecast(series, horizon);
    }

    /// <summary>Seasonal-index × linear-trend forecast with a 95% band from residual standard deviation.</summary>
    public static IReadOnlyList<ForecastPoint> Forecast(IReadOnlyList<(string Month, double Total)> series, int horizon)
    {
        var points = series.Select(s => new ForecastPoint(s.Month, (decimal)s.Total, null, null, null)).ToList();
        var n = series.Count;
        if (n < 4) return points;

        var mean = series.Average(s => s.Total);
        static int Cal(string m) => int.Parse(m[5..7]) - 1;
        var season = Enumerable.Range(0, 12).Select(i =>
        {
            var xs = series.Where(s => Cal(s.Month) == i).ToList();
            return xs.Count == 0 ? 1.0 : xs.Average(s => s.Total / mean);
        }).ToArray();

        var ys = series.Select(s => s.Total / season[Cal(s.Month)]).ToArray();
        var xm = (n - 1) / 2.0;
        var ym = ys.Average();
        var slope = ys.Select((y, i) => (i - xm) * (y - ym)).Sum() / Enumerable.Range(0, n).Sum(i => (i - xm) * (i - xm));
        var intercept = ym - slope * xm;
        var sd = Math.Sqrt(series.Select((s, i) => Math.Pow(s.Total - (intercept + slope * i) * season[Cal(s.Month)], 2)).Sum() / Math.Max(1, n - 2));

        var lastMonth = DateOnly.ParseExact(series[^1].Month + "-01", "yyyy-MM-dd");
        for (var h = 1; h <= horizon; h++)
        {
            var d = lastMonth.AddMonths(h);
            var value = (intercept + slope * (n - 1 + h)) * season[d.Month - 1];
            var band = 1.96 * sd * Math.Sqrt(1 + h / (double)n);
            points.Add(new ForecastPoint(d.ToString("yyyy-MM"), null, Math.Round((decimal)value), Math.Round((decimal)(value - band)), Math.Round((decimal)(value + band))));
        }
        return points;
    }
}
