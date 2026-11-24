import type { ReactNode } from "react";
import SportyFanzShell from "../../components/AppShell";

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SportyFanzShell>
      {children}
    </SportyFanzShell>
  );
}