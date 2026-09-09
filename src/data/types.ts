export type PassedCheck = {
  id: string;
  check: string;
  note: string;
  status: "pass";
};

export type FailedCheck = {
  id: string;
  check: string;
  note: string;
  status: "fail";
  adjustment: string;
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
};
