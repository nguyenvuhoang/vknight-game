import type {
  AdventureStageConfig,
  Choice,
  Cond,
  Effect,
  Hotspot,
  Line,
  Verb,
} from "./types";

export type PuzzleState = { flags: string[]; inv: string[] };

export type Outcome = {
  state: PuzzleState;
  lines: Line[];
  choice?: Choice;
  gained: string[];
  won?: string;
};

export function check(cond: Cond | undefined, s: PuzzleState): boolean {
  if (!cond) return true;
  return (
    (cond.flags ?? []).every((f) => s.flags.includes(f)) &&
    (cond.notFlags ?? []).every((f) => !s.flags.includes(f)) &&
    (cond.has ?? []).every((i) => s.inv.includes(i)) &&
    (cond.lacks ?? []).every((i) => !s.inv.includes(i))
  );
}

export function runEffects(effects: Effect[], start: PuzzleState): Outcome {
  const out: Outcome = { state: { flags: [...start.flags], inv: [...start.inv] }, lines: [], gained: [] };
  for (const e of effects) {
    if ("say" in e) out.lines.push(...e.say);
    else if ("give" in e) {
      if (!out.state.inv.includes(e.give)) out.state.inv.push(e.give);
      out.gained.push(e.give);
    } else if ("take" in e) out.state.inv = out.state.inv.filter((i) => i !== e.take);
    else if ("set" in e) {
      if (!out.state.flags.includes(e.set)) out.state.flags.push(e.set);
    } else if ("choice" in e) out.choice = e.choice;
    else if ("win" in e) out.won = e.win;
  }
  return out;
}

/** First matching rule wins; otherwise a light fallback line. */
export function interact(
  cfg: AdventureStageConfig,
  spot: Hotspot,
  verb: Verb,
  item: string | null,
  s: PuzzleState,
  skillLine: string,
): Outcome {
  const rule = cfg.rules.find(
    (r) =>
      r.on === spot.id &&
      r.verb === verb &&
      (verb !== "use" || r.item === item) &&
      check(r.when, s),
  );
  if (rule) return runEffects(rule.effects, s);

  const itemName = item ? cfg.items[item]?.name ?? item : "";
  const text = {
    talk:
      spot.kind === "npc"
        ? `${spot.name} đang bận, chưa muốn nói chuyện.`
        : `Bạn thử bắt chuyện với ${spot.name}. ${spot.name} im lặng một cách lịch sự.`,
    inspect: `Bạn ngắm ${spot.name} thật kỹ. Không có gì đặc biệt… lần này.`,
    use: `Dùng ${itemName} lên ${spot.name}? Không ăn thua gì cả.`,
    skill: skillLine.replaceAll("{target}", spot.name),
  }[verb];
  return runEffects([{ say: [{ who: "narrator", text }] }], s);
}
