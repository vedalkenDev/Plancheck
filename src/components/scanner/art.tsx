import { Dots, Line, Solid } from "@/components/iso/draw";
import { ScannerLive } from "./live";
import { BASE_ART, BED_ART, CARRIAGE_BACK, CARRIAGE_FRONT, DIAL_ART, RAIL_ART, RODS, RULE } from "./geometry";

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, index) => (
      <g key={index}>
        {parts.map((paths, part) => (
          <Solid key={part} paths={paths} tone="lo" crease="faint" />
        ))}
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="lo" crease="faint" />
    <Line d={BASE_ART.groove} tone="lo" />
    {BASE_ART.bosses.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={BASE_ART.screwRings} tone="lo" />
    <Dots points={BASE_ART.screws} size={0.45} tone="mid" />
    <Solid paths={BASE_ART.plate} tone="mid" crease="none" />
    <Line d={BASE_ART.plateLine} tone="faint" />
    <Line d={BASE_ART.plateRule} tone="lo" free />
    <Dots points={BASE_ART.plateScrews} size={0.4} tone="mid" />
  </g>
);

const RAIL = (
  <g key="rail">
    {RAIL_ART.feet.map((paths, index) => (
      <Solid key={`foot-${index}`} paths={paths} tone="lo" crease="faint" />
    ))}
    {RAIL_ART.posts.map((paths, index) => (
      <Solid key={`post-${index}`} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={RAIL_ART.postSeams} tone="faint" />
    {RAIL_ART.caps.map((paths, index) => (
      <Solid key={`cap-${index}`} paths={paths} tone="mid" crease="faint" />
    ))}
    <Dots points={RAIL_ART.capScrews} size={0.45} tone="mid" />
    <Solid paths={RAIL_ART.rail} tone="mid" crease="faint" />
    <Dots points={RAIL_ART.railScrews} size={0.45} tone="mid" />
    {RAIL_ART.stops.map((paths, index) => (
      <Solid key={`stop-${index}`} paths={paths} tone="mid" crease="faint" />
    ))}
    {RODS.map((paths, index) => (
      <Solid key={`rod-${index}`} paths={paths} tone="mid" crease="none" />
    ))}
    <Line d={RULE.base} tone="faint" />
    <Line d={RULE.minor} tone="lo" />
    <Line d={RULE.major} tone="mid" />
  </g>
);

const BACK = (
  <g key="carriage-back">
    <Solid paths={CARRIAGE_BACK.bush} tone="mid" crease="faint" />
    <Line d={CARRIAGE_BACK.bores} tone="lo" />
    <Solid paths={CARRIAGE_BACK.clamp} tone="mid" crease="faint" />
    <Line d={CARRIAGE_BACK.clampKnurl} tone="lo" />
    <Solid paths={CARRIAGE_BACK.arm} tone="mid" crease="faint" />
    <Solid paths={CARRIAGE_BACK.brace} tone="mid" crease="faint" />
    <Line d={CARRIAGE_BACK.armLine} tone="faint" />
    <Solid paths={CARRIAGE_BACK.rider} tone="hi" crease="faint" />
    <Line d={CARRIAGE_BACK.index} tone="hi" />
  </g>
);

const BED = (
  <g key="bed">
    <Solid paths={BED_ART.glass} tone="mid" crease="faint" />
    <Line d={BED_ART.glassLine} tone="faint" />
    <Solid paths={BED_ART.paper} tone="hi" crease="none" />
    <Line d={BED_ART.margin} tone="lo" />
    <Line d={BED_ART.building} tone="mid" />
    <Line d={BED_ART.wallX} tone="mid" />
    <Line d={BED_ART.wallY} tone="mid" />
    <Line d={BED_ART.block} tone="lo" />
    <Line d={BED_ART.blockRule} tone="faint" free />
  </g>
);

const FRONT = (
  <g key="carriage-front">
    <Solid paths={CARRIAGE_FRONT.arm} tone="mid" crease="faint" />
    <Solid paths={CARRIAGE_FRONT.brace} tone="mid" crease="faint" />
    <Line d={CARRIAGE_FRONT.armLine} tone="faint" />
    <Solid paths={CARRIAGE_FRONT.head} tone="mid" crease="faint" />
    <Line d={CARRIAGE_FRONT.seam} tone="lo" />
    <Solid paths={CARRIAGE_FRONT.collar} tone="mid" crease="faint" />
    <Solid paths={CARRIAGE_FRONT.setScrew} tone="mid" crease="faint" />
    <Solid paths={CARRIAGE_FRONT.lamp} tone="hi" lit />
    <Line d={CARRIAGE_FRONT.lens} tone="lit" />
  </g>
);

const DIAL = (
  <g key="dial">
    <Solid paths={DIAL_ART.stand} tone="lo" crease="faint" />
    <Dots points={DIAL_ART.standScrews} size={0.45} tone="mid" />
    <Solid paths={DIAL_ART.column} tone="mid" crease="none" />
    <Solid paths={DIAL_ART.puck} tone="mid" crease="faint" />
    <Solid paths={DIAL_ART.bezel} tone="hi" crease="faint" />
    <Line d={DIAL_ART.knurl} tone="lo" />
    <Line d={DIAL_ART.band} tone="faint" />
    <Line d={DIAL_ART.face} tone="lo" />
    <Line d={DIAL_ART.minor} tone="lo" />
    <Line d={DIAL_ART.major} tone="mid" />
    <Line d={DIAL_ART.zero} tone="hi" />
    <Line d={DIAL_ART.hub} tone="mid" />
    <Dots points={[DIAL_ART.hubDot]} size={0.55} tone="hi" />
    <Solid paths={DIAL_ART.crown} tone="mid" crease="faint" />
    <Solid paths={DIAL_ART.crownCap} tone="mid" crease="faint" />
    <Line d={DIAL_ART.crownKnurl} tone="lo" />
  </g>
);

export function ScannerArt() {
  return <ScannerLive base={BASE} rail={RAIL} carriageBack={BACK} bed={BED} carriageFront={FRONT} dial={DIAL} />;
}
