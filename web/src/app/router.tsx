import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { LayoutLabPage } from "../pages/LayoutLabPage";
import { RunDetailPage } from "../pages/RunDetailPage";
import { WorkflowDetailPage } from "../pages/WorkflowDetailPage";
import { WorkflowListPage } from "../pages/WorkflowListPage";

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<WorkflowListPage />} />
        <Route path="/layout-lab" element={<LayoutLabPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
        <Route path="/workflows/:workflowId/runs/:runId" element={<RunDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
