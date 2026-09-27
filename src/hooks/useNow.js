import { useSyncExternalStore } from 'react'

/*
  A clock is an external system, so it is read with useSyncExternalStore rather
  than a setInterval + setState pair. That keeps the value out of React state
  entirely: no impure Date.now() call during render, and no setState inside an
  effect.

  getSnapshot has to return the same value for as long as nothing has ticked,
  otherwise React sees a "change" on every render and loops. So the current
  time is cached in module scope and only the interval writes to it.
*/

/* Countdown labels are in whole minutes, so 15s is finer than the display needs. */
const TICK_MS = 15_000

const listeners = new Set()

let cachedNow = Date.now()
let timer = null

function tick() {
  cachedNow = Date.now()
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)

  if (!timer) {
    /*
      Resuming from a stopped clock. Refresh before React's post-subscribe
      check so a component mounted after a gap does not render stale time.
    */
    cachedNow = Date.now()
    timer = setInterval(tick, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot() {
  return cachedNow
}

/*
  Pass an explicit `now` to a component instead of calling this when a parent
  already has a tick, so one clock drives a whole screen.
*/
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
