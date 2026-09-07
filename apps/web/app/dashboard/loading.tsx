import { Logo } from "@/components/logo";

export default function DashboardLoading() {
  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <Logo />
      </div>

      <div className="skeleton skeleton-greeting" />
      <div className="skeleton skeleton-toolbar" />

      <div className="skeleton skeleton-month-nav" />
      <div className="summary-cards">
        <div className="skeleton skeleton-summary-card" />
        <div className="skeleton skeleton-summary-card" />
        <div className="skeleton skeleton-summary-card" />
      </div>

      <div className="dashboard-grid">
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart" />
      </div>

      <div className="skeleton skeleton-transactions" />
    </main>
  );
}
