// Candy Wall: shared dimensions (centimetres) and device flags.
export const BG = 0x040405;
export const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
export const PARAMS = new URLSearchParams(location.search);
export const TEST = PARAMS.has('test');

export const WALL = { cols: 8, rows: 6, cellW: 19.5, cellH: 19.5, z: -100, y0: 30, counterY: 19, counterD: 46 };
export const TRAY = { cols: 4, rows: 3, cell: 7.6, wall: 0.28, depth: 3.1, lip: 0.5 };
export const TABLE = { w: 170, d: 96, y: 0 };
export const HEAD_Z = -34;
export const BINBOX = { w: 18.0, d: 12.4, fill: 9.6 };
export const BIN = { w: 18.6, y: 2.8, h: 16, z0: 0.2, hingeZ: 7, noseZ: 16, noseY: 7.2, frontZ: 12.8 };
