export default function DashboardLoading() {
  return (
    <main className="page">
      <div className="skeleton skeleton-greeting" />
      <div className="summary-cards">
        <div className="skeleton skeleton-summary-card" />
        <div className="skeleton skeleton-summary-card" />
        <div className="skeleton skeleton-summary-card" />
        <div className="skeleton skeleton-summary-card" />
      </div>
      <div className="grid-main">
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart" />
      </div>
      <div className="skeleton skeleton-transactions" />
    </main>
  );
}
