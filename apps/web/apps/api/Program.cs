using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<GameDb>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Game")));
builder.Services.AddCors(options => options.AddPolicy("web", policy =>
    policy.WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"])
          .AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors("web");
using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<GameDb>().Database.EnsureCreatedAsync();

app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "vknight-api" }));
app.MapGet("/api/v1/chapters", () => Results.Ok(new [] { new { id="ch01-lang-ngao", title="Làng Ngáo", levels=10 } }));
app.MapGet("/api/v1/progress/{playerId:guid}", async (Guid playerId, GameDb db) =>
    Results.Ok(await db.Progress.Where(x=>x.PlayerId==playerId)
        .Select(x=>new {x.HeroId,x.CompletedLevel}).ToListAsync()));

// DEVELOPMENT ONLY: Caller-supplied playerId & level completion are insecure.
// Production: authenticated session, server-validated completion, and rate limiting.
app.MapPost("/api/v1/progress/complete", async (CompleteLevelRequest req, GameDb db) => {
    if (req.PlayerId == Guid.Empty || !new[]{"sword","professor","chairman","angry","comedian"}.Contains(req.HeroId)
        || req.Level < 1 || req.Level > 10) return Results.BadRequest(new {error="Invalid input"});
    var record = await db.Progress.SingleOrDefaultAsync(x => x.PlayerId==req.PlayerId && x.HeroId==req.HeroId);
    if (record is null) {
        if(req.Level!=1) return Results.BadRequest(new { error="Complete level 1 first" });
        record=new PlayerProgress{PlayerId=req.PlayerId,HeroId=req.HeroId,CompletedLevel=1};db.Progress.Add(record);
    } else if (req.Level==record.CompletedLevel+1) record.CompletedLevel=req.Level;
    else if (req.Level>record.CompletedLevel+1) return Results.BadRequest(new {error="Level out of sequence"});
    await db.SaveChangesAsync();
    return Results.Ok(new { record.HeroId,record.CompletedLevel });
});

// Do not accept actual transfers in demo. No payment or entitlement is granted.
app.MapPost("/api/v1/payments/skip/demo", () => Results.StatusCode(501));
app.Run();

public sealed record CompleteLevelRequest(Guid PlayerId,string HeroId,int Level);
public sealed class PlayerProgress {
    public long Id {get;set;}
    public Guid PlayerId {get;set;}
    [MaxLength(32)] public string HeroId {get;set;}="";
    public int CompletedLevel {get;set;}
}
public sealed class GameDb(DbContextOptions<GameDb> options):DbContext(options) {
    public DbSet<PlayerProgress> Progress => Set<PlayerProgress>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<PlayerProgress>().HasIndex(x => new{x.PlayerId,x.HeroId}).IsUnique();
}
