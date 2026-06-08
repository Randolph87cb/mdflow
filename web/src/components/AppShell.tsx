import { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
    </div>
  );
}
