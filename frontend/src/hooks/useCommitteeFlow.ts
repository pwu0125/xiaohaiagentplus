import { useState, useCallback, useRef } from 'react';
import type { FlowStatus, StreamEvent } from '@/types';
import { analyzeProjectStreamAuto } from '@/lib/api';

const DEFAULT_DEPARTMENTS = [
  'investment',
  'asset_management',
  'market',
  'operation',
  'financial',
  'design',
  'engineering',
  'cost',
  'legal',
];

function buildInitialStatus(selectedDepts: string[]): FlowStatus {
  const deptStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'> = {};
  selectedDepts.forEach((d) => {
    deptStatuses[d] = 'pending';
  });
  return {
    currentStage: '',
    completedStages: [],
    departmentStatuses: deptStatuses,
    intermediateResults: {},
    finalReport: null,
    error: null,
    isConnected: false,
    isRunning: false,
  };
}

export function useCommitteeFlow() {
  const [flowStatus, setFlowStatus] = useState<FlowStatus>(buildInitialStatus(DEFAULT_DEPARTMENTS));
  const [logs, setLogs] = useState<Array<{ time: string; type: string; message: string }>>([]);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const addLog = useCallback((type: string, message: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs((prev) => [...prev, { time, type, message }]);
  }, []);

  const handleEvent = useCallback(
    (event: StreamEvent) => {
      setFlowStatus((prev) => {
        const next = { ...prev };

        switch (event.type) {
          case 'stage_start':
            next.currentStage = event.stage || '';
            next.isConnected = true;
            addLog('stage_start', `阶段开始: ${getStageName(event.stage || '')}`);
            break;

          case 'stage_progress':
            next.isConnected = true;
            addLog('stage_progress', `${getStageName(event.stage || '')} 进度: ${Math.round((event.progress || 0) * 100)}%`);
            break;

          case 'stage_complete':
            next.currentStage = '';
            next.completedStages = [...prev.completedStages, event.stage || ''];
            next.intermediateResults = {
              ...prev.intermediateResults,
              [event.stage || '']: event.result,
            };
            if (event.stage === 'decision_maker' && event.result) {
              next.finalReport = event.result;
            }
            addLog('stage_complete', `阶段完成: ${getStageName(event.stage || '')}`);
            break;

          case 'department_started':
            // Only track departments that are in our status map
            if (prev.departmentStatuses[event.department || ''] !== undefined) {
              next.departmentStatuses = {
                ...prev.departmentStatuses,
                [event.department || '']: 'running',
              };
            }
            addLog('department_started', `部门开始分析: ${getDeptName(event.department || '')}`);
            break;

          case 'department_complete':
            if (prev.departmentStatuses[event.department || ''] !== undefined) {
              next.departmentStatuses = {
                ...prev.departmentStatuses,
                [event.department || '']: 'completed',
              };
              next.intermediateResults = {
                ...prev.intermediateResults,
                [event.department || '']: event.result,
              };
            }
            addLog('department_complete', `部门分析完成: ${getDeptName(event.department || '')} (评分: ${event.result?.score ?? '-'})`);
            break;

          case 'flow_complete':
            next.isRunning = false;
            next.isConnected = false;
            if (event.result) {
              next.finalReport = event.result;
            }
            // Also check for final_report in the event
            if (event.final_report) {
              next.finalReport = event.final_report;
            }
            addLog('flow_complete', '分析流程全部完成');
            break;

          case 'error':
            next.error = event.error || event.message || '未知错误';
            addLog('error', `错误: ${next.error}`);
            break;
        }

        return next;
      });
    },
    [addLog]
  );

  const startAnalysis = useCallback(
    async (files: File[], projectType: string, selectedDepts: string[], selectedMasters: string[] = []) => {
      setFlowStatus({ ...buildInitialStatus(selectedDepts), isRunning: true });
      setLogs([]);
      addLog('system', `开始分析流程... 选中 ${selectedDepts.length} 个部门`);

      try {
        await analyzeProjectStreamAuto(
          files,
          projectType,
          selectedDepts,
          selectedMasters,
          handleEvent,
          (error) => {
            setFlowStatus((prev) => ({
              ...prev,
              error: error.message,
              isRunning: false,
              isConnected: false,
            }));
            addLog('error', `连接错误: ${error.message}`);
          },
          () => {
            setFlowStatus((prev) => ({
              ...prev,
              isRunning: false,
              isConnected: false,
            }));
            addLog('system', '分析完成');
          }
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setFlowStatus((prev) => ({
          ...prev,
          error: msg,
          isRunning: false,
          isConnected: false,
        }));
        addLog('error', `异常: ${msg}`);
      }
    },
    [handleEvent, addLog]
  );

  const reset = useCallback(() => {
    setFlowStatus(buildInitialStatus(DEFAULT_DEPARTMENTS));
    setLogs([]);
  }, []);

  return { flowStatus, logs, handleEvent, startAnalysis, reset };
}

function getStageName(stage: string): string {
  const names: Record<string, string> = {
    secretary: '秘书Agent',
    departments: '部门Agent',
    master_skill: '大师Skill',
    decision_maker: '决策者',
  };
  return names[stage] || stage;
}

function getDeptName(dept: string): string {
  const names: Record<string, string> = {
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
  return names[dept] || dept;
}
