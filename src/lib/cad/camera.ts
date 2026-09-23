export type Camera = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Frame = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function fitCamera(frame: Frame, viewW: number, viewH: number, pad = 0.08): Camera {
  const contentW = Math.max(frame.maxX - frame.minX, 1);
  const contentH = Math.max(frame.maxY - frame.minY, 1);
  const paddedW = contentW * (1 + pad * 2);
  const paddedH = contentH * (1 + pad * 2);
  const viewAspect = viewW / Math.max(viewH, 1);
  const contentAspect = paddedW / paddedH;
  const width = contentAspect > viewAspect ? paddedW : paddedH * viewAspect;
  const height = width / viewAspect;
  const centerX = (frame.minX + frame.maxX) / 2;
  const centerY = (frame.minY + frame.maxY) / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function panCamera(
  camera: Camera,
  dxPx: number,
  dyPx: number,
  viewW: number,
  viewH: number,
): Camera {
  return {
    x: camera.x - dxPx * (camera.width / viewW),
    y: camera.y - dyPx * (camera.height / viewH),
    width: camera.width,
    height: camera.height,
  };
}

export function zoomCamera(
  camera: Camera,
  factor: number,
  cursorX: number,
  cursorY: number,
  viewW: number,
  viewH: number,
): Camera {
  const u = cursorX / viewW;
  const v = cursorY / viewH;
  const worldX = camera.x + u * camera.width;
  const worldY = camera.y + v * camera.height;
  const width = camera.width / factor;
  const height = camera.height / factor;
  return {
    x: worldX - u * width,
    y: worldY - v * height,
    width,
    height,
  };
}

export function resizeCamera(
  camera: Camera,
  previousViewW: number,
  viewW: number,
  viewH: number,
): Camera {
  const worldPerPx = camera.width / previousViewW;
  const width = viewW * worldPerPx;
  const height = viewH * worldPerPx;
  const centerX = camera.x + camera.width / 2;
  const centerY = camera.y + camera.height / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function clampZoom(camera: Camera, frame: Frame, next: Camera): Camera {
  const span = Math.max(frame.maxX - frame.minX, frame.maxY - frame.minY, 1);
  if (next.width < span / 80 || next.width > span * 24) {
    return camera;
  }
  return next;
}

export function cameraViewBox(camera: Camera) {
  return `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;
}
