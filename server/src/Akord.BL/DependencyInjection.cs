using Akord.BL.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Akord.BL;

public static class DependencyInjection
{
    public static IServiceCollection AddAkordBusinessLogic(this IServiceCollection services)
    {
        services.AddScoped<ISchedulerService, SchedulerService>();
        services.AddScoped<IInsightsService, InsightsService>();
        services.AddScoped<IAssistantService, AssistantService>();
        services.AddScoped<ICalendarService, CalendarService>();
        services.AddHttpClient("anthropic", c =>
        {
            c.BaseAddress = new Uri("https://api.anthropic.com/");
            c.Timeout = TimeSpan.FromSeconds(60);
        });
        return services;
    }
}
