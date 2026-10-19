import type { SampleDrawing } from "./types";

export type { AuditSample, FailedCheck, PassedCheck, SampleDrawing } from "./types";

export const sampleDrawings: SampleDrawing[] = [
  {
    id: "marine-drive-notes",
    label: "69 Marine Drive (PDF notes)",
    href: "/samples/marine-drive-notes.pdf",
  },
  {
    id: "marine-drive-pdf",
    label: "69 Marine Drive (PDF sheet)",
    href: "/samples/marine-drive.pdf",
  },
  {
    id: "hartley-pdf",
    label: "130 Hartley Road (PDF sheet)",
    href: "/samples/hartley-test2.pdf",
  },
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
