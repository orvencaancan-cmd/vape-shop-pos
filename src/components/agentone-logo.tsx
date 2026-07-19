export function AgentOneLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-serif tracking-tight ${className}`}>
      <span className="text-ink">Agent</span>
      <span className="text-primary">One</span>
    </span>
  );
}
