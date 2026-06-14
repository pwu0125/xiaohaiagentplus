import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Tag } from 'lucide-react';
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
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-8 text-center text-slate-400">
              加载中...
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-slate-400">
              当前没有匹配的书签或笔记。
            </div>
          ) : (
            bookmarks.map((bookmark) => (
              <article key={bookmark.id} className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 shadow-sm shadow-slate-950/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-slate-400 text-sm">
                      <span className="rounded-full bg-slate-800/70 px-2.5 py-1">{bookmark.bookmark_type === 'note' ? '笔记' : '书签'}</span>
                      {bookmark.url ? (
                        <a href={bookmark.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300">
                          查看链接
                        </a>
                      ) : null}
                    </div>
                    <h2 className="text-xl font-semibold text-slate-100">{bookmark.title}</h2>
                    {bookmark.content ? <p className="text-slate-400 whitespace-pre-wrap">{bookmark.content}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bookmark.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span>创建于 {new Date(bookmark.created_at).toLocaleString()}</span>
                  <span>更新于 {new Date(bookmark.updated_at).toLocaleString()}</span>
                </div>
              </article>
            ))
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
