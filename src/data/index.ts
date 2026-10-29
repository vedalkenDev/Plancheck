import type { SampleDrawing } from "./types";

export type { AuditSample, FailedCheck, PassedCheck, SampleDrawing } from "./types";

export const sampleDrawings: SampleDrawing[] = [
  {
    id: "747-villa",
    label: "747 Villa (PDF)",
    href: "/samples/747-villa.pdf",
  },
  {
    id: "dogtrot",
    label: "Dogtrot (PDF)",
    href: "/samples/dogtrot-floorplan.pdf",
  },
];
