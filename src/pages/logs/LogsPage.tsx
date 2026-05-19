import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataPanel } from '../../components/DataPanel';
import { LogViewer } from '../../components/LogViewer';
import { api } from '../../services/api';
import type { LogLevel } from '../../services/types';
import { filterLogs, summarizeLogLevels } from './logFilters';

export function LogsPage() {
  const { data = [] } = useQuery({ queryKey: ['logs'], queryFn: api.getLogs });
  const [service, setService] = useState('');
  const [environment, setEnvironment] = useState('');
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const filtered = useMemo(() => filterLogs(data, { service, environment, level, keyword }), [data, environment, keyword, level, service]);
  const summary = summarizeLogLevels(filtered);
  const services = [...new Set(data.map((item) => item.service))];
  const environments = [...new Set(data.map((item) => item.environment))];

  return (
    <div className="space-y-6">
      <DataPanel title="过滤器" meta="api query adapter">
        <div className="grid gap-3 md:grid-cols-5">
          <select className="console-input" value={service} onChange={(event) => setService(event.target.value)}>
            <option value="">全部服务</option>
            {services.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="console-input" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
            <option value="">全部环境</option>
            {environments.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="console-input" value={level} onChange={(event) => setLevel(event.target.value as LogLevel | 'all')}>
            <option value="all">全部级别</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </select>
          <input className="console-input md:col-span-2" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="关键字、错误码或服务名" />
        </div>
      </DataPanel>
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(summary).map(([name, count]) => (
          <div key={name} className="console-panel px-4 py-3">
            <div className="text-xs font-semibold uppercase text-muted">{name}</div>
            <div className="font-mono text-xl text-on-surface">{count}</div>
          </div>
        ))}
      </div>
      <DataPanel title="日志流" meta={`${filtered.length} entries`}>
        <LogViewer logs={filtered} />
      </DataPanel>
    </div>
  );
}
