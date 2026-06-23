import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Building2,
  FileText,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIProductReport, CycleIndicator } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ReportViewProps {
  report: AIProductReport;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

/* ─── 结论颜色 ─── */
function conclusionColor(conclusion: string) {
  if (conclusion === '投') return 'bg-green-500/20 text-green-400 border-green-500/40';
  if (conclusion === '改') return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  return 'bg-red-500/20 text-red-400 border-red-500/40';
}

// @ts-ignore
function conclusionBadgeColor(conclusion: string) {
  if (conclusion === '投') return 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25';
  if (conclusion === '改') return 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25';
  return 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25';
}

function levelColor(level: string) {
  const l = level.toLowerCase();
  if (l.includes('高')) return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (l.includes('中')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-green-500/15 text-green-400 border-green-500/30';
}

/* ─── 1. ReportHeader ─── */
function ReportHeader({ report }: { report: AIProductReport }) {
  const conclusion = report.conclusion || report.typed_conclusion || '-';
  const confidence = report.confidence ?? 0;
  const projectName = report.project_profile?.project_name || report.report_header?.project_name || '未知项目';

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* 结论徽章 */}
            <div className="flex items-center gap-4">
              <div className={cn('w-20 h-20 rounded-2xl border-2 flex items-center justify-center shrink-0', conclusionColor(conclusion))}>
                <span className="text-3xl font-bold">{conclusion}</span>
              </div>
              <div>
                <div className="text-sm text-slate-400">投资建议</div>
                <div className="text-lg font-semibold text-slate-100">{projectName}</div>
              </div>
            </div>

            {/* 置信度 */}
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">置信度</span>
                <span className={cn(
                  'text-xl font-bold',
                  confidence >= 80 ? 'text-green-400' : confidence >= 60 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {confidence}%
                </span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  className={cn(
                    'h-full rounded-full',
                    confidence >= 80 ? 'bg-green-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                />
              </div>
            </div>

            {/* 评级 */}
            {report.rating && (
              <div className="shrink-0 text-center">
                <div className="text-sm text-slate-400">评级</div>
                <div className={cn(
                  'text-2xl font-bold',
                  report.rating.startsWith('A') ? 'text-green-400' :
                    report.rating.startsWith('B') ? 'text-blue-400' : 'text-amber-400'
                )}>
                  {report.rating}
                </div>
              </div>
            )}
          </div>

          {/* 摘要 */}
          {report.summary && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <p className="text-sm text-slate-300 leading-relaxed">{report.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 2. KeyMetricsGrid ─── */
function KeyMetricsGrid({ report }: { report: AIProductReport }) {
  const metrics = report.key_metrics || {};
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;

  const metricIcons: Record<string, typeof TrendingUp> = {
    '估值': Building2,
    'cap_rate': TrendingUp,
    'irr': TrendingUp,
    'noi': BarChart3,
    '出租率': CheckCircle2,
    'dscr': CheckCircle2,
    'ltv': Minus,
  };

  return (
    <motion.div variants={itemVariants}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map(([key, value], i) => {
          const Icon = metricIcons[key.toLowerCase()] || FileText;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">{key}</span>
              </div>
              <div className="text-lg font-semibold text-slate-100">{String(value)}</div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── 3. ScenariosComparison ─── */
function ScenariosComparison({ report }: { report: AIProductReport }) {
  const s = report.scenarios;
  if (!s) return null;

  const scenarios = [
    { key: 'optimistic', label: '乐观情景', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    { key: 'base', label: '基准情景', icon: Minus, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { key: 'pessimistic', label: '悲观情景', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  ] as const;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            三情景对比
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">指标</th>
                  {scenarios.map((sc) => (
                    <th key={sc.key} className={cn('text-center py-2 px-3 font-medium', sc.color)}>
                      <div className="flex items-center justify-center gap-1.5">
                        <sc.icon className="w-3.5 h-3.5" />
                        {sc.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'IRR', field: 'irr' as const },
                  { label: 'ROI', field: 'roi' as const },
                  { label: '估值', field: 'value' as const },
                  { label: '触发条件', field: 'trigger' as const },
                ].map((row) => (
                  <tr key={row.field} className="border-b border-slate-700/50 last:border-0">
                    <td className="py-2.5 px-3 text-slate-300">{row.label}</td>
                    {scenarios.map((sc) => (
                      <td key={sc.key} className="text-center py-2.5 px-3 text-slate-200">
                        {(s as any)[sc.key]?.[row.field] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 4. RiskMatrix ─── */
function RiskMatrix({ report }: { report: AIProductReport }) {
  const risks = report.risks || [];
  if (risks.length === 0) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            风险列表
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {risks.map((risk, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"
            >
              <Badge variant="outline" className={cn('shrink-0 mt-0.5', levelColor(risk.level))}>
                {risk.level}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200">{risk.category}</div>
                <div className="text-xs text-slate-400 mt-1">{risk.description}</div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 5. ActionItems ─── */
function ActionItems({ report }: { report: AIProductReport }) {
  const items = report.action_items || [];
  if (items.length === 0) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            行动建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2.5 text-sm text-slate-300"
              >
                <span className={cn(
                  'shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium mt-0.5',
                  i < 3 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700 text-slate-400'
                )}>
                  {i + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 6. MacroCyclePanel ─── */
function MacroCyclePanel({ report }: { report: AIProductReport }) {
  const macro = report.macro_cycle;
  if (!macro) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            宏观周期
          </CardTitle>
          <CardDescription className="text-slate-400">
            当前阶段: <Badge variant="outline" className="ml-1 bg-violet-500/10 text-violet-400 border-violet-500/30">{macro.phase}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {macro.summary && <p className="text-sm text-slate-300">{macro.summary}</p>}
          <IndicatorCharts indicators={macro.indicators || []} color="#8b5cf6" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 7. IndustryCyclePanel ─── */
function IndustryCyclePanel({ report }: { report: AIProductReport }) {
  const ind = report.industry_cycle;
  if (!ind) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            行业周期
          </CardTitle>
          <CardDescription className="text-slate-400">
            当前阶段: <Badge variant="outline" className="ml-1 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">{ind.phase}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ind.summary && <p className="text-sm text-slate-300">{ind.summary}</p>}
          <IndicatorCharts indicators={ind.indicators || []} color="#06b6d4" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 指标图表 ─── */
function IndicatorCharts({ indicators, color }: { indicators: CycleIndicator[]; color: string }) {
  if (indicators.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 指标表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-2 text-slate-400 font-medium">指标</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">当前值</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">趋势</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => (
              <tr key={i} className="border-b border-slate-700/50 last:border-0">
                <td className="py-2 px-2 text-slate-300">{ind.name}</td>
                <td className="text-center py-2 px-2 text-slate-200 font-medium">{ind.current}</td>
                <td className="text-center py-2 px-2">
                  <span className={cn(
                    'text-xs',
                    ind.trend === 'up' ? 'text-green-400' : ind.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                  )}>
                    {ind.trend === 'up' ? '↑ 上升' : ind.trend === 'down' ? '↓ 下降' : '→ 平稳'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 图表 */}
      {indicators.map((ind, i) => {
        const data = (ind.points || []).map((p) => ({
          year: p.year,
          value: Number(p.value) || 0,
        }));
        if (data.length < 2) return null;

        return (
          <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
            <div className="text-xs text-slate-400 mb-2">{ind.name}</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  fill={`url(#grad-${i})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 8. CityAnalysisPanel ─── */
function CityAnalysisPanel({ report }: { report: AIProductReport }) {
  const city = report.city_analysis;
  if (!city) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-400" />
            城市分析
          </CardTitle>
          <CardDescription className="text-slate-400">
            城市: <span className="text-slate-200 font-medium">{city.city}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {city.summary && <p className="text-sm text-slate-300">{city.summary}</p>}

          {/* 项目位置 */}
          {city.project_location && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400 mb-1">项目位置</div>
              <div className="text-sm text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                {city.project_location.name}
                <span className="text-slate-500 text-xs">
                  ({city.project_location.lat.toFixed(4)}, {city.project_location.lng.toFixed(4)})
                </span>
              </div>
            </div>
          )}

          {/* 竞品列表 */}
          {city.competitors && city.competitors.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">周边竞品</div>
              <div className="space-y-2">
                {city.competitors.map((comp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm text-slate-200">{comp.name}</span>
                      <Badge variant="outline" className="text-xs bg-slate-800 text-slate-400 border-slate-600">
                        {comp.type}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {comp.distance} · {comp.area}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── 9. FinancialPanel ─── */
function FinancialPanel({ report }: { report: AIProductReport }) {
  const sections = report.sections;
  if (!sections) return null;

  const sectionMap: { key: keyof typeof sections; label: string; icon: typeof FileText }[] = [
    { key: 'overview', label: '概览', icon: FileText },
    { key: 'financial', label: '财务分析', icon: BarChart3 },
    { key: 'valuation', label: '估值分析', icon: TrendingUp },
    { key: 'roi', label: '投资回报', icon: TrendingUp },
    { key: 'risk', label: '风险分析', icon: AlertTriangle },
  ];

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      {sectionMap.map(({ key, label, icon: Icon }) => {
        const content = sections[key];
        if (!content || typeof content !== 'string') return null;
        return (
          <Card key={key} className="border-slate-700 bg-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Icon className="w-4 h-4 text-emerald-400" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-invert prose-sm max-w-none text-slate-300"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </CardContent>
          </Card>
        );
      })}

      {/* 财务报表 */}
      {sections.financial_statements && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              财务报表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-invert prose-sm max-w-none text-slate-300"
              dangerouslySetInnerHTML={{ __html: sections.financial_statements }}
            />
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

/* ─── 主组件 ─── */
function ReportViewComponent({ report }: ReportViewProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <ReportHeader report={report} />
      <KeyMetricsGrid report={report} />
      <ScenariosComparison report={report} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MacroCyclePanel report={report} />
        <IndustryCyclePanel report={report} />
      </div>
      <CityAnalysisPanel report={report} />
      <RiskMatrix report={report} />
      <ActionItems report={report} />
      <FinancialPanel report={report} />
    </motion.div>
  );
}

export default memo(ReportViewComponent);
