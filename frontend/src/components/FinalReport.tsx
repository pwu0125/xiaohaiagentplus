import { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Lightbulb, BarChart3, FileCheck, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FinalReport as FinalReportType } from '@/types';

interface FinalReportProps {
  report: FinalReportType;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function FinalReportComponent({ report }: FinalReportProps) {
  const conclusionColor =
    report.typed_conclusion === '投'
      ? 'bg-green-500/20 text-green-400 border-green-500/40'
      : report.typed_conclusion === '改'
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
        : 'bg-red-500/20 text-red-400 border-red-500/40';

  const ratingColor =
    report.rating?.startsWith('A')
      ? 'text-green-400'
      : report.rating?.startsWith('B')
        ? 'text-blue-400'
        : 'text-amber-400';

  const score = report.score ?? 0;
  const scoreColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreBarColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  const departmentScores = report.department_scores || {};
  const maxScore = 100;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* 综合评分头部 */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-slate-700 bg-slate-800/50 p-6"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* 结论标签 */}
          <div className="flex items-center gap-4">
            <div className={cn('w-20 h-20 rounded-2xl border-2 flex items-center justify-center', conclusionColor)}>
              <span className="text-3xl font-bold">{report.typed_conclusion || '-'}</span>
            </div>
            <div>
              <div className="text-sm text-slate-400">投资建议</div>
              <div className={cn('text-2xl font-bold', ratingColor)}>
                {report.rating || '-'}
                <span className="text-sm text-slate-400 ml-2 font-normal">评级</span>
              </div>
            </div>
          </div>

          {/* 分数 */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">综合评分</span>
              <span className={cn('text-2xl font-bold', scoreColor)}>{score}</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className={cn('h-full rounded-full', scoreBarColor)}
              />
            </div>
          </div>
        </div>

        {/* 摘要 */}
        {report.summary && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-300 leading-relaxed">{report.summary}</p>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 关键指标 */}
        {report.key_metrics && Object.keys(report.key_metrics).length > 0 && (
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h3 className="font-semibold text-slate-100">关键指标</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(report.key_metrics).map(([key, value], i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 + 0.3 }}
                  className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50"
                >
                  <div className="text-xs text-slate-500 mb-1">{key}</div>
                  <div className="text-sm font-semibold text-slate-200 font-mono">{String(value)}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 部门评分 */}
        {Object.keys(departmentScores).length > 0 && (
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-slate-100">部门评分</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(departmentScores).map(([dept, scoreValue], i) => {
                const pct = (typeof scoreValue === 'number' ? scoreValue : 0) / maxScore * 100;
                const deptNameMap: Record<string, string> = {
                  investment: '投资分析',
                  asset_management: '资产管理',
                  market: '市场分析',
                  operation: '运营分析',
                  financial: '财务建模',
                  design: '设计分析',
                  engineering: '工程分析',
                  cost: '成本分析',
                  legal: '法律分析',
                };
                const deptName = deptNameMap[dept] || dept;
                const barColor =
                  pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                const scoreNum = typeof scoreValue === 'number' ? scoreValue : 0;

                return (
                  <motion.div
                    key={dept}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{deptName}</span>
                      <span className={cn('text-sm font-bold', scoreNum >= 80 ? 'text-green-400' : scoreNum >= 60 ? 'text-amber-400' : 'text-red-400')}>
                        {scoreValue}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 + 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                        className={cn('h-full rounded-full', barColor)}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* 风险列表 */}
      {report.risks && report.risks.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-slate-700 bg-slate-800/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-slate-100">风险分析</h3>
          </div>
          <div className="space-y-2">
            {report.risks.map((risk: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.3 }}
                className="flex items-start gap-3 bg-slate-900/40 rounded-lg p-3 border border-slate-700/30"
              >
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{risk.type || `风险${i + 1}`}</span>
                    {risk.level && (
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-medium',
                        risk.level === '低' && 'bg-green-500/10 text-green-400',
                        risk.level === '中低' && 'bg-emerald-500/10 text-emerald-400',
                        risk.level === '中等' && 'bg-amber-500/10 text-amber-400',
                        risk.level === '中高' && 'bg-orange-500/10 text-orange-400',
                        risk.level === '高' && 'bg-red-500/10 text-red-400',
                      )}>
                        {risk.level}
                      </span>
                    )}
                  </div>
                  {risk.description && (
                    <p className="text-xs text-slate-400 mt-1">{risk.description}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 建议列表 */}
      {report.recommendations && report.recommendations.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-slate-700 bg-slate-800/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-slate-100">投资建议</h3>
          </div>
          <div className="space-y-2">
            {report.recommendations.map((rec: string, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.3 }}
                className="flex items-start gap-3 bg-slate-900/40 rounded-lg p-3 border border-slate-700/30"
              >
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300">{rec}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 最终评估 */}
      {report.final_assessment && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileCheck className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-slate-100">最终评估</h3>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{report.final_assessment}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default memo(FinalReportComponent);
