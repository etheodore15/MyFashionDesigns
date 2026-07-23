// All persistence is IndexedDB via idb (webview-safety rules, §2) — never
// web storage. Closing and reopening the browser loses nothing.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Design, Profile } from '../model/types'

interface YdrlDB extends DBSchema {
  profiles: { key: string; value: Profile }
  designs: {
    key: string
    value: Design
    indexes: { 'by-profile': string }
  }
  meta: { key: string; value: { key: string; value: string } }
}

let dbPromise: Promise<IDBPDatabase<YdrlDB>> | null = null

function db(): Promise<IDBPDatabase<YdrlDB>> {
  if (!dbPromise) {
    dbPromise = openDB<YdrlDB>('your-drawings-real-life', 1, {
      upgrade(database) {
        database.createObjectStore('profiles', { keyPath: 'id' })
        const designs = database.createObjectStore('designs', { keyPath: 'id' })
        designs.createIndex('by-profile', 'profileId')
        database.createObjectStore('meta', { keyPath: 'key' })
      }
    })
  }
  return dbPromise
}

export async function listProfiles(): Promise<Profile[]> {
  return (await (await db()).getAll('profiles')).sort((a, b) => a.created - b.created)
}

export async function saveProfile(profile: Profile): Promise<void> {
  await (await db()).put('profiles', profile)
}

export async function deleteProfile(id: string): Promise<void> {
  const database = await db()
  const designs = await database.getAllKeysFromIndex('designs', 'by-profile', id)
  const tx = database.transaction(['profiles', 'designs'], 'readwrite')
  await tx.objectStore('profiles').delete(id)
  for (const key of designs) await tx.objectStore('designs').delete(key)
  await tx.done
}

export async function listDesigns(profileId: string): Promise<Design[]> {
  const all = await (await db()).getAllFromIndex('designs', 'by-profile', profileId)
  return all.sort((a, b) => b.modified - a.modified)
}

export async function getDesign(id: string): Promise<Design | undefined> {
  return (await db()).get('designs', id)
}

export async function saveDesign(design: Design): Promise<void> {
  await (await db()).put('designs', design)
}

export async function deleteDesign(id: string): Promise<void> {
  await (await db()).delete('designs', id)
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await (await db()).get('meta', key))?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await (await db()).put('meta', { key, value })
}
