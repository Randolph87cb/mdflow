import type {
  NodeInspectorData,
  NodeSummary,
  OutputEntry,
  OutputPreview,
  RunDetail,
  RunSummary,
  SystemStatus,
  WorkflowDetail,
  WorkflowSummary,
} from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export const studioApi = {
  getSystemStatus: () => api<SystemStatus>("/api/system/status"),
  listWorkflows: () => api<WorkflowSummary[]>("/api/workflows"),
  getWorkflow: (workflowId: string) => api<WorkflowDetail>(`/api/workflows/${workflowId}`),
  getWorkflowGraph: (workflowId: string) =>
    api<{ nodes: any[]; edges: any[] }>(`/api/workflows/${workflowId}/graph`),
  copyWorkflow: (workflowId: string, payload: Record<string, unknown>) =>
    api<{ workflow_id: string; name: string }>(`/api/workflows/${workflowId}/copy`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listNodes: (workflowId: string) => api<NodeSummary[]>(`/api/workflows/${workflowId}/nodes`),
  getNode: (workflowId: string, nodeId: string) =>
    api<{ node: NodeSummary; content: string; path: string }>(`/api/workflows/${workflowId}/nodes/${nodeId}`),
  updateNode: (workflowId: string, nodeId: string, content: string) =>
    api(`/api/workflows/${workflowId}/nodes/${nodeId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  listRuns: (workflowId: string) => api<RunSummary[]>(`/api/workflows/${workflowId}/runs`),
  createRun: (workflowId: string, payload: Record<string, unknown>) =>
    api<{ run_id: string; status: string; run_dir: string }>(`/api/workflows/${workflowId}/runs`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRun: (workflowId: string, runId: string) =>
    api<RunDetail>(`/api/workflows/${workflowId}/runs/${runId}`),
  getRunNode: (workflowId: string, runId: string, nodeId: string) =>
    api<NodeInspectorData>(`/api/workflows/${workflowId}/runs/${runId}/nodes/${nodeId}`),
  rerun: (workflowId: string, runId: string, payload: Record<string, unknown>) =>
    api<{ run_id: string; status: string; run_dir: string }>(`/api/workflows/${workflowId}/runs/${runId}/rerun`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listOutputs: (workflowId: string, runId: string) =>
    api<OutputEntry[]>(`/api/workflows/${workflowId}/runs/${runId}/outputs`),
  getOutput: (workflowId: string, runId: string, fileName: string) =>
    api<OutputPreview>(`/api/workflows/${workflowId}/runs/${runId}/outputs/${encodeURIComponent(fileName)}`),
  downloadOutput: (workflowId: string, runId: string, fileName: string) =>
    `/api/workflows/${workflowId}/runs/${runId}/outputs/${encodeURIComponent(fileName)}?download=true`,
  downloadOutputsZip: async (workflowId: string, runId: string, files?: string[]) => {
    const response = await fetch(`/api/workflows/${workflowId}/runs/${runId}/outputs/download-zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.blob();
  },
};
