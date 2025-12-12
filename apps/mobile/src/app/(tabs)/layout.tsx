import type { ReactNode } from "react";
import { MobileShell } from "../../components/layout/mobile-shell";
import { BottomNav } from "../../components/navigation/bottom-nav";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <MobileShell>
      <main className="pb-4">{children}</main>
      <BottomNav />
    </MobileShell>
  );
}
