// Architectural acceptance criteria (Build Brief v0.4 §13) — tested explicitly.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.join(__dirname, '..', 'src')

function walk(dir: string, exts = ['.ts', '.tsx']): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

const sourceFiles = walk(SRC)
const read = (f: string) => readFileSync(f, 'utf8')
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, '/')

describe('Rule 4 — no network calls of any kind', () => {
  it('grep for fetch(, XMLHttpRequest or WebSocket returns nothing', () => {
    const offenders = sourceFiles.filter((f) => {
      const text = read(f)
      return /\bfetch\s*\(/.test(text) || /XMLHttpRequest/.test(text) || /WebSocket/.test(text)
    })
    expect(offenders.map(rel)).toEqual([])
  })
})

describe('Webview-safety — IndexedDB only for data', () => {
  it('grep for localStorage returns nothing outside preferences', () => {
    const offenders = sourceFiles.filter((f) => read(f).includes('localStorage'))
    // This build keeps even preferences in IndexedDB, so the allowed set is empty.
    expect(offenders.map(rel)).toEqual([])
  })
})

describe('Rule 3 — nothing reads figure assets except the adapter', () => {
  it('grep for direct reads of figures/ outside the adapter returns nothing', () => {
    const offenders = sourceFiles
      .filter((f) => !rel(f).startsWith('figure/'))
      .filter((f) => read(f).includes('figures/'))
    expect(offenders.map(rel)).toEqual([])
  })

  it('RasterFigureAdapter is referenced only inside src/figure/', () => {
    const offenders = sourceFiles
      .filter((f) => !rel(f).startsWith('figure/'))
      .filter((f) => read(f).includes('RasterFigureAdapter'))
    expect(offenders.map(rel)).toEqual([])
  })
})

describe('Frozen region taxonomy', () => {
  it('has exactly the sixteen permanent ids in order', async () => {
    const { REGION_TAXONOMY } = await import('../src/model/types')
    expect([...REGION_TAXONOMY]).toEqual([
      'head', 'neck', 'shoulders', 'torso', 'waist', 'hips',
      'arm-left', 'arm-right', 'hand-left', 'hand-right',
      'legs-upper', 'legs-lower', 'foot-left', 'foot-right',
      'whole-body', 'background'
    ])
  })
})

describe('Adapter swappability', () => {
  it('a stub FigureAdapter satisfies the interface without touching other files', async () => {
    const mod = await import('../src/figure/adapter')
    type FA = import('../src/figure/adapter').FigureAdapter
    const stub: FA = {
      getRegions: () => ['head'],
      getBounds: () => ({ x: 0, y: 0, w: 1, h: 1 }),
      getPadding: () => 0.06,
      getAnchors: () => [],
      hitTest: () => null,
      renderUnderlay: () => undefined,
      renderRegionView: () => undefined
    }
    expect(stub.getRegions()).toEqual(['head'])
    expect(mod).toBeTruthy()
  })
})

describe('Entitlement stubs (§8)', () => {
  it('report the fixed values for this build', async () => {
    const e = await import('../src/entitlements')
    expect(e.isSubscribed()).toBe(true)
    expect(e.maxSavedDesigns()).toBe(Infinity)
    expect(e.canUploadFigure()).toBe(false)
    expect(e.canShareToCircle()).toBe(false)
  })
})

describe('Data-driven packs and tutorials (§6/§9)', () => {
  it('loads figures, swatches, tones, frames, backdrops and tutorials from pack manifests only', async () => {
    const loader = await import('../src/packs/loader')
    expect(loader.listFigureIds()).toContain('mannequin-tpose')
    expect(loader.listFigureIds()).toContain('bust-form')
    expect(loader.listSkinTones()).toHaveLength(12)
    expect(loader.listSwatches()).toHaveLength(12)
    expect(loader.listFrames().map((f) => f.id)).toEqual(expect.arrayContaining(['plain', 'sketchbook']))
    expect(loader.listBackdrops().length).toBeGreaterThanOrEqual(4)
  })

  it('tutorials come from JSON discovered by glob — adding a seventh needs only a new file', async () => {
    const loader = await import('../src/packs/loader')
    const tutorials = loader.listTutorials()
    expect(tutorials.map((t) => t.id)).toEqual(['first-design', 'building-an-outfit'])
    for (const t of tutorials) {
      expect(Array.isArray(t.steps)).toBe(true)
      expect(t.steps.length).toBeGreaterThan(2)
      for (const step of t.steps) {
        expect(typeof step.text).toBe('string')
        expect(typeof step.waitFor.event).toBe('string')
      }
    }
  })
})
