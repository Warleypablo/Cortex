import { SidebarTrigger } from "@/components/ui/sidebar";

export default function TopBar() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
      </div>
    </header>
  );
}