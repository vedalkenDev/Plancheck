import { sampleDrawings } from "@/data";
import { PlancheckApp } from "@/components/PlancheckApp";

export default function PlancheckPage() {
  return <PlancheckApp samples={sampleDrawings} />;
}
