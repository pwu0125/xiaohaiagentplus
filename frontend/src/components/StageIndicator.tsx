import { memo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Building2, Sparkles, Gavel, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stage {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const stages: Stage[] = [
  {
    id: 'secretary',
    name: '秘书',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500',
  },
  {
    id: 'departments',
    name: '部门',
    icon: <Building2 className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
  },
  {
    id: 'master_skill',
    name: '大师',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500',
  },
  {
    id: 'decision_maker',
    name: '决策者',
    icon: <Gavel className="w-5 h-5" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
  },
];

interface StageIndicatorProps {
  currentStage: string;
  completedStages: string[];
  isRunning: boolean;
}

function StageIndicatorComponent({ currentStage, completedStages, isRunning }: StageIndicatorProps) {
  const getStatus = (stageId: string): 'pending' | 'running' | 'completed' | 'error' => {
    if (completedStages.includes(stageId)) return 'completed';
    if (currentStage === stageId) return isRunning ? 'running' : 'pending';
    return 'pending';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        {stages.map((stage, index) => {
          const status = getStatus(stage.id);
          const isActive = status === 'running';
          const isCompleted = status === 'completed';
          const isPending = status === 'pending';

          return (
            <div key={stage.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <motion.div
                  initial={false}
                  animate={
                    isActive
                      ? { scale: [1, 1.05, 1] }
                      : isCompleted
                        ? { scale: 1 }
                        : { scale: 1 }
                  }
                  transition={
                    isActive
                      ? { repeat: Infinity, duration: 2, ease: 'easeInOut' as const }
                      : { duration: 0.3 }
                  }
                  className={cn(
                    'relative flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-colors duration-300',
                    isActive && stage.borderColor,
                    isActive && stage.bgColor,
                    isCompleted && 'border-green-500 bg-green-500/20',
                    isPending && 'border-slate-600 bg-slate-800',
                  )}
                >
                  {isActive && (
                    <motion.div
                      className={cn('absolute inset-0 rounded-xl', stage.bgColor)}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' as const }}
                    />
                  )}
                  <span className={cn(
                    'relative z-10',
                    isActive && stage.color,
                    isCompleted && 'text-green-400',
                    isPending && 'text-slate-500',
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Circle className="w-5 h-5" />}
                  </span>
                  {isActive && (
                    <motion.div
                      className={cn('absolute -inset-1 rounded-xl border', stage.borderColor)}
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' as const }}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </motion.div>
                <span className={cn(
                  'mt-2 text-sm font-medium transition-colors duration-300',
                  isActive && stage.color,
                  isCompleted && 'text-green-400',
                  isPending && 'text-slate-500',
                )}>
                  {stage.name}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-slate-700 relative overflow-hidden rounded-full">
                  <motion.div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      isCompleted ? 'bg-green-500' : 'bg-transparent',
                    )}
                    initial={false}
                    animate={isCompleted ? { width: '100%' } : { width: '0%' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(StageIndicatorComponent);
