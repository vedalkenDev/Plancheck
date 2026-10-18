import { boxCorners, fitProjection, iso, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";
import { TRAVEL_MM, xOf } from "./model";

export const WIDTH = 680;
export const HEIGHT = 400;
export const AZIMUTH = 50;

export const BASE: Plan = { x: -168, y: -96, w: 340, d: 184, r: 10 };
export const BASE_H = 10;
export const FOOT_H = 5;

export const GLASS: Plan = { x: -132, y: -50, w: 228, d: 112, r: 2 };
export const GLASS_H = 3.4;

export const PAPER: Plan = { x: -122, y: -40, w: 208, d: 94, r: 0.4 };
export const PAPER_Z = GLASS_H;
export const PAPER_H = 0.7;
export const PAPER_TOP = PAPER_Z + PAPER_H;

export const RAIL: Plan = { x: -150, y: -84, w: 262, d: 14, r: 2 };
export const RAIL_Z = 0;
export const RAIL_H = 8;
export const RAIL_TOP = RAIL_Z + RAIL_H;
export const RAIL_FRONT = RAIL.y + RAIL.d;

export const POST_W = 16;
export const POST_D = 18;
export const POST_Y = RAIL.y - 2;
export const POST_XS = [-156, 100] as const;
export const POST_H = 36;

export const ROD_Y = RAIL.y + RAIL.d / 2;
export const ROD_R = 2.1;
export const ROD_ZS = [RAIL_TOP + 4.2, RAIL_TOP + 11.4] as const;
export const ROD_X0 = POST_XS[0] + POST_W;
export const ROD_X1 = POST_XS[1];

export const HEAD_Y = -2;
export const HEAD_R = 8.5;
export const HEAD_Z = PAPER_TOP + 2.2;
export const HEAD_H = 13;
export const HEAD_TOP = HEAD_Z + HEAD_H;

export const LAMP_R = 5.2;
export const LAMP_H = 3.4;

export const ARM_Z = HEAD_TOP - 6;
export const ARM_H = 5;
export const ARM_W = 8;
export const SPLIT_Y = GLASS.y;

export const DIAL_X = 150;
export const DIAL_Y = 46;
export const DIAL_R = 17;
export const DIAL_Z = 2.4;
export const DIAL_H = 8;
export const DIAL_TOP = DIAL_Z + DIAL_H;
export const NEEDLE_FROM = -2.15;
export const NEEDLE_SPAN = (240 * Math.PI) / 180;

const span = (mm: number): Point3[] => {
  const x = xOf(mm);
  return [
    ...boxCorners({ x: x - HEAD_R, y: HEAD_Y - HEAD_R, w: HEAD_R * 2, d: HEAD_R * 2, r: 0 }, HEAD_Z, HEAD_TOP + LAMP_H),
    ...boxCorners({ x: x - 12, y: ROD_Y - 8, w: 24, d: 16, r: 0 }, RAIL_TOP, ROD_ZS[1] + ROD_R),
  ];
};

export const P: Projection = fitProjection(
  [
    ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...boxCorners({ x: POST_XS[0], y: POST_Y, w: POST_XS[1] + POST_W - POST_XS[0], d: POST_D, r: 0 }, 0, POST_H),
    ...boxCorners({ x: DIAL_X - DIAL_R - 4, y: DIAL_Y - DIAL_R - 4, w: DIAL_R * 2 + 16, d: DIAL_R * 2 + 8, r: 0 }, 0, DIAL_TOP + 4),
    ...span(0),
    ...span(TRAVEL_MM),
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: AZIMUTH },
);

export const at = (point: Point3) => iso(point, P);
