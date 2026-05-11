interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-outline bg-surface-lowest">
      {label ? <div className="border-b border-outline bg-surface-low px-3 py-2 text-xs font-semibold text-muted">{label}</div> : null}
      <pre className="overflow-x-auto bg-[#2e3038] p-4 font-mono text-xs leading-6 text-[#eff0fa]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
