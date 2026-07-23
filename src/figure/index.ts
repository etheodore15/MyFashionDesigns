import type { FigureAdapter } from './adapter'
import { RasterFigureAdapter, listFigureDescriptors } from './rasterAdapter'

export type { FigureAdapter, Context, Tone, FigureDescriptor } from './adapter'

const cache = new Map<string, Promise<FigureAdapter>>()

/**
 * The only way the rest of the app obtains a figure adapter. Swapping the
 * implementation happens here and nowhere else (Rule 3 / acceptance §13).
 */
export function getFigureAdapter(figureId: string): Promise<FigureAdapter> {
  let p = cache.get(figureId)
  if (!p) {
    p = RasterFigureAdapter.load(figureId)
    cache.set(figureId, p)
  }
  return p
}

export function listFigures(orderedIds?: string[]): { id: string; name: string }[] {
  const all = listFigureDescriptors().map((d) => ({ id: d.id, name: d.name }))
  if (!orderedIds) return all
  // Present figures in pack-manifest order (§9: the pack loader decides
  // which figures exist; the adapter only reads their assets).
  return orderedIds
    .map((id) => all.find((f) => f.id === id))
    .filter((f): f is { id: string; name: string } => Boolean(f))
}
