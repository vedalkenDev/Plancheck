import type { SansClause } from "@/data/types";

// Rows copied from the PlanCheck headings table.
// Part XA has no 4.4.4 row. The indexed heading is 4.4.
const RULE_CLAUSES: Record<string, SansClause> = {
  occupancy: {
    book: "INTRO",
    ref: "A20",
    label: "Classification and Designation of Occupancies",
    page: 33,
  },
  address: {
    book: "INTRO",
    ref: "A6",
    label: "Site Plans",
    page: 28,
  },
  titleblocks: {
    book: "INTRO",
    ref: "A7",
    label: "Layout Drawing",
    page: 28,
  },
  "xa-fenestration": {
    book: "XA",
    ref: "4.4",
    label: "Building envelope requirements",
    page: 9,
  },
  "window-schedule": {
    book: "N",
    ref: "4.2",
    label: "Glazing installations",
    page: 6,
  },
  "part-r": {
    book: "INTRO",
    ref: "R1",
    label: "Stormwater Disposal Requirement",
    page: 149,
  },
  "part-m": {
    book: "M",
    ref: "4.2",
    label: "Dimensional requirements",
    page: 6,
  },
  "part-d": {
    book: "D",
    ref: "4.4",
    label: "Swimming pools and swimming baths",
    page: 5,
  },
  "part-k": {
    book: "K",
    ref: "4.2",
    label: "Masonry walls",
    page: 9,
  },
  "part-s": {
    book: "S",
    ref: "4.4",
    label: "External and internal circulation",
    page: 11,
  },
  "part-t": {
    book: "T",
    ref: "4.5",
    label: "Fire performance",
    page: 31,
  },
  "part-o": {
    book: "O",
    ref: "4.2",
    label: "Lighting",
    page: 7,
  },
  "site-area": {
    book: "INTRO",
    ref: "A6",
    label: "Site Plans",
    page: 28,
  },
  signatures: {
    book: "INTRO",
    ref: "A19",
    label: "Appointment of Persons Responsible for Design",
    page: 32,
  },
  "eng-packs": {
    book: "INTRO",
    ref: "A19",
    label: "Appointment of Persons Responsible for Design",
    page: 32,
  },
};

export function clauseForRule(id: string) {
  return RULE_CLAUSES[id];
}

export function formatClause(clause: SansClause) {
  const page = clause.page ? `, page ${clause.page}` : "";
  if (/^\d/.test(clause.ref)) {
    return `SANS 10400-${clause.book} ${clause.ref} ${clause.label}${page}`;
  }
  return `SANS 10400 ${clause.ref} ${clause.label}${page}`;
}

export function clauseStamp(clause: SansClause | undefined) {
  if (!clause) {
    return "No SANS 10400 clause.";
  }
  if (/^\d/.test(clause.ref)) {
    return `SANS 10400-${clause.book} ${clause.ref}.`;
  }
  return `SANS 10400 ${clause.ref}.`;
}
