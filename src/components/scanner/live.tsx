"use client";

import { IsoFigure } from "@/components/iso/draw";
import { translateAlong } from "@/components/iso/iso-kit";
import { follow, useInView, useLoop, useReadout } from "@/components/iso/live";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { needlePath } from "./geometry";
import { TRAVEL_MM, X_MIN, clockAt, mmAt, readoutOf, xOf } from "./model";
import { HEIGHT, P, WIDTH } from "./view";

type Dir = 1 | -1;

interface ScanState {
  mm: number;
  target: number;
  clock: number;
  dir: Dir;
  touring: boolean;
  holding: boolean;
  idle: number;
}

const LABEL = "A flatbed scanner reading a drawing. Its head travels a 240 millimetre window, and the dial shows the same distance.";

function described(mm: number) {
  return `Scan at ${readoutOf(mm).replace("scan ", "")}`;
}

export function ScannerLive({
  base,
  rail,
  carriageBack,
  bed,
  carriageFront,
  dial,
}: {
  base: ReactNode;
  rail: ReactNode;
  carriageBack: ReactNode;
  bed: ReactNode;
  carriageFront: ReactNode;
  dial: ReactNode;
}) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const back = useRef<SVGGElement>(null);
  const front = useRef<SVGGElement>(null);
  const needle = useRef<SVGPathElement>(null);
  const state = useRef<ScanState>({
    mm: 0,
    target: 0,
    clock: 0,
    dir: 1,
    touring: true,
    holding: false,
    idle: 0,
  });
  const visible = useInView(anchor);

  function paint(mm: number) {
    const shift = translateAlong(P, [xOf(mm), 0, 0]);
    back.current?.setAttribute("transform", shift);
    front.current?.setAttribute("transform", shift);
    needle.current?.setAttribute("d", needlePath(mm));
    say(readoutOf(mm));
  }

  function writeValue(mm: number) {
    const node = anchor.current;
    if (!node) return;
    node.setAttribute("aria-valuenow", String(Math.round(mm)));
    node.setAttribute("aria-valuetext", described(mm));
  }

  const kick = useLoop((dt, calm) => {
    const scan = state.current;
    if (calm) {
      scan.touring = false;
      scan.mm = scan.target;
      paint(scan.mm);
      return false;
    }
    if (scan.touring) {
      scan.clock += dt;
      const next = mmAt(scan.clock);
      scan.dir = next + 1e-6 >= scan.mm ? 1 : -1;
      scan.mm = next;
      scan.target = next;
    } else {
      scan.idle += dt;
      scan.mm = follow(scan.mm, scan.target, dt, 0.22, false);
      if (!scan.holding && scan.idle > 3.6 && scan.mm === scan.target) {
        scan.touring = true;
        scan.clock = clockAt(scan.mm, scan.dir);
      }
    }
    paint(scan.mm);
    return scan.touring || scan.mm !== scan.target || (!scan.holding && scan.idle <= 3.6);
  }, visible);

  function take(mm: number) {
    const scan = state.current;
    const next = Math.min(TRAVEL_MM, Math.max(0, mm));
    scan.holding = true;
    scan.touring = false;
    scan.idle = 0;
    scan.dir = next >= scan.mm ? 1 : -1;
    scan.target = next;
    scan.clock = clockAt(scan.mm, scan.dir);
    kick();
  }

  function mmFrom(event: PointerEvent) {
    const svg = anchor.current?.querySelector("svg");
    if (!svg) return state.current.mm;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return state.current.mm;
    return ((event.clientX - rect.left) / rect.width) * TRAVEL_MM;
  }

  function release() {
    const scan = state.current;
    scan.holding = false;
    scan.idle = 0;
    scan.clock = clockAt(scan.mm, scan.dir);
    writeValue(scan.mm);
    kick();
  }

  function onKey(event: KeyboardEvent) {
    const scan = state.current;
    const step = event.shiftKey ? 40 : 10;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = scan.mm + step;
    else if (event.key === "ArrowLeft") next = scan.mm - step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TRAVEL_MM;
    else return;
    event.preventDefault();
    take(next);
    scan.holding = false;
    writeValue(Math.min(TRAVEL_MM, Math.max(0, next)));
  }

  const rest = translateAlong(P, [X_MIN, 0, 0]);

  return (
    <div
      ref={anchor}
      className="scan-stage"
      tabIndex={0}
      role="slider"
      aria-label={LABEL}
      aria-valuemin={0}
      aria-valuemax={TRAVEL_MM}
      aria-valuenow={0}
      aria-valuetext={described(0)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        take(mmFrom(event));
      }}
      onPointerMove={(event) => {
        if (state.current.holding) take(mmFrom(event));
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={onKey}
      onFocus={() => writeValue(state.current.mm)}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
        {base}
        {rail}
        <g ref={back} transform={rest}>
          {carriageBack}
        </g>
        {bed}
        <g ref={front} transform={rest}>
          {carriageFront}
        </g>
        {dial}
        <path ref={needle} className="iso-line" data-tone="hi" d={needlePath(0)} />
      </IsoFigure>
    </div>
  );
}
