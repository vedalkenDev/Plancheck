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
    id: "marine-drive",
    label: "69 Marine Drive (H4 dwelling)",
    href: "/samples/marine-drive.dxf",
  },
  {
    id: "hartley-pdf",
    label: "130 Hartley Road (PDF sheet)",
    href: "/samples/hartley-test2.pdf",
  },
  {
    id: "hartley-test2",
    label: "130 Hartley Road (G1 medical offices)",
    href: "/samples/hartley-test2.dxf",
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
  {
    id: "sample-2018",
    label: "Sample DWG",
    href: "/samples/sample-2018.dwg",
  },
  {
    id: "sheet-styles",
    label: "Dashes, hatch, leader",
    href: "/samples/sheet-styles.dxf",
  },
];
