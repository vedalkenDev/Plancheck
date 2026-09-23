import { CircleCheck, CircleX, ListChecks, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { FailedCheck, PassedCheck } from "@/data/types";
import { cn } from "cn";

export type ReviewTab = "passed" | "failed" | "changes";

export const REVIEW_TABS: {
  id: ReviewTab;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  {
    id: "passed",
    label: "Passed",
    icon: CircleCheck,
    iconClass: "text-emerald-400",
  },
  {
    id: "failed",
    label: "Not approved",
    icon: CircleX,
    iconClass: "text-red-400",
  },
  {
    id: "changes",
    label: "What to change",
    icon: ListChecks,
    iconClass: "text-amber-300",
  },
];

export function ReviewTitle({
  id,
  extra,
}: {
  id: ReviewTab;
  extra?: ReactNode;
}) {
  const tab = REVIEW_TABS.find((item) => item.id === id);
  if (!tab) {
    return null;
  }
  const Icon = tab.icon;
  return (
    <CardTitle className="flex items-center gap-2">
      <Icon className={cn("size-4", tab.iconClass)} />
      {tab.label}
      {extra}
    </CardTitle>
  );
}

export function PassedList({ rows }: { rows: PassedCheck[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No passing checks yet.</p>;
  }
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1 py-3">
          <p className="text-sm font-medium">
            <span className="font-mono text-xs text-muted-foreground">{row.part}</span>
            {" · "}
            {row.check}
          </p>
          <p className="text-sm text-muted-foreground">{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function FailedList({ rows }: { rows: FailedCheck[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing failed on the checks we could read.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1 py-3">
          <p className="text-sm font-medium">
            <span className="font-mono text-xs text-muted-foreground">{row.part}</span>
            {" · "}
            {row.check}
          </p>
          <p className="text-sm text-muted-foreground">{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function ChangeList({
  rows,
  done,
  setDone,
}: {
  rows: FailedCheck[];
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">No drawing changes from these checks.</p>
    );
  }
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 py-3">
          <Checkbox
            checked={Boolean(done[row.id])}
            onCheckedChange={(value) => setDone({ ...done, [row.id]: value === true })}
            aria-label={`Mark ${row.check} done`}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {row.part} · {row.check}
            </p>
            <p className="text-sm text-muted-foreground">{row.adjust}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
