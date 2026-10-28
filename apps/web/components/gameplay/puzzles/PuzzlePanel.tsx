"use client";
// Fantasy puzzle panel for an item guarded by a backend map puzzle. Renders the
// question from the backend definition, sends the answer through the BFF and
// shows exactly what WF_BO_SUBMIT_PUZZLE_ANSWER says (correct / message /
// retries). Collecting the item afterwards is the stage's local inventory step.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { encodeAnswer } from "@/lib/gameplay/puzzle-adapter";
import type { MapPuzzle, PuzzleOption, PuzzleSubmitResult } from "@/lib/gameplay/puzzle-types";
import type { SubmitOutcome } from "@/lib/gameplay/use-map-puzzles";
import "./puzzle-panel.css";

type Props = {
  puzzle: MapPuzzle;
  itemName: string;
  itemImage: string | null;
  /** Server progress already says solved (e.g. answered before a reload). */
  solved: boolean;
  attempts: number;
  onSubmit: (answer: string) => Promise<SubmitOutcome>;
  /** Pick the item up (local inventory) and close. */
  onCollect: () => void;
  onClose: () => void;
};

const KIND_LABEL = { MULTIPLE_CHOICE: "Câu đố trí tuệ", WORD_ORDER: "Ghép chữ", MEMORY_SEQUENCE: "Thử thách trí nhớ" } as const;

/** Stable shuffle (seeded by the puzzle code) so the words never start in answer order. */
function shuffled<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function PuzzlePanel({ puzzle, itemName, itemImage, solved, attempts, onSubmit, onCollect, onClose }: Props) {
  const titleId = useId();
  const [parts, setParts] = useState<PuzzleOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PuzzleSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const done = solved || result?.correct === true || result?.alreadyCompleted === true;
  const blocked = !done && result != null && !result.correct && !result.canRetry;
  const need = puzzle.type === "MULTIPLE_CHOICE" ? 1 : puzzle.type === "WORD_ORDER" ? puzzle.options.length : puzzle.sequence.length;
  const ready = parts.length === need && !busy && !done && !blocked;

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button:not([disabled])")?.focus();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, [busy, onClose]);

  // Synchronous guard: a double click lands before React re-renders `busy`.
  const sending = useRef(false);
  const send = async () => {
    if (!ready || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const out = await onSubmit(encodeAnswer(puzzle, parts));
    sending.current = false;
    setBusy(false);
    if (!out.ok) return setError(out.error);
    setResult(out.result);
    if (!out.result.correct && !out.result.alreadyCompleted) setParts([]);
  };

  const shownAttempts = result?.attempts ?? attempts;
  return (
    <div className="pz-overlay" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div ref={panelRef} className={`pz-panel fh-frame is-${puzzle.type}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="pz-head">
          {itemImage && <img className="pz-item" src={itemImage} alt="" draggable={false} />}
          <div>
            <small className="pz-kind">🧩 {KIND_LABEL[puzzle.type]}</small>
            <h2 id={titleId}>{puzzle.title}</h2>
          </div>
          <button type="button" className="pz-close" onClick={onClose} disabled={busy} aria-label="Đóng câu đố">
            ✕
          </button>
        </header>

        <div className="pz-body fh-parch">
          <p className="pz-for">Manh mối: {itemName}</p>
          {puzzle.question && <p className="pz-question">{puzzle.question}</p>}
          {puzzle.instruction && <p className="pz-instruction">{puzzle.instruction}</p>}

          {done ? (
            <div className="pz-feedback is-success" role="status">
              <strong>✔ Giải đúng!</strong>
              <span>{result?.message ?? "Câu đố này đã được giải trên máy chủ."}</span>
            </div>
          ) : (
            <>
              {puzzle.type === "MULTIPLE_CHOICE" && <Choices puzzle={puzzle} picked={parts[0]?.code ?? null} onPick={(o) => setParts([o])} disabled={busy || blocked} />}
              {puzzle.type === "WORD_ORDER" && <WordOrder puzzle={puzzle} parts={parts} setParts={setParts} disabled={busy || blocked} />}
              {puzzle.type === "MEMORY_SEQUENCE" && <Memory puzzle={puzzle} parts={parts} setParts={setParts} disabled={busy || blocked} round={shownAttempts} />}
              {result && !result.correct && (
                <div className="pz-feedback is-fail" role="alert">
                  <strong>✖ Chưa đúng</strong>
                  <span>{result.message ?? "Sai rồi, thử lại nhé!"}</span>
                  {blocked && <span>Đã hết lượt thử cho câu đố này.</span>}
                </div>
              )}
              {error && (
                <div className="pz-feedback is-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}

          <div className="pz-meta">
            <span>Lần thử: {shownAttempts}</span>
            {result?.remainingAttempts != null && !done && <span>Còn {result.remainingAttempts} lượt</span>}
            {puzzle.hint && !done && (
              <button type="button" className="pz-link" onClick={() => setHint((h) => !h)} aria-expanded={hint}>
                💡 {hint ? "Ẩn gợi ý" : "Gợi ý"}
              </button>
            )}
          </div>
          {hint && puzzle.hint && !done && <p className="pz-hint">{puzzle.hint}</p>}
        </div>

        <footer className="pz-foot">
          {done ? (
            <button type="button" className="pz-btn is-gold" onClick={onCollect} data-autofocus>
              🖐 Nhặt {itemName}
            </button>
          ) : (
            <>
              <button type="button" className="pz-btn" onClick={onClose} disabled={busy}>
                Để sau
              </button>
              <button type="button" className="pz-btn is-gold" onClick={send} disabled={!ready} aria-busy={busy}>
                {busy ? "Đang chấm…" : "Trả lời"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

type WidgetProps = { puzzle: MapPuzzle; parts: PuzzleOption[]; setParts: (p: PuzzleOption[]) => void; disabled: boolean };

function Choices({ puzzle, picked, onPick, disabled }: { puzzle: MapPuzzle; picked: string | null; onPick: (o: PuzzleOption) => void; disabled: boolean }) {
  return (
    <div className="pz-choices" role="radiogroup" aria-label="Chọn đáp án">
      {puzzle.options.map((o, i) => (
        <button
          key={o.code}
          type="button"
          role="radio"
          aria-checked={picked === o.code}
          className={`pz-choice ${picked === o.code ? "is-picked" : ""}`}
          onClick={() => onPick(o)}
          disabled={disabled}
          data-autofocus={i === 0 || undefined}
        >
          <span className="pz-letter" aria-hidden>
            {String.fromCharCode(65 + i)}
          </span>
          {o.imageUrl && <img src={o.imageUrl} alt="" />}
          <span>{o.text}</span>
        </button>
      ))}
    </div>
  );
}

function WordOrder({ puzzle, parts, setParts, disabled }: WidgetProps) {
  const pool = useMemo(() => shuffled(puzzle.options, puzzle.code), [puzzle]);
  // Options may repeat a word: track by index in the pool.
  const used = new Set(parts.map((p) => pool.indexOf(p)));
  return (
    <div className="pz-words">
      <div className="pz-line" aria-label="Câu đã ghép" aria-live="polite">
        {parts.length === 0 && <span className="pz-placeholder">Chạm vào các mảnh chữ theo đúng thứ tự…</span>}
        {parts.map((w, i) => (
          <button key={`${w.code}-${i}`} type="button" className="pz-chip is-placed" onClick={() => setParts(parts.filter((_, j) => j !== i))} disabled={disabled} aria-label={`Bỏ “${w.text}”`}>
            {w.text}
          </button>
        ))}
      </div>
      <div className="pz-tray" aria-label="Mảnh chữ">
        {pool.map((w, i) => (
          <button key={`${w.code}-${i}`} type="button" className="pz-chip" onClick={() => setParts([...parts, w])} disabled={disabled || used.has(i)} data-autofocus={i === 0 || undefined}>
            {w.text}
          </button>
        ))}
      </div>
      <button type="button" className="pz-link" onClick={() => setParts([])} disabled={disabled || parts.length === 0}>
        ↺ Ghép lại
      </button>
    </div>
  );
}

function Memory({ puzzle, parts, setParts, disabled, round }: WidgetProps & { round: number }) {
  const [lit, setLit] = useState<number | null>(null);
  const [watching, setWatching] = useState(true);
  const [replay, setReplay] = useState(0);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Play the backend sequence (again after each wrong attempt or on request).
  useEffect(() => {
    setWatching(true);
    setParts([]);
    const timers: number[] = [];
    const step = puzzle.showMs, gap = puzzle.pauseMs;
    puzzle.sequence.forEach((code, i) => {
      const idx = puzzle.options.findIndex((o) => o.code === code);
      timers.push(window.setTimeout(() => setLit(idx), 500 + i * (step + gap)));
      timers.push(window.setTimeout(() => setLit(null), 500 + i * (step + gap) + step));
    });
    timers.push(window.setTimeout(() => setWatching(false), 500 + puzzle.sequence.length * (step + gap)));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, replay, round]);

  const pressed = (i: number) => {
    if (watching || disabled || parts.length >= puzzle.sequence.length) return;
    setParts([...parts, puzzle.options[i]]);
    if (!reduce) {
      setLit(i);
      window.setTimeout(() => setLit((l) => (l === i ? null : l)), 220);
    }
  };

  return (
    <div className="pz-memory">
      <p className="pz-status" aria-live="polite">
        {watching ? `👀 Nhìn kỹ thứ tự… (${puzzle.sequence.length} bước)` : `Lặp lại thứ tự: ${parts.length}/${puzzle.sequence.length}`}
      </p>
      <div className="pz-symbols" style={{ "--n": Math.min(puzzle.options.length, 4) } as React.CSSProperties}>
        {puzzle.options.map((o, i) => (
          <button
            key={o.code}
            type="button"
            className={`pz-symbol ${lit === i ? "is-lit" : ""}`}
            onClick={() => pressed(i)}
            disabled={watching || disabled}
            aria-label={o.text}
            data-autofocus={i === 0 || undefined}
          >
            {o.imageUrl ? <img src={o.imageUrl} alt="" /> : <span>{o.text}</span>}
          </button>
        ))}
      </div>
      <div className="pz-dots" aria-hidden>
        {puzzle.sequence.map((_, i) => (
          <span key={i} className={i < parts.length ? "is-on" : ""} />
        ))}
      </div>
      <div className="pz-row">
        {puzzle.allowReplay && (
          <button type="button" className="pz-link" onClick={() => setReplay((n) => n + 1)} disabled={watching || disabled}>
            ▶ Xem lại
          </button>
        )}
        <button type="button" className="pz-link" onClick={() => setParts(parts.slice(0, -1))} disabled={watching || disabled || parts.length === 0}>
          ⌫ Xoá bước cuối
        </button>
      </div>
    </div>
  );
}
