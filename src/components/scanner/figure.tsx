import { Plate } from "@/components/iso/draw";
import { ScannerArt } from "./art";
import { IsoFrame } from "./theme";

type ScanLoaderProps = {
  compact?: boolean;
  fig?: string;
  title?: string;
};

export function ScanLoader({ compact = false, fig, title }: ScanLoaderProps) {
  return (
    <IsoFrame compact={compact}>
      <Plate
        fig={fig ?? (compact ? "Fig 2" : "Fig 1")}
        title={title ?? (compact ? "Tracing the plan" : "Reading the sheet")}
        hint={compact ? undefined : "Drag, or arrow keys"}
        readout="scan 0.0 mm"
        keys={
          compact
            ? []
            : [
                { mark: "lit", label: "The lamp on the read head" },
                { mark: "edge", label: "Millimetres from the left stop" },
              ]
        }
        caption={
          compact
            ? undefined
            : "The head travels a 240 mm window of the drawing. The dial and the readout both show that distance from the left stop."
        }
      >
        <ScannerArt passive={compact} />
      </Plate>
    </IsoFrame>
  );
}
