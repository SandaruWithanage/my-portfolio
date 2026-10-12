export const MODULE_SPACING = 3.6

/** X position of module `index` out of `count`, centred on the origin. */
export function moduleX(index: number, count: number, spacing = MODULE_SPACING): number {
  return (index - (count - 1) / 2) * spacing
}

/** Camera distance that keeps `count` modules in frame. */
export function homeDistance(count: number): number {
  return 8 + Math.max(0, count - 1) * 1.6
}
