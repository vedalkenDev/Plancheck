import {
  circleRing,
  extrude,
  insetPlan,
  knurl,
  onTop,
  pathOf,
  planOutline,
  sideArc,
  sideRing,
  slabOf,
  type Plan,
  type Plane,
  type Point3,
} from "@/components/iso/iso-kit";
import { TRAVEL_MM } from "./model";
import {
  ARM_H,
  ARM_W,
  ARM_Z,
  BASE,
  BASE_H,
  DIAL_H,
  DIAL_R,
  DIAL_TOP,
  DIAL_X,
  DIAL_Y,
  DIAL_Z,
  FOOT_H,
  GLASS,
  GLASS_H,
  HEAD_H,
  HEAD_R,
  HEAD_TOP,
  HEAD_Y,
  HEAD_Z,
  LAMP_H,
  LAMP_R,
  NEEDLE_FROM,
  NEEDLE_SPAN,
  P,
  PAPER,
  PAPER_H,
  PAPER_TOP,
  PAPER_Z,
  POST_D,
  POST_H,
  POST_W,
  POST_XS,
  POST_Y,
  RAIL,
  RAIL_FRONT,
  RAIL_H,
  RAIL_TOP,
  ROD_R,
  ROD_X0,
  ROD_X1,
  ROD_Y,
  ROD_ZS,
  SPLIT_Y,
  at,
} from "./view";

const solid = (plan: Plan, z: number, h: number, steps = 6, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const round = (cx: number, cy: number, r: number, z: number, h: number, steps = 28) =>
  extrude(circleRing(cx, cy, r, steps), z, h, P, { convex: true });
const ring = (cx: number, cy: number, r: number, z: number, steps = 40) => onTop(circleRing(cx, cy, r, steps), z, P, true);
const join = (paths: string[]) => paths.join("");
const segment = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);

const FEET: Plane[] = [
  [BASE.x + 22, BASE.y + 20],
  [BASE.x + BASE.w - 22, BASE.y + 20],
  [BASE.x + 22, BASE.y + BASE.d - 20],
  [BASE.x + BASE.w - 22, BASE.y + BASE.d - 20],
];

const SCREWS: Plane[] = [
  [BASE.x + 9, BASE.y + 9],
  [BASE.x + BASE.w - 9, BASE.y + 9],
  [BASE.x + 9, BASE.y + BASE.d - 9],
  [BASE.x + BASE.w - 9, BASE.y + BASE.d - 9],
];

const PLATE: Plan = { x: BASE.x + 18, y: BASE.y + BASE.d - 28, w: 58, d: 14, r: 1.6 };

export const BASE_ART = {
  halo: solid(BASE, -BASE_H - FOOT_H, BASE_H).fill,
  feet: FEET.map(([x, y]) => [round(x, y, 8, -BASE_H - FOOT_H, 1.8, 20), round(x, y, 5.6, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, 20)]),
  slab: solid(BASE, -BASE_H, BASE_H, 8, 1.4),
  groove: planOutline(insetPlan(BASE, 5), 0, P),
  bosses: SCREWS.map(([x, y]) => round(x, y, 2.4, 0, 0.9, 16)),
  screws: SCREWS.map(([x, y]) => at([x, y, 0.9])),
  screwRings: join(SCREWS.map(([x, y]) => ring(x, y, 1.5, 0.9, 14))),
  plate: solid(PLATE, 0, 0.9, 4),
  plateLine: planOutline(insetPlan(PLATE, 1.5), 0.9, P),
  plateScrews: [at([PLATE.x + 3.4, PLATE.y + PLATE.d / 2, 0.9]), at([PLATE.x + PLATE.w - 3.4, PLATE.y + PLATE.d / 2, 0.9])],
  plateRule: join([0, 1, 2].map((row) => onTop([[PLATE.x + 8, PLATE.y + 3.6 + row * 2.4], [PLATE.x + (row === 1 ? 36 : 46), PLATE.y + 3.6 + row * 2.4]], 0.9, P))),
};

const POSTS: Plan[] = POST_XS.map((x) => ({ x, y: POST_Y, w: POST_W, d: POST_D, r: 1.6 }));

export const RAIL_ART = {
  feet: POSTS.map((plan) => solid({ x: plan.x - 2, y: plan.y - 1, w: plan.w + 4, d: plan.d + 2, r: 1.4 }, 0, 2, 4)),
  posts: POSTS.map((plan) => solid(plan, 2, POST_H - 2, 4, 0.6)),
  caps: POSTS.map((plan) => solid(insetPlan(plan, -0.6), POST_H, 2.2, 4, 0.4)),
  capScrews: POSTS.map((plan) => at([plan.x + POST_W / 2, plan.y + POST_D / 2, POST_H + 2.2])),
  postSeams: join(POSTS.map((plan) => segment([plan.x + POST_W, plan.y + 3, 6], [plan.x + POST_W, plan.y + 3, POST_H - 3]))),
  rail: solid(RAIL, 0, RAIL_H, 4, 0.7),
  railScrews: POSTS.map((plan) => at([plan.x + POST_W / 2, ROD_Y, RAIL_TOP])),
  stops: [ROD_X0 + 3, ROD_X1 - 3].map((x) => solid({ x: x - 2, y: RAIL.y - 0.6, w: 4, d: RAIL.d + 1.2, r: 0.8 }, RAIL_TOP, 2.4, 3)),
};

const ROD_PLAN: Plan = { x: ROD_X0, y: ROD_Y - ROD_R, w: ROD_X1 - ROD_X0, d: ROD_R * 2, r: ROD_R - 0.15 };

export const RODS = ROD_ZS.map((z) => solid(ROD_PLAN, z - ROD_R, ROD_R * 2, 3));

function ruler() {
  const minor: string[] = [];
  const major: string[] = [];
  const from = ROD_X0 + 8;
  const to = ROD_X1 - 8;
  for (let x = Math.ceil(from / 8) * 8; x <= to; x += 8) {
    const big = Math.round(x / 8) % 5 === 0;
    (big ? major : minor).push(segment([x, RAIL_FRONT, RAIL_TOP], [x, RAIL_FRONT, RAIL_TOP - (big ? 4.6 : 2.6)]));
  }
  return {
    minor: join(minor),
    major: join(major),
    base: segment([from, RAIL_FRONT, RAIL_TOP - 1.1], [to, RAIL_FRONT, RAIL_TOP - 1.1]),
  };
}

export const RULE = ruler();

const BUSH: Plan = { x: -11, y: ROD_Y - 7, w: 22, d: 14, r: 2 };
const BUSH_Z = ROD_ZS[0] - ROD_R - 1.4;
const BUSH_H = ROD_ZS[1] + ROD_R + 1.6 - BUSH_Z;
const BUSH_TOP = BUSH_Z + BUSH_H;

const arm = (y: number, d: number) => solid({ x: -ARM_W / 2, y, w: ARM_W, d, r: 1.1 }, ARM_Z, ARM_H, 4, 0.5);
const brace = (y: number, d: number) => solid({ x: -2.2, y, w: 4.4, d, r: 0.8 }, HEAD_Z + 1, 3.2, 3, 0.3);

export const CARRIAGE_BACK = {
  bush: solid(BUSH, BUSH_Z, BUSH_H, 4, 0.6),
  bores: join(ROD_ZS.flatMap((z) => [sideRing([-11, ROD_Y, z], ROD_R + 0.7, "x", P, 16), sideRing([11, ROD_Y, z], ROD_R + 0.7, "x", P, 16)])),
  clamp: round(0, ROD_Y - 2, 2.3, BUSH_TOP, 2.6, 16),
  clampKnurl: knurl(0, ROD_Y - 2, 2.3, BUSH_TOP, BUSH_TOP + 2.6, 14, P),
  arm: arm(RAIL_FRONT, SPLIT_Y - RAIL_FRONT),
  brace: brace(RAIL_FRONT, SPLIT_Y - RAIL_FRONT),
  armLine: onTop([[0, RAIL_FRONT + 1.2], [0, SPLIT_Y]], ARM_Z + ARM_H, P),
  rider: solid({ x: -3.2, y: RAIL.y, w: 6.4, d: RAIL.d, r: 0.7 }, RAIL_TOP, 2, 3),
  index: segment([0, RAIL_FRONT, RAIL_TOP + 2], [0, RAIL_FRONT, RAIL_TOP - 1.1]),
};

const ARM_END = HEAD_Y - 2;

export const CARRIAGE_FRONT = {
  arm: arm(SPLIT_Y, ARM_END - SPLIT_Y),
  brace: brace(SPLIT_Y, ARM_END - SPLIT_Y),
  armLine: onTop([[0, SPLIT_Y], [0, ARM_END]], ARM_Z + ARM_H, P),
  head: round(0, HEAD_Y, HEAD_R, HEAD_Z, HEAD_H, 36),
  seam: sideArc(0, HEAD_Y, HEAD_R, HEAD_Z + 4.5, P, 28),
  collar: round(0, HEAD_Y, HEAD_R + 0.7, HEAD_TOP - 2.2, 2.2, 36),
  setScrew: round(HEAD_R - 0.4, HEAD_Y, 1.5, HEAD_Z + 6, 2.4, 12),
  lamp: round(0, HEAD_Y, LAMP_R, HEAD_TOP, LAMP_H, 32),
  lens: ring(0, HEAD_Y, LAMP_R - 1.6, HEAD_TOP + LAMP_H, 28),
};

const BUILDING: Plan = { x: PAPER.x + 14, y: PAPER.y + 16, w: PAPER.w - 28, d: PAPER.d - 30, r: 0 };
const WALL_X = BUILDING.x + BUILDING.w * 0.46;
const WALL_Y = BUILDING.y + BUILDING.d * 0.58;
const BLOCK: Plan = { x: PAPER.x + PAPER.w - 52, y: PAPER.y + 6, w: 42, d: 16, r: 0 };

export const BED_ART = {
  glass: solid(GLASS, 0, GLASS_H, 6, 0.4),
  glassLine: planOutline(insetPlan(GLASS, 2.2), GLASS_H, P),
  paper: solid(PAPER, PAPER_Z, PAPER_H, 4),
  margin: planOutline(insetPlan(PAPER, 5), PAPER_TOP, P),
  building: planOutline(BUILDING, PAPER_TOP, P),
  wallX: onTop([[WALL_X, BUILDING.y], [WALL_X, BUILDING.y + BUILDING.d]], PAPER_TOP, P),
  wallY: onTop([[BUILDING.x, WALL_Y], [WALL_X, WALL_Y]], PAPER_TOP, P),
  block: planOutline(BLOCK, PAPER_TOP, P),
  blockRule: join([0, 1, 2].map((row) => onTop([[BLOCK.x + 3, BLOCK.y + 4 + row * 3.2], [BLOCK.x + BLOCK.w - 3, BLOCK.y + 4 + row * 3.2]], PAPER_TOP, P))),
};

const STAND: Plan = { x: DIAL_X - 16, y: DIAL_Y - 15, w: 32, d: 30, r: 2.4 };

function dialTicks() {
  const minor: string[] = [];
  const major: string[] = [];
  const outer = DIAL_R - 2.2;
  const count = 24;
  for (let index = 0; index <= count; index++) {
    const angle = NEEDLE_FROM + (index / count) * NEEDLE_SPAN;
    const big = index % 4 === 0;
    const sx = Math.sin(angle);
    const sy = -Math.cos(angle);
    const inner = outer - (big ? 3.1 : 1.6);
    (big ? major : minor).push(onTop([[DIAL_X + sx * inner, DIAL_Y + sy * inner], [DIAL_X + sx * outer, DIAL_Y + sy * outer]], DIAL_TOP, P));
  }
  return { minor: join(minor), major: join(major), ring: ring(DIAL_X, DIAL_Y, outer, DIAL_TOP, 48) };
}

const TICKS = dialTicks();

export const DIAL_ART = {
  stand: solid(STAND, 0, DIAL_Z, 4, 0.5),
  standScrews: [
    at([STAND.x + 3.2, STAND.y + 3.2, DIAL_Z]),
    at([STAND.x + STAND.w - 3.2, STAND.y + 3.2, DIAL_Z]),
    at([STAND.x + 3.2, STAND.y + STAND.d - 3.2, DIAL_Z]),
    at([STAND.x + STAND.w - 3.2, STAND.y + STAND.d - 3.2, DIAL_Z]),
  ],
  column: round(DIAL_X, DIAL_Y, 4.2, 0, DIAL_Z, 20),
  puck: round(DIAL_X, DIAL_Y, DIAL_R, DIAL_Z, DIAL_H, 48),
  bezel: round(DIAL_X, DIAL_Y, DIAL_R + 0.8, DIAL_TOP - 1.6, 1.6, 48),
  knurl: knurl(DIAL_X, DIAL_Y, DIAL_R, DIAL_TOP - 3.2, DIAL_TOP - 0.4, 48, P),
  band: sideArc(DIAL_X, DIAL_Y, DIAL_R, DIAL_TOP - 3.2, P, 36),
  face: TICKS.ring,
  hub: ring(DIAL_X, DIAL_Y, 2.4, DIAL_TOP, 16),
  hubDot: at([DIAL_X, DIAL_Y, DIAL_TOP]),
  minor: TICKS.minor,
  major: TICKS.major,
  zero: (() => {
    const sx = Math.sin(NEEDLE_FROM);
    const sy = -Math.cos(NEEDLE_FROM);
    const outer = DIAL_R - 2.2;
    return onTop([[DIAL_X + sx * (outer - 4.2), DIAL_Y + sy * (outer - 4.2)], [DIAL_X + sx * outer, DIAL_Y + sy * outer]], DIAL_TOP, P);
  })(),
  crown: solid({ x: DIAL_X + DIAL_R - 0.4, y: DIAL_Y - 2.6, w: 5, d: 5.2, r: 1.3 }, DIAL_Z + 1.6, 4.6, 3, 0.3),
  crownCap: round(DIAL_X + DIAL_R + 4.2, DIAL_Y, 2.5, DIAL_Z + 2.2, 3.4, 16),
  crownKnurl: knurl(DIAL_X + DIAL_R + 4.2, DIAL_Y, 2.5, DIAL_Z + 2.2, DIAL_Z + 5.6, 14, P),
};

export function needlePath(mm: number) {
  const share = Math.min(1, Math.max(0, mm / TRAVEL_MM));
  const angle = NEEDLE_FROM + share * NEEDLE_SPAN;
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  const outer = DIAL_R - 2.2;
  return onTop(
    [
      [DIAL_X + sx * 2.4, DIAL_Y + sy * 2.4],
      [DIAL_X + sx * outer, DIAL_Y + sy * outer],
    ],
    DIAL_TOP,
    P,
  );
}
