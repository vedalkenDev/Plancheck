"use client";

import { ChevronLeft, ChevronRight, FileUp, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChangeList, ReviewTitle } from "@/components/check-panels";
import { DrawingPreview } from "@/components/DrawingPreview";
import { PdfPageView } from "@/components/PdfPageView";
import { ReviewDock } from "@/components/ReviewDock";
import { SansBook } from "@/components/SansBook";
import { ScanLoader } from "@/components/scanner/figure";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditSample, SampleDrawing } from "@/data/types";
import { auditFromDrawing, stampAudit } from "@/lib/cad";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER, ENGINE_NOTE, auditToReport, downloadBlob } from "@/lib/checklist";
import { extractPdf, type ExtractProgress } from "@/lib/pdf/extract";
import { stampPdf } from "@/lib/pdf/stamp";

type PlancheckAppProps = {
  samples: SampleDrawing[];
  userEmail: string;
};

const DRAWING_NAME = /\.pdf$/i;
const MAX_BYTES = 40 * 1024 * 1024;
const MIN_SPIN_MS = 700;

async function readPdf(
  filename: string,
  bytes: ArrayBuffer,
  onProgress?: (info: ExtractProgress) => void,
) {
  return {
    drawing: await extractPdf(filename, bytes, { onProgress }),
    pdfBytes: bytes.slice(0),
  };
}

function etaText(progress: ExtractProgress | null) {
  const startedAt = progress?.startedAt ?? 0;
  if (!progress || progress.page < 1 || progress.total < 2 || startedAt <= 0) {
    return null;
  }
  const elapsed = Date.now() - startedAt;
  const remainingMs = (elapsed / progress.page) * (progress.total - progress.page);
  const seconds = Math.max(1, Math.round(remainingMs / 1000));
  if (seconds < 60) {
    return `About ${seconds}s left`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `About ${minutes} min left`;
}

function howLabel(row: { clause?: string; how?: string }) {
  const clause = row.clause ?? "SANS 10400";
  return row.how === "measured" ? `${clause} · measured` : `${clause} · notes`;
}

export function PlancheckApp({ samples, userEmail }: PlancheckAppProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [extract, setExtract] = useState<DrawingExtract | null>(null);
  const [drawingName, setDrawingName] = useState("drawing");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const runId = useRef(0);

  function resetChecks() {
    setDone({});
  }

  function reset() {
    runId.current += 1;
    setExtract(null);
    setSheetIndex(0);
    setPdfBytes(null);
    setError(null);
    setReading(false);
    setProgress(null);
    resetChecks();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function inspect(file: File) {
    if (!DRAWING_NAME.test(file.name)) {
      setError("Please choose a PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That drawing is too large to read here. Try a smaller file.");
      return;
    }

    const id = runId.current + 1;
    runId.current = id;
    setError(null);
    setReading(true);
    setProgress({ page: 0, total: 0 });
    setSheetIndex(0);
    resetChecks();

    try {
      const [bytes] = await Promise.all([
        file.arrayBuffer(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, MIN_SPIN_MS);
        }),
      ]);
      if (runId.current !== id) {
        return;
      }
      const { drawing, pdfBytes: nextPdf } = await readPdf(file.name, bytes, (info) => {
        if (runId.current === id) {
          setProgress(info);
        }
      });
      if (runId.current !== id) {
        return;
      }
      setDrawingName(file.name);
      setExtract(drawing);
      setPdfBytes(nextPdf);
    } catch {
      if (runId.current !== id) {
        return;
      }
      setError("The PDF could not be read. Plot a vector PDF from CAD and try again.");
      setExtract(null);
      setPdfBytes(null);
    } finally {
      if (runId.current === id) {
        setReading(false);
        setProgress(null);
      }
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    await inspect(file);
  }

  async function loadSample(sample: SampleDrawing) {
    const id = runId.current + 1;
    runId.current = id;
    setError(null);
    setReading(true);
    setProgress({ page: 0, total: 0 });
    setSheetIndex(0);
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
      if (runId.current !== id) {
        return;
      }
      const filename = sample.href.split("/").pop() ?? `${sample.id}.pdf`;
      const { drawing, pdfBytes: nextPdf } = await readPdf(filename, bytes, (info) => {
        if (runId.current === id) {
          setProgress(info);
        }
      });
      if (runId.current !== id) {
        return;
      }
      setDrawingName(sample.label);
      setExtract(drawing);
      setPdfBytes(nextPdf);
    } catch {
      if (runId.current !== id) {
        return;
      }
      setError("The sample drawing could not be loaded.");
    } finally {
      if (runId.current === id) {
        setReading(false);
        setProgress(null);
      }
    }
  }

  const audit = useMemo(() => {
    if (!extract) {
      return null;
    }
    return auditFromDrawing(drawingName, extract);
  }, [extract, drawingName]);

  const viewed = useMemo(() => {
    if (!extract || !audit) {
      return null;
    }
    const sheets = extract.sheets.length
      ? extract.sheets
      : [
          {
            name: "Sheet 1",
            geometry: extract.geometry,
            texts: extract.texts,
            strings: extract.strings,
            width: extract.pageWidth,
            height: extract.pageHeight,
          },
        ];
    const index = Math.min(sheetIndex, sheets.length - 1);
    const sheet = sheets[index];
    const preview: DrawingExtract = {
      ...extract,
      geometry: sheet.geometry,
      pageWidth: sheet.width ?? extract.pageWidth,
      pageHeight: sheet.height ?? extract.pageHeight,
    };
    return { extract: stampAudit(preview, audit), audit, sheets, index };
  }, [extract, audit, sheetIndex]);

  return (
    <div className="flex min-h-svh flex-col bg-background lg:h-svh lg:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          Plancheck
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
            {userEmail}
          </span>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
          <ThemeToggle />
          <a
            href="https://vedalken.dev"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Vedalken Dev
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-3">
        <section className="flex min-h-[28rem] min-w-0 flex-col border-b p-4 lg:min-h-0 lg:overflow-hidden lg:border-r lg:border-b-0 lg:p-6">
          <input
            ref={inputRef}
            id={inputId}
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {viewed && !reading ? (
            <DrawingPane
              extract={viewed.extract}
              pdfBytes={pdfBytes}
              label={viewed.audit.label}
              audit={viewed.audit}
              sheets={viewed.sheets}
              sheetIndex={viewed.index}
              onSheet={(index) => {
                setSheetIndex(index);
              }}
              done={done}
              setDone={setDone}
              onReplace={reset}
            />
          ) : reading ? (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-4 text-muted-foreground"
              aria-busy="true"
            >
              <div className="w-full lg:hidden">
                <ScanLoader />
              </div>
              <ReadProgress progress={progress} />
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
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <FileUp className="size-8 text-muted-foreground" />
                <p className="max-w-xs text-sm leading-relaxed">
                  Drag a council PDF here. Click to inspect the drawing
                  for council plan submission.
                </p>
              </div>
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

        <section className="min-h-0 min-w-0 overflow-auto lg:col-span-2">
          <div className="space-y-6 p-4 md:p-6">
            <SansBook />
            {reading ? (
              <InspectingState progress={progress} />
            ) : viewed ? (
              <Analysis
                audit={viewed.audit}
                extract={viewed.extract}
                pdfBytes={pdfBytes}
                done={done}
                setDone={setDone}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DrawingPane({
  extract,
  pdfBytes,
  label,
  audit,
  sheets,
  sheetIndex,
  onSheet,
  done,
  setDone,
  onReplace,
}: {
  extract: DrawingExtract;
  pdfBytes: ArrayBuffer | null;
  label: string;
  audit: AuditSample | null;
  sheets: { name: string }[];
  sheetIndex: number;
  onSheet: (index: number) => void;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
  onReplace: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{label}</p>
          <Button type="button" variant="ghost" size="sm" onClick={onReplace}>
            Replace
          </Button>
        </div>
        <SheetSwitcher sheets={sheets} sheetIndex={sheetIndex} onSheet={onSheet} />
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border">
          {pdfBytes ? (
            <PdfPageView bytes={pdfBytes} label={label} page={sheetIndex + 1} />
          ) : (
            <DrawingPreview
              extract={extract}
              label={label}
              onToggleFullscreen={() => setFullscreen(true)}
            />
          )}
          {pdfBytes ? (
            <div className="absolute top-2 left-2 z-10">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Fullscreen"
                onClick={() => setFullscreen(true)}
              >
                <Maximize2 />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {fullscreen ? (
        <FullscreenDrawing
          extract={extract}
          pdfBytes={pdfBytes}
          label={label}
          audit={audit}
          sheets={sheets}
          sheetIndex={sheetIndex}
          onSheet={onSheet}
          done={done}
          setDone={setDone}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}

function SheetSwitcher({
  sheets,
  sheetIndex,
  onSheet,
}: {
  sheets: { name: string }[];
  sheetIndex: number;
  onSheet: (index: number) => void;
}) {
  if (sheets.length < 2) {
    return null;
  }
  const last = sheets.length - 1;
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous sheet"
        disabled={sheetIndex <= 0}
        onClick={() => onSheet(sheetIndex - 1)}
      >
        <ChevronLeft />
      </Button>
      <p className="shrink-0 text-sm tabular-nums">
        Sheet {sheetIndex + 1} of {sheets.length}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next sheet"
        disabled={sheetIndex >= last}
        onClick={() => onSheet(sheetIndex + 1)}
      >
        <ChevronRight />
      </Button>
      <select
        aria-label="Sheets"
        className="h-7 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
        value={sheetIndex}
        onChange={(event) => onSheet(Number(event.target.value))}
      >
        {sheets.map((sheet, index) => (
          <option key={`${sheet.name}-${index}`} value={index}>
            {sheet.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function FullscreenDrawing({
  extract,
  pdfBytes,
  label,
  audit,
  sheets,
  sheetIndex,
  onSheet,
  done,
  setDone,
  onClose,
}: {
  extract: DrawingExtract;
  pdfBytes: ArrayBuffer | null;
  label: string;
  audit: AuditSample | null;
  sheets: { name: string }[];
  sheetIndex: number;
  onSheet: (index: number) => void;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
  onClose: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const sheetNavRef = useRef({ sheetIndex, sheets: sheets.length, onSheet });

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    sheetNavRef.current = { sheetIndex, sheets: sheets.length, onSheet };
  });

  useEffect(() => {
    const shell = shellRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let entered = false;
    shell?.requestFullscreen?.().then(
      () => {
        entered = true;
      },
      () => undefined,
    );

    function onFullscreenChange() {
      if (entered && !document.fullscreenElement) {
        onCloseRef.current();
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) {
        onCloseRef.current();
      }
      const nav = sheetNavRef.current;
      if (event.key === "ArrowLeft") {
        onSheetNav(Math.max(0, nav.sheetIndex - 1));
      }
      if (event.key === "ArrowRight") {
        onSheetNav(Math.min(nav.sheets - 1, nav.sheetIndex + 1));
      }
    }

    function onSheetNav(index: number) {
      sheetNavRef.current.onSheet(index);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement === shell) {
        void document.exitFullscreen?.();
      }
    };
  }, []);

  return (
    <div ref={shellRef} className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
        <p className="max-w-xs truncate text-sm font-medium">{label}</p>
        <SheetSwitcher sheets={sheets} sheetIndex={sheetIndex} onSheet={onSheet} />
        <div className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X />
          Exit
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {pdfBytes ? (
          <>
            <PdfPageView bytes={pdfBytes} label={label} page={sheetIndex + 1} />
            <div className="absolute top-2 left-2 z-10">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Exit fullscreen"
                onClick={onClose}
              >
                <Minimize2 />
              </Button>
            </div>
          </>
        ) : (
          <DrawingPreview
            extract={extract}
            label={label}
            fullscreen
            onToggleFullscreen={onClose}
          />
        )}
        <ReviewDock audit={audit} done={done} setDone={setDone} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-muted-foreground">
      <p className="max-w-md text-sm">
        Upload the council PDF to inspect it against SANS 10400 before you lodge.
      </p>
      <p className="mt-3 max-w-md text-xs">{ENGINE_NOTE}</p>
    </div>
  );
}

function InspectingState({
  progress,
}: {
  progress: ExtractProgress | null;
}) {
  return (
    <div className="hidden space-y-4 lg:block">
      <p className="sr-only">Reading the drawing and running SANS 10400 checks</p>
      <ScanLoader />
      <ReadProgress progress={progress} />
    </div>
  );
}

function ReadProgress({
  progress,
}: {
  progress: ExtractProgress | null;
}) {
  const total = progress?.total ?? 0;
  const page = progress?.page ?? 0;
  const headline =
    total < 1
      ? "Opening the PDF…"
      : page < 1
        ? `Found ${total} sheets. Reading text…`
        : progress?.ocr
          ? `Reading sheet ${page} of ${total} with OCR…`
          : `Reading sheet ${page} of ${total}`;
  const eta = etaText(progress);
  const percent = total > 0 ? Math.round((Math.max(page, 0) / total) * 100) : 0;
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 text-center">
      <p className="text-sm">{headline}</p>
      {eta ? <p className="text-xs text-muted-foreground">{eta}</p> : null}
      {total > 0 ? (
        <div
          className="h-1 w-48 overflow-hidden rounded bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={headline}
        >
          <div className="h-full bg-foreground" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Analysis({
  audit,
  extract,
  pdfBytes,
  done,
  setDone,
}: {
  audit: AuditSample;
  extract: DrawingExtract | null;
  pdfBytes: ArrayBuffer | null;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
}) {
  const remaining = useMemo(
    () => audit.failed.filter((row) => !done[row.id]).length,
    [audit.failed, done],
  );

  function downloadChecklist() {
    downloadBlob(
      `${audit.fileStem}-checklist.txt`,
      auditToReport(audit),
      "text/plain;charset=utf-8",
    );
  }

  async function downloadDrawing() {
    if (!pdfBytes) {
      return;
    }
    const annotated = await stampPdf(pdfBytes, audit, extract ?? undefined);
    downloadBlob(
      `${audit.fileStem}-annotated.pdf`,
      annotated,
      "application/pdf",
    );
  }

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

      <p className="text-xs text-muted-foreground">{ENGINE_NOTE}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <ReviewTitle id="passed" />
          </CardHeader>
          <CardContent>
            {audit.passed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.passed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-normal">
                        {row.part}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.check}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {howLabel(row)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {row.detail}
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
            <ReviewTitle id="failed" />
          </CardHeader>
          <CardContent>
            {audit.failed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.failed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-normal">
                        {row.part}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.check}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {howLabel(row)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {row.detail}
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
          <ReviewTitle
            id="changes"
            extra={
              audit.failed.length ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {remaining} left
                </span>
              ) : null
            }
          />
        </CardHeader>
        <CardContent>
          <ChangeList rows={audit.failed} done={done} setDone={setDone} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadDrawing()}
          disabled={!pdfBytes}
        >
          Download annotated PDF
        </Button>
        <Button type="button" variant="outline" onClick={downloadChecklist}>
          Download checklist
        </Button>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
      <p className="text-xs text-muted-foreground">
        Finding first. Fixing is the job. Luqmaan Sayed
      </p>
    </div>
  );
}
