export type StatusKind = 'running' | 'success' | 'failure' | 'idle'

/** Colour class of a node status. IDLE_FROM_* is a node that went idle: it is idle, not its last result. */
export function statusKind(status?: string): StatusKind {
  switch (status) {
    case 'RUNNING': return 'running'
    case 'SUCCESS': return 'success'
    case 'FAILURE': return 'failure'
    default: return 'idle'
  }
}
