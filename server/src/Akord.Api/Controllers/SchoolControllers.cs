using Akord.BL.Services;
using Akord.DAL;
using Akord.DAL.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Akord.Api.Controllers;

public record StudentDto(int Id, string FirstName, string LastName, string Instrument, int Level, StudentStatus Status, DateOnly BirthDate, string Phone);
public record CreateStudentRequest(int FamilyId, string FirstName, DateOnly BirthDate, string Instrument, int Level);
public record LessonDto(int Id, int Day, int Hour, string Student, string Teacher, string Room);
public record AskRequest(string Question);

[ApiController, Route("api/students")]
public class StudentsController(AkordDbContext db) : ControllerBase
{
    /// <summary>Lists students, optionally filtered by status or free text.</summary>
    [HttpGet]
    public async Task<IEnumerable<StudentDto>> Get([FromQuery] StudentStatus? status, [FromQuery] string? q, CancellationToken ct) =>
        await db.Students
            .Where(s => status == null || s.Status == status)
            .Where(s => q == null || s.FirstName.Contains(q) || s.Family.LastName.Contains(q) || s.Instrument.Contains(q))
            .OrderBy(s => s.Family.LastName)
            .Select(s => new StudentDto(s.Id, s.FirstName, s.Family.LastName, s.Instrument, s.Level, s.Status, s.BirthDate, s.Family.Phone))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create(CreateStudentRequest req, CancellationToken ct)
    {
        var family = await db.Families.FindAsync([req.FamilyId], ct);
        if (family is null) return Problem(statusCode: 404, title: "המשפחה לא נמצאה");
        if (req.Level is < 1 or > 5) return ValidationProblem("רמה חייבת להיות בין 1 ל-5");
        var s = new Student { FamilyId = family.Id, FirstName = req.FirstName, BirthDate = req.BirthDate, Instrument = req.Instrument, Level = req.Level, Status = StudentStatus.Waiting, StartDate = DateOnly.FromDateTime(DateTime.Today) };
        db.Students.Add(s);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { }, new StudentDto(s.Id, s.FirstName, family.LastName, s.Instrument, s.Level, s.Status, s.BirthDate, family.Phone));
    }
}

[ApiController, Route("api/schedule")]
public class ScheduleController(AkordDbContext db, ISchedulerService scheduler, ICalendarService calendar) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<LessonDto>> Get([FromQuery] int? teacherId, CancellationToken ct) =>
        await db.Lessons
            .Where(l => teacherId == null || l.Enrollment.TeacherId == teacherId)
            .OrderBy(l => l.Day).ThenBy(l => l.Hour)
            .Select(l => new LessonDto(l.Id, l.Day, l.Hour, l.Enrollment.Student.FirstName + " " + l.Enrollment.Student.Family.LastName, l.Enrollment.Teacher.FirstName + " " + l.Enrollment.Teacher.LastName, l.Room.Name))
            .ToListAsync(ct);

    /// <summary>Runs the constraint solver and replaces the weekly timetable.</summary>
    [HttpPost("solve")]
    public Task<ScheduleResult> Solve(CancellationToken ct) => scheduler.SolveAndSaveAsync(DateOnly.FromDateTime(DateTime.Today), ct);

    /// <summary>iCalendar feed (weekly recurring) for Google Calendar / Outlook.</summary>
    [HttpGet("calendar.ics")]
    public async Task<IActionResult> Ics([FromQuery] int? teacherId, CancellationToken ct) =>
        File(System.Text.Encoding.UTF8.GetBytes(await calendar.BuildIcsAsync(teacherId, DateOnly.FromDateTime(DateTime.Today), ct)), "text/calendar", "akord.ics");
}

[ApiController, Route("api/payments")]
public class PaymentsController(AkordDbContext db) : ControllerBase
{
    [HttpGet("{month}")]
    public async Task<IActionResult> ByMonth(string month, CancellationToken ct) =>
        Ok(await db.Payments.Where(p => p.Month == month)
            .Select(p => new { p.Id, Family = p.Family.LastName, p.Family.Phone, p.Amount, p.PaidAt, p.Method })
            .ToListAsync(ct));

    [HttpPost("{id:int}/paid")]
    public async Task<IActionResult> MarkPaid(int id, [FromQuery] PaymentMethod method, CancellationToken ct)
    {
        var p = await db.Payments.FindAsync([id], ct);
        if (p is null) return NotFound();
        if (p.PaidAt is not null) return Conflict(new { title = "התשלום כבר סומן כשולם" });
        p.PaidAt = DateOnly.FromDateTime(DateTime.Today);
        p.Method = method;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

[ApiController, Route("api/insights")]
public class InsightsController(IInsightsService insights) : ControllerBase
{
    /// <summary>Explainable churn prediction for every active student.</summary>
    [HttpGet("churn")]
    public Task<IReadOnlyList<ChurnPrediction>> Churn(CancellationToken ct) => insights.ChurnAsync(DateOnly.FromDateTime(DateTime.Today), ct);

    /// <summary>Seasonal revenue forecast with a 95% confidence band.</summary>
    [HttpGet("forecast")]
    public Task<IReadOnlyList<ForecastPoint>> Forecast([FromQuery] int horizon = 6, CancellationToken ct = default) => insights.ForecastAsync(Math.Clamp(horizon, 1, 24), ct);
}

[ApiController, Route("api/assistant")]
public class AssistantController(IAssistantService assistant) : ControllerBase
{
    /// <summary>Ask the AI office assistant (tool-using agent) a question in Hebrew.</summary>
    [HttpPost, EnableRateLimiting("assistant")]
    public async Task<ActionResult<AssistantReply>> Ask(AskRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || req.Question.Length > 500) return ValidationProblem("השאלה ריקה או ארוכה מדי");
        return await assistant.AskAsync(req.Question, DateOnly.FromDateTime(DateTime.Today), ct);
    }
}
