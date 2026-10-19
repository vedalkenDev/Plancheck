"use client";

import { FileUp, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ChangeList, ReviewTitle } from "@/components/check-panels";
import { DrawingPreview } from "@/components/DrawingPreview";
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
import { auditFromDrawing, buildAnnotatedDrawing, extractDrawing, stampAudit } from "@/lib/cad";
import { addVisibleText } from "@/lib/cad/annotate";
import { dwgToDxf } from "@/lib/cad/dwg-to-dxf";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER, auditToReport, downloadBlob } from "@/lib/checklist";
import { extractPdf } from "@/lib/pdf/extract";
import { stampPdf } from "@/lib/pdf/stamp";

type PlancheckAppProps = {
  samples: SampleDrawing[];
  userEmail: string;
};

const DRAWING_NAME = /\.(dwg|dxf|pdf)$/i;
const MAX_BYTES = 40 * 1024 * 1024;
const MIN_SPIN_MS = 700;

function bytesOf(text: string) {
  const encoded = new TextEncoder().encode(text);
  const copy = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(copy).set(encoded);
  return copy;
}

async function readDrawing(filename: string, bytes: ArrayBuffer) {
  if (/\.pdf$/i.test(filename)) {
    return {
      drawing: await extractPdf(filename, bytes),
      sourceText: null as string | null,
      pdfBytes: bytes.slice(0),
    };
  }

  if (/\.dwg$/i.test(filename)) {
    const dxf = await dwgToDxf(bytes);
    if (dxf) {
      return {
        drawing: extractDrawing(filename.replace(/\.dwg$/i, ".dxf"), bytesOf(dxf)),
        sourceText: dxf,
        pdfBytes: null as ArrayBuffer | null,
      };
    }
  }

  return {
    drawing: extractDrawing(filename, bytes),
    sourceText: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    pdfBytes: null as ArrayBuffer | null,
  };
}

export function PlancheckApp({ samples, userEmail }: PlancheckAppProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [extract, setExtract] = useState<DrawingExtract | null>(null);
  const [drawingName, setDrawingName] = useState("drawing");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [sourceText, setSourceText] = useState<string | null>(null);
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
    setSourceText(null);
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
      setError("Please choose a drawing file.");
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
      const { drawing, sourceText: nextText, pdfBytes: nextPdf } = await readDrawing(file.name, bytes);
      setDrawingName(file.name);
      setExtract(drawing);
      setSourceText(nextText);
      setPdfBytes(nextPdf);
    } catch {
      setError("The drawing could not be read. Plot a vector PDF from CAD, or export DWG / DXF, and try again.");
      setExtract(null);
      setSourceText(null);
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
      const filename = sample.href.split("/").pop() ?? `${sample.id}.dxf`;
      const { drawing, sourceText: nextText, pdfBytes: nextPdf } = await readDrawing(filename, bytes);
      setDrawingName(sample.label);
      setExtract(drawing);
      setSourceText(nextText);
      setPdfBytes(nextPdf);
    } catch {
      setError("The sample drawing could not be loaded.");
    } finally {
      setReading(false);
    }
  }

  const viewed = useMemo(() => {
    if (!extract) {
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
          },
        ];
    const index = Math.min(sheetIndex, sheets.length - 1);
    const sheet = sheets[index];
    const base: DrawingExtract = {
      ...extract,
      geometry: sheet.geometry,
      texts: sheet.texts,
      strings: sheet.strings,
      sheets,
    };
    const result = auditFromDrawing(drawingName, base);
    return { extract: stampAudit(base, result), audit: result, sheets, index };
  }, [extract, sheetIndex, drawingName]);

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
            accept=".pdf,.dwg,.dxf,application/pdf,application/acad,image/vnd.dwg,image/vnd.dxf"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {viewed && !reading ? (
            <DrawingPane
              extract={viewed.extract}
              sourceText={sourceText}
              pdfBytes={pdfBytes}
              label={viewed.audit.label}
              audit={viewed.audit}
              sheets={viewed.sheets}
              sheetIndex={viewed.index}
              onSheet={(index) => {
                setSheetIndex(index);
                resetChecks();
              }}
              done={done}
              setDone={setDone}
              onReplace={reset}
              onChange={(next) => {
                setExtract((current) => {
                  if (!current?.sheets.length) {
                    return next.extract;
                  }
                  const sheets = current.sheets.map((sheet, index) =>
                    index === sheetIndex
                      ? {
                          name: sheet.name,
                          geometry: next.extract.geometry,
                          texts: next.extract.texts,
                          strings: next.extract.strings,
                        }
                      : sheet,
                  );
                  const first = sheets[0];
                  return {
                    ...current,
                    sheets,
                    geometry: first.geometry,
                    texts: first.texts,
                    strings: first.strings,
                  };
                });
                setSourceText(next.sourceText);
              }}
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
                  Drag a council PDF here, or a DWG / DXF. Click to inspect
                  the drawing for council plan submission.
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
                sheetName={viewed.sheets[viewed.index]?.name ?? "Sheet 1"}
                sourceText={sourceText}
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
  sourceText,
  pdfBytes,
  label,
  audit,
  sheets,
  sheetIndex,
  onSheet,
  done,
  setDone,
  onReplace,
  onChange,
}: {
  extract: DrawingExtract;
  sourceText: string | null;
  pdfBytes: ArrayBuffer | null;
  label: string;
  audit: AuditSample | null;
  sheets: { name: string }[];
  sheetIndex: number;
  onSheet: (index: number) => void;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
  onReplace: () => void;
  onChange: (next: { extract: DrawingExtract; sourceText: string | null }) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const pdf = extract.format === "pdf";

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{label}</p>
          <Button type="button" variant="ghost" size="sm" onClick={onReplace}>
            Replace
          </Button>
        </div>
        <SheetTabs sheets={sheets} sheetIndex={sheetIndex} onSheet={onSheet} />
        {pdf ? null : (
          <NoteForm extract={extract} sourceText={sourceText} onChange={onChange} />
        )}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          {pdf && pdfBytes ? (
            <PdfPreview bytes={pdfBytes} label={label} />
          ) : (
            <DrawingPreview
              extract={extract}
              label={label}
              onToggleFullscreen={() => setFullscreen(true)}
            />
          )}
        </div>
      </div>
      {fullscreen ? (
        <FullscreenDrawing
          extract={extract}
          sourceText={sourceText}
          label={label}
          audit={audit}
          sheets={sheets}
          sheetIndex={sheetIndex}
          onSheet={onSheet}
          done={done}
          setDone={setDone}
          onChange={onChange}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}

function SheetTabs({
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
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sheets">
      {sheets.map((sheet, index) => (
        <Button
          key={`${sheet.name}-${index}`}
          type="button"
          size="sm"
          variant={index === sheetIndex ? "secondary" : "outline"}
          role="tab"
          aria-selected={index === sheetIndex}
          onClick={() => onSheet(index)}
        >
          {sheet.name}
        </Button>
      ))}
    </div>
  );
}

function NoteForm({
  extract,
  sourceText,
  onChange,
}: {
  extract: DrawingExtract;
  sourceText: string | null;
  onChange: (next: { extract: DrawingExtract; sourceText: string | null }) => void;
}) {
  const noteId = useId();
  const [draft, setDraft] = useState("");

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = addVisibleText(extract, sourceText, draft);
    onChange(next);
    setDraft("");
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={addNote}>
      <label htmlFor={noteId} className="min-w-0 flex-1 text-xs text-muted-foreground">
        Add text
        <input
          id={noteId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-1 block w-full border-b border-border bg-transparent py-1 text-sm text-foreground"
        />
      </label>
      <Button type="submit" variant="outline" size="sm">
        Show on drawing
      </Button>
    </form>
  );
}

function FullscreenDrawing({
  extract,
  sourceText,
  label,
  audit,
  sheets,
  sheetIndex,
  onSheet,
  done,
  setDone,
  onChange,
  onClose,
}: {
  extract: DrawingExtract;
  sourceText: string | null;
  label: string;
  audit: AuditSample | null;
  sheets: { name: string }[];
  sheetIndex: number;
  onSheet: (index: number) => void;
  done: Record<string, boolean>;
  setDone: (value: Record<string, boolean>) => void;
  onChange: (next: { extract: DrawingExtract; sourceText: string | null }) => void;
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
        <SheetTabs sheets={sheets} sheetIndex={sheetIndex} onSheet={onSheet} />
        <div className="min-w-0 flex-1">
          <NoteForm extract={extract} sourceText={sourceText} onChange={onChange} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X />
          Exit
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <DrawingPreview
          extract={extract}
          label={label}
          fullscreen
          onToggleFullscreen={onClose}
        />
        <ReviewDock audit={audit} done={done} setDone={setDone} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center text-center text-muted-foreground">
      <p className="max-w-md text-sm">
        Upload the council PDF (or a DWG / DXF) to inspect it against SANS 10400
        before you lodge.
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

function PdfPreview({ bytes, label }: { bytes: ArrayBuffer; label: string }) {
  const url = useMemo(() => {
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }, [bytes]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <iframe
      title={label}
      src={url}
      className="h-full min-h-[22rem] w-full bg-background"
    />
  );
}

function Analysis({
  audit,
  extract,
  sheetName,
  sourceText,
  pdfBytes,
  done,
  setDone,
}: {
  audit: AuditSample;
  extract: DrawingExtract | null;
  sheetName: string;
  sourceText: string | null;
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
    if (pdfBytes) {
      const annotated = await stampPdf(pdfBytes, audit);
      downloadBlob(
        `${audit.fileStem}-annotated.pdf`,
        annotated,
        "application/pdf",
      );
      return;
    }
    if (!extract) {
      return;
    }
    downloadBlob(
      `${audit.fileStem}-${sheetName.replace(/\s+/g, "-").toLowerCase()}-annotated.dxf`,
      buildAnnotatedDrawing(audit, extract, sourceText ?? undefined),
      "application/dxf",
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
          disabled={!extract && !pdfBytes}
        >
          {pdfBytes ? "Download annotated PDF" : "Download annotated drawing"}
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
