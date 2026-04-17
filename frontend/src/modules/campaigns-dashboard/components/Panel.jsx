export function Panel({ tabs, activeTab, children, className = '' }) {
  const list = tabs.split(/\s+/).filter(Boolean);
  const show = list.includes(activeTab);
  if (!show) return null;
  return <div className={className}>{children}</div>;
}
