import { create } from 'zustand'
import type { Profile, ToolId } from '../model/types'
import { ALL_TOOLS, createProfile } from '../model/factories'
import { deleteProfile as dbDeleteProfile, getMeta, listProfiles, saveProfile, setMeta } from '../db'
import { getTutorial, listTutorials, type TutorialDef } from '../packs/loader'
import { onTutorialEvent, type TutorialEventPayload } from '../tutorial/bus'

export type Screen = 'landing' | 'figure-select' | 'board' | 'finish' | 'export' | 'gallery'

interface AppState {
  booted: boolean
  screen: Screen
  profiles: Profile[]
  activeProfileId: string | null

  // Tutorial runner state (T1) — data-driven, reads pack JSON only.
  activeTutorial: TutorialDef | null
  tutorialStep: number
  tutorialCounter: number

  boot(): Promise<void>
  navigate(screen: Screen): void
  addProfile(name: string, icon: string, colour: string): Promise<Profile>
  selectProfile(id: string): void
  patchProfile(id: string, fn: (p: Profile) => Profile): void
  removeProfile(id: string): Promise<void>
  unlockEverything(): void

  activeProfile(): Profile | null
  hasTool(tool: ToolId): boolean
  nextTutorialFor(profile: Profile): TutorialDef | null
  startTutorial(id: string): void
  skipTutorial(): void
  dismissTutorial(): void
}

export const useApp = create<AppState>((set, get) => {
  function completeTutorial(skipped: boolean) {
    const { activeTutorial, activeProfileId } = get()
    if (!activeTutorial || !activeProfileId) return
    // Skipping still unlocks the tools (§6 rule 2).
    get().patchProfile(activeProfileId, (p) => ({
      ...p,
      tutorialProgress: {
        completed: skipped
          ? p.tutorialProgress.completed
          : [...new Set([...p.tutorialProgress.completed, activeTutorial.id])],
        skipped: skipped
          ? [...new Set([...p.tutorialProgress.skipped, activeTutorial.id])]
          : p.tutorialProgress.skipped
      },
      unlockedTools: [...new Set([...p.unlockedTools, ...(activeTutorial.unlocksTools as ToolId[])])]
    }))
    set({ activeTutorial: null, tutorialStep: 0, tutorialCounter: 0 })
  }

  onTutorialEvent((event: string, payload: TutorialEventPayload) => {
    const { activeTutorial, tutorialStep, tutorialCounter } = get()
    if (!activeTutorial) return
    const step = activeTutorial.steps[tutorialStep]
    if (!step || step.waitFor.event !== event) return
    if (step.waitFor.region && step.waitFor.region !== payload.region) return
    const needed = step.waitFor.count ?? 1
    if (tutorialCounter + 1 < needed) {
      set({ tutorialCounter: tutorialCounter + 1 })
      return
    }
    if (tutorialStep + 1 >= activeTutorial.steps.length) {
      completeTutorial(false)
    } else {
      set({ tutorialStep: tutorialStep + 1, tutorialCounter: 0 })
    }
  })

  return {
    booted: false,
    screen: 'landing',
    profiles: [],
    activeProfileId: null,
    activeTutorial: null,
    tutorialStep: 0,
    tutorialCounter: 0,

    async boot() {
      const profiles = await listProfiles()
      const activeProfileId = (await getMeta('activeProfileId')) ?? null
      set({
        profiles,
        activeProfileId: profiles.some((p) => p.id === activeProfileId) ? activeProfileId : null,
        booted: true
      })
    },

    navigate(screen) { set({ screen }) },

    async addProfile(name, icon, colour) {
      const profile = createProfile(name, icon, colour)
      await saveProfile(profile)
      set((s) => ({ profiles: [...s.profiles, profile], activeProfileId: profile.id }))
      void setMeta('activeProfileId', profile.id)
      return profile
    },

    selectProfile(id) {
      set({ activeProfileId: id })
      void setMeta('activeProfileId', id)
    },

    patchProfile(id, fn) {
      set((s) => {
        const profiles = s.profiles.map((p) => (p.id === id ? fn(p) : p))
        const updated = profiles.find((p) => p.id === id)
        if (updated) void saveProfile(updated)
        return { profiles }
      })
    },

    async removeProfile(id) {
      await dbDeleteProfile(id)
      set((s) => ({
        profiles: s.profiles.filter((p) => p.id !== id),
        activeProfileId: s.activeProfileId === id ? null : s.activeProfileId
      }))
    },

    /** Parental gate action: unlock everything at once (§6 rule 3). */
    unlockEverything() {
      const { activeProfileId } = get()
      if (!activeProfileId) return
      get().patchProfile(activeProfileId, (p) => ({
        ...p,
        unlockedTools: [...ALL_TOOLS]
      }))
    },

    activeProfile() {
      const { profiles, activeProfileId } = get()
      return profiles.find((p) => p.id === activeProfileId) ?? null
    },

    hasTool(tool) {
      return get().activeProfile()?.unlockedTools.includes(tool) ?? false
    },

    /** First tutorial whose prerequisite is met and that hasn't been done/skipped. */
    nextTutorialFor(profile) {
      const done = new Set([...profile.tutorialProgress.completed, ...profile.tutorialProgress.skipped])
      for (const t of listTutorials()) {
        if (done.has(t.id)) continue
        if (t.requires && !done.has(t.requires)) continue
        return t
      }
      return null
    },

    startTutorial(id) {
      const tutorial = getTutorial(id)
      if (tutorial) set({ activeTutorial: tutorial, tutorialStep: 0, tutorialCounter: 0 })
    },

    skipTutorial() { completeTutorial(true) },
    dismissTutorial() { set({ activeTutorial: null, tutorialStep: 0, tutorialCounter: 0 }) }
  }
})
