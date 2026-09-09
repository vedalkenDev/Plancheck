import { hartley, sampleList } from "@/data";
import { PlancheckApp } from "@/components/PlancheckApp";

export default function PlancheckPage() {
  return <PlancheckApp samples={sampleList} uploadStandIn={hartley} />;
}
