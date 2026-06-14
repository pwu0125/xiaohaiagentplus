import { memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  time: string;
  type: string;
  message: string;
}

interface TerminalLogProps {
  logs: LogEntry[];
}

const typeColors: Record<string, string> = {
  stage_start: 'text-violet-400',
  stage_progress: 'text-blue-400',
  stage_complete: 'text-green-400',
  department_started: 'text-cyan-400',
  department_complete: 'text-emerald-400',
  flow_complete: 'text-green-400 font-bold',
  error: 'text-red-400 font-bold',
  system: 'text-slate-300',
};

const typeLabels: Record<string, string> = {
  stage_start: 'STAGE',
  stage_progress: 'PROG',
  stage_complete: 'DONE',
  department_started: 'DEPT',
  department_complete: 'DEPT',
  flow_complete: 'FLOW',
  error: 'ERR',
  system: 'SYS',
};

function TerminalLogComponent({ logs }: TerminalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <Terminal className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">实时日志</span>
        <span className="ml-auto text-xs text-slate-500 font-mono">{logs.length} 条记录</span>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-4 space-y-1 terminal-text text-xs"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-600 italic"
            >
              等待分析开始...
            </motion.div>
          )}
          {logs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 hover:bg-slate-800/50 rounded px-1 py-0.5"
            >
              <span className="text-slate-600 shrink-0 font-mono">[{log.time}]</span>
              <span className={cn('shrink-0 font-mono text-[10px] px-1 py-0.5 rounded bg-slate-800', typeColors[log.type] || 'text-slate-400')}>
                {typeLabels[log.type] || log.type.toUpperCase()}
              </span>
              <span className={cn('break-all', typeColors[log.type] || 'text-slate-300')}>
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default memo(TerminalLogComponent);
