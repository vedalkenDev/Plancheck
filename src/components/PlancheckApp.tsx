"use client";

import { useId, useRef, useState } from "react";
import { AuditResult } from "@/components/AuditResult";
import type { AuditSample } from "@/data/types";
import { auditFromDrawing, extractDrawing } from "@/lib/cad";
import styles from "@/app/plancheck/plancheck.module.css";

type PlancheckAppProps = {
  samples: AuditSample[];
};

const DRAWING_NAME = /\.(dwg|dxf)$/i;
const MAX_BYTES = 40 * 1024 * 1024;

export function PlancheckApp({ samples }: PlancheckAppProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [audit, setAudit] = useState<AuditSample | null>(null);
  const [source, setSource] = useState<"sample" | "upload">("sample");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  function reset() {
    setAudit(null);
    setSource("sample");
    setError(null);
    setReading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function loadSample(sample: AuditSample) {
    setError(null);
    setReading(false);
    setSource("sample");
    setAudit(sample);
  }

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }

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

    try {
      const bytes = await file.arrayBuffer();
      const extract = extractDrawing(file.name, bytes);
      const result = auditFromDrawing(file.name, extract);
      setSource("upload");
      setAudit(result);
    } catch {
      setError("The drawing could not be read. Save a DXF from your CAD software and try again.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div>
      <h1 className={styles.claim}>
        <span className={styles.claimLine}>Upload a .dwg.</span>
        <span className={styles.claimEm}>See what fails SANS 10400</span>
        <span className={styles.claimLine}>before you submit.</span>
      </h1>
      <p className={styles.lead}>
        Plancheck reads a drawing and returns a pass/fail checklist against SANS
        10400. Finding first. Fixing is the job.
      </p>
      <p className={styles.offer}>The finding is free.</p>

      {audit ? (
        <AuditResult audit={audit} source={source} onReset={reset} />
      ) : (
        <>
          <label
            className={styles.zone}
            htmlFor={inputId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void onFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              id={inputId}
              className={styles.file}
              type="file"
              accept=".dwg,.dxf,application/acad,image/vnd.dwg,image/vnd.dxf"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <p className={styles.zoneTitle}>
              {reading ? "Reading the drawing…" : "Choose a drawing file (.dwg or .dxf)"}
            </p>
            <p className={styles.zoneHint}>
              You will get a pass/fail checklist before you submit.
            </p>
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.samples}>
            <p className={styles.samplesLabel}>Or run a sample audit</p>
            <ul className={styles.sampleList}>
              {samples.map((sample) => (
                <li key={sample.id}>
                  <button
                    className={styles.sampleBtn}
                    type="button"
                    onClick={() => loadSample(sample)}
                  >
                    {sample.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
