/**
 * Lightweight mutable store for owner cursor presence inside the tank volume.
 * Updated by CameraRig pointer handlers and read smoothly in movementSystem
 * without triggering React re-renders.
 */
export const pointerState = {
  active: false,
  x: 0,
  y: 0,
  z: 0,
  speed: 0,
  lastMoveAt: 0,
  lastTapAt: 0,
  tapX: 0,
  tapY: 0,
  tapZ: 0,
};
