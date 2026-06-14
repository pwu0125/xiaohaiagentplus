import { memo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import type { FlowStatus } from '@/types';
import StageIndicator from './StageIndicator';
import DepartmentGrid from './DepartmentGrid';
import TerminalLog from './TerminalLog';
import CollapsibleSection from './CollapsibleSection';

interface FlowProgressProps {
  flowStatus: FlowStatus;
  logs: Array<{ time: string; type: string; message: string }>;
}

function FlowProgressComponent({ flowStatus, logs }: FlowProgressProps) {
  const showDepartments =
    flowStatus.currentStage === 'departments' ||
    flowStatus.completedStages.includes('departments') ||
    flowStatus.completedStages.includes('master_skill') ||
    flowStatus.completedStages.includes('decision_maker');

  const hasIntermediateResults = Object.keys(flowStatus.intermediateResults).length > 0;

  const formatJson = (data: any): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* 阶段指示器 */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-slate-100">流程进度</h3>
        </div>
        <StageIndicator
          currentStage={flowStatus.currentStage}
          completedStages={flowStatus.completedStages}
          isRunning={flowStatus.isRunning}
        />
      </div>

      {/* 部门分析状态 */}
      {showDepartments && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">部门Agent分析状态</h3>
          <DepartmentGrid
            departmentStatuses={flowStatus.departmentStatuses}
            intermediateResults={flowStatus.intermediateResults}
          />
        </div>
      )}

      {/* 中间结果折叠面板 */}
      {hasIntermediateResults && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400">中间结果详情</h3>

          {flowStatus.intermediateResults.secretary && (
            <CollapsibleSection
              title="秘书Agent - 结构化提取"
              subtitle={flowStatus.intermediateResults.secretary?.project_name || ''}
              variant="info"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.secretary)}
              </pre>
            </CollapsibleSection>
          )}

          {flowStatus.intermediateResults.market && (
            <CollapsibleSection
              title="市场分析 - 详细结果"
              subtitle={`评分: ${flowStatus.intermediateResults.market?.score ?? '-'}`}
              variant="default"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.market)}
              </pre>
            </CollapsibleSection>
          )}

          {flowStatus.intermediateResults.financial && (
            <CollapsibleSection
              title="财务建模 - 详细结果"
              subtitle={`评分: ${flowStatus.intermediateResults.financial?.score ?? '-'}`}
              variant="success"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.financial)}
              </pre>
            </CollapsibleSection>
          )}

          {flowStatus.intermediateResults.risk && (
            <CollapsibleSection
              title="风险评估 - 详细结果"
              subtitle={`评分: ${flowStatus.intermediateResults.risk?.score ?? '-'} | 风险等级: ${flowStatus.intermediateResults.risk?.overall_risk_level || '-'}`}
              variant="warning"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.risk)}
              </pre>
            </CollapsibleSection>
          )}

          {flowStatus.intermediateResults.master_skill && (
            <CollapsibleSection
              title="大师Skill - 综合洞察"
              subtitle={flowStatus.intermediateResults.master_skill?.skill_name || ''}
              variant="info"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.master_skill)}
              </pre>
            </CollapsibleSection>
          )}

          {flowStatus.intermediateResults.decision_maker && (
            <CollapsibleSection
              title="决策者 - 最终决策"
              subtitle={`结论: ${flowStatus.intermediateResults.decision_maker?.typed_conclusion || '-'} | 评级: ${flowStatus.intermediateResults.decision_maker?.rating || '-'}`}
              variant="success"
            >
              <pre className="terminal-text text-xs text-slate-300 overflow-auto max-h-96 bg-slate-900/50 p-3 rounded-lg">
                {formatJson(flowStatus.intermediateResults.decision_maker)}
              </pre>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* 终端日志 */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-3">实时日志</h3>
        <TerminalLog logs={logs} />
      </div>
    </motion.div>
  );
}

export default memo(FlowProgressComponent);
