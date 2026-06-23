import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Tag, X, BookOpen, FileText, MessageSquare, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllTags, listBookmarks, searchBookmarks } from '@/lib/api';
import type { BookmarkOut } from '@/types';
import PageIntro from '@/components/PageIntro';

const PAGE_SIZE = 20;

export default function KnowledgeBase() {
  const [bookmarks, setBookmarks] = useState<BookmarkOut[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 笔记卡片展开状态管理
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // 获取笔记类型的图标和颜色配置
  function getTypeMeta(type: string) {
    switch (type) {
      case 'ai-product':
        return { label: '材料分析', icon: FileText, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'committee':
        return { label: '投决会', icon: MessageSquare, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default:
        return { label: '笔记', icon: BookOpen, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
  }

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listBookmarks({
        page,
        page_size: PAGE_SIZE,
        tags: selectedTag ? [selectedTag] : undefined,
      });
      setBookmarks(response.items);
      setTotal(response.total);
    } catch (err) {
      setError((err as Error)?.message || '加载知识库失败');
    } finally {
      setLoading(false);
    }
  }, [page, selectedTag]);

  const loadTags = useCallback(async () => {
    try {
      const response = await getAllTags();
      setTags(response.tags || []);
    } catch {
      setTags([]);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    setPage(1);
    setLoading(true);
    setError(null);
    try {
      if (!searchTerm.trim()) {
        await fetchBookmarks();
        return;
      }
      const result = await searchBookmarks(searchTerm.trim(), selectedTag ? [selectedTag] : undefined);
      setBookmarks(result.results);
      setTotal(result.count);
    } catch (err) {
      setError((err as Error)?.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  }, [fetchBookmarks, searchTerm, selectedTag]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      void fetchBookmarks();
    }
  }, [fetchBookmarks, searchTerm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div className="space-y-6">
      <PageIntro />

      <div className="rounded-3xl border border-slate-700 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400/80">知识库</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">投资洞察与知识笔记</h1>
            <p className="mt-2 max-w-2xl text-slate-400">搜索书签与笔记，按标签过滤，快速回到前一次投资分析或研究结论。</p>
          </div>
          <div className="grid gap-3 w-full max-w-2xl md:w-auto">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="按标题、内容或标签搜索"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <Button type="button" onClick={handleSearch} className="w-full md:w-auto">
              搜索知识库
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={selectedTag === '' ? 'secondary' : 'outline'}
            onClick={() => setSelectedTag('')}
            className="rounded-full px-4 py-2 text-sm"
          >
            全部标签
          </Button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSelectedTag(tag);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedTag === tag
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100'
              }`}
            >
              <Tag className="inline-block mr-2 h-3.5 w-3.5 align-text-bottom" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-100 flex items-center justify-between gap-3">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0 p-1 hover:bg-red-500/20 rounded-lg transition-colors"
              aria-label="关闭错误提示"
            >
              <X className="w-4 h-4 text-red-300" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-12 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
                <span className="text-slate-400">正在加载知识库...</span>
              </div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">暂无匹配的知识笔记</p>
              <p className="text-slate-500 text-sm">尝试调整搜索关键词或标签筛选条件</p>
            </div>
          ) : (
            bookmarks.map((bookmark, index) => {
              const typeMeta = getTypeMeta(bookmark.tags[0] || '');
              const TypeIcon = typeMeta.icon;
              const isExpanded = expandedId === bookmark.id;
              const contentPreview = bookmark.content
                ? bookmark.content.length > 150
                  ? bookmark.content.slice(0, 150) + '...'
                  : bookmark.content
                : '';

              return (
                <motion.article
                  key={bookmark.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3">
                    {/* 头部：类型标识 + 标签 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${typeMeta.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeMeta.label}
                      </span>
                      {bookmark.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* 标题 */}
                    <h2 className="text-lg font-semibold text-slate-100">{bookmark.title}</h2>

                    {/* 内容：支持展开/折叠 */}
                    {bookmark.content && (
                      <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {isExpanded ? bookmark.content : contentPreview}
                        {bookmark.content.length > 150 && (
                          <button
                            onClick={() => toggleExpand(bookmark.id)}
                            className="ml-2 inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs font-medium transition-colors"
                          >
                            {isExpanded ? (
                              <>收起 <ChevronUp className="w-3 h-3" /></>
                            ) : (
                              <>展开详情 <ChevronDown className="w-3 h-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 底部：创建时间 */}
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(bookmark.created_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(bookmark.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>
      </div>

      {bookmarks.length > 0 && !searchTerm.trim() ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>第 {page}/{totalPages} 页，共 {total} 条结果</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              上一页
            </Button>
            <Button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
