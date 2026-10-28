"use client";

import { FileUp, Maximize2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChangeList,
  CorrectionList,
  CorrectionSkipList,
  PassedList,
  ReviewTitle,
} from "@/components/check-panels";
import { DrawingPreview } from "@/components/DrawingPreview";
import { PdfPreview } from "@/components/PdfPreview";
import { ReviewDock } from "@/components/ReviewDock";
import { SansBook } from "@/components/SansBook";
import { ScanLoader } from "@/components/scanner/figure";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AuditSample, SampleDrawing } from "@/data/types";
import { auditFromDrawing, stampAudit } from "@/lib/cad";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER, ENGINE_NOTE, auditToReport, downloadBlob } from "@/lib/checklist";
import { extractPdf, type ExtractProgress } from "@/lib/pdf/extract";
import { stampPdf } from "@/lib/pdf/stamp";
import { cardsFromCorrections, correctionsFromAudit } from "@/lib/sans/correct";

type AppMode = "inspect" | "correct";

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
  const [mode, setMode] = useState<AppMode>("inspect");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [corrected, setCorrected] = useState<{ key: string; bytes: ArrayBuffer } | null>(
    null,
  );
  const runId = useRef(0);

  function adoptPdf(bytes: ArrayBuffer | null) {
    setPdfBytes(bytes);
  }

  function resetChecks() {
    setDone({});
    setPicked({});
  }

  function reset() {
    runId.current += 1;
    setExtract(null);
    setSheetIndex(0);
    adoptPdf(null);
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
      adoptPdf(nextPdf);
    } catch {
      if (runId.current !== id) {
        return;
      }
      setError("The PDF could not be read. Plot a vector PDF from CAD and try again.");
      setExtract(null);
      adoptPdf(null);
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
      adoptPdf(nextPdf);
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

  const plan = useMemo(
    () => (audit ? correctionsFromAudit(audit) : { add: [], skip: [] }),
    [audit],
  );

  const selectedNotes = useMemo(
    () => new Set(plan.add.filter((row) => picked[row.id] !== false).map((row) => row.id)),
    [plan, picked],
  );

  const correctionCards = useMemo(
    () => (audit ? cardsFromCorrections(audit, selectedNotes) : []),
    [audit, selectedNotes],
  );

  const stampKey =
    mode === "correct" && pdfBytes && audit
      ? `${audit.id}:${[...selectedNotes].sort().join(",")}`
      : "";

  useEffect(() => {
    if (!stampKey || !pdfBytes || !audit || !extract) {
      return;
    }
    const key = stampKey;
    let cancelled = false;
    void stampPdf(pdfBytes, audit, extract, {
      kind: "correct",
      cards: correctionCards,
    }).then((bytes) => {
      if (cancelled) {
        return;
      }
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      setCorrected({ key, bytes: copy });
    });
    return () => {
      cancelled = true;
    };
  }, [stampKey, pdfBytes, audit, extract, correctionCards]);

  const previewBytes =
    mode === "correct" && corrected?.key === stampKey ? corrected.bytes : pdfBytes;
  const writingNotes = mode === "correct" && Boolean(pdfBytes) && corrected?.key !== stampKey;

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
    const stamped =
      mode === "correct"
        ? stampAudit(preview, audit, correctionCards)
        : stampAudit(preview, audit);
    return { extract: stamped, audit, sheets, index };
  }, [extract, audit, sheetIndex, mode, correctionCards]);

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
        <section className="flex min-h-[70vh] min-w-0 flex-col border-b p-4 lg:col-span-2 lg:min-h-0 lg:overflow-hidden lg:border-r lg:border-b-0 lg:p-6">
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
              pdfBytes={previewBytes}
              label={viewed.audit.label}
              audit={viewed.audit}
              sheets={viewed.sheets}
              sheetIndex={viewed.index}
              onSheet={(index) => {
                setSheetIndex(index);
              }}
              done={done}
              setDone={setDone}
              mode={mode}
              writing={writingNotes}
              plan={plan}
              picked={picked}
              setPicked={setPicked}
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

        <section className="min-h-0 min-w-0 overflow-auto">
          <div className="space-y-6 p-4 md:p-6">
            <SansBook />
            {reading ? (
              <InspectingState progress={progress} />
            ) : viewed ? (
              <Analysis
                audit={viewed.audit}
                extract={extract}
                pdfBytes={pdfBytes}
                done={done}
                setDone={setDone}
                mode={mode}
                onMode={setMode}
                plan={plan}
                picked={picked}
                setPicked={setPicked}
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
  mode,
  writing,
  plan,
  picked,
  setPicked,
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
  mode: AppMode;
  writing: boolean;
  plan: ReturnType<typeof correctionsFromAudit>;
  picked: Record<string, boolean>;
  setPicked: (value: Record<string, boolean>) => void;
  onReplace: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {mode === "correct" ? (
              <p className="truncate text-xs text-muted-foreground">
                {writing ? "Writing SANS notes onto the drawing…" : "Corrector notes on empty paper"}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {pdfBytes ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fullscreen"
                onClick={() => setFullscreen(true)}
              >
                <Maximize2 />
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onReplace}>
              Replace
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          {pdfBytes ? (
            <PdfPreview
              bytes={pdfBytes}
              label={label}
              page={sheetIndex + 1}
              pageCount={sheets.length}
              onPage={(next) => onSheet(next - 1)}
              onToggleFullscreen={() => setFullscreen(true)}
            />
          ) : (
            <DrawingPreview
              extract={extract}
              label={label}
              page={sheetIndex + 1}
              pageCount={sheets.length}
              onPage={(next) => onSheet(next - 1)}
              onToggleFullscreen={() => setFullscreen(true)}
            />
          )}
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
          mode={mode}
          plan={plan}
          picked={picked}
          setPicked={setPicked}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
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
  mode,
  plan,
  picked,
  setPicked,
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
  mode: AppMode;
  plan: ReturnType<typeof correctionsFromAudit>;
  picked: Record<string, boolean>;
  setPicked: (value: Record<string, boolean>) => void;
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
        <div className="min-w-0 flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X />
          Exit
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {pdfBytes ? (
          <PdfPreview
            bytes={pdfBytes}
            label={label}
            page={sheetIndex + 1}
            pageCount={sheets.length}
            onPage={(next) => onSheet(next - 1)}
            fullscreen
            onToggleFullscreen={onClose}
          />
        ) : (
          <DrawingPreview
            extract={extract}
            label={label}
            page={sheetIndex + 1}
            pageCount={sheets.length}
            onPage={(next) => onSheet(next - 1)}
            fullscreen
            onToggleFullscreen={onClose}
          />
        )}
        <ReviewDock
          audit={audit}
          done={done}
          setDone={setDone}
          mode={mode}
          plan={plan}
          picked={picked}
          setPicked={setPicked}
        />
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

function ModeSwitch({
  mode,
  onMode,
}: {
  mode: AppMode;
  onMode: (mode: AppMode) => void;
}) {
  return (
    <div className="flex w-fit gap-0.5 rounded-lg border p-0.5" role="group" aria-label="Plancheck mode">
      <Button
        type="button"
        size="sm"
        variant={mode === "inspect" ? "secondary" : "ghost"}
        aria-pressed={mode === "inspect"}
        onClick={() => onMode("inspect")}
      >
        Inspect
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "correct" ? "secondary" : "ghost"}
        aria-pressed={mode === "correct"}
        onClick={() => onMode("correct")}
      >
        Correct
      </Button>
    </div>
  );
}

function Analysis({
  audit,
  extract,
  pdfBytes,
  done,
  setDone,
  mode,
  onMode,
  plan,
  picked,
  setPicked,
}: {
  audit: AuditSample;
  extract: DrawingExtract | null;
  pdfBytes: ArrayBuffer | null;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
  mode: AppMode;
  onMode: (mode: AppMode) => void;
  plan: ReturnType<typeof correctionsFromAudit>;
  picked: Record<string, boolean>;
  setPicked: (value: Record<string, boolean>) => void;
}) {
  const remaining = useMemo(
    () => audit.failed.filter((row) => !done[row.id]).length,
    [audit.failed, done],
  );
  const selected = useMemo(
    () => new Set(plan.add.filter((row) => picked[row.id] !== false).map((row) => row.id)),
    [plan, picked],
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
    const annotated = await stampPdf(
      pdfBytes,
      audit,
      extract ?? undefined,
      mode === "correct"
        ? { kind: "correct", cards: cardsFromCorrections(audit, selected) }
        : { kind: "inspect" },
    );
    downloadBlob(
      mode === "correct"
        ? `${audit.fileStem}-corrected.pdf`
        : `${audit.fileStem}-annotated.pdf`,
      annotated,
      "application/pdf",
    );
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-medium text-balance md:text-xl">
            {audit.project}
          </h2>
          <p className="text-sm text-muted-foreground">
            {audit.address}
            {audit.erf ? ` · ${audit.erf}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeSwitch mode={mode} onMode={onMode} />
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

      <p className="text-xs text-muted-foreground">
        {mode === "correct"
          ? "Corrector writes the missing SANS note into a block on empty paper. Measured sizes, signatures, and packs still need the architect."
          : ENGINE_NOTE}
      </p>

      {mode === "correct" ? (
        <>
          <section className="space-y-3">
            <h3 className="font-heading text-base font-medium">Notes to add</h3>
            <CorrectionList rows={plan.add} selected={picked} setSelected={setPicked} />
          </section>
          {plan.skip.length ? (
            <section className="space-y-3">
              <h3 className="font-heading text-base font-medium">Still needs the architect</h3>
              <CorrectionSkipList rows={plan.skip} />
            </section>
          ) : null}
        </>
      ) : audit.failed.length ? (
        <section className="space-y-3">
          <ReviewTitle
            id="changes"
            extra={
              <span className="text-sm font-normal text-muted-foreground">
                {remaining} left
              </span>
            }
          />
          <ChangeList rows={audit.failed} done={done} setDone={setDone} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing failed on the checks we could read.
        </p>
      )}

      <section className="space-y-3">
        <ReviewTitle id="passed" />
        <PassedList rows={audit.passed} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadDrawing()}
          disabled={!pdfBytes}
        >
          {mode === "correct" ? "Download corrected PDF" : "Download annotated PDF"}
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
