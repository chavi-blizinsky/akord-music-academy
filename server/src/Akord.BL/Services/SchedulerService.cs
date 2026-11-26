using Akord.DAL;
using Akord.DAL.Models;
using Microsoft.EntityFrameworkCore;

namespace Akord.BL.Services;

public record Slot(int Day, int Hour, int RoomId);
public record PlannedLesson(int EnrollmentId, int StudentId, int TeacherId, int RoomId, int Day, int Hour);
public record Unscheduled(int EnrollmentId, string Reason);
public record ScheduleResult(IReadOnlyList<PlannedLesson> Lessons, IReadOnlyList<Unscheduled> Unscheduled, int Explored, int SiblingPairs, int TeacherGaps);

public interface ISchedulerService
{
    ScheduleResult Solve(ScheduleInput input);
    Task<ScheduleResult> SolveAndSaveAsync(DateOnly today, CancellationToken ct = default);
}

/// <summary>Pure input for the solver – keeps the algorithm testable without a database.</summary>
public record ScheduleInput(
    IReadOnlyList<(int Id, int StudentId, int FamilyId, int TeacherId, string Instrument, bool Young)> Enrollments,
    IReadOnlyDictionary<int, IReadOnlyList<(int Day, int From, int To)>> TeacherAvailability,
    IReadOnlyList<(int Id, IReadOnlyCollection<string> Instruments)> Rooms);

/// <summary>
/// Constraint-satisfaction timetable solver (backtracking + MRV ordering + beam of best-scored slots).
/// Hard: teacher availability, no teacher/student/room double booking, room suits instrument, under-9 finish before 18:00.
/// Soft: siblings back-to-back, compact teacher days, fewer late lessons.
/// </summary>
public class SchedulerService(AkordDbContext db) : ISchedulerService
{
    private const int MaxNodes = 60_000;
    private const int Beam = 6;

    public ScheduleResult Solve(ScheduleInput input)
    {
        var unscheduled = new List<Unscheduled>();
        var domains = new Dictionary<int, List<Slot>>();
        foreach (var e in input.Enrollments)
        {
            var rooms = input.Rooms.Where(r => r.Instruments.Contains(e.Instrument)).ToList();
            var slots = (input.TeacherAvailability.TryGetValue(e.TeacherId, out var windows) ? windows : Array.Empty<(int Day, int From, int To)>())
                .SelectMany(w => Enumerable.Range(w.From, w.To - w.From).Select(h => (w.Day, Hour: h)))
                .Where(s => !(e.Young && s.Hour >= 18))
                .SelectMany(s => rooms.Select(r => new Slot(s.Day, s.Hour, r.Id)))
                .ToList();
            if (slots.Count == 0) unscheduled.Add(new(e.Id, rooms.Count == 0 ? "אין חדר שמתאים לכלי" : "אין חלון זמינות אצל המורה"));
            else domains[e.Id] = slots;
        }

        var order = input.Enrollments.Where(e => domains.ContainsKey(e.Id)).OrderBy(e => domains[e.Id].Count).ToList();
        var byId = input.Enrollments.ToDictionary(e => e.Id);
        var busy = new HashSet<string>();
        var assignment = new Dictionary<int, Slot>();
        var explored = 0;

        int Score(int eId, Slot s)
        {
            var e = byId[eId];
            var score = s.Hour >= 19 ? -2 : 0;
            foreach (var (otherId, os) in assignment)
            {
                var o = byId[otherId];
                if (o.FamilyId == e.FamilyId && os.Day == s.Day) score += Math.Abs(os.Hour - s.Hour) == 1 ? 12 : -2;
                if (o.TeacherId == e.TeacherId && os.Day == s.Day) score += Math.Abs(os.Hour - s.Hour) == 1 ? 4 : 1;
            }
            return score;
        }

        string[] Keys((int Id, int StudentId, int FamilyId, int TeacherId, string Instrument, bool Young) e, Slot s) =>
            [$"T{e.TeacherId}|{s.Day}|{s.Hour}", $"S{e.StudentId}|{s.Day}|{s.Hour}", $"R{s.RoomId}|{s.Day}|{s.Hour}"];

        bool Place(int i)
        {
            if (i == order.Count) return true;
            if (explored > MaxNodes) return false;
            var e = order[i];
            var candidates = domains[e.Id]
                .Where(s => Keys(e, s).All(k => !busy.Contains(k)))
                .OrderByDescending(s => Score(e.Id, s))
                .Take(Beam)
                .ToList();
            foreach (var s in candidates)
            {
                explored++;
                assignment[e.Id] = s;
                foreach (var k in Keys(e, s)) busy.Add(k);
                if (Place(i + 1)) return true;
                assignment.Remove(e.Id);
                foreach (var k in Keys(e, s)) busy.Remove(k);
            }
            unscheduled.Add(new(e.Id, "כל המשבצות של המורה תפוסות"));
            return Place(i + 1);
        }
        Place(0);

        var lessons = assignment.Select(a => new PlannedLesson(a.Key, byId[a.Key].StudentId, byId[a.Key].TeacherId, a.Value.RoomId, a.Value.Day, a.Value.Hour)).ToList();
        return new ScheduleResult(lessons, unscheduled, explored, SiblingPairs(lessons, byId.ToDictionary(x => x.Value.StudentId, x => x.Value.FamilyId)), TeacherGaps(lessons));
    }

    public async Task<ScheduleResult> SolveAndSaveAsync(DateOnly today, CancellationToken ct = default)
    {
        var enrollments = await db.Enrollments
            .Where(e => e.Student.Status == StudentStatus.Active)
            .Select(e => new { e.Id, e.StudentId, e.Student.FamilyId, e.TeacherId, e.Course.Instrument, e.Student.BirthDate })
            .ToListAsync(ct);
        var availability = await db.TeacherAvailability.ToListAsync(ct);
        var rooms = await db.Rooms.ToListAsync(ct);

        var input = new ScheduleInput(
            enrollments.Select(e => (e.Id, e.StudentId, e.FamilyId, e.TeacherId, e.Instrument, Young: e.BirthDate > today.AddYears(-9))).ToList(),
            availability.GroupBy(a => a.TeacherId).ToDictionary(g => g.Key, g => (IReadOnlyList<(int Day, int From, int To)>)g.Select(a => (Day: a.Day, From: a.FromHour, To: a.ToHour)).ToList()),
            rooms.Select(r => (r.Id, (IReadOnlyCollection<string>)r.InstrumentList.ToList())).ToList());

        var result = Solve(input);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Lessons.RemoveRange(db.Lessons);
        await db.SaveChangesAsync(ct);
        db.Lessons.AddRange(result.Lessons.Select(l => new Lesson { EnrollmentId = l.EnrollmentId, RoomId = l.RoomId, Day = l.Day, Hour = l.Hour }));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return result;
    }

    public static int SiblingPairs(IReadOnlyList<PlannedLesson> lessons, IReadOnlyDictionary<int, int> familyOfStudent)
    {
        var pairs = 0;
        for (var i = 0; i < lessons.Count; i++)
            for (var j = i + 1; j < lessons.Count; j++)
            {
                var (a, b) = (lessons[i], lessons[j]);
                if (a.StudentId != b.StudentId && familyOfStudent[a.StudentId] == familyOfStudent[b.StudentId] && a.Day == b.Day && Math.Abs(a.Hour - b.Hour) == 1) pairs++;
            }
        return pairs;
    }

    public static int TeacherGaps(IEnumerable<PlannedLesson> lessons) =>
        lessons.GroupBy(l => (l.TeacherId, l.Day))
            .Sum(g => { var h = g.Select(x => x.Hour).OrderBy(x => x).ToList(); return h.Zip(h.Skip(1), (x, y) => y - x - 1).Sum(); });

    public static IReadOnlyList<string> FindConflicts(IEnumerable<PlannedLesson> lessons)
    {
        var seen = new HashSet<string>();
        var conflicts = new List<string>();
        foreach (var l in lessons)
            foreach (var k in new[] { $"T{l.TeacherId}|{l.Day}|{l.Hour}", $"S{l.StudentId}|{l.Day}|{l.Hour}", $"R{l.RoomId}|{l.Day}|{l.Hour}" })
                if (!seen.Add(k)) conflicts.Add(k);
        return conflicts;
    }
}
