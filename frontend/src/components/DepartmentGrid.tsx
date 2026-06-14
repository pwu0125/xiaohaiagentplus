import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Calculator,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  BarChart3,
  Cog,
  Palette,
  Wrench,
  Receipt,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepartmentGridProps {
  departmentStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
  intermediateResults: Record<string, any>;
}

const departments = [
  {
    id: 'investment',
    name: '投资部',
    description: '投资回报、IRR/NPV、资本结构',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    avatarBorder: 'border-red-400',
    activeBorder: 'border-red-400',
    pulseColor: 'bg-red-400',
  },
  {
    id: 'asset_management',
    name: '资管部',
    description: '资产增值、tenant mix、运营效率',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    avatarBorder: 'border-indigo-400',
    activeBorder: 'border-indigo-400',
    pulseColor: 'bg-indigo-400',
  },
  {
    id: 'market',
    name: '市场部',
    description: '市场规模、竞争格局、需求分析',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    avatarBorder: 'border-cyan-400',
    activeBorder: 'border-cyan-400',
    pulseColor: 'bg-cyan-400',
  },
  {
    id: 'operation',
    name: '运营部',
    description: '运营模式、管理团队、服务质量',
    icon: <Cog className="w-6 h-6" />,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    avatarBorder: 'border-teal-400',
    activeBorder: 'border-teal-400',
    pulseColor: 'bg-teal-400',
  },
  {
    id: 'financial',
    name: '财务部',
    description: '收益预测、成本结构、现金流',
    icon: <Calculator className="w-6 h-6" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    avatarBorder: 'border-emerald-400',
    activeBorder: 'border-emerald-400',
    pulseColor: 'bg-emerald-400',
  },
  {
    id: 'design',
    name: '设计部',
    description: '空间规划、动线设计、用户体验',
    icon: <Palette className="w-6 h-6" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    avatarBorder: 'border-pink-400',
    activeBorder: 'border-pink-400',
    pulseColor: 'bg-pink-400',
  },
  {
    id: 'engineering',
    name: '工程部',
    description: '施工可行性、技术方案、工期评估',
    icon: <Wrench className="w-6 h-6" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    avatarBorder: 'border-orange-400',
    activeBorder: 'border-orange-400',
    pulseColor: 'bg-orange-400',
  },
  {
    id: 'cost',
    name: '成本部',
    description: '建设成本、运营成本、成本优化',
    icon: <Receipt className="w-6 h-6" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    avatarBorder: 'border-yellow-400',
    activeBorder: 'border-yellow-400',
    pulseColor: 'bg-yellow-400',
  },
  {
    id: 'legal',
    name: '法律部',
    description: '法律合规、合同风险、产权问题',
    icon: <Scale className="w-6 h-6" />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    avatarBorder: 'border-violet-400',
    activeBorder: 'border-violet-400',
    pulseColor: 'bg-violet-400',
  },
];

function DepartmentGridComponent({ departmentStatuses, intermediateResults }: DepartmentGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {departments.map((dept, index) => {
        const status = departmentStatuses[dept.id] || 'pending';
        const result = intermediateResults[dept.id];
        const isRunning = status === 'running';
        const isCompleted = status === 'completed';
        const isError = status === 'error';

        return (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            }}
            className={cn(
              'relative rounded-xl border p-5 transition-all duration-300',
              dept.bgColor,
              isRunning && dept.activeBorder,
              isCompleted && 'border-green-500/40 bg-green-500/5',
              isError && 'border-red-500/40 bg-red-500/5',
              !isRunning && !isCompleted && !isError && dept.borderColor,
            )}
          >
            {isRunning && (
              <motion.div
                className={cn('absolute inset-0 rounded-xl opacity-20', dept.pulseColor)}
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' as const }}
              />
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`/depts/${dept.id}.png`}
                    alt={dept.name}
                    className={cn(
                      'w-14 h-14 rounded-full object-cover border-2 shrink-0',
                      isRunning && dept.avatarBorder,
                      isCompleted && 'border-green-400',
                      isError && 'border-red-400',
                      !isRunning && !isCompleted && !isError && 'border-slate-600',
                    )}
                  />
                  <h3 className="font-semibold text-slate-100">{dept.name}</h3>
                </div>
                <StatusBadge status={status} deptColor={dept.color} />
              </div>

              <p className="text-sm text-slate-400 mb-4">{dept.description}</p>

              <AnimatePresence mode="wait">
                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Loader2 className={cn('w-4 h-4 animate-spin', dept.color)} />
                    <span className={cn(dept.color)}>正在分析中...</span>
                  </motion.div>
                )}

                {isCompleted && result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {'score' in result && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">综合评分</span>
                            <span className="text-lg font-bold text-green-400">{result.score}</span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${result.score}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                              className={cn(
                                'h-full rounded-full',
                                result.score >= 80 ? 'bg-green-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-red-500',
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, deptColor }: { status: string; deptColor: string }) {
  if (status === 'running') {
    return (
      <span className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium', deptColor, 'bg-slate-800')}>
        <Loader2 className="w-3 h-3 animate-spin" />
        分析中
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium text-green-400 bg-green-500/10">
        <CheckCircle2 className="w-3 h-3" />
        已完成
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium text-red-400 bg-red-500/10">
        <AlertCircle className="w-3 h-3" />
        错误
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium text-slate-500 bg-slate-800">
      <Clock className="w-3 h-3" />
      等待中
    </span>
  );
}

export default memo(DepartmentGridComponent);
