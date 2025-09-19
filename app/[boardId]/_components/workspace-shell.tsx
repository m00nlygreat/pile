import type { ReactNode } from "react";

type WorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({ sidebar, children }: WorkspaceShellProps) {
  return (
    <div className="workspace">
      {sidebar}
      <section className="workspace-content">{children}</section>
    </div>
  );
}
