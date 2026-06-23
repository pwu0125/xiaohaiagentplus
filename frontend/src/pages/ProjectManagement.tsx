import { motion } from 'framer-motion';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  MapPin,
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

const PROJECTS = [
  {
    id: '1',
    name: '深圳前海商业综合体',
    code: 'SZ-QH-2025-001',
    type: '商业综合体',
    location: '深圳前海',
    status: 'completed',
    statusLabel: '投决完成',
    rating: 'A',
    ratingColor: 'bg-emerald-50 text-emerald-600',
    date: '2025-06-20',
    dept: '投资部',
    progress: 100,
  },
  {
    id: '2',
    name: '杭州滨江写字楼',
    code: 'HZ-BJ-2025-003',
    type: '写字楼',
    location: '杭州滨江',
    status: 'reviewing',
    statusLabel: '部门评审中',
    rating: 'B+',
    ratingColor: 'bg-amber-50 text-amber-600',
    date: '2025-06-18',
    dept: '设计部',
    progress: 65,
  },
  {
    id: '3',
    name: '北京朝阳长租公寓',
    code: 'BJ-CY-2025-008',
    type: '长租公寓',
    location: '北京朝阳',
    status: 'uploaded',
    statusLabel: '资料已上传',
    rating: '-',
    ratingColor: 'bg-slate-50 text-slate-400',
    date: '2025-06-15',
    dept: '市场部',
    progress: 20,
  },
  {
    id: '4',
    name: '上海浦东产业园',
    code: 'SH-PD-2025-012',
    type: '产业园',
    location: '上海浦东',
    status: 'analyzing',
    statusLabel: 'AI分析中',
    rating: '-',
    ratingColor: 'bg-blue-50 text-blue-600',
    date: '2025-06-12',
    dept: '工程部',
    progress: 45,
  },
  {
    id: '5',
    name: '成都天府仓储物流',
    code: 'CD-TF-2025-015',
    type: '仓储物流',
    location: '成都天府',
    status: 'completed',
    statusLabel: '投决完成',
    rating: 'A-',
    ratingColor: 'bg-emerald-50 text-emerald-600',
    date: '2025-06-10',
    dept: '成本部',
    progress: 100,
  },
  {
    id: '6',
    name: '广州南沙购物中心',
    code: 'GZ-NS-2025-018',
    type: '购物中心',
    location: '广州南沙',
    status: 'pending',
    statusLabel: '待启动',
    rating: '-',
    ratingColor: 'bg-slate-50 text-slate-400',
    date: '2025-06-08',
    dept: '投资部',
    progress: 0,
  },
];

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  completed: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  reviewing: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
  uploaded: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-500' },
  analyzing: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600' },
  pending: { dot: 'bg-slate-300', bg: 'bg-slate-50', text: 'text-slate-400' },
};

export default function ProjectManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">项目管理</h1>
        <p className="text-[13px] text-slate-500 mt-1">共 42 个在管项目，6 个处于活跃流程中</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: '活跃项目', value: '6', icon: FolderOpen, color: 'blue' },
          { label: '投决完成', value: '28', icon: CheckCircle2, color: 'green' },
          { label: '评审中', value: '4', icon: Clock, color: 'amber' },
          { label: '待启动', value: '3', icon: AlertCircle, color: 'slate' },
        ].map((s, i) => {
          const Icon = s.icon;
          const colors: Record<string, { border: string; icon: string; text: string }> = {
            blue: { border: 'border-blue-500', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-600' },
            green: { border: 'border-emerald-500', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600' },
            amber: { border: 'border-amber-500', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-600' },
            slate: { border: 'border-slate-400', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-500' },
          };
          const c = colors[s.color];
          return (
            <motion.div
              key={s.label}
              custom={i}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className={cn(
                'bg-white border border-slate-200 rounded-xl p-5 relative',
                'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:rounded-t-xl',
                c.border
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-medium">{s.label}</span>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.icon)}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Project list */}
      <motion.div
        custom={5}
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-900">项目列表</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 transition-all">
              全部
            </button>
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 transition-all">
              投决中
            </button>
            <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 transition-all">
              已完成
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">项目信息</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">物业类型</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">位置</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">状态</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">投决评级</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">当前部门</th>
                <th className="text-right py-3 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">流程进度</th>
              </tr>
            </thead>
            <tbody>
              {PROJECTS.map((p) => {
                const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{p.code}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {p.location}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit', status.bg, status.text)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                        {p.statusLabel}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', p.ratingColor)}>
                        {p.rating}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-600">{p.dept}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              p.progress === 100 ? 'bg-emerald-500' : p.progress > 50 ? 'bg-blue-500' : 'bg-amber-500'
                            )}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 w-8 text-right">{p.progress}%</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
