export type CheckEvidence = {
  quote: string;
  layer?: string;
};

export type PassedCheck = {
  id: string;
  code: string;
  check: string;
  note: string;
  status: "pass";
  evidence?: CheckEvidence[];
};

export type FailedCheck = {
  id: string;
  code: string;
  check: string;
  note: string;
  status: "fail";
  adjustment: string;
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
