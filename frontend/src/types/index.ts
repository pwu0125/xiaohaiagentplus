// SSE事件类型
export interface StreamEvent {
  type: 'stage_start' | 'stage_complete' | 'department_started' |
        'department_complete' | 'stage_progress' | 'flow_complete' | 'error';
  stage?: string;
  department?: string;
  result?: any;
  progress?: number;
  error?: string;
  message?: string;
  session_id?: string;
  final_report?: any;
}

// 流程状态
export interface FlowStatus {
  currentStage: string;
  completedStages: string[];
  departmentStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
  intermediateResults: Record<string, any>;
  finalReport: any | null;
  error: string | null;
  isConnected: boolean;
  isRunning: boolean;
}

// 秘书Agent输出
export interface SecretaryOutput {
  project_name: string;
  extracted_fields: {
    basic_info: Record<string, any>;
    financial_data: Record<string, any>;
    operational_data: Record<string, any>;
    market_context: Record<string, any>;
  };
  missing_fields: string[];
  material_summary: string;
  structured_content: string;
}

// 部门分析结果
export interface DepartmentOutput {
  department: string;
  [key: string]: any;
  score?: number;
}

// 大师Skill输出
export interface MasterSkillOutput {
  skill_name: string;
  key_insights: string[];
  critical_questions: string[];
  cross_department_analysis: string;
  additional_analysis: string;
  strategic_recommendations: string[];
}

// 最终报告
export interface FinalReport {
  typed_conclusion: string;
  rating: string;
  score: number;
  summary: string;
  key_metrics: Record<string, any>;
  risks: any[];
  recommendations: string[];
  department_scores: Record<string, number>;
  final_assessment: string;
}

// 书签/笔记条目
export interface BookmarkOut {
  id: string;
  title: string;
  url?: string | null;
  content?: string | null;
  tags: string[];
  bookmark_type: 'bookmark' | 'note';
  created_at: string;
  updated_at: string;
}

export interface BookmarkListResponse {
  items: BookmarkOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  subtitle: string;
}

export interface AgentDiscussResult {
  agent_id: string;
  agent_name: string;
  agent_subtitle: string;
  content: string;
  timestamp: string;
  error?: string;
}

export interface AgentDiscussResponse {
  topic: string;
  results: AgentDiscussResult[];
  total: number;
}

// 阶段配置
export interface StageConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
}
