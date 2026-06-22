import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MessageSquare, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { discussWithAgents, listAgents } from '@/lib/api';
import type { AgentInfo, AgentDiscussResult } from '@/types';

import PageIntro from '@/components/PageIntro';

export default function MultiAgentChat() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [results, setResults] = useState<AgentDiscussResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const response = await listAgents();
      setAgents(response.agents);
      setSelectedAgentIds(response.agents.slice(0, 3).map((agent) => agent.id));
    } catch (err) {
      setError((err as Error)?.message || '无法加载Agent列表');
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const handleToggleAgent = useCallback((agentId: string) => {
    setSelectedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId]
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    setResults([]);
    try {
      // 流式讨论：逐条接收每位大师的回复
      await discussWithAgents(
        topic.trim(),
        selectedAgentIds,
        context.trim() || undefined,
        (result) => {
          // 每来一条实时添加到列表
          setResults((prev) => [...prev, result]);
        },
      );
    } catch (err) {
      setError((err as Error)?.message || '讨论请求失败');
    } finally {
      setLoading(false);
    }
  }, [context, selectedAgentIds, topic]);

  const canSubmit = useMemo(
    () => topic.trim().length > 0 && selectedAgentIds.length > 0 && !loading,
    [topic, selectedAgentIds, loading]
  );

  return (
    <div className="space-y-6">
      <PageIntro />

      <section className="rounded-3xl border border-slate-700 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400/80">多Agent对话</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">投资大师圆桌讨论</h1>
            <p className="mt-2 max-w-2xl text-slate-400">选择一个或多个投资大师，输入讨论主题，获取他们基于各自投资哲学的观点。</p>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Users className="h-8 w-8 text-sky-400" />
            <span>{agents.length} 位大师可用</span>
          </div>
        </div>

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

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="block text-slate-300">
              讨论主题
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="例如：请从宏观经济、估值和风险角度评估当前某城市商业地产机会。"
                className="mt-2 h-36 w-full rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </label>

            <label className="block text-slate-300">
              补充背景（可选）
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="添加项目定位、市场前提、竞争对手、资金计划等背景。"
                className="mt-2 h-28 w-full rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-slate-100 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleToggleAgent(agent.id)}
                    className={`rounded-2xl border px-4 py-2 text-sm transition ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                        : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:bg-slate-900/90'
                    }`}
                  >
                    {agent.name}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-400">
                已选 {selectedAgentIds.length} / {agents.length} 位大师
              </div>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                开始讨论
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">已选择大师</h2>
            {selectedAgentIds.length === 0 ? (
              <p className="text-slate-500">请选择至少一位大师开始讨论。</p>
            ) : (
              <div className="space-y-3">
                {selectedAgentIds.map((id) => {
                  const agent = agents.find((item) => item.id === id);
                  if (!agent) return null;
                  return (
                    <div key={id} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                      <div className="font-medium text-slate-100">{agent.name}</div>
                      <div className="text-sm text-slate-500">{agent.subtitle}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-slate-400">
          <MessageSquare className="h-5 w-5 text-sky-400" />
          <h2 className="text-xl font-semibold text-slate-100">讨论结果</h2>
        </div>

        {loading && results.length === 0 ? (
          <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
            <p className="text-slate-400">正在召集投资大师，请稍候…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-slate-400">提交主题后，系统会显示各大师的观点和建议。</div>
        ) : (
          <div className="grid gap-4">
            {/* 流式讨论中：已有部分结果，还有大师在回复 */}
            {loading && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span className="text-sm text-amber-400">
                  {selectedAgentIds.length > results.length
                    ? `讨论进行中… 已收到 ${results.length}/${selectedAgentIds.length} 位大师观点`
                    : '整理讨论结果…'}
                </span>
              </div>
            )}
            <AnimatePresence>
            {results.map((result, index) => (
              <motion.article
                key={`${result.agent_id}-${result.timestamp}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index === results.length - 1 ? 0 : 0, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 shadow-sm shadow-slate-950/10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">{result.agent_name}</h3>
                    <p className="text-sm text-slate-500">{result.agent_subtitle}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="mt-4 whitespace-pre-wrap text-slate-300">{result.content}</div>
                {result.error ? (
                  <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-200">{result.error}</div>
                ) : null}
              </motion.article>
            ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
