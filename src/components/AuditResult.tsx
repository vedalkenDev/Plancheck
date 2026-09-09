import type { AuditSample } from "@/data/types";
import {
  annotatedDrawingPlaceholder,
  auditToReport,
  DISCLAIMER,
} from "@/lib/checklist";
import { downloadTextFile } from "@/lib/download";
import styles from "@/app/plancheck/plancheck.module.css";

type AuditResultProps = {
  audit: AuditSample;
  source: "sample" | "upload";
  onReset: () => void;
};

export function AuditResult({ audit, source, onReset }: AuditResultProps) {
  function downloadChecklist() {
    downloadTextFile(
      `${audit.fileStem}-checklist.txt`,
      auditToReport(audit),
      "text/plain;charset=utf-8",
    );
  }

  function downloadDrawing() {
    downloadTextFile(
      `${audit.fileStem}-annotated.dwg`,
      annotatedDrawingPlaceholder(audit),
      "application/octet-stream",
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <p className={styles.kicker}>
          {source === "upload"
            ? `Uploaded drawing · showing ${audit.label} as an example`
            : `Sample audit · ${audit.label}`}
        </p>
        <button className={styles.textBtn} type="button" onClick={onReset}>
          Start over
        </button>
      </div>

      <section className={styles.meta} aria-labelledby="project-title">
        <p className={styles.kicker}>Project</p>
        <h2 id="project-title" className={styles.project}>
          {audit.project}
        </h2>
        <dl className={styles.facts}>
          {audit.erf ? (
            <div>
              <dt>Erf</dt>
              <dd>{audit.erf}</dd>
            </div>
          ) : null}
          <div>
            <dt>Address</dt>
            <dd>{audit.address}</dd>
          </div>
          <div>
            <dt>Occupancy</dt>
            <dd>
              {audit.occupancy} · {audit.occupancyNote}
            </dd>
          </div>
          <div>
            <dt>Verdict</dt>
            <dd className={styles.verdict}>{audit.verdict}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="passed-heading">
        <h2 id="passed-heading" className={styles.sectionTitle}>
          Passed
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Numbers / note</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.passed.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.check}</th>
                  <td>{row.note}</td>
                  <td>Pass</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="failed-heading">
        <h2 id="failed-heading" className={styles.sectionTitle}>
          Failed
        </h2>
        <ul className={styles.failList}>
          {audit.failed.map((row) => (
            <li key={row.id} className={styles.failItem}>
              <div className={styles.failHead}>
                <h3 className={styles.failCheck}>{row.check}</h3>
                <p className={styles.failNote}>{row.note}</p>
              </div>
              <p className={styles.adjust}>
                <span className={styles.adjustLabel}>Adjust: </span>
                {row.adjustment}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.disclaimer} role="note">
        {DISCLAIMER}
      </p>

      <div className={styles.downloads}>
        <button className={styles.download} type="button" onClick={downloadDrawing}>
          Download annotated drawing
        </button>
        <button className={styles.download} type="button" onClick={downloadChecklist}>
          Download checklist
        </button>
      </div>
    </div>
  );
}
