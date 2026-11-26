using Akord.DAL.Models;
using Microsoft.EntityFrameworkCore;

namespace Akord.DAL;

public class AkordDbContext(DbContextOptions<AkordDbContext> options) : DbContext(options)
{
    public DbSet<Family> Families => Set<Family>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<TeacherAvailability> TeacherAvailability => Set<TeacherAvailability>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Attendance> Attendance => Set<Attendance>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<WaitlistEntry> Waitlist => Set<WaitlistEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Teacher>().Ignore(t => t.InstrumentList);
        b.Entity<Room>().Ignore(r => r.InstrumentList);
        b.Entity<Teacher>().HasMany(t => t.Availability).WithOne().HasForeignKey(a => a.TeacherId);

        b.Entity<Payment>().HasIndex(p => new { p.FamilyId, p.Month }).IsUnique();
        b.Entity<Attendance>().HasIndex(a => new { a.StudentId, a.Date });

        // A room and a teacher can only host one lesson per weekly slot – enforced by the database too.
        b.Entity<Lesson>().HasIndex(l => new { l.RoomId, l.Day, l.Hour }).IsUnique();

        b.Entity<Course>().Property(c => c.MonthlyPrice).HasPrecision(10, 2);
        b.Entity<Teacher>().Property(t => t.HourlyRate).HasPrecision(10, 2);
        b.Entity<Payment>().Property(p => p.Amount).HasPrecision(10, 2);
    }
}
