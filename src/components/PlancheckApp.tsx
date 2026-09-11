"use client";

import { useId, useRef, useState } from "react";
import { DrawingPreview } from "@/components/DrawingPreview";
import type { AuditSample, SampleDrawing } from "@/data/types";
import { auditFromDrawing, buildAnnotatedDrawing, extractDrawing } from "@/lib/cad";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER, auditToReport, downloadBlob } from "@/lib/checklist";

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
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  function reset() {
    setAudit(null);
    setExtract(null);
    setSourceText(null);
    setError(null);
    setReading(false);
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
    setAudit(null);

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
      setSourceText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
      setAudit(result);
    } catch {
      setError("The drawing could not be read. Export it from CAD and try again.");
      setExtract(null);
      setSourceText(null);
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
      setSourceText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
      setAudit(result);
    } catch {
      setError("The sample drawing could not be loaded.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16 md:px-12">
      <section
        className="max-w-3xl"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFile(event.dataTransfer.files[0]);
        }}
      >
        <h1 className="font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          Upload a drawing. See what fails SANS 10400, and what to adjust.
        </h1>
        <p className="mt-6 font-serif text-xl text-bronze">The finding is free.</p>
        <p className="mt-4 text-stone">Fixing is the job.</p>

        <div className="mt-12">
          <label htmlFor={inputId} className="block text-sm">
            Choose a drawing file (.dwg or .dxf)
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="mt-3 block w-full max-w-md text-sm file:mr-4 file:border-0 file:bg-transparent file:px-0 file:py-0 file:text-sm file:text-ink"
            type="file"
            accept=".dwg,.dxf,application/acad,image/vnd.dwg,image/vnd.dxf"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </div>

        <p className="mt-8 text-sm text-stone">
          Samples:{" "}
          {samples.map((sample, index) => (
            <span key={sample.id}>
              {index > 0 ? " · " : null}
              <button
                type="button"
                className="text-ink underline-offset-4 hover:underline"
                onClick={() => void loadSample(sample)}
              >
                {sample.label}
              </button>
            </span>
          ))}
        </p>

        {error ? (
          <p className="mt-6 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-10 max-w-xl text-sm text-stone">{DISCLAIMER}</p>
      </section>

      <section className="mt-16" aria-live="polite">
        {reading ? (
          <p className="text-sm text-stone">Reading the drawing…</p>
        ) : audit ? (
          <Result
            audit={audit}
            extract={extract}
            sourceText={sourceText}
            onReplace={reset}
          />
        ) : null}
      </section>
    </div>
  );
}

function Result({
  audit,
  extract,
  sourceText,
  onReplace,
}: {
  audit: AuditSample;
  extract: DrawingExtract | null;
  sourceText: string | null;
  onReplace: () => void;
}) {
  function downloadChecklist() {
    downloadBlob(
      `${audit.fileStem}-checklist.txt`,
      auditToReport(audit),
      "text/plain;charset=utf-8",
    );
  }

  function downloadDrawing() {
    if (!extract) {
      return;
    }
    downloadBlob(
      `${audit.fileStem}-annotated.dxf`,
      buildAnnotatedDrawing(audit, extract, sourceText ?? undefined),
      "application/dxf",
    );
  }

  return (
    <div className="space-y-14">
      <header className="max-w-3xl">
        <h2 className="font-serif text-3xl leading-tight">{audit.project}</h2>
        <p className="mt-3 text-sm text-stone">
          {audit.address}
          {audit.erf ? ` · ${audit.erf}` : ""}
        </p>
        <p className="mt-2 text-sm">
          {audit.occupancy} · {audit.occupancyNote}
        </p>
        <p className="mt-2 text-sm">{audit.verdict}</p>
        {audit.warnings?.length ? (
          <p className="mt-4 text-sm text-stone">{audit.warnings[0]}</p>
        ) : null}
        <button
          type="button"
          className="mt-6 text-sm underline-offset-4 hover:underline"
          onClick={onReplace}
        >
          Choose another drawing
        </button>
      </header>

      <section>
        <h3 className="font-serif text-2xl">Passed</h3>
        {audit.passed.length ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="text-stone">
                <th className="py-2 pr-4 font-normal">Check</th>
                <th className="py-2 pr-4 font-normal">Numbers/note</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.passed.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3 pr-4">
                    {row.part} — {row.check}
                  </td>
                  <td className="py-3 pr-4 text-stone">{row.detail}</td>
                  <td className="py-3">Pass</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-stone">No passing checks yet.</p>
        )}
      </section>

      <section>
        <h3 className="font-serif text-2xl">Failed</h3>
        {audit.failed.length ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="text-stone">
                <th className="py-2 pr-4 font-normal">Check</th>
                <th className="py-2 pr-4 font-normal">Numbers/note</th>
                <th className="py-2 pr-4 font-normal">What to adjust</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.failed.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3 pr-4">
                    {row.part} — {row.check}
                  </td>
                  <td className="py-3 pr-4 text-stone">{row.detail}</td>
                  <td className="py-3 pr-4">{row.adjust}</td>
                  <td className="py-3">Fail</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-stone">
            Nothing failed on the checks we could read.
          </p>
        )}
      </section>

      {extract ? (
        <section>
          <h3 className="font-serif text-2xl">Drawing</h3>
          <div className="mt-6 min-h-64 w-full text-ink">
            <DrawingPreview extract={extract} label={audit.label} />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <button
          type="button"
          className="underline-offset-4 hover:underline"
          onClick={downloadChecklist}
        >
          Download checklist
        </button>
        <button
          type="button"
          className="underline-offset-4 hover:underline disabled:text-stone"
          onClick={downloadDrawing}
          disabled={!extract}
        >
          Download annotated drawing
        </button>
      </div>

      <p className="max-w-xl text-sm text-stone">{DISCLAIMER}</p>
    </div>
  );
}
