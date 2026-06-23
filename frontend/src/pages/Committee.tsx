import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommitteeFlow } from '@/hooks/useCommitteeFlow';
import FileUpload from '@/components/FileUpload';
import FlowProgress from '@/components/FlowProgress';
import FinalReport from '@/components/FinalReport';
import { MASTER_OPTIONS } from '@/data/masters';

export default function Home() {
  const { flowStatus, logs, startAnalysis, reset } = useCommitteeFlow();

  const handleStart = useCallback(
    async (files: File[], projectType: string, selectedDepts: string[], selectedMasters: string[]) => {
      await startAnalysis(files, projectType, selectedDepts, selectedMasters);
    },
    [startAnalysis]
  );

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!flowStatus.isRunning && !flowStatus.finalReport && (
          <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}>

            <div className="text-center mb-10">
              <motion.img src="/xiaohai-original.png" alt="小海Agent"
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-500/30 shadow-xl shadow-blue-500/20 mx-auto mb-5"
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} />
              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="text-4xl font-bold text-slate-900 mb-3">小海Agent</motion.h2>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-xl text-blue-400 mb-2">智能投资分析</motion.p>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-base text-slate-400 max-w-xl mx-auto">上传项目材料，由多Agent协同完成结构化提取、部门分析、大师洞察和最终决策</motion.p>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
              {[
                { step: '1', title: '秘书Agent', desc: '结构化提取材料信息', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { step: '2', title: '部门Agent', desc: '9部门并行分析', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { step: '3', title: '大师Skill', desc: `${MASTER_OPTIONS.length}位大师综合洞察`, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { step: '4', title: '决策者', desc: '最终投资结论', color: 'text-green-400', bg: 'bg-green-500/10' },
              ].map((item) => (
                <div key={item.step} className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 text-center">
                  <div className={`w-10 h-10 rounded-lg ${item.bg} ${item.color} flex items-center justify-center text-base font-bold mx-auto mb-3`}>{item.step}</div>
                  <div className="text-base font-medium text-slate-200">{item.title}</div>
                  <div className="text-sm text-slate-500 mt-1">{item.desc}</div>
                </div>
              ))}
            </motion.div>

            <FileUpload onStart={handleStart} />
          </motion.div>
        )}

        {flowStatus.isRunning && (
          <motion.div key="progress" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}>
            <FlowProgress flowStatus={flowStatus} logs={logs} />
          </motion.div>
        )}

        {flowStatus.finalReport && !flowStatus.isRunning && (
          <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }} className="space-y-6">

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="flex items-center justify-between rounded-xl border border-green-700/30 bg-green-900/10 p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-xl">✓</div>
                <div>
                  <h2 className="text-lg font-semibold text-green-400">分析完成</h2>
                  <p className="text-base text-slate-400">小海Agent已完成全部分析流程</p>
                </div>
              </div>
              <Button onClick={reset} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100 text-base px-4 py-2">
                <RotateCcw className="w-5 h-5 mr-2" />新的分析
              </Button>
            </motion.div>

            <FlowProgress flowStatus={flowStatus} logs={logs} />
            <FinalReport report={flowStatus.finalReport} />
            <div className="flex justify-center pt-4 pb-8">
              <Button onClick={reset} variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100 px-8 text-base">
                <RotateCcw className="w-5 h-5 mr-2" />开始新的分析
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
