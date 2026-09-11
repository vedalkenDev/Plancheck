import type { SampleDrawing } from "./types";

export type { AuditSample, FailedCheck, PassedCheck, SampleDrawing } from "./types";

export const sampleDrawings: SampleDrawing[] = [
  {
    id: "marine-drive",
    label: "69 Marine Drive (H4 dwelling)",
    href: "/samples/marine-drive.dxf",
  },
  {
    id: "hartley-test2",
    label: "130 Hartley Road (G1 medical offices)",
    href: "/samples/hartley-test2.dxf",
  },
];
