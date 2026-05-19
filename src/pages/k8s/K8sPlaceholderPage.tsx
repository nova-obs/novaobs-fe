export function K8sPlaceholderPage({ title }: { title: string }) {
  return (
    <section className="console-panel min-h-[420px] p-5">
      <div className="max-w-xl">
        <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          当前入口已纳入统一导航，后续会按 startorch 功能矩阵逐项迁移，接入 NovaObs RBAC、Secret、Audit 与统一 API envelope。
        </p>
      </div>
    </section>
  );
}
