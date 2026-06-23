import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Clock,
  Download,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const REPORTS = [
  {
    id: '1',
    title: 'REITs 市场周报（第23期）',
    type: '市场报告',
    tagClass: 'bg-blue-50 text-blue-600',
    date: '2025-06-20',
    author: '小海Agent',
    size: '2.3MB',
    summary: '覆盖42只上市REITs，市场总市值1,856.3亿，平均溢价率18.7%...',
    Icon: BarChart3,
  },
  {
    id: '2',
    title: '深圳前海商业综合体投决报告',
    type: '投决报告',
    tagClass: 'bg-emerald-50 text-emerald-600',
    date: '2025-06-18',
    author: '投决会',
    size: '5.8MB',
    summary: '9部门评审完成，32位专家洞察，最终评级A，建议投资...',
    Icon: Building2,
  },
  {
    id: '3',
    title: '长租公寓行业深度研究',
    type: '行业研究',
    tagClass: 'bg-violet-50 text-violet-600',
    date: '2025-06-15',
    author: '投资部',
    size: '4.1MB',
    summary: '政策利好持续释放，一线城市出租率回升至92%...',
    Icon: TrendingUp,
  },
  {
    id: '4',
    title: '杭州滨江写字楼项目风险分析',
    type: '风险报告',
    tagClass: 'bg-red-50 text-red-600',
    date: '2025-06-12',
    author: '风控部',
    size: '3.2MB',
    summary: '竞争风险中高，周边3公里内新增供应12万方...',
    Icon: AlertTriangle,
  },
  {
    id: '5',
    title: '产业园资产估值模型（2025Q2）',
    type: '估值模型',
    tagClass: 'bg-amber-50 text-amber-600',
    date: '2025-06-10',
    author: '资管部',
    size: '1.8MB',
    summary: 'DCF估值更新，资本化率区间4.5%-5.2%...',
    Icon: Lightbulb,
  },
  {
    id: '6',
    title: '商业不动产市场季度回顾',
    type: '市场报告',
    tagClass: 'bg-blue-50 text-blue-600',
    date: '2025-06-05',
    author: '市场部',
    size: '6.5MB',
    summary: 'Q2全国商业不动产成交同比+15%，北京上海领跑...',
    Icon: BarChart3,
  },
];

export default function ReportCenter() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">分析报告</h1>
        <p className="text-[13px] text-slate-500 mt-1">共 68 份报告，涵盖投决报告、行业研究、市场周报等</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['全部', '投决报告', '行业研究', '市场报告', '风险报告', '估值模型'].map((f) => (
          <button
            key={f}
            className={cn(
              'px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
              f === '全部'
                ? 'bg-[hsl(212,60%,24%)] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-2 gap-5">
        {REPORTS.map((report, i) => {
          const Icon = report.Icon;
          return (
            <motion.div
              key={report.id}
              custom={i}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{report.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', report.tagClass)}>
                        {report.type}
                      </span>
                      <span className="text-[11px] text-slate-400">{report.size}</span>
                    </div>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-slate-50 text-slate-400">
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[12px] text-slate-500 leading-relaxed mb-4">{report.summary}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {report.date}
                  </span>
                  <span>{report.author}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium group-hover:underline">
                  查看详情
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
