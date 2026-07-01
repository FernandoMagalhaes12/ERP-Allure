import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white md:text-[32px]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13px] text-[#c6a9ae] md:text-sm">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-dark", className)}>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white md:text-[17px]">{title}</h2> : null}
            {description ? <p className="mt-1 text-[12px] text-[#b9959d] md:text-[13px]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="panel-dark min-h-[92px]">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#a98a91]">{title}</p>
      <p className={cn("mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white", accent)}>{value}</p>
    </div>
  );
}

export function StatusBanner({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    success: "border-[#355744] bg-[#11281d] text-[#9de6bc]",
    error: "border-[#6a2d39] bg-[#291017] text-[#ffbac6]",
    info: "border-white/10 bg-white/[0.03] text-[#ddd0d3]",
  } as const;

  return <div className={cn("rounded-2xl border px-4 py-3 text-[13px] shadow-[0_14px_30px_rgba(0,0,0,0.12)]", styles[tone])}>{children}</div>;
}
