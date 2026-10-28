"use client";

import { FileUp, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChangeList, PassedList, ReviewTitle } from "@/components/check-panels";
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
import { DISCLAIMER, auditToReport, downloadBlob } from "@/lib/checklist";
import { extractPdf } from "@/lib/pdf/extract";
import { stampPdf } from "@/lib/pdf/stamp";

type PlancheckAppProps = {
  samples: SampleDrawing[];
  userEmail: string;
};

const DRAWING_NAME = /\.pdf$/i;
const MAX_BYTES = 40 * 1024 * 1024;
const MIN_SPIN_MS = 700;

async function readPdf(filename: string, bytes: ArrayBuffer) {
  return {
    drawing: await extractPdf(filename, bytes),
    pdfBytes: bytes.slice(0),
  };
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
  const [done, setDone] = useState<Record<string, boolean>>({});

  function resetChecks() {
    setDone({});
  }

  function reset() {
    setExtract(null);
    setSheetIndex(0);
    setPdfBytes(null);
    setError(null);
    setReading(false);
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

    setError(null);
    setReading(true);
    setSheetIndex(0);
    resetChecks();

    try {
      const [bytes] = await Promise.all([
        file.arrayBuffer(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, MIN_SPIN_MS);
        }),
      ]);
      const { drawing, pdfBytes: nextPdf } = await readPdf(file.name, bytes);
      setDrawingName(file.name);
      setExtract(drawing);
      setPdfBytes(nextPdf);
    } catch {
      setError("The PDF could not be read. Plot a vector PDF from CAD and try again.");
      setExtract(null);
      setPdfBytes(null);
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
      const filename = sample.href.split("/").pop() ?? `${sample.id}.pdf`;
      const { drawing, pdfBytes: nextPdf } = await readPdf(filename, bytes);
      setDrawingName(sample.label);
      setExtract(drawing);
      setPdfBytes(nextPdf);
    } catch {
      setError("The sample drawing could not be loaded.");
    } finally {
      setReading(false);
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
              <p className="hidden text-sm lg:block">Inspecting drawing…</p>
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
              <InspectingState />
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

  useEffect(() => {
    onCloseRef.current = onClose;
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
    </div>
  );
}

function InspectingState() {
  return (
    <div className="hidden lg:block">
      <p className="sr-only">Running SANS 10400 checks</p>
      <ScanLoader />
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

      {audit.failed.length ? (
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
