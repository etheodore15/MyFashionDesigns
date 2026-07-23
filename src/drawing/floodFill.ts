// Scanline flood fill used to RENDER 'fill' strokes. The stored data stays
// vector (a fill stroke is just its tap point + colour); rasterisation only
// ever happens at render time (Rule 1).

export function floodFill(ctx: CanvasRenderingContext2D, px: number, py: number, colour: string): void {
  const { width, height } = ctx.canvas
  const x0 = Math.round(px)
  const y0 = Math.round(py)
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return

  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  const idx = (x: number, y: number) => (y * width + x) * 4

  const target = data.slice(idx(x0, y0), idx(x0, y0) + 4)
  const fill = parseColour(ctx, colour)
  if (!fill) return
  if (same(target, fill, 8)) return

  const TOL = 40
  const matches = (i: number) =>
    Math.abs(data[i] - target[0]) <= TOL &&
    Math.abs(data[i + 1] - target[1]) <= TOL &&
    Math.abs(data[i + 2] - target[2]) <= TOL &&
    Math.abs(data[i + 3] - target[3]) <= TOL

  const stack: number[] = [x0, y0]
  const visited = new Uint8Array(width * height)
  while (stack.length) {
    const y = stack.pop()!
    let x = stack.pop()!
    while (x >= 0 && matches(idx(x, y)) && !visited[y * width + x]) x--
    x++
    let spanUp = false
    let spanDown = false
    while (x < width && matches(idx(x, y)) && !visited[y * width + x]) {
      const i = idx(x, y)
      data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = 255
      visited[y * width + x] = 1
      if (y > 0) {
        const up = matches(idx(x, y - 1)) && !visited[(y - 1) * width + x]
        if (up && !spanUp) { stack.push(x, y - 1); spanUp = true }
        if (!up) spanUp = false
      }
      if (y < height - 1) {
        const down = matches(idx(x, y + 1)) && !visited[(y + 1) * width + x]
        if (down && !spanDown) { stack.push(x, y + 1); spanDown = true }
        if (!down) spanDown = false
      }
      x++
    }
  }
  ctx.putImageData(image, 0, 0)
}

function same(a: ArrayLike<number>, b: ArrayLike<number>, tol: number): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= tol
}

function parseColour(ctx: CanvasRenderingContext2D, colour: string): [number, number, number, number] | null {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const pctx = probe.getContext('2d')!
  pctx.fillStyle = colour
  pctx.fillRect(0, 0, 1, 1)
  const d = pctx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2], d[3]]
}
