import type { DeformMode, RegionId } from './types'

// deformMode defaults by category (§4). Captured on every item even though
// nothing consumes it in this build.
const FOLLOW = new Set([
  'sleeve', 'top', 'dress', 'jacket', 'skirt', 'trousers', 'tights',
  'hair', 'cape', 'scarf', 'gloves', 'socks', 'shoes', 'freestyle', 'belt'
])
const RIGID = new Set([
  'ring', 'watch', 'earrings', 'glasses', 'necklace', 'bag', 'held',
  'logo', 'text', 'tattoo', 'hat', 'crown'
])

export function deformModeFor(category: string): DeformMode {
  if (RIGID.has(category)) return 'rigid'
  if (FOLLOW.has(category)) return 'follow'
  return 'follow'
}

export interface CategoryDef {
  id: string
  label: string
  icon: string
  /** Extra regions the item spans beyond the tapped one. */
  regions?: RegionId[]
}

const C = (id: string, label: string, icon: string, regions?: RegionId[]): CategoryDef =>
  ({ id, label, icon, regions })

const FREESTYLE = C('freestyle', 'Freestyle', '✏️')

/** Three to four categories per region, plus Freestyle on every region (§7). */
export const REGION_CATEGORIES: Record<RegionId, CategoryDef[]> = {
  head: [C('hair', 'Hair', '💇'), C('hat', 'Hat', '🎩'), C('glasses', 'Glasses', '👓'), FREESTYLE],
  neck: [C('necklace', 'Necklace', '📿'), C('scarf', 'Scarf', '🧣'), FREESTYLE],
  shoulders: [C('jacket', 'Jacket', '🧥', ['shoulders', 'torso', 'waist']), C('cape', 'Cape', '🦸', ['shoulders', 'torso', 'waist', 'hips']), C('sleeve', 'Straps', '🎽'), FREESTYLE],
  torso: [C('top', 'Top', '👚', ['torso', 'waist']), C('dress', 'Dress', '👗', ['torso', 'waist', 'hips']), C('jacket', 'Jacket', '🧥', ['shoulders', 'torso', 'waist']), FREESTYLE],
  waist: [C('belt', 'Belt', '🎀'), C('skirt', 'Skirt', '💃', ['waist', 'hips']), C('top', 'Top', '👚', ['torso', 'waist']), FREESTYLE],
  hips: [C('skirt', 'Skirt', '💃', ['hips', 'legs-upper']), C('trousers', 'Trousers', '👖', ['hips', 'legs-upper', 'legs-lower']), C('dress', 'Dress', '👗', ['torso', 'waist', 'hips']), FREESTYLE],
  'arm-left': [C('sleeve', 'Sleeve', '🎽'), C('tattoo', 'Art', '🎨'), C('watch', 'Bracelet', '⌚'), FREESTYLE],
  'arm-right': [C('sleeve', 'Sleeve', '🎽'), C('tattoo', 'Art', '🎨'), C('watch', 'Bracelet', '⌚'), FREESTYLE],
  'hand-left': [C('gloves', 'Glove', '🧤'), C('ring', 'Ring', '💍'), C('bag', 'Bag', '👜'), FREESTYLE],
  'hand-right': [C('gloves', 'Glove', '🧤'), C('ring', 'Ring', '💍'), C('bag', 'Bag', '👜'), FREESTYLE],
  'legs-upper': [C('trousers', 'Trousers', '👖', ['hips', 'legs-upper', 'legs-lower']), C('skirt', 'Skirt', '💃', ['hips', 'legs-upper']), C('tights', 'Tights', '🩰', ['legs-upper', 'legs-lower']), FREESTYLE],
  'legs-lower': [C('trousers', 'Trousers', '👖', ['hips', 'legs-upper', 'legs-lower']), C('tights', 'Tights', '🩰', ['legs-upper', 'legs-lower']), C('socks', 'Socks', '🧦', ['legs-lower']), FREESTYLE],
  'foot-left': [C('shoes', 'Shoe', '👟'), C('socks', 'Sock', '🧦'), FREESTYLE],
  'foot-right': [C('shoes', 'Shoe', '👟'), C('socks', 'Sock', '🧦'), FREESTYLE],
  'whole-body': [C('dress', 'Outfit', '👗'), C('cape', 'Cape', '🦸'), FREESTYLE],
  background: [FREESTYLE]
}

/** Default z-order on creation: skin → base garments → outer → accessories → hair → held (§5). */
export function defaultZBand(category: string): number {
  switch (category) {
    case 'tattoo': return 10
    case 'tights': case 'socks': return 20
    case 'top': case 'dress': case 'skirt': case 'trousers': case 'sleeve': return 30
    case 'jacket': case 'cape': case 'belt': return 40
    case 'shoes': case 'gloves': case 'scarf': return 45
    case 'necklace': case 'ring': case 'watch': case 'earrings': case 'glasses': case 'crown': return 50
    case 'hair': case 'hat': return 60
    case 'bag': case 'held': return 70
    default: return 35
  }
}
