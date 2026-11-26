namespace Akord.DAL.Models;

// Domain entities. The model follows the original Akord database (Family → Student → Courses → AnnualHoursSystem),
// extended with rooms, attendance, payments and a waiting list.

public enum StudentStatus { Active, Waiting, Paused, Finished }
public enum AttendanceStatus { Present, Absent, Excused }
public enum PaymentMethod { Credit, Transfer, Cash, Check }

public class Family
{
    public int Id { get; set; }
    public string LastName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public string? Address { get; set; }
    public List<Student> Students { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
}

public class Student
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family Family { get; set; } = null!;
    public string FirstName { get; set; } = "";
    public DateOnly BirthDate { get; set; }
    public DateOnly StartDate { get; set; }
    public StudentStatus Status { get; set; }
    public string Instrument { get; set; } = "";
    public int Level { get; set; } = 1;
    public string? Notes { get; set; }
    public List<Enrollment> Enrollments { get; set; } = new();
    public List<Attendance> Attendance { get; set; } = new();
}

public class Teacher
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    /// <summary>Comma separated list, e.g. "פסנתר,תיאוריה".</summary>
    public string Instruments { get; set; } = "";
    public bool Active { get; set; } = true;
    public decimal HourlyRate { get; set; }
    public List<TeacherAvailability> Availability { get; set; } = new();

    public IEnumerable<string> InstrumentList => Instruments.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public class TeacherAvailability
{
    public int Id { get; set; }
    public int TeacherId { get; set; }
    /// <summary>0 = Sunday … 5 = Friday.</summary>
    public int Day { get; set; }
    public int FromHour { get; set; }
    public int ToHour { get; set; }
}

public class Course
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Instrument { get; set; } = "";
    public decimal MonthlyPrice { get; set; }
    public int DurationMin { get; set; } = 45;
    public int FromAge { get; set; }
    public int ToAge { get; set; } = 99;
    public string? Description { get; set; }
}

public class Room
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Instruments { get; set; } = "";
    public IEnumerable<string> InstrumentList => Instruments.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public class Enrollment
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public int TeacherId { get; set; }
    public Teacher Teacher { get; set; } = null!;
    public DateOnly StartDate { get; set; }
}

/// <summary>A weekly recurring lesson slot (the original "AnnualHoursSystem").</summary>
public class Lesson
{
    public int Id { get; set; }
    public int EnrollmentId { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public int Day { get; set; }
    public int Hour { get; set; }
}

public class Attendance
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public DateOnly Date { get; set; }
    public AttendanceStatus Status { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int FamilyId { get; set; }
    public Family Family { get; set; } = null!;
    /// <summary>Billing month, "yyyy-MM".</summary>
    public string Month { get; set; } = "";
    public decimal Amount { get; set; }
    public DateOnly? PaidAt { get; set; }
    public PaymentMethod Method { get; set; }
}

public class WaitlistEntry
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public DateOnly RequestedAt { get; set; }
    public int Priority { get; set; }
}
