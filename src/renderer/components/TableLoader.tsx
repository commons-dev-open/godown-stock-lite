export default function TableLoader() {
  return (
    <div
      className="flex items-center justify-center py-12 text-gray-500"
      role="status"
      aria-label="Loading table"
    >
      <span className="text-sm">Loading…</span>
    </div>
  );
}
