using Akord.DAL.Models;

namespace Akord.DAL;

/// <summary>Deterministic demo data – the same school the React demo shows.</summary>
public static class DbSeeder
{
    public static void Seed(AkordDbContext db, DateOnly today)
    {
        if (db.Families.Any()) return;
        var rnd = new Random(7);
        T Pick<T>(IReadOnlyList<T> xs) => xs[rnd.Next(xs.Count)];

        var teachers = new List<Teacher>
        {
            NewTeacher("אסתר", "רובין", "פסנתר,תיאוריה", 140, (0, 14, 19), (2, 14, 20), (4, 13, 18)),
            NewTeacher("דוד", "אלמוג", "גיטרה,בס", 130, (1, 15, 20), (3, 15, 20)),
            NewTeacher("מרים", "שטרן", "כינור,צ׳לו", 150, (0, 15, 19), (1, 14, 18), (3, 14, 18)),
            NewTeacher("יוסף", "בן שושן", "תופים,כלי הקשה", 120, (2, 15, 20), (4, 14, 19)),
            NewTeacher("חנה", "גרוס", "פסנתר,חליל", 135, (1, 13, 17), (2, 13, 17), (3, 16, 20)),
            NewTeacher("אליהו", "נגר", "שירה,פיתוח קול", 145, (0, 16, 20), (4, 15, 19)),
        };
        db.Teachers.AddRange(teachers);

        var courses = new List<Course>
        {
            new() { Name = "פסנתר קלאסי", Instrument = "פסנתר", MonthlyPrice = 420, FromAge = 6, Description = "שיטת סוזוקי ורפרטואר קלאסי" },
            new() { Name = "גיטרה מודרנית", Instrument = "גיטרה", MonthlyPrice = 380, FromAge = 8, Description = "אקורדים, ליווי ואלתור" },
            new() { Name = "כינור", Instrument = "כינור", MonthlyPrice = 440, FromAge = 5, Description = "יסודות ותזמורת הנוער" },
            new() { Name = "תופים", Instrument = "תופים", MonthlyPrice = 390, FromAge = 7, Description = "קצב וקואורדינציה" },
            new() { Name = "חליל צד", Instrument = "חליל", MonthlyPrice = 360, DurationMin = 30, FromAge = 7, Description = "נשימה וצליל" },
            new() { Name = "פיתוח קול", Instrument = "שירה", MonthlyPrice = 410, FromAge = 9, Description = "טכניקה קולית והופעה" },
            new() { Name = "צ׳לו", Instrument = "צ׳לו", MonthlyPrice = 460, FromAge = 7, Description = "נגינה קאמרית" },
        };
        db.Courses.AddRange(courses);

        db.Rooms.AddRange(
            new Room { Name = "חדר סטיינווי", Instruments = "פסנתר,שירה,חליל,כינור,צ׳לו" },
            new Room { Name = "חדר ימאהה", Instruments = "פסנתר,שירה,חליל" },
            new Room { Name = "אולפן הקלטות", Instruments = "גיטרה,בס,שירה,תופים" },
            new Room { Name = "חדר מיתרים", Instruments = "כינור,צ׳לו,גיטרה" });

        string[] last = ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "פרידמן", "שפירא", "גולדברג", "רוזן", "אזולאי", "דהן", "קליין", "וייס", "ברק", "אלון", "נחום", "שמואלי"];
        string[] first = ["נועה", "מאיה", "תמר", "יעל", "שירה", "אביגיל", "הדס", "רחל", "אורי", "איתי", "יונתן", "דניאל", "עידו", "אריאל", "נועם", "אליה", "מיכל", "עדי"];

        for (var f = 0; f < 26; f++)
        {
            var family = new Family { LastName = last[f % last.Length], Phone = $"05{rnd.Next(9)}-{rnd.Next(1000000, 9999999)}", Email = $"family{f + 1}@mail.demo", Address = "ירושלים" };
            var kids = 1 + (rnd.NextDouble() < 0.45 ? 1 : 0);
            for (var k = 0; k < kids; k++)
            {
                var course = Pick(courses);
                var roll = rnd.NextDouble();
                var student = new Student
                {
                    FirstName = Pick(first),
                    BirthDate = today.AddYears(-rnd.Next(7, 17)).AddDays(-rnd.Next(365)),
                    StartDate = today.AddDays(-rnd.Next(60, 900)),
                    Status = roll < 0.8 ? StudentStatus.Active : roll < 0.9 ? StudentStatus.Waiting : StudentStatus.Paused,
                    Instrument = course.Instrument,
                    Level = rnd.Next(1, 6),
                };
                family.Students.Add(student);
                if (student.Status == StudentStatus.Waiting)
                    db.Waitlist.Add(new WaitlistEntry { Student = student, Course = course, RequestedAt = today.AddDays(-rnd.Next(50)), Priority = rnd.Next(1, 4) });
                else
                    db.Enrollments.Add(new Enrollment { Student = student, Course = course, Teacher = teachers.First(t => t.InstrumentList.Contains(course.Instrument)), StartDate = student.StartDate });

                if (student.Status == StudentStatus.Active)
                {
                    var drifting = rnd.NextDouble() < 0.18;
                    for (var w = 10; w >= 1; w--)
                    {
                        var pAbsent = drifting ? (w <= 4 ? 0.55 : 0.15) : 0.07;
                        student.Attendance.Add(new Attendance { Date = today.AddDays(-7 * w), Status = rnd.NextDouble() < pAbsent ? AttendanceStatus.Absent : AttendanceStatus.Present });
                    }
                }
            }
            db.Families.Add(family);
        }
        db.SaveChanges();

        // 18 months of billing with seasonality.
        double[] seasonal = [1.0, 1.0, 1.02, 1.0, 0.98, 0.9, 0.72, 0.7, 1.12, 1.08, 1.04, 1.02];
        var enrolledByFamily = db.Enrollments.Select(e => new { e.Student.FamilyId, e.Course.MonthlyPrice }).ToList()
            .GroupBy(x => x.FamilyId).ToDictionary(g => g.Key, g => g.Sum(x => x.MonthlyPrice));
        for (var m = 17; m >= 0; m--)
        {
            var month = new DateOnly(today.Year, today.Month, 1).AddMonths(-m);
            foreach (var (familyId, basePrice) in enrolledByFamily)
            {
                var amount = Math.Round(basePrice * (decimal)(seasonal[month.Month - 1] * (1 + (17 - m) * 0.012)) / 10) * 10;
                var unpaid = m == 0 && rnd.NextDouble() < 0.2;
                db.Payments.Add(new Payment
                {
                    FamilyId = familyId,
                    Month = month.ToString("yyyy-MM"),
                    Amount = amount,
                    PaidAt = unpaid ? null : month.AddDays(rnd.Next(0, 9)),
                    Method = (PaymentMethod)rnd.Next(4),
                });
            }
        }
        db.SaveChanges();
    }

    private static Teacher NewTeacher(string first, string last, string instruments, decimal rate, params (int day, int from, int to)[] windows) => new()
    {
        FirstName = first,
        LastName = last,
        Phone = "050-0000000",
        Instruments = instruments,
        HourlyRate = rate,
        Availability = windows.Select(w => new TeacherAvailability { Day = w.day, FromHour = w.from, ToHour = w.to }).ToList(),
    };
}
