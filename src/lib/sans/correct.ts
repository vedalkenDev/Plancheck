import type { AuditSample, FailedCheck } from "@/data/types";
import type { NoteCard } from "@/lib/pdf/space";

export type Correction = {
  id: string;
  part: string;
  check: string;
  clause: string;
  title: string;
  body: string;
};

export type CorrectionSkip = {
  id: string;
  part: string;
  check: string;
  reason: string;
};

export type CorrectionPlan = {
  add: Correction[];
  skip: CorrectionSkip[];
};

const SKIP_REASON: Partial<Record<string, string>> = {
  signatures: "Owner and competent-person signatures still have to be signed.",
  "eng-packs": "Engineering packs have to be attached. A note cannot stand in for them.",
  "readable-text": "Export a vector PDF from CAD so titles and notes can be read.",
  address: "The street address has to be consistent on the titleblock. Plancheck will not invent one.",
  occupancy: "Occupancy has to be marked on the titleblock.",
  titleblocks: "Leftover titleblocks have to be replaced so every sheet matches this project.",
  "part-m": "Stair riser and going have to be dimensioned on the flight.",
  "window-schedule": "Window types need elevations on the sheet, not a general note.",
};

/** Missing printed notes we can write as a SANS block. Measured sizes stay with the architect. */
export function correctionsFromAudit(audit: AuditSample): CorrectionPlan {
  const add: Correction[] = [];
  const skip: CorrectionSkip[] = [];
  for (const row of audit.failed) {
    const note = noteForFail(row, audit);
    if ("body" in note) {
      add.push({
        id: row.id,
        part: row.part,
        check: row.check,
        clause: row.clause ?? "SANS 10400",
        title: note.title,
        body: note.body,
      });
      continue;
    }
    skip.push({
      id: row.id,
      part: row.part,
      check: row.check,
      reason: note.reason,
    });
  }
  return { add, skip };
}

export function cardsFromCorrections(
  audit: AuditSample,
  selected?: ReadonlySet<string>,
): NoteCard[] {
  const plan = correctionsFromAudit(audit);
  const notes = plan.add.filter((row) => !selected || selected.has(row.id));
  return [
    {
      id: "verdict",
      title: "PLANCHECK CORRECTOR",
      body: "Missing SANS notes written into empty paper.\nNot a stamp. Not municipal approval.",
      minW: 220,
      minH: 72,
      tone: "note",
    },
    ...notes.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      minW: 220,
      minH: 100,
      tone: "note" as const,
    })),
  ];
}

function noteForFail(
  row: FailedCheck,
  audit: AuditSample,
): { title: string; body: string } | { reason: string } {
  const known = SKIP_REASON[row.id];
  if (known) {
    return { reason: known };
  }

  if (row.id === "part-r") {
    return {
      title: "SANS 10400-R  STORMWATER",
      body: "Stormwater to a soak pit on site to SANS 10400-R.",
    };
  }

  if (row.id === "part-d") {
    return {
      title: "SANS 10400-D  POOL ENCLOSURE",
      body: "Pool enclosure to SANS 10400-D: barrier at least 1.2 m high, openings not more than 100 mm, and a self-closing / self-latching gate.",
    };
  }

  if (row.id === "part-t") {
    const occupancy =
      audit.occupancy !== "—"
        ? `occupancy ${audit.occupancy} ${audit.occupancyNote}`
        : "this occupancy";
    return {
      title: "SANS 10400-T  FIRE PROTECTION",
      body: `Fire protection and emergency escape to SANS 10400-T. Hose reels and emergency exits as required for ${occupancy}.`,
    };
  }

  if (row.id === "xa-fenestration") {
    return xaNote(row);
  }

  if (row.how === "measured") {
    return {
      reason: "This was measured from sizes on the sheet. A note cannot change the drawing.",
    };
  }

  return { reason: "No drawing note for this check yet." };
}

function xaNote(row: FailedCheck): { title: string; body: string } | { reason: string } {
  if (/schedule measures/i.test(row.detail)) {
    return {
      reason:
        "The XA percentages have to match the window schedule. Plancheck will not overwrite the titleblock figure.",
    };
  }
  if (/exceed 15%/i.test(row.detail)) {
    return {
      title: "SANS 10400-XA  FENESTRATION",
      body: "Fenestration exceeds 15% of nett floor area per storey. SANS 204 applies (SANS 10400-XA 4.4.4).",
    };
  }
  if (/20%/.test(row.detail)) {
    return {
      title: "SANS 10400-XA  FENESTRATION",
      body: "Fenestration to SANS 10400-XA 4.4.4: glazed area not to exceed 15% of nett floor area per storey. Where exceeded, SANS 204 applies.",
    };
  }
  if (row.how === "measured") {
    return {
      reason: "This was measured from sizes on the sheet. A note cannot change the drawing.",
    };
  }
  return {
    title: "SANS 10400-XA  FENESTRATION",
    body: "Fenestration to SANS 10400-XA 4.4.4: glazed area not to exceed 15% of nett floor area per storey. Where exceeded, SANS 204 applies.",
  };
}
