import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  Loader2,
  RotateCcw,
  TrendingUp,
  Briefcase,
  Hotel,
  KeyRound,
  Factory,
  Building2,
  ShoppingBag,
  BarChart3,
  Globe,
  MapPin,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import ReportView from '@/components/ai_product/ReportView';
import type { MaterialStreamEvent, AIProductReport } from '@/types';
import { analyzeMaterialStream } from '@/lib/api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const PROJECT_TYPES = [
  { value: 'retail', label: '购物中心', icon: ShoppingBag },
  { value: 'office_building', label: '写字楼', icon: Briefcase },
  { value: 'hotel', label: '酒店', icon: Hotel },
  { value: 'long_term_rental', label: '长租公寓', icon: KeyRound },
  { value: 'industrial', label: '产业园区', icon: Factory },
  { value: 'mixed_use', label: '城市综合体', icon: Building2 },
];

const STAGE_CONFIG = [
  { id: 'file_extract', label: '文件提取', description: '解析上传的 PDF/Excel 文件内容' },
  { id: 'secretary', label: '秘书处理', description: '结构化提取关键投资指标' },
  { id: 'report_gen', label: '报告生成', description: 'AI 生成完整投资分析报告' },
];

/* ─── Mock 报告数据 ─── */
const MOCK_REPORT: AIProductReport = {
  conclusion: '投',
  confidence: 85,
  summary: '上海环球港商业综合体项目整体评估为"投"。项目具备显著的区位优势和规模效应，48万㎡超大体量配合三轨交汇交通优势形成强大的竞争壁垒。投资模型显示预期IRR 11.2%，第4年实现正现金流，投资回收期12年处于合理区间。',
  sections: {
    overview: '<p>上海环球港位于上海市普陀区中山北路3300号，是由月星集团投资开发的超大型城市综合体。项目总建筑面积约48万平方米，其中商业面积32万平方米，办公面积10万平方米，酒店面积6万平方米。</p>',
    financial: '<p>项目总投资约120亿元人民币，预期IRR 11.2%，NPV 18.6亿元。投资结构合理，股权占比45%，债权占比55%。第4年实现正现金流，12年投资回收期处于合理区间。</p>',
    valuation: '<p>采用收益法估值，项目资产评估值约138.6亿元。Cap Rate 5.8%，高于市场平均水平，显示项目具备较好的投资价值。</p>',
    roi: '<p>预期年化回报率8.5%，高于同类项目平均水平。分阶段开发可进一步优化现金流，降低投资风险。</p>',
    risk: '<p>主要风险包括市场竞争加剧、电商冲击传统零售、利率波动等。建议通过签订长期租约、引入主力店等方式缓释风险。</p>',
  },
  key_metrics: {
    '估值': '138.6亿元',
    'Cap Rate': '5.8%',
    'IRR': '11.2%',
    '年NOI': '8.0亿元',
    '出租率': '92%',
    'DSCR': '1.35x',
    'LTV': '55%',
    'NPV': '18.6亿元',
  },
  scenarios: {
    optimistic: { irr: '14.5%', roi: '11.2%', value: '158亿元', trigger: '出租率>95%，租金年增长>5%' },
    base: { irr: '11.2%', roi: '8.5%', value: '138.6亿元', trigger: '出租率90-95%，租金年增长3-5%' },
    pessimistic: { irr: '7.8%', roi: '5.5%', value: '118亿元', trigger: '出租率<85%，租金停滞或下降' },
  },
  risks: [
    { category: '市场风险', level: '中等', description: '商业地产市场波动，受宏观经济影响较大' },
    { category: '竞争风险', level: '中高', description: '周边新建商业项目可能分流客流' },
    { category: '运营风险', level: '中低', description: '大型综合体管理复杂度高' },
    { category: '财务风险', level: '中等', description: '利率敏感性较高，需关注融资成本变化' },
    { category: '政策风险', level: '低', description: '房地产调控政策可能影响项目价值' },
  ],
  action_items: [
    '优先引入国际知名主力店作为锚店，提升项目定位',
    '签订长期租约锁定优质租户，降低空置风险',
    '采用利率互换工具对冲利率风险',
    '建立数字化运营平台提升管理效率',
    '考虑分阶段开发，酒店部分择机推出',
    '预留10-15%面积用于灵活调整业态',
    '推进节能改造降低运营成本8-12%',
  ],
  project_profile: {
    project_name: '上海环球港商业综合体',
    location: '上海市普陀区',
    developer: '月星集团',
    total_area: '480000平方米',
    project_type: '城市综合体',
  },
  macro_cycle: {
    phase: '复苏期',
    summary: '当前宏观经济处于复苏期，GDP增速回升，消费信心逐步恢复，商业地产市场呈现回暖态势。',
    indicators: [
      { name: 'GDP增速', current: '5.2%', trend: 'up', points: [{ year: '2020', value: 2.3 }, { year: '2021', value: 8.1 }, { year: '2022', value: 3.0 }, { year: '2023', value: 5.2 }, { year: '2024', value: 5.2 }] },
      { name: '社零增速', current: '7.8%', trend: 'up', points: [{ year: '2020', value: -3.9 }, { year: '2021', value: 12.5 }, { year: '2022', value: -0.2 }, { year: '2023', value: 7.2 }, { year: '2024', value: 7.8 }] },
      { name: 'CPI', current: '0.8%', trend: 'down', points: [{ year: '2020', value: 2.5 }, { year: '2021', value: 0.9 }, { year: '2022', value: 2.0 }, { year: '2023', value: 0.2 }, { year: '2024', value: 0.8 }] },
    ],
  },
  industry_cycle: {
    phase: '成熟期',
    summary: '商业地产行业进入成熟期，增速放缓但结构性机会依然存在，核心城市优质资产仍具吸引力。',
    indicators: [
      { name: '商业空置率', current: '8.5%', trend: 'down', points: [{ year: '2020', value: 12.0 }, { year: '2021', value: 10.5 }, { year: '2022', value: 11.2 }, { year: '2023', value: 9.8 }, { year: '2024', value: 8.5 }] },
      { name: '租金指数', current: '102.3', trend: 'up', points: [{ year: '2020', value: 95.0 }, { year: '2021', value: 98.5 }, { year: '2022', value: 97.0 }, { year: '2023', value: 100.0 }, { year: '2024', value: 102.3 }] },
      { name: '资本化率', current: '5.8%', trend: 'up', points: [{ year: '2020', value: 4.8 }, { year: '2021', value: 5.0 }, { year: '2022', value: 5.2 }, { year: '2023', value: 5.5 }, { year: '2024', value: 5.8 }] },
    ],
  },
  city_analysis: {
    city: '上海',
    summary: '上海作为中国商业地产最活跃的城市之一，拥有成熟的商业生态和强大的消费能力。项目所在普陀区是连接长三角的重要节点，区位优势显著。',
    project_location: { lat: 31.2356, lng: 121.4208, name: '普陀区中山北路3300号' },
    competitors: [
      { lat: 31.2397, lng: 121.4998, name: '正大广场', type: '购物中心', distance: '3.2km', area: '32万㎡' },
      { lat: 31.1962, lng: 121.4354, name: '港汇恒隆', type: '购物中心', distance: '4.5km', area: '25万㎡' },
      { lat: 31.2336, lng: 121.5056, name: '环球金融中心', type: '综合体', distance: '5.8km', area: '45万㎡' },
      { lat: 31.2304, lng: 121.4737, name: '静安嘉里中心', type: '综合体', distance: '3.8km', area: '38万㎡' },
    ],
  },
  rating: 'B+',
  score: 80,
  typed_conclusion: '投',
};

/* ─── 日志条目类型 ─── */
interface LogEntry {
  time: string;
  type: string;
  message: string;
}

/* ─── 分析阶段状态 ─── */
interface StageStatus {
  id: string;
  label: string;
  progress: number;
  completed: boolean;
  started: boolean;
}

export default function MaterialAnalysis() {
  const [files, setFiles] = useState<File[]>([]);
  const [projectType, setProjectType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // 三态: 'upload' | 'analyzing' | 'report'
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'report'>('upload');

  // 分析状态
  const [stages, setStages] = useState<StageStatus[]>(
    STAGE_CONFIG.map((s) => ({ ...s, progress: 0, completed: false, started: false }))
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [report, setReport] = useState<AIProductReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logsRef = useRef<HTMLDivElement>(null);

  /* ─── 文件拖拽处理 ─── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addLog = useCallback((type: string, message: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((prev) => [...prev, { time, type, message }]);
  }, []);

  /* ─── 开始分析 ─── */
  const handleStartAnalysis = useCallback(async () => {
    if (files.length === 0 || !projectType) return;

    setPhase('analyzing');
    setError(null);
    setLogs([]);
    setReport(null);
    setStages(STAGE_CONFIG.map((s) => ({ ...s, progress: 0, completed: false, started: false })));

    if (USE_MOCK) {
      // Mock 模式: 模拟进度
      addLog('system', '开始材料分析（Mock 模式）...');

      for (let i = 0; i < STAGE_CONFIG.length; i++) {
        const stage = STAGE_CONFIG[i];
        setStages((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], started: true };
          return next;
        });
        addLog('stage_start', `${stage.label} 开始`);

        // 模拟进度
        for (let p = 0; p <= 100; p += 25) {
          await new Promise((r) => setTimeout(r, 400));
          setStages((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], progress: p };
            return next;
          });
          addLog('stage_progress', `${stage.label} 进度 ${p}%`);
        }

        setStages((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], completed: true, progress: 100 };
          return next;
        });
        addLog('stage_complete', `${stage.label} 完成`);
      }

      addLog('flow_complete', '分析流程完成');
      setReport(MOCK_REPORT);
      setPhase('report');
      return;
    }

    // 真实 SSE 流式分析
    try {
      addLog('system', '连接到分析服务...');

      await analyzeMaterialStream(files, projectType, (event: MaterialStreamEvent) => {
        switch (event.type) {
          case 'stage_start':
            if (event.stage) {
              const idx = STAGE_CONFIG.findIndex((s) => s.id === event.stage);
              if (idx >= 0) {
                setStages((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], started: true };
                  return next;
                });
              }
              addLog('stage_start', `${event.stage} 开始`);
            }
            break;

          case 'stage_progress':
            if (event.stage && event.progress !== undefined) {
              const idx = STAGE_CONFIG.findIndex((s) => s.id === event.stage);
              if (idx >= 0) {
                setStages((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], progress: event.progress! };
                  return next;
                });
              }
            }
            break;

          case 'stage_complete':
            if (event.stage) {
              const idx = STAGE_CONFIG.findIndex((s) => s.id === event.stage);
              if (idx >= 0) {
                setStages((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], completed: true, progress: 100 };
                  return next;
                });
              }
              addLog('stage_complete', `${event.stage} 完成`);
            }
            break;

          case 'flow_complete':
            addLog('flow_complete', '分析流程完成');
            if (event.final_report?.report) {
              setReport(event.final_report.report);
            }
            setPhase('report');
            break;

          case 'error':
            addLog('error', event.error || '未知错误');
            setError(event.error || '分析过程中发生错误');
            break;
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog('error', msg);
    }
  }, [files, projectType, addLog]);

  /* ─── 重置 ─── */
  const handleReset = useCallback(() => {
    setPhase('upload');
    setFiles([]);
    setProjectType('');
    setReport(null);
    setLogs([]);
    setError(null);
    setStages(STAGE_CONFIG.map((s) => ({ ...s, progress: 0, completed: false, started: false })));
  }, []);

  /* ─── 滚动日志 ─── */
  const scrollToBottom = () => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  };

  // 日志更新时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════════════
            状态 A: 上传材料
        ═══════════════════════════════════════ */}
        {phase === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="space-y-8"
          >
            {/* 页面标题 */}
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h1 className="text-3xl font-bold text-slate-100 mb-2">材料分析</h1>
                <p className="text-slate-400 max-w-xl mx-auto">
                  上传项目材料（PDF、Excel、CSV、TXT），AI 自动提取关键指标并生成投资分析报告
                </p>
              </motion.div>
            </div>

            {/* 项目类型选择 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                <label className="block text-sm font-medium text-slate-300 mb-4">
                  选择项目类型 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PROJECT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const selected = projectType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setProjectType(type.value)}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
                          selected
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-700/30'
                        )}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{type.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* 文件上传区域 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
                <label className="block text-sm font-medium text-slate-300 mb-4">
                  上传材料 <span className="text-red-400">*</span>
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300',
                    isDragging
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
                  )}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,.csv,.txt,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="选择文件"
                  />
                  <motion.div
                    animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center',
                      isDragging ? 'bg-blue-500/20' : 'bg-slate-700'
                    )}>
                      <Upload className={cn('w-6 h-6', isDragging ? 'text-blue-400' : 'text-slate-400')} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">
                        {isDragging ? '释放以上传文件' : '拖拽文件到此处，或点击选择文件'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        支持：PDF、Excel、CSV、TXT（可多选）
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* 已选文件列表 */}
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 space-y-2"
                  >
                    <div className="text-sm text-slate-400 mb-2">已选择 {files.length} 个文件</div>
                    {files.map((file, index) => (
                      <motion.div
                        key={`${file.name}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 bg-slate-800/80 rounded-lg px-3 py-2.5 border border-slate-700"
                      >
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-300 truncate">{file.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* 开始分析按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center"
            >
              <Button
                onClick={handleStartAnalysis}
                disabled={files.length === 0 || !projectType}
                size="lg"
                className={cn(
                  'px-10 py-3 text-base font-medium rounded-xl transition-all duration-300',
                  files.length > 0 && projectType
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                开始分析
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            状态 B: 分析中
        ═══════════════════════════════════════ */}
        {phase === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            {/* 分析中标题 */}
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full mx-auto mb-4"
              />
              <h2 className="text-xl font-semibold text-slate-100 mb-1">正在分析材料...</h2>
              <p className="text-sm text-slate-400">AI 正在提取关键指标并生成报告</p>
            </div>

            {/* 阶段进度 */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 space-y-5">
              {stages.map((stage, i) => (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {stage.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                      ) : stage.started ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-600 shrink-0" />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        stage.completed ? 'text-green-400' : stage.started ? 'text-slate-100' : 'text-slate-500'
                      )}>
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{stage.progress}%</span>
                  </div>
                  <Progress value={stage.progress} className="h-2" />
                  <p className="text-xs text-slate-500">{stage.description}</p>
                </div>
              ))}
            </div>

            {/* 错误提示 */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* 实时日志 */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">实时日志</span>
                <span className="ml-auto text-xs text-slate-500 font-mono">{logs.length} 条</span>
              </div>
              <div
                ref={logsRef}
                className="h-48 overflow-y-auto p-4 space-y-1 text-xs"
                style={{ scrollBehavior: 'smooth' }}
              >
                {logs.length === 0 && (
                  <div className="text-slate-600 italic">等待分析开始...</div>
                )}
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 hover:bg-slate-800/50 rounded px-1 py-0.5"
                  >
                    <span className="text-slate-600 shrink-0 font-mono">[{log.time}]</span>
                    <span className={cn(
                      'shrink-0 font-mono text-[10px] px-1 py-0.5 rounded bg-slate-800',
                      log.type === 'stage_start' && 'text-violet-400',
                      log.type === 'stage_progress' && 'text-blue-400',
                      log.type === 'stage_complete' && 'text-green-400',
                      log.type === 'flow_complete' && 'text-green-400 font-bold',
                      log.type === 'error' && 'text-red-400 font-bold',
                      log.type === 'system' && 'text-slate-300',
                    )}>
                      {log.type.toUpperCase()}
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════
            状态 C: 报告展示
        ═══════════════════════════════════════ */}
        {phase === 'report' && report && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="space-y-6"
          >
            {/* 完成提示 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between rounded-xl border border-green-700/30 bg-green-900/10 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-green-400">分析完成</h2>
                  <p className="text-sm text-slate-400">AI 材料分析已完成，报告已自动保存至知识库</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  重新分析
                </Button>
              </div>
            </motion.div>

            {/* Tab 切换报告 */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-slate-800 border border-slate-700">
                <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  报告概览
                </TabsTrigger>
                <TabsTrigger value="macro" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <Globe className="w-3.5 h-3.5 mr-1.5" />
                  宏观周期
                </TabsTrigger>
                <TabsTrigger value="industry" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  行业周期
                </TabsTrigger>
                <TabsTrigger value="city" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <MapPin className="w-3.5 h-3.5 mr-1.5" />
                  城市分析
                </TabsTrigger>
                <TabsTrigger value="financial" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  财务分析
                </TabsTrigger>
                <TabsTrigger value="risk" className="data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  风险评估
                </TabsTrigger>
              </TabsList>

              {/* 报告概览 */}
              <TabsContent value="overview" className="space-y-6">
                <ReportView report={report} />
              </TabsContent>

              {/* 宏观周期 */}
              <TabsContent value="macro" className="space-y-6">
                <MacroCycleView report={report} />
              </TabsContent>

              {/* 行业周期 */}
              <TabsContent value="industry" className="space-y-6">
                <IndustryCycleView report={report} />
              </TabsContent>

              {/* 城市分析 */}
              <TabsContent value="city" className="space-y-6">
                <CityAnalysisView report={report} />
              </TabsContent>

              {/* 财务分析 */}
              <TabsContent value="financial" className="space-y-6">
                <FinancialView report={report} />
              </TabsContent>

              {/* 风险评估 */}
              <TabsContent value="risk" className="space-y-6">
                <RiskView report={report} />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════
   子页面组件（用于 TabsContent）
   ═══════════════════════════════════════════ */

function MacroCycleView({ report }: { report: AIProductReport }) {
  const macro = report.macro_cycle;
  if (!macro) return <EmptyTab message="暂无宏观周期数据" />;

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-violet-400" />
            宏观周期分析
          </CardTitle>
          <CardDescription className="text-slate-400">
            当前阶段:
            <Badge variant="outline" className="ml-2 bg-violet-500/10 text-violet-400 border-violet-500/30">
              {macro.phase}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {macro.summary && <p className="text-sm text-slate-300">{macro.summary}</p>}
          <IndicatorCharts indicators={macro.indicators || []} color="#8b5cf6" />
        </CardContent>
      </Card>
    </div>
  );
}

function IndustryCycleView({ report }: { report: AIProductReport }) {
  const ind = report.industry_cycle;
  if (!ind) return <EmptyTab message="暂无行业周期数据" />;

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            行业周期分析
          </CardTitle>
          <CardDescription className="text-slate-400">
            当前阶段:
            <Badge variant="outline" className="ml-2 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              {ind.phase}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {ind.summary && <p className="text-sm text-slate-300">{ind.summary}</p>}
          <IndicatorCharts indicators={ind.indicators || []} color="#06b6d4" />
        </CardContent>
      </Card>
    </div>
  );
}

function CityAnalysisView({ report }: { report: AIProductReport }) {
  const city = report.city_analysis;
  if (!city) return <EmptyTab message="暂无城市分析数据" />;

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-400" />
            城市分析
          </CardTitle>
          <CardDescription className="text-slate-400">
            城市: <span className="text-slate-200 font-medium">{city.city}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {city.summary && <p className="text-sm text-slate-300">{city.summary}</p>}

          {city.project_location && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4">
              <div className="text-xs text-slate-400 mb-1">项目位置</div>
              <div className="text-sm text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                {city.project_location.name}
                <span className="text-slate-500 text-xs">
                  ({city.project_location.lat.toFixed(4)}, {city.project_location.lng.toFixed(4)})
                </span>
              </div>
            </div>
          )}

          {city.competitors && city.competitors.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-300 mb-3">周边竞品</div>
              <div className="grid gap-2">
                {city.competitors.map((comp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500" />
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
    </div>
  );
}

function FinancialView({ report }: { report: AIProductReport }) {
  const sections = report.sections;
  if (!sections) return <EmptyTab message="暂无财务分析数据" />;

  const sectionList = [
    { key: 'overview' as const, label: '概览', icon: FileText },
    { key: 'financial' as const, label: '财务分析', icon: BarChart3 },
    { key: 'valuation' as const, label: '估值分析', icon: TrendingUp },
    { key: 'roi' as const, label: '投资回报', icon: TrendingUp },
    { key: 'risk' as const, label: '风险分析', icon: AlertTriangle },
    { key: 'financial_statements' as const, label: '财务报表', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {sectionList.map(({ key, label, icon: Icon }) => {
        const content = sections[key];
        if (!content || typeof content !== 'string') return null;
        return (
          <Card key={key} className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
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

      {/* 关键指标 */}
      {report.key_metrics && Object.keys(report.key_metrics).length > 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              关键财务指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.key_metrics).map(([k, v], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-center"
                >
                  <div className="text-xs text-slate-400 mb-1">{k}</div>
                  <div className="text-base font-semibold text-slate-100">{String(v)}</div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RiskView({ report }: { report: AIProductReport }) {
  const risks = report.risks || [];
  if (risks.length === 0) return <EmptyTab message="暂无风险评估数据" />;

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            风险评估
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {risks.map((risk, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-4"
            >
              <Badge variant="outline" className={cn('shrink-0 mt-0.5',
                risk.level.includes('高') ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                  risk.level.includes('中') ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    'bg-green-500/15 text-green-400 border-green-500/30'
              )}>
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

      {/* 行动建议 */}
      {report.action_items && report.action_items.length > 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              行动建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.action_items.map((item, i) => (
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
      )}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-12 text-center">
      <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-500">{message}</p>
    </div>
  );
}

/* ─── 共享指标图表组件 ─── */
function IndicatorCharts({ indicators, color }: { indicators: import('@/types').CycleIndicator[]; color: string }) {
  if (indicators.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 指标表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">指标</th>
              <th className="text-center py-2 px-3 text-slate-400 font-medium">当前值</th>
              <th className="text-center py-2 px-3 text-slate-400 font-medium">趋势</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => (
              <tr key={i} className="border-b border-slate-700/50 last:border-0">
                <td className="py-2 px-3 text-slate-300">{ind.name}</td>
                <td className="text-center py-2 px-3 text-slate-200 font-medium">{ind.current}</td>
                <td className="text-center py-2 px-3">
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
      <div className="grid gap-4">
        {indicators.map((ind, i) => {
          const data = (ind.points || []).map((p) => ({
            year: p.year,
            value: Number(p.value) || 0,
          }));
          if (data.length < 2) return null;

          return (
            <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400 mb-2">{ind.name}</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`grad-macro-${i}`} x1="0" y1="0" x2="0" y2="1">
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
                    fill={`url(#grad-macro-${i})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
