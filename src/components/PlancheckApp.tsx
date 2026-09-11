"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { DrawingPreview } from "@/components/DrawingPreview";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditSample, SampleDrawing } from "@/data/types";
import { auditFromDrawing, extractDrawing } from "@/lib/cad";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER } from "@/lib/checklist";

type PlancheckAppProps = {
  samples: SampleDrawing[];
};

const DRAWING_NAME = /\.(dwg|dxf)$/i;
const MAX_BYTES = 40 * 1024 * 1024;
const MIN_SPIN_MS = 700;

export function PlancheckApp({ samples }: PlancheckAppProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [audit, setAudit] = useState<AuditSample | null>(null);
  const [extract, setExtract] = useState<DrawingExtract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  function resetChecks() {
    setDone({});
  }

  function reset() {
    setAudit(null);
    setExtract(null);
    setError(null);
    setReading(false);
    resetChecks();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function inspect(file: File) {
    if (!DRAWING_NAME.test(file.name)) {
      setError("Please choose a .dwg or .dxf drawing.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That drawing is too large to read here. Save a DXF and try again.");
      return;
    }

    setError(null);
    setReading(true);
    setAudit(null);
    resetChecks();

    try {
      const [bytes] = await Promise.all([
        file.arrayBuffer(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, MIN_SPIN_MS);
        }),
      ]);
      const drawing = extractDrawing(file.name, bytes);
      const result = auditFromDrawing(file.name, drawing);
      setExtract(drawing);
      setAudit(result);
    } catch {
      setError(
        "The drawing could not be read. Save a DXF from your CAD software and try again.",
      );
      setExtract(null);
    } finally {
      setReading(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    await inspect(file);
  }

  async function loadSample(sample: SampleDrawing) {
    setError(null);
    setReading(true);
    setAudit(null);
    resetChecks();
    try {
      const [response] = await Promise.all([
        fetch(sample.href),
        new Promise<void>((resolve) => {
          setTimeout(resolve, MIN_SPIN_MS);
        }),
      ]);
      if (!response.ok) {
        throw new Error("sample");
      }
      const bytes = await response.arrayBuffer();
      const drawing = extractDrawing(`${sample.id}.dxf`, bytes);
      const result = auditFromDrawing(sample.label, drawing);
      result.label = sample.label;
      setExtract(drawing);
      setAudit(result);
    } catch {
      setError("The sample drawing could not be loaded.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          Plancheck
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://vedalken.dev"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Vedalken Dev
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:h-[calc(100svh-4rem)] lg:grid-cols-3">
        <section className="flex min-h-[28rem] flex-col border-b p-4 lg:border-r lg:border-b-0 lg:p-6">
          <input
            ref={inputRef}
            id={inputId}
            className="sr-only"
            type="file"
            accept=".dwg,.dxf,application/acad,image/vnd.dwg,image/vnd.dxf"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {extract && !reading ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border-2 border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">
                  {audit?.label ?? "Drawing"}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  Replace
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
                <DrawingPreview
                  extract={extract}
                  label={audit?.label ?? "Drawing"}
                />
              </div>
            </div>
          ) : (
            <label
              htmlFor={inputId}
              className="flex min-h-0 flex-1 cursor-pointer flex-col rounded-xl border-2 border-dashed border-border bg-card p-4 ring-foreground/10 transition-colors hover:bg-muted/40 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void onFile(event.dataTransfer.files[0]);
              }}
            >
              {reading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin" />
                  <p className="text-sm">Inspecting drawing…</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <FileUp className="size-8 text-muted-foreground" />
                  <p className="max-w-xs text-sm leading-relaxed">
                    Drag DWG file here, or click here to inspect your drawing file
                    for council plan submission.
                  </p>
                </div>
              )}
            </label>
          )}
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Sample drawings
            </p>
            <div className="flex flex-wrap gap-2">
              {samples.map((sample) => (
                <Button
                  key={sample.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadSample(sample)}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-auto lg:col-span-2">
            <div className="p-4 md:p-6">
              {reading ? (
                <InspectingState />
              ) : audit ? (
                <Analysis audit={audit} done={done} setDone={setDone} />
              ) : (
                <EmptyState />
              )}
            </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-muted-foreground">
      <p className="max-w-md text-sm">
        Upload a drawing to inspect it against SANS 10400 before you lodge with
        council.
      </p>
    </div>
  );
}

function InspectingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Running SANS 10400 checks…</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

function Analysis({
  audit,
  done,
  setDone,
}: {
  audit: AuditSample;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
}) {
  const remaining = useMemo(
    () => audit.failed.filter((row) => !done[row.id]).length,
    [audit.failed, done],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Project
          </p>
          <h2 className="font-heading text-lg font-medium md:text-xl">
            {audit.project}
          </h2>
          <p className="text-sm text-muted-foreground">
            {audit.address}
            {audit.erf ? ` · ${audit.erf}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {audit.occupancy} · {audit.occupancyNote}
          </Badge>
          <Badge variant={audit.failed.length ? "destructive" : "secondary"}>
            {audit.verdict}
          </Badge>
        </div>
      </div>

      {audit.warnings?.length ? (
        <p className="text-sm text-muted-foreground">{audit.warnings[0]}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Passed</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.passed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SANS / NBR</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.passed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-normal">
                        {row.code}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.check}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {row.note}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No passing checks yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Not approved</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.failed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SANS / NBR</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Missed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.failed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-normal">
                        {row.code}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.check}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {row.note}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing failed on the checks we could read.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            What to change
            {audit.failed.length ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {remaining} left
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.failed.length ? (
            <ul className="divide-y">
              {audit.failed.map((row) => (
                <li key={row.id} className="flex items-start gap-3 py-3">
                  <Checkbox
                    checked={Boolean(done[row.id])}
                    onCheckedChange={(value) =>
                      setDone({ ...done, [row.id]: value === true })
                    }
                    aria-label={`Mark ${row.check} done`}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {row.code} · {row.check}
                    </p>
                    <p className="text-sm text-muted-foreground">{row.adjustment}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No drawing changes from these checks.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}
