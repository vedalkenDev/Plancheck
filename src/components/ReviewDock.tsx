"use client";

import { useState } from "react";
import { ChangeList, FailedList, PassedList, REVIEW_TABS, type ReviewTab } from "@/components/check-panels";
import type { AuditSample } from "@/data/types";
import { cn } from "cn";

type ReviewDockProps = {
  audit: AuditSample | null;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
};

export function ReviewDock({ audit, done, setDone }: ReviewDockProps) {
  const [hover, setHover] = useState<ReviewTab | null>(null);
  const [pinned, setPinned] = useState<ReviewTab | null>(null);
  const shown = hover ?? pinned;
  const tab = REVIEW_TABS.find((item) => item.id === shown) ?? null;
  const remaining = audit?.failed.filter((row) => !done[row.id]).length ?? 0;

  function count(id: ReviewTab) {
    if (!audit) {
      return 0;
    }
    if (id === "passed") {
      return audit.passed.length;
    }
    if (id === "failed") {
      return audit.failed.length;
    }
    return remaining;
  }

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 flex max-w-full"
      onMouseLeave={() => setHover(null)}
    >
      {tab && audit ? (
        <aside className="flex h-full w-[min(24rem,calc(100vw-3.5rem))] flex-col border-l bg-card shadow-xl">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <tab.icon className={cn("size-4", tab.iconClass)} />
            <h2 className="text-sm font-medium">{tab.label}</h2>
            {tab.id === "changes" && audit.failed.length ? (
              <span className="text-xs text-muted-foreground">{remaining} left</span>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-auto px-4">
            {tab.id === "passed" ? <PassedList rows={audit.passed} /> : null}
            {tab.id === "failed" ? <FailedList rows={audit.failed} /> : null}
            {tab.id === "changes" ? (
              <ChangeList rows={audit.failed} done={done} setDone={setDone} />
            ) : null}
          </div>
        </aside>
      ) : null}
      <div className="flex w-14 shrink-0 flex-col gap-1 border-l bg-background/95 p-1.5 backdrop-blur">
        {REVIEW_TABS.map((item) => {
          const Icon = item.icon;
          const open = shown === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={pinned === item.id}
              aria-expanded={open}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] leading-none text-muted-foreground hover:bg-muted hover:text-foreground",
                open && "bg-muted text-foreground",
              )}
              onMouseEnter={() => setHover(item.id)}
              onFocus={() => setHover(item.id)}
              onClick={() => setPinned((current) => (current === item.id ? null : item.id))}
            >
              <Icon className={cn("size-4", item.iconClass)} />
              <span>{count(item.id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
