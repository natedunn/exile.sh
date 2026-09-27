export function pointerAnchor(x: number, y: number) {
  return {
    getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
  }
}
