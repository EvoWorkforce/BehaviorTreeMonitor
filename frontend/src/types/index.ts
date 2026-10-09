/** Behavior tree node type */
export type BtNodeType =
  | 'root'
  | 'sequence'
  | 'fallback'
  | 'parallel'
  | 'decorator'
  | 'action'
  | 'condition'
  | 'subtree'

/** Node status */
export type NodeStatusStr =
  | 'IDLE'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILURE'
  | 'SKIPPED'
  | 'IDLE_FROM_SUCCESS'
  | 'IDLE_FROM_FAILURE'
  | 'IDLE_FROM_RUNNING'
  | 'UNKNOWN'

/** Port */
export interface NodePort {
  name: string
  value: string
  isOutput: boolean
}

/** Parsed tree node */
export interface TreeNode {
  tag: string
  name: string
  uid: string
  type: BtNodeType
  attributes: Record<string, string>
  children: TreeNode[]
  isSubtreeContainer?: boolean
  subtreeId?: string
  expanded?: boolean
  x: number
  y: number
  width: number
  depth: number
  subtreeWidth: number
  subtreeHeight: number
  treeWidth?: number
  treeHeight?: number
}

/** WebSocket message */
export interface WsMessage {
  type: string
  connected?: boolean
  tree_xml?: string | null
  tree_uuid?: string | null
  data?: Record<string, string> | string | null
  message?: string
}

/** Decoded blackboard: instance name -> key -> JSON value */
export type BlackboardMap = Record<string, Record<string, unknown>>

/** One recorded node status change; timestamp_us is absolute (epoch) */
export interface TransitionRecord {
  timestamp_us: number
  uid: number
  status: NodeStatusStr
}

/** Server -> client: blackboard poll result */
export interface BlackboardMessage {
  type: 'blackboard'
  data: BlackboardMap | null
}

/** Server -> client: recording state */
export interface RecordingMessage {
  type: 'recording'
  active: boolean
  start_epoch_us: number
}

/** Server -> client: transitions read since the previous poll */
export interface TransitionsMessage {
  type: 'transitions'
  data: TransitionRecord[]
}

/** Client -> server messages added for the blackboard rail and the timeline */
export type ClientMessage =
  | { type: 'set_blackboard_target'; names: string }
  | { type: 'record_start' }
  | { type: 'record_stop' }
