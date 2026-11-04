import type { Command, Snapshot } from './types'

type ViewListener = (snapshot: Snapshot) => void
type CommandListener = (command: Command) => void

const viewListeners = new Set<ViewListener>()
const commandListeners = new Set<CommandListener>()
const pending: Command[] = []

export function onView(fn: ViewListener): () => void {
  viewListeners.add(fn)
  return () => viewListeners.delete(fn)
}

export function emitView(snapshot: Snapshot): void {
  for (const fn of viewListeners) fn(snapshot)
}

export function onCommand(fn: CommandListener): () => void {
  commandListeners.add(fn)
  if (pending.length) {
    const queued = pending.splice(0, pending.length)
    for (const command of queued) fn(command)
  }
  return () => commandListeners.delete(fn)
}

export function emitCommand(command: Command): void {
  if (commandListeners.size === 0) {
    pending.push(command)
    return
  }
  for (const fn of commandListeners) fn(command)
}
