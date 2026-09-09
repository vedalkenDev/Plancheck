"use client";

import { useId, useRef, useState } from "react";
import { AuditResult } from "@/components/AuditResult";
import type { AuditSample } from "@/data/types";
import styles from "@/app/plancheck/plancheck.module.css";

type PlancheckAppProps = {
  samples: AuditSample[];
  uploadStandIn: AuditSample;
};

const DRAWING_NAME = /\.(dwg|dxf)$/i;
const ENGINE_NOTE =
  "A live check of this drawing is coming. For now, here is 130 Hartley Road so you can see the report.";

export function PlancheckApp({ samples, uploadStandIn }: PlancheckAppProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [audit, setAudit] = useState<AuditSample | null>(null);
  const [source, setSource] = useState<"sample" | "upload">("sample");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function reset() {
    setAudit(null);
    setSource("sample");
    setError(null);
    setToast(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function loadSample(sample: AuditSample) {
    setError(null);
    setToast(null);
    setSource("sample");
    setAudit(sample);
  }

  function onFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!DRAWING_NAME.test(file.name)) {
      setError("Please choose a .dwg or .dxf drawing.");
      return;
    }

    setError(null);
    setSource("upload");
    setAudit(uploadStandIn);
    setToast(ENGINE_NOTE);
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
              onFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              id={inputId}
              className={styles.file}
              type="file"
              accept=".dwg,.dxf,application/acad,image/vnd.dwg,image/vnd.dxf"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
            <p className={styles.zoneTitle}>
              Choose a drawing file (.dwg or .dxf)
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

      {toast ? (
        <p className={styles.toast} role="status" aria-live="polite">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
