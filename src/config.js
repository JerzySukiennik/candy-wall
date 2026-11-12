// Candy Wall: shared dimensions (centimetres) and device flags.
export const BG = 0x040405;
export const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
export const PARAMS = new URLSearchParams(location.search);
export const TEST = PARAMS.has('test');

export const WALL = { cols: 12, rows: 4, cellW: 15, cellH: 24, z: -100, y0: 30, counterY: 19, counterD: 34 };
export const TRAY = { cols: 4, rows: 3, cell: 7.6, wall: 0.28, depth: 3.1, lip: 0.5 };
export const TABLE = { w: 170, d: 96, y: 0 };
export const HEAD_Z = -34;
