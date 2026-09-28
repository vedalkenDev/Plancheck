export type CheckEvidence = {
  quote: string;
  layer?: string;
};

export type SansClause = {
  book: string;
  ref: string;
  label: string;
  page: number | null;
};

export type PassedCheck = {
  id: string;
  part: string;
  check: string;
  detail: string;
  status: "pass";
  clause?: SansClause;
  evidence?: CheckEvidence[];
};

export type FailedCheck = {
  id: string;
  part: string;
  check: string;
  detail: string;
  status: "fail";
  adjust: string;
  clause?: SansClause;
  evidence?: CheckEvidence[];
};

export type AuditSample = {
  id: string;
  slug: string;
  label: string;
  fileStem: string;
  project: string;
  erf: string | null;
  address: string;
  occupancy: string;
  occupancyNote: string;
  verdict: string;
  passed: PassedCheck[];
  failed: FailedCheck[];
  warnings?: string[];
  format?: "dxf" | "dwg" | "unknown";
};

export type SampleDrawing = {
  id: string;
  label: string;
  href: string;
};
