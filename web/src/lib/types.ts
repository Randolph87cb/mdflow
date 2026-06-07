export type WorkflowSummary = {
  workflow_id: string;
  name?: string | null;
  node_count: number;
  latest_run?: {
    run_id: string;
    status: string;
    started_at: string;
  } | null;
};

export type WorkflowDetail = {
  workflow_id: string;
  name?: string | null;
  entry: string;
  model: Record<string, unknown>;
  final_outputs: string[];
  workflow_path: string;
  body: string;
  node_count: number;
};

export type GraphNode = {
  id: string;
  name: string;
  type: string;
  produces?: string | null;
  status?: string;
  attempts?: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: string;
  label?: string | null;
};

export type NodeSummary = {
  id: string;
  name?: string | null;
  type: string;
  produces?: string | null;
  next?: string | null;
  retry?: { max_attempts: number } | null;
  default_next?: string | null;
  routes?: Array<{ source: string; operator: string; value: unknown; next: string }>;
  path: string;
};

export type RunSummary = {
  run_id: string;
  status: string;
  current_node?: string | null;
  started_at: string;
  finished_at?: string | null;
  source_run_id?: string | null;
  rerun_from_node?: string | null;
};

export type RunDetail = {
  meta: Record<string, any>;
  state: Record<string, any>;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  outputs: OutputEntry[];
  workflow_source_dir: string;
  snapshot_dir?: string | null;
};

export type NodeInspectorData = {
  node: {
    id: string;
    type: string;
    name?: string | null;
    produces?: string | null;
    next?: string | null;
  };
  source: {
    path: string;
    content: string;
  };
  trace: {
    attempt: number;
    input?: string | null;
    prompt?: string | null;
    stdout?: string | null;
    stderr?: string | null;
    output?: string | null;
    route_selected?: {
      selected_next?: string | null;
      route_source?: string | null;
      route_operator?: string | null;
    } | null;
  };
};

export type OutputEntry = {
  name: string;
  path: string;
  previewable: boolean;
  size: number;
};

export type OutputPreview = {
  name: string;
  path: string;
  previewable: boolean;
  content?: string;
};

export type SystemStatus = {
  project_root: string;
  workflows_dir: string;
  runs_dir: string;
  frontend_built: boolean;
};
