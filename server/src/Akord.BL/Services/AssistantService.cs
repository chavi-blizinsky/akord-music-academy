using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Akord.DAL;
using Akord.DAL.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Akord.BL.Services;

public record AssistantReply(string Answer, IReadOnlyList<string> ToolsUsed, string Engine);

public interface IAssistantService
{
    Task<AssistantReply> AskAsync(string question, DateOnly today, CancellationToken ct = default);
}

/// <summary>
/// Tool-using AI agent. With an Anthropic key (configuration "Claude:ApiKey") Claude decides which tools to call;
/// without one, a Hebrew intent router calls the same tools, so the endpoint always answers from live data.
/// </summary>
public class AssistantService(AkordDbContext db, IInsightsService insights, IHttpClientFactory http, IConfiguration config) : IAssistantService
{
    private const string Model = "claude-sonnet-5-5";

    private static readonly JsonArray ToolDefinitions = new()
    {
        Tool("unpaid_families", "Families that have not paid the current month"),
        Tool("at_risk_students", "Students with the highest predicted churn risk and why"),
        Tool("school_stats", "Headline numbers: active students, teachers, waitlist, weekly lessons"),
        Tool("revenue_forecast", "Revenue forecast for the next three months"),
    };

    private static JsonObject Tool(string name, string description) => new()
    {
        ["name"] = name,
        ["description"] = description,
        ["input_schema"] = new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() },
    };

    public async Task<AssistantReply> AskAsync(string question, DateOnly today, CancellationToken ct = default)
    {
        var key = config["Claude:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            var tool = Route(question);
            return new AssistantReply(await RunToolAsync(tool, today, ct), [tool], "local");
        }
        return await AskClaudeAsync(question, key, today, ct);
    }

    public static string Route(string q) =>
        q.Contains("שילם") || q.Contains("חוב") || q.Contains("תשלום") ? "unpaid_families"
        : q.Contains("סיכון") || q.Contains("לעזוב") || q.Contains("נטישה") ? "at_risk_students"
        : q.Contains("תחזית") || q.Contains("צפי") ? "revenue_forecast"
        : "school_stats";

    public async Task<string> RunToolAsync(string name, DateOnly today, CancellationToken ct)
    {
        var month = today.ToString("yyyy-MM");
        switch (name)
        {
            case "unpaid_families":
                var unpaid = await db.Payments.Where(p => p.Month == month && p.PaidAt == null)
                    .Select(p => new { p.Family.LastName, p.Family.Phone, p.Amount }).ToListAsync(ct);
                return unpaid.Count == 0 ? "כל המשפחות שילמו החודש."
                    : $"{unpaid.Count} משפחות לא שילמו (סה״כ ₪{unpaid.Sum(u => u.Amount):N0}):\n" + string.Join("\n", unpaid.Select(u => $"• משפחת {u.LastName} – ₪{u.Amount:N0} – {u.Phone}"));
            case "at_risk_students":
                var risk = (await insights.ChurnAsync(today, ct)).Where(r => r.Level != "low").Take(5).ToList();
                return risk.Count == 0 ? "אין תלמידים בסיכון." : "בסיכון עזיבה:\n" + string.Join("\n", risk.Select(r => $"• {r.Name} – {r.Probability:P0} ({r.Factors[0].Label}). מומלץ: {r.Action}"));
            case "revenue_forecast":
                var f = (await insights.ForecastAsync(3, ct)).Where(p => p.Forecast != null);
                return "תחזית הכנסות:\n" + string.Join("\n", f.Select(p => $"• {p.Month}: ₪{p.Forecast:N0} (₪{p.Low:N0}–₪{p.High:N0})"));
            default:
                var active = await db.Students.CountAsync(s => s.Status == StudentStatus.Active, ct);
                return $"{active} תלמידים פעילים, {await db.Teachers.CountAsync(ct)} מורים, {await db.Waitlist.CountAsync(ct)} ממתינים, {await db.Lessons.CountAsync(ct)} שיעורים בשבוע.";
        }
    }

    private async Task<AssistantReply> AskClaudeAsync(string question, string key, DateOnly today, CancellationToken ct)
    {
        var client = http.CreateClient("anthropic");
        var messages = new JsonArray { new JsonObject { ["role"] = "user", ["content"] = question } };
        var used = new List<string>();

        for (var step = 0; step < 4; step++)
        {
            var body = new JsonObject
            {
                ["model"] = Model,
                ["max_tokens"] = 800,
                ["system"] = $"You are the office assistant of the Akord music school. Today is {today:yyyy-MM-dd}. Answer in Hebrew, concise. Use tools for facts.",
                ["tools"] = ToolDefinitions.DeepClone(),
                ["messages"] = messages.DeepClone(),
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "v1/messages") { Content = JsonContent.Create(body) };
            req.Headers.Add("x-api-key", key);
            req.Headers.Add("anthropic-version", "2023-06-01");
            using var res = await client.SendAsync(req, ct);
            res.EnsureSuccessStatusCode();
            var json = JsonNode.Parse(await res.Content.ReadAsStringAsync(ct))!;
            var content = json["content"]!.AsArray();
            messages.Add(new JsonObject { ["role"] = "assistant", ["content"] = content.DeepClone() });

            if (json["stop_reason"]?.GetValue<string>() != "tool_use")
                return new AssistantReply(string.Join("\n", content.Where(c => c?["type"]?.GetValue<string>() == "text").Select(c => c!["text"]!.GetValue<string>())), used, "claude");

            var results = new JsonArray();
            foreach (var call in content.Where(c => c?["type"]?.GetValue<string>() == "tool_use"))
            {
                var name = call!["name"]!.GetValue<string>();
                used.Add(name);
                results.Add(new JsonObject { ["type"] = "tool_result", ["tool_use_id"] = call["id"]!.GetValue<string>(), ["content"] = await RunToolAsync(name, today, ct) });
            }
            messages.Add(new JsonObject { ["role"] = "user", ["content"] = results });
        }
        return new AssistantReply("לא הצלחתי להשלים את התשובה.", used, "claude");
    }
}
