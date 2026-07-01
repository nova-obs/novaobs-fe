import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, RefreshCw, Save, Search, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { platformApi, type PlatformImage } from './api';

const imageLabels: Record<string, string> = {
  __NOVAOBS_IMAGE_OTEL_COLLECTOR__: 'OTel Collector',
  __NOVAOBS_IMAGE_VMALERT__: 'vmalert',
};

export function PlatformSettingsPage() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState('');
  const [editingKey, setEditingKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const imagesQuery = useQuery({ queryKey: ['platform-images'], queryFn: () => platformApi.listImages(), retry: false });
  const images = imagesQuery.data ?? [];
  const selectedImage = images.find((item) => item.key === selectedKey) ?? images[0] ?? null;
  const editingImage = images.find((item) => item.key === editingKey) ?? null;
  const changed = Boolean(editingImage && draftValue.trim() !== editingImage.value);
  const blockedReason = !editingImage
    ? ''
    : !draftValue.trim()
      ? '镜像地址不能为空'
      : /\s/.test(draftValue)
        ? '镜像地址不能包含空白字符'
        : '';

  useEffect(() => {
    if (selectedKey || images.length === 0) return;
    setSelectedKey(images[0].key);
    setDraftValue(images[0].value);
  }, [images, selectedKey]);

  useEffect(() => {
    if (!selectedImage) return;
    if (editingKey) return;
    setDraftValue(selectedImage.value);
  }, [editingKey, selectedImage?.key, selectedImage?.value]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const updateMutation = useMutation({
    mutationFn: () => platformApi.updateImage({ key: editingImage!.key, value: draftValue.trim() }),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['platform-images'] });
      setSelectedKey(item.key);
      setEditingKey('');
      setDraftValue(item.value);
    },
  });

  const imageRows = useMemo(() => images.map((item) => ({
    ...item,
    label: imageDisplayName(item),
  })), [images]);
  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return imageRows;
    return imageRows.filter((item) => [
      item.label,
      item.key,
      item.value,
      imageScopeText(item.key),
    ].join(' ').toLowerCase().includes(keyword));
  }, [imageRows, query]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filteredRows.length, currentPage * pageSize);

  useEffect(() => {
    if (page <= pageCount) return;
    setPage(pageCount);
  }, [page, pageCount]);

  function selectImage(item: PlatformImage) {
    setSelectedKey(item.key);
    if (!editingKey) setDraftValue(item.value);
  }

  function beginEdit(item: PlatformImage) {
    updateMutation.reset();
    setSelectedKey(item.key);
    setEditingKey(item.key);
    setDraftValue(item.value);
  }

  function cancelEdit() {
    updateMutation.reset();
    if (editingImage) setDraftValue(editingImage.value);
    setEditingKey('');
  }

  return (
    <div className="console-workbench platform-settings-page overflow-hidden">
      <section className="min-w-0">
          <DataPanel title="镜像模板" meta="平台级运行配置，部署清单渲染时使用">
            {imagesQuery.isLoading ? (
              <div className="space-y-2">
                <div className="h-10 rounded-md bg-surface" />
                <div className="h-10 rounded-md bg-surface" />
                <div className="h-40 rounded-md bg-surface" />
              </div>
            ) : imagesQuery.error ? (
              <EmptyState title="镜像模板加载失败" action={<button type="button" className="console-button" onClick={() => imagesQuery.refetch()}>重试</button>} />
            ) : images.length === 0 ? (
              <EmptyState title="暂无镜像模板" />
            ) : (
              <div className="min-w-0 overflow-hidden rounded-md border border-outline bg-white">
                <div className="console-list-toolbar border-b border-outline">
                  <label className="console-list-toolbar-search sm:w-[380px]">
                    <span className="sr-only">搜索镜像模板</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    <input
                      className="console-input h-8 w-full pl-8 text-xs"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索模板、占位符、镜像"
                    />
                  </label>
                  <div className="console-list-toolbar-actions justify-between sm:justify-end">
                    {updateMutation.isSuccess && !editingKey ? <span className="text-xs font-semibold text-success">镜像模板已更新</span> : null}
                    <span className="min-w-[72px] text-right font-mono text-[11px] text-muted">{rangeStart}-{rangeEnd} / {filteredRows.length}</span>
                    <button
                      type="button"
                      className="console-icon-button"
                      onClick={() => imagesQuery.refetch()}
                      disabled={imagesQuery.isFetching}
                      aria-label="刷新镜像模板"
                      title="刷新镜像模板"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${imagesQuery.isFetching ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      className="console-button h-8 px-2"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      aria-label="上一页"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      上一页
                    </button>
                    <button
                      type="button"
                      className="console-button h-8 px-2"
                      disabled={currentPage >= pageCount}
                      onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                      aria-label="下一页"
                    >
                      下一页
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {filteredRows.length === 0 ? (
                  <div className="px-3 py-12">
                    <EmptyState title="未找到匹配的镜像模板" />
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="console-table platform-settings-table w-full max-w-[1480px] min-w-[1040px] table-fixed">
                      <colgroup>
                        <col className="w-[18%]" />
                        <col className="w-[24%]" />
                        <col className="w-[40%]" />
                        <col className="w-[12%]" />
                        <col className="w-[96px]" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>模板</th>
                          <th>占位符</th>
                          <th>当前镜像</th>
                          <th>生效范围</th>
                          <th className="text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((item) => {
                          const active = item.key === selectedImage?.key;
                          const rowEditing = item.key === editingKey;
                          const rowChanged = rowEditing && draftValue.trim() !== item.value;
                          return (
                            <tr
                              key={item.key}
                              className={`cursor-pointer ${active || rowEditing ? 'console-selected-row' : ''}`}
                              onClick={() => selectImage(item)}
                            >
                              <td className="font-semibold text-on-surface"><div className="truncate" title={item.label}>{item.label}</div></td>
                              <td className="font-mono text-[11px] text-muted"><div className="truncate" title={item.key}>{item.key}</div></td>
                              <td className="font-mono text-[11px] text-muted">
                                {rowEditing ? (
                                  <div className="space-y-1">
                                    <input
                                      className="console-input h-8 w-full font-mono text-[11px]"
                                      value={draftValue}
                                      onChange={(event) => setDraftValue(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                      placeholder="registry.example.com/namespace/image:tag"
                                    />
                                    {blockedReason ? <div className="text-[11px] font-semibold text-danger">{blockedReason}</div> : null}
                                    {updateMutation.error ? <div className="text-[11px] font-semibold text-danger">{errorMessage(updateMutation.error)}</div> : null}
                                  </div>
                                ) : (
                                  <div className="truncate" title={item.value}>{item.value}</div>
                                )}
                              </td>
                              <td className="text-xs text-muted"><ImageScopeTag scope={imageScopeText(item.key)} /></td>
                              <td className="text-right">
                                {rowEditing ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      className="console-button h-7 px-2"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        cancelEdit();
                                      }}
                                      disabled={updateMutation.isPending}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      取消
                                    </button>
                                    <button
                                      type="button"
                                      className="console-button console-button-primary h-7 px-2"
                                      disabled={!rowChanged || Boolean(blockedReason) || updateMutation.isPending}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateMutation.mutate();
                                      }}
                                      title={blockedReason || (!rowChanged ? '镜像地址未变更' : '保存镜像模板')}
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      {updateMutation.isPending ? '保存中' : '保存'}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="console-button h-7 px-2"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      beginEdit(item);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    修改
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </DataPanel>
        </section>
    </div>
  );
}

function imageDisplayName(item: PlatformImage) {
  return imageLabels[item.key] ?? item.key;
}

function imageScopeText(key: string) {
  if (key === '__NOVAOBS_IMAGE_OTEL_COLLECTOR__') return '日志采集 DaemonSet';
  if (key === '__NOVAOBS_IMAGE_VMALERT__') return '日志告警 vmalert Runtime';
  return '平台部署清单';
}

function ImageScopeTag({ scope }: { scope: string }) {
  const tone = scope.includes('DaemonSet')
    ? 'border-emerald-600/20 bg-emerald-50 text-emerald-700'
    : scope.includes('vmalert')
      ? 'border-primary/20 bg-primary-soft text-primary'
      : 'border-outline bg-surface text-muted';
  return (
    <span className={`inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`} title={scope}>
      <span className="truncate">{scope}</span>
    </span>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '镜像模板更新失败';
}
