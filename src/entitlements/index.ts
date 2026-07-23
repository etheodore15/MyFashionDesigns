// Entitlement stubs (§8). Every gate-able feature calls these rather than
// testing a flag inline — the call sites are what matter in this build.

export function isSubscribed(): boolean {
  return true // hardcoded in this build
}

export function maxSavedDesigns(): number {
  return Infinity // no limits enforced in this build
}

export function canUploadFigure(): boolean {
  return false
}

export function canShareToCircle(): boolean {
  return false
}
