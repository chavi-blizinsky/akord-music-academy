using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Akord.Tests;

/// <summary>End-to-end tests against the real ASP.NET Core pipeline with a throw-away SQLite database.</summary>
public class ApiTests : IClassFixture<ApiTests.Factory>
{
    public class Factory : WebApplicationFactory<Program>
    {
        private readonly string _db = Path.Combine(Path.GetTempPath(), $"akord-test-{Guid.NewGuid():N}.db");
        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.UseSetting("ConnectionStrings:Akord", $"Data Source={_db}");
    }

    private readonly HttpClient _http;
    public ApiTests(Factory f) => _http = f.CreateClient();

    [Fact]
    public async Task Health_is_green() => Assert.Equal(HttpStatusCode.OK, (await _http.GetAsync("/health")).StatusCode);

    [Fact]
    public async Task Solve_then_read_schedule_and_calendar()
    {
        var solve = await _http.PostAsync("/api/schedule/solve", null);
        solve.EnsureSuccessStatusCode();
        var lessons = await _http.GetFromJsonAsync<List<object>>("/api/schedule");
        Assert.NotEmpty(lessons!);

        var ics = await _http.GetStringAsync("/api/schedule/calendar.ics");
        Assert.StartsWith("BEGIN:VCALENDAR", ics);
        Assert.Contains("RRULE:FREQ=WEEKLY", ics);
    }

    [Fact]
    public async Task Insights_return_predictions_and_forecast()
    {
        var churn = await _http.GetFromJsonAsync<List<object>>("/api/insights/churn");
        var forecast = await _http.GetFromJsonAsync<List<object>>("/api/insights/forecast?horizon=3");
        Assert.NotEmpty(churn!);
        Assert.True(forecast!.Count > 3);
    }

    [Fact]
    public async Task Assistant_answers_offline_and_validates_input()
    {
        var ok = await _http.PostAsJsonAsync("/api/assistant", new { question = "כמה תלמידים יש?" });
        ok.EnsureSuccessStatusCode();
        var bad = await _http.PostAsJsonAsync("/api/assistant", new { question = "" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Unknown_family_returns_problem_details()
    {
        var res = await _http.PostAsJsonAsync("/api/students", new { familyId = 99999, firstName = "נועה", birthDate = "2015-01-01", instrument = "פסנתר", level = 2 });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
    }
}
