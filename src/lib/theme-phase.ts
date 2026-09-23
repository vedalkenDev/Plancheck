export const THEME_PHASE_MS = 560;
export const THEME_STAGGER_MS = 640;
const WIDE_SURFACE = 0.72;

type StyleName = "backgroundColor" | "color" | "borderTopColor" | "fill" | "stroke";

type Snap = {
  el: HTMLElement | SVGElement;
  delay: number;
  props: { name: StyleName; from: string; to: string }[];
};

type Wipe = {
  el: HTMLElement | SVGElement;
  from: string;
  to: string;
  delay: number;
  props: { name: StyleName; from: string; to: string }[];
};

let active: Snap[] = [];
let wipes: Wipe[] = [];
let clearTimer = 0;

export function isWideSurface(elementWidth: number, viewportWidth: number) {
  return viewportWidth > 0 && elementWidth >= viewportWidth * WIDE_SURFACE;
}

export function themeDelay(centerX: number, width: number, staggerMs: number) {
  if (width <= 0) {
    return 0;
  }
  const fromRight = Math.min(1, Math.max(0, (width - centerX) / width));
  return fromRight * staggerMs;
}

export function phaseThemeChange(apply: () => void) {
  if (typeof window === "undefined") {
    apply();
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearSnaps(active, wipes);
    active = [];
    wipes = [];
    apply();
    return;
  }

  window.clearTimeout(clearTimer);
  clearSnaps(active, wipes);

  const width = window.innerWidth || 1;
  const nodes = visibleNodes();
  const before = nodes.map((el) => {
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    return {
      el,
      delay: themeDelay(center, width, THEME_STAGGER_MS),
      from: readColors(el),
    };
  });

  apply();

  const next: Snap[] = [];
  const wide: Wipe[] = [];
  for (const item of before) {
    const to = readColors(item.el);
    const props = (Object.keys(item.from) as StyleName[])
      .filter((name) => item.from[name] && item.from[name] !== to[name])
      .map((name) => ({ name, from: item.from[name], to: to[name] }));
    const background = props.find((prop) => prop.name === "backgroundColor");
    const span = item.el.getBoundingClientRect().width;
    if (background && isWideSurface(span, width)) {
      wide.push({
        el: item.el,
        from: background.from,
        to: background.to,
        delay: item.delay,
        props: props.filter((prop) => prop.name !== "backgroundColor"),
      });
      continue;
    }
    if (props.length) {
      next.push({ el: item.el, delay: item.delay, props });
    }
  }

  for (const snap of next) {
    snap.el.style.transition = "none";
    for (const prop of snap.props) {
      writeColor(snap.el, prop.name, prop.from);
    }
  }

  ensureWipeProperty();
  document.documentElement.getBoundingClientRect();
  for (const wipe of wide) {
    wipe.el.style.transition = "none";
    wipe.el.style.setProperty("--theme-wipe", "0%");
    wipe.el.style.backgroundImage = `linear-gradient(to left, ${wipe.to} var(--theme-wipe), ${wipe.from} var(--theme-wipe))`;
    for (const prop of wipe.props) {
      writeColor(wipe.el, prop.name, prop.from);
    }
  }

  document.documentElement.getBoundingClientRect();
  const wipeMs = THEME_PHASE_MS + THEME_STAGGER_MS;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const snap of next) {
        snap.el.style.transition = snap.props
          .map(
            (prop) =>
              `${cssName(prop.name)} ${THEME_PHASE_MS}ms ease ${snap.delay}ms`,
          )
          .join(", ");
        for (const prop of snap.props) {
          writeColor(snap.el, prop.name, prop.to);
        }
      }
      for (const wipe of wide) {
        const parts = [
          `--theme-wipe ${wipeMs}ms linear`,
          ...wipe.props.map(
            (prop) =>
              `${cssName(prop.name)} ${THEME_PHASE_MS}ms ease ${wipe.delay}ms`,
          ),
        ];
        wipe.el.style.transition = parts.join(", ");
        wipe.el.style.setProperty("--theme-wipe", "100%");
        for (const prop of wipe.props) {
          writeColor(wipe.el, prop.name, prop.to);
        }
      }
    });
  });

  active = next;
  wipes = wide;
  clearTimer = window.setTimeout(() => {
    clearSnaps(active, wipes);
    active = [];
    wipes = [];
  }, THEME_PHASE_MS + THEME_STAGGER_MS + 80);
}

function visibleNodes() {
  const nodes: (HTMLElement | SVGElement)[] = [];
  const root = [document.documentElement, document.body, ...document.body.querySelectorAll("*")];
  for (const node of root) {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
      continue;
    }
    if (node instanceof HTMLElement && ["SCRIPT", "STYLE"].includes(node.tagName)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width < 0.5 && rect.height < 0.5) {
      continue;
    }
    nodes.push(node);
  }
  return nodes;
}

function readColors(el: HTMLElement | SVGElement) {
  const style = getComputedStyle(el);
  const colors: Record<StyleName, string> = {
    backgroundColor: style.backgroundColor,
    color: style.color,
    borderTopColor: style.borderTopColor,
    fill: "",
    stroke: "",
  };
  if (el instanceof SVGElement) {
    colors.fill = style.fill;
    colors.stroke = style.stroke;
  }
  return colors;
}

function writeColor(el: HTMLElement | SVGElement, name: StyleName, value: string) {
  if (name === "borderTopColor") {
    el.style.borderColor = value;
    return;
  }
  el.style[name] = value;
}

function cssName(name: StyleName) {
  if (name === "backgroundColor") {
    return "background-color";
  }
  if (name === "borderTopColor") {
    return "border-color";
  }
  return name;
}

function ensureWipeProperty() {
  if (document.getElementById("theme-wipe-prop")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "theme-wipe-prop";
  style.textContent =
    "@property --theme-wipe { syntax: \"<percentage>\"; inherits: false; initial-value: 0%; }";
  document.head.appendChild(style);
}

function clearSnaps(snaps: Snap[], wiped: Wipe[]) {
  for (const snap of snaps) {
    snap.el.style.transition = "";
    snap.el.style.backgroundColor = "";
    snap.el.style.color = "";
    snap.el.style.borderColor = "";
    snap.el.style.fill = "";
    snap.el.style.stroke = "";
  }
  for (const wipe of wiped) {
    wipe.el.style.transition = "";
    wipe.el.style.backgroundImage = "";
    wipe.el.style.color = "";
    wipe.el.style.borderColor = "";
    wipe.el.style.removeProperty("--theme-wipe");
  }
}
