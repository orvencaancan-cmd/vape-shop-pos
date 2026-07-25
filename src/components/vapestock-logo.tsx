export function VapeStockLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-semibold tracking-tight ${className}`}>
      <span className="text-ink">Vape</span>
      <span className="text-brand">Stock</span>
    </span>
  );
}
