import { Plate } from "@/components/iso/draw";
import { ScannerArt } from "./art";
import { IsoFrame } from "./theme";

export function ScanLoader() {
  return (
    <IsoFrame>
      <Plate
        fig="Fig 1"
        title="Reading the sheet"
        hint="Drag, or arrow keys"
        readout="scan 0.0 mm"
        keys={[
          { mark: "lit", label: "The lamp on the read head" },
          { mark: "edge", label: "Millimetres from the left stop" },
        ]}
        caption="The head travels a 240 mm window of the drawing. The dial and the readout both show that distance from the left stop."
      >
        <ScannerArt />
      </Plate>
    </IsoFrame>
  );
}
