// Skin-tone tinting. Parts are authored neutral greyscale and tinted at
// runtime (§3).
//
// Tinting the finished composite rather than each part is both correct and
// far cheaper: source-over blending is linear in colour, so multiplying the
// blended result by the tone equals multiplying every contribution by it.
// The naive per-part approach needed one full-size cached canvas per part per
// tone — with ten figures that is gigabytes of bitmaps on a phone.

let scratchA: HTMLCanvasElement | null = null
let scratchB: HTMLCanvasElement | null = null

function scratch(which: 'a' | 'b', width: number, height: number): HTMLCanvasElement {
  let canvas = which === 'a' ? scratchA : scratchB
  if (!canvas) {
    canvas = document.createElement('canvas')
    if (which === 'a') scratchA = canvas
    else scratchB = canvas
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return canvas
}

/**
 * Multiply-tint everything already drawn on `canvas`, preserving its alpha.
 * The canvas must contain only the artwork to tint.
 */
export function tintInPlace(canvas: HTMLCanvasElement, tone: string): void {
  const { width, height } = canvas
  if (!width || !height) return
  const ctx = canvas.getContext('2d')!

  // Keep the untinted alpha as a mask: multiply alone would paint the tone
  // across transparent pixels too.
  const mask = scratch('b', width, height)
  const maskCtx = mask.getContext('2d')!
  maskCtx.clearRect(0, 0, width, height)
  maskCtx.drawImage(canvas, 0, 0)

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tone
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.restore()
}

/** A reusable working canvas for composing artwork before it is tinted. */
export function workCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = scratch('a', width, height)
  canvas.getContext('2d')!.clearRect(0, 0, width, height)
  return canvas
}
