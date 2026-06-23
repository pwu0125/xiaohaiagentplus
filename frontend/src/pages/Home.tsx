import { motion } from 'framer-motion';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  BookMarked,
  TrendingUp,
  Upload,
  Users,
  MessageSquare,
  BookOpen,
  Grid3X3,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FileText,
  BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

/* ------------------------------------------------------------------ */
/* Stats data                                                         */
/* ------------------------------------------------------------------ */

const STATS = [
  {
    label: '在管项目',
    value: '42',
    change: '+5',
    changeLabel: '本月新增',
    positive: true,
    icon: FolderOpen,
    accent: 'blue',
  },
  {
    label: '投决通过',
    value: '28',
    change: '66.7%',
    changeLabel: '通过率',
    positive: true,
    icon: CheckCircle2,
    accent: 'green',
  },
  {
    label: '待处理分析',
    value: '7',
    change: '+2',
    changeLabel: '较上周',
    positive: false,
    icon: Clock,
    accent: 'amber',
  },
  {
    label: '知识库条目',
    value: '1,248',
    change: '36',
    changeLabel: '本周新增',
    positive: true,
    icon: BookMarked,
    accent: 'purple',
  },
];

const ACCENT_MAP: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100 text-blue-600' },
  green: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600' },
  amber: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', iconBg: 'bg-amber-100 text-amber-600' },
  purple: { border: 'border-violet-500', bg: 'bg-violet-50', text: 'text-violet-600', iconBg: 'bg-violet-100 text-violet-600' },
};

/* ------------------------------------------------------------------ */
/* Modules data                                                       */
/* ------------------------------------------------------------------ */

const MODULES = [
  {
    title: '公募 REITs 指标看板',
    desc: '覆盖 REITs 市场价格走势、溢价率、分红收益率、资产估值等核心指标，辅助投资决策研判。',
    icon: TrendingUp,
    status: '实时',
    tags: ['行情', '估值', '分红'],
    path: '/reits',
    accent: 'blue',
  },
  {
    title: '项目资料上传分析',
    desc: '支持上传项目材料（PDF/Word/Excel），自动提取结构化数据，生成投资摘要与风险识别。',
    icon: Upload,
    status: '智能',
    tags: ['PDF', 'OCR', '摘要'],
    path: '/pdf',
    accent: 'green',
  },
  {
    title: '项目模拟投决会',
    desc: '模拟真实投委会流程，9大部门并行评审，32位投资专家多维洞察，输出投/改/退结论与评级。',
    icon: Users,
    status: '9部门',
    tags: ['投决', '评分', '评级'],
    path: '/committee',
    accent: 'amber',
  },
  {
    title: '专家圆桌讨论',
    desc: '发起多专家深度讨论，汇聚价值投资、成长投资、量化策略等多流派视角，获取投资决策洞见。',
    icon: MessageSquare,
    status: '多维',
    tags: ['圆桌', '辩论', '洞察'],
    path: '/chat',
    accent: 'purple',
  },
  {
    title: '项目知识库',
    desc: '统一管理项目资料、研究报告、投决记录与行业数据，支持全文检索与分类管理，构建投研知识资产。',
    icon: BookOpen,
    status: '检索',
    tags: ['搜索', '笔记', '标签'],
    path: '/knowledge',
    accent: 'cyan',
  },
  {
    title: '资产智能评价',
    desc: '基于资产质量、成长性、风险收益等多维度评价体系，对商业不动产进行九宫格定位，输出标准化评价报告。',
    icon: Grid3X3,
    status: '评价',
    tags: ['九宫格', '评级', '报告'],
    path: '/reports',
    accent: 'red',
  },
];

const MODULE_ACCENT: Record<string, { border: string; iconBg: string; statusBg: string }> = {
  blue: { border: 'hover:border-blue-400', iconBg: 'bg-blue-100 text-blue-600', statusBg: 'bg-blue-50 text-blue-600' },
  green: { border: 'hover:border-emerald-400', iconBg: 'bg-emerald-100 text-emerald-600', statusBg: 'bg-emerald-50 text-emerald-600' },
  amber: { border: 'hover:border-amber-400', iconBg: 'bg-amber-100 text-amber-600', statusBg: 'bg-amber-50 text-amber-600' },
  purple: { border: 'hover:border-violet-400', iconBg: 'bg-violet-100 text-violet-600', statusBg: 'bg-violet-50 text-violet-600' },
  cyan: { border: 'hover:border-cyan-400', iconBg: 'bg-cyan-100 text-cyan-600', statusBg: 'bg-cyan-50 text-cyan-600' },
  red: { border: 'hover:border-red-400', iconBg: 'bg-red-100 text-red-600', statusBg: 'bg-red-50 text-red-600' },
};

/* ------------------------------------------------------------------ */
/* Activities data                                                    */
/* ------------------------------------------------------------------ */

const ACTIVITIES = [
  {
    name: '深圳前海商业综合体项目',
    status: '投决会已完成',
    time: '2小时前',
    badge: 'A级',
    badgeClass: 'bg-emerald-50 text-emerald-600',
    iconBg: 'bg-blue-50 text-blue-600',
    Icon: FileText,
  },
  {
    name: '杭州滨江写字楼项目',
    status: '部门评审中',
    time: '5小时前',
    badge: 'B+级',
    badgeClass: 'bg-amber-50 text-amber-600',
    iconBg: 'bg-amber-50 text-amber-600',
    Icon: FileText,
  },
  {
    name: 'REITs 市场周报（第23期）',
    status: '报告已生成',
    time: '昨天',
    badge: '报告',
    badgeClass: 'bg-blue-50 text-blue-600',
    iconBg: 'bg-emerald-50 text-emerald-600',
    Icon: BarChart3,
  },
  {
    name: '专家圆桌：长租公寓投资策略',
    status: '讨论已完成',
    time: '2天前',
    badge: '洞察',
    badgeClass: 'bg-violet-50 text-violet-600',
    iconBg: 'bg-violet-50 text-violet-600',
    Icon: MessageSquare,
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl px-10 py-8 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1e3a5f 100%)' }}
      >
        <div className="relative z-10">
          <div className="text-[13px] text-white/50 font-medium tracking-wider mb-2">GOOD MORNING</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">小海Agent</h1>
          <p className="text-sm text-white/60 leading-relaxed max-w-xl">
            今日有 3 个项目处于投决分析阶段，2 份 REITs 市场报告待查阅。小海已为您整理好最新数据，可随时启动投决流程。
          </p>
        </div>
        <div className="relative z-10 w-28 h-28 rounded-full overflow-hidden border-[3px] border-white/20 bg-white/10 shrink-0">
          <img src="/xiaohai-original.png" alt="小海" className="w-full h-full object-cover object-top" />
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          const style = ACCENT_MAP[stat.accent];
          return (
            <motion.div
              key={stat.label}
              custom={i}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className={cn(
                'bg-white border border-slate-200 rounded-xl p-6 relative transition-all hover:border-slate-300 hover:shadow-md',
                'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:rounded-t-xl',
                style.border
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500 font-medium">{stat.label}</span>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', style.iconBg)}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
              <div className={cn('text-xs font-medium flex items-center gap-1', stat.positive ? 'text-emerald-600' : 'text-red-500')}>
                {stat.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {stat.change} {stat.changeLabel}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-5 bg-[hsl(212,60%,24%)] rounded-full" />
          <h2 className="text-base font-bold text-slate-900">核心功能模块</h2>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon;
            const style = MODULE_ACCENT[mod.accent] || MODULE_ACCENT.blue;
            return (
              <motion.div
                key={mod.title}
                custom={i + 4}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                onClick={() => navigate(mod.path)}
                className={cn(
                  'bg-white border border-slate-200 rounded-xl p-7 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg',
                  style.border
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', style.iconBg)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', style.statusBg)}>
                    {mod.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{mod.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed mb-5">{mod.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {mod.tags.map((tag) => (
                      <span key={tag} className="text-[11px] font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Activity + Quick Actions */}
      <div className="grid grid-cols-2 gap-5">
        {/* Activity */}
        <motion.div
          custom={10}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-bold text-slate-900">最近投决活动</h3>
            <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">查看全部</span>
          </div>
          <div className="space-y-1">
            {ACTIVITIES.map((act) => {
              const Icon = act.Icon;
              return (
                <div key={act.name} className="flex items-center gap-3.5 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', act.iconBg)}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 truncate">{act.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {act.status}
                      <span>·</span>
                      {act.time}
                    </div>
                  </div>
                  <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0', act.badgeClass)}>
                    {act.badge}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          custom={11}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-bold text-slate-900">快捷操作</h3>
          </div>
          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/pdf')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[hsl(212,60%,24%)] text-white hover:bg-[hsl(212,60%,18%)] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold">上传项目材料</div>
                <div className="text-[11px] text-white/60 mt-0.5">开始新一轮投决分析</div>
              </div>
            </button>
            <button
              onClick={() => navigate('/reits')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-medium text-slate-700">查看 REITs 看板</span>
            </button>
            <button
              onClick={() => navigate('/committee')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-medium text-slate-700">发起模拟投决会</span>
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-medium text-slate-700">专家圆桌讨论</span>
            </button>
            <button
              onClick={() => navigate('/knowledge')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[13px] font-medium text-slate-700">访问知识库</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
