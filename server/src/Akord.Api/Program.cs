using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Akord.BL;
using Akord.DAL;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AkordDbContext>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Akord") ?? "Data Source=akord.db"));
builder.Services.AddAkordBusinessLogic();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o => o.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "Akord.Api.xml")));
builder.Services.AddHealthChecks().AddDbContextCheck<AkordDbContext>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod()));

// The AI endpoint costs money per call – protect it.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("assistant", l => { l.PermitLimit = 10; l.Window = TimeSpan.FromMinutes(1); });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AkordDbContext>();
    db.Database.EnsureCreated();
    DbSeeder.Seed(db, DateOnly.FromDateTime(DateTime.Today));
}

app.UseExceptionHandler();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseRateLimiter();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program { }
