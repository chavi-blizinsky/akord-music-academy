using System.Text;
using Akord.DAL;
using Microsoft.EntityFrameworkCore;

namespace Akord.BL.Services;

public interface ICalendarService
{
    Task<string> BuildIcsAsync(int? teacherId, DateOnly weekOf, CancellationToken ct = default);
}

/// <summary>RFC 5545 export with weekly recurrence – subscribe from Google Calendar, Outlook or Apple Calendar.</summary>
public class CalendarService(AkordDbContext db) : ICalendarService
{
    public async Task<string> BuildIcsAsync(int? teacherId, DateOnly weekOf, CancellationToken ct = default)
    {
        var lessons = await db.Lessons
            .Where(l => teacherId == null || l.Enrollment.TeacherId == teacherId)
            .Select(l => new { l.Id, l.Day, l.Hour, Room = l.Room.Name, l.Enrollment.Student.FirstName, l.Enrollment.Student.Family.LastName, l.Enrollment.Course.Instrument })
            .ToListAsync(ct);

        var sunday = weekOf.AddDays(-(int)weekOf.DayOfWeek);
        var sb = new StringBuilder();
        sb.Append("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Akord//Music School//HE\r\nCALSCALE:GREGORIAN\r\n");
        foreach (var l in lessons)
        {
            var date = sunday.AddDays(l.Day).ToString("yyyyMMdd");
            sb.Append("BEGIN:VEVENT\r\n")
              .Append($"UID:lesson-{l.Id}@akord\r\n")
              .Append($"DTSTAMP:{date}T000000Z\r\n")
              .Append($"DTSTART;TZID=Asia/Jerusalem:{date}T{l.Hour:00}0000\r\n")
              .Append($"DTEND;TZID=Asia/Jerusalem:{date}T{l.Hour:00}4500\r\n")
              .Append("RRULE:FREQ=WEEKLY\r\n")
              .Append($"SUMMARY:שיעור {l.Instrument} – {l.FirstName} {l.LastName}\r\n")
              .Append($"LOCATION:{l.Room}\r\n")
              .Append("END:VEVENT\r\n");
        }
        sb.Append("END:VCALENDAR\r\n");
        return sb.ToString();
    }
}
