import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';

export interface ListFilter<T> {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  match: (item: T, value: string) => boolean;
}

const pillTone: Record<string, string> = {
  neutral: 'border-outline bg-surface-low text-muted',
  info: 'border-primary/25 bg-primary-soft text-primary',
  success: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

/** 授权列表的统一区块：标题、搜索、筛选和分页合并为同一条工具栏，避免多表堆叠时出现连续的水平分隔带。 */
export function ListSection<T>({
  icon,
  title,
  meta,
  items,
  searchText,
  searchPlaceholder,
  filters = [],
  headers,
  renderRows,
  pageSize = 8,
  empty,
  minWidth = 'min-w-[760px]',
}: {
  icon?: ReactNode;
  title?: ReactNode;
  meta?: string;
  items: T[];
  searchText: (item: T) => string;
  searchPlaceholder: string;
  filters?: Array<ListFilter<T>>;
  headers: string[];
  renderRows: (pagedItems: T[]) => ReactNode;
  pageSize?: number;
  empty: string;
  minWidth?: string;
}) {
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const keyword = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (keyword && !searchText(item).toLowerCase().includes(keyword)) return false;
    return filters.every((filter) => {
      const value = filterValues[filter.id] ?? '';
      return !value || filter.match(item, value);
    });
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, currentPage * pageSize);
  const narrowed = Boolean(keyword) || filters.some((filter) => Boolean(filterValues[filter.id]));

  return (
    <section className="console-summary-strip min-w-0">
      <div className="console-list-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {title ? (
            <h2 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-on-surface">
              {icon}
              {title}
              <span className="font-mono text-[11px] font-medium text-muted">{items.length}</span>
            </h2>
          ) : null}
          <label className="console-list-toolbar-search sm:w-56">
            <span className="sr-only">{searchPlaceholder}</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              className="console-input h-8 w-full pl-8 text-xs"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {filters.map((filter) => (
            <select
              key={filter.id}
              className="console-input h-8 w-auto text-xs font-semibold"
              aria-label={filter.label}
              value={filterValues[filter.id] ?? ''}
              onChange={(event) => {
                const { value } = event.target;
                setFilterValues((current) => ({ ...current, [filter.id]: value }));
                setPage(1);
              }}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ))}
        </div>
        <div className="console-list-toolbar-actions justify-between sm:justify-end">
          {meta ? <span className="hidden text-xs text-muted xl:inline">{meta}</span> : null}
          <span className="min-w-[68px] text-right font-mono text-[11px] text-muted">
            {rangeStart}-{rangeEnd} / {filtered.length}
          </span>
          <button
            type="button"
            className="console-button h-8 px-2"
            disabled={currentPage <= 1}
            aria-label="上一页"
            title="上一页"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="console-button h-8 px-2"
            disabled={currentPage >= pageCount}
            aria-label="下一页"
            title="下一页"
            onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-10">
          <EmptyState title={narrowed ? '没有匹配当前搜索或筛选的记录' : empty} />
        </div>
      ) : (
        <div className="console-resource-list min-w-0 overflow-x-auto">
          <table className={`console-table w-full ${minWidth}`}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} className={header === '操作' ? 'text-right' : undefined}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>{renderRows(pagedItems)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 长列表值（命名空间等）只展示前若干项，其余折叠为计数，避免单元格把表格撑宽。 */
export function Chips({ values, max = 3 }: { values: string[]; max?: number }) {
  if (!values.length) return <span className="text-xs text-muted">-</span>;
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1" title={values.join(', ')}>
      {shown.map((value) => (
        <span key={value} className="soft-tile px-1.5 py-0.5 font-mono text-[11px] text-on-surface">{value}</span>
      ))}
      {rest > 0 ? <span className="text-[11px] font-semibold text-muted">+{rest}</span> : null}
    </span>
  );
}

export function Pill({ tone, label }: { tone: keyof typeof pillTone; label: string }) {
  return (
    <span className={`status-badge ${pillTone[tone] ?? pillTone.neutral}`}>
      <span className="status-dot" aria-hidden />
      {label}
    </span>
  );
}

/**
 * secondary 只放对用户有意义的稳定标识（用户名、产品 key 等）。
 * 数据库主键这类内部 ID 不进正文，只挂在 title 上供排查时悬浮查看。
 */
export function Identity({
  primary,
  secondary,
  internalId,
}: {
  primary: string;
  secondary?: string;
  internalId?: string;
}) {
  return (
    <div className="min-w-0" title={internalId || undefined}>
      <div className="truncate font-semibold text-on-surface">{primary}</div>
      {secondary ? <div className="truncate font-mono text-[11px] text-muted">{secondary}</div> : null}
    </div>
  );
}

/** 行内操作统一右对齐并使用同一间距，避免操作列右侧留出大片空白。 */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-1 whitespace-nowrap">{children}</div>;
}
