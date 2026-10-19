export type StatusKind = 'running' | 'success' | 'failure' | 'idle'

/**
 * Colour class of a node status. IDLE_FROM_SUCCESS and IDLE_FROM_FAILURE keep the colour of the
 * last result, shown faded (see `isFaded`). IDLE_FROM_RUNNING is idle: a node that is not running
 * must not look active.
 */
export function statusKind(status?: string): StatusKind {
  switch (status) {
    case 'RUNNING': return 'running'
    case 'SUCCESS':
    case 'IDLE_FROM_SUCCESS': return 'success'
    case 'FAILURE':
    case 'IDLE_FROM_FAILURE': return 'failure'
    default: return 'idle'
  }
}

/** True for a node that finished and went idle: it keeps its last result colour, dimmed. */
export function isFaded(status?: string): boolean {
  return status === 'IDLE_FROM_SUCCESS' || status === 'IDLE_FROM_FAILURE'
}
