"use client";
import { useEffect, useRef, useState } from "react";
import type { ActivityEvent, ActivityKind } from "./types";

const TABS: { id: string; label: string; kinds: ActivityKind[] | null }[] = [
  { id: "all", label: "Tất cả", kinds: null },
  { id: "quest", label: "Nhiệm vụ", kinds: ["quest", "gate"] },
  { id: "item", label: "Vật phẩm", kinds: ["item"] },
  { id: "npc", label: "Hội thoại", kinds: ["npc"] },
  { id: "system", label: "Hệ thống", kinds: ["system"] },
];

/**
 * Event log of what actually happened in this run. There is no chat backend,
 * so there is deliberately no input box or send button.
 */
export default function GameActivityLog({ events }: { events: ActivityEvent[] }) {
  const [tab, setTab] = useState("all");
  const listRef = useRef<HTMLOListElement>(null);
  const kinds = TABS.find((t) => t.id === tab)?.kinds ?? null;
  const shown = kinds ? events.filter((e) => kinds.includes(e.kind)) : events;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, tab]);

  return (
    <section className="fh-frame fh-log" aria-label="Nhật ký hoạt động">
      <div className="fh-log-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <ol ref={listRef} className="fh-log-list" aria-live="polite">
        {shown.length === 0 && <li className="fh-log-empty">Chưa có hoạt động.</li>}
        {shown.map((e) => (
          <li key={e.id} className={`is-${e.kind}`}>
            <time>[{e.time}]</time> {e.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
