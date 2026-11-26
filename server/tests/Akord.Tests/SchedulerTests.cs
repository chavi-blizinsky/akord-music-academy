using Akord.BL.Services;
using Xunit;

namespace Akord.Tests;

public class SchedulerTests
{
    private static readonly IReadOnlyList<(int Id, IReadOnlyCollection<string> Instruments)> Rooms =
        [(1, ["פסנתר"]), (2, ["פסנתר", "כינור"])];

    private static ScheduleInput Input(params (int Id, int StudentId, int FamilyId, int TeacherId, string Instrument, bool Young)[] enrollments) =>
        new(enrollments, new Dictionary<int, IReadOnlyList<(int Day, int From, int To)>>
        {
            [1] = [(0, 14, 17)],
            [2] = [(0, 14, 19)],
        }, Rooms);

    private static SchedulerService Solver() => new(null!); // Solve() is pure – no database needed

    [Fact]
    public void Produces_conflict_free_timetable()
    {
        var res = Solver().Solve(Input(
            (1, 10, 100, 1, "פסנתר", false), (2, 11, 101, 1, "פסנתר", false), (3, 12, 102, 1, "פסנתר", false),
            (4, 13, 103, 2, "כינור", false), (5, 14, 104, 2, "כינור", false)));

        Assert.Equal(5, res.Lessons.Count);
        Assert.Empty(SchedulerService.FindConflicts(res.Lessons));
        Assert.All(res.Lessons.Where(l => l.TeacherId == 1), l => Assert.InRange(l.Hour, 14, 16));
    }

    [Fact]
    public void Places_siblings_back_to_back()
    {
        var res = Solver().Solve(Input((1, 10, 100, 1, "פסנתר", false), (2, 11, 100, 2, "כינור", false)));
        var hours = res.Lessons.Select(l => l.Hour).OrderBy(h => h).ToList();
        Assert.Equal(1, hours[1] - hours[0]);
        Assert.Equal(1, res.SiblingPairs);
    }

    [Fact]
    public void Young_students_finish_before_six()
    {
        var res = Solver().Solve(Input((1, 10, 100, 2, "כינור", true)));
        Assert.True(res.Lessons.Single().Hour < 18);
    }

    [Fact]
    public void Reports_what_cannot_be_scheduled()
    {
        var res = Solver().Solve(Input((1, 10, 100, 1, "תופים", false)));
        Assert.Empty(res.Lessons);
        Assert.Equal("אין חדר שמתאים לכלי", res.Unscheduled.Single().Reason);
    }
}

public class ForecastTests
{
    [Fact]
    public void Forecast_has_widening_confidence_band()
    {
        var series = Enumerable.Range(0, 18).Select(i => ($"{2025 + (i + 5) / 12}-{(i + 5) % 12 + 1:00}", 30000.0 + i * 400)).ToList();
        var f = InsightsService.Forecast(series, 6).Where(p => p.Forecast != null).ToList();
        Assert.Equal(6, f.Count);
        Assert.True(f[5].High - f[5].Low > f[0].High - f[0].Low);
        Assert.True(f[5].Forecast > f[0].Forecast * 0.8m);
    }

    [Theory]
    [InlineData("מי לא שילם החודש?", "unpaid_families")]
    [InlineData("מי בסיכון לעזוב?", "at_risk_students")]
    [InlineData("מה התחזית?", "revenue_forecast")]
    [InlineData("כמה תלמידים יש?", "school_stats")]
    public void Assistant_routes_hebrew_intents(string question, string tool) => Assert.Equal(tool, AssistantService.Route(question));
}
