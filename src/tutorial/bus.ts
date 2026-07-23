// Tiny event bus connecting app actions to the tutorial runner. Keeps the
// tutorial framework fully data-driven: tutorials are JSON step lists that
// wait for these events (§6).

export interface TutorialEventPayload {
  region?: string
  category?: string
  tool?: string
  colour?: string
}

type Listener = (event: string, payload: TutorialEventPayload) => void

const listeners = new Set<Listener>()

export function onTutorialEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function tutorialEvent(event: string, payload: TutorialEventPayload = {}): void {
  for (const l of [...listeners]) l(event, payload)
}
