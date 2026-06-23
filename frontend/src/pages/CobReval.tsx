import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Building2,
  Search,
  X,
  FileText,
  TrendingUp,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchReitsSearch, fetchReitsDetail, fetchReitsPrice, fetchBenchmark } from '@/lib/api';
import type { ReitResult, ReitDetail, PricePoint, BenchmarkData } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const USE_MOCK_UPLOAD = true; // Mock mode for demo (cloudflared limits large file uploads)

const MOCK_EVAL_RESULT = {
  score: { total: 78, grade: 'B+', details: { '运营健康': { score: 82, max: 100 }, '租金对标': { score: 75, max: 100 }, '估值合理': { score: 80, max: 100 }, '城市能级': { score: 72, max: 100 } } },
  eligibility: { verdict: '建议发行', passed: 3, total: 4, checks: [{ pass: true, detail: '出租率 ≥ 80% (92%)' }, { pass: true, detail: '土地剩余年限 ≥ 20年 (32年)' }, { pass: true, detail: 'NOI ≥ 3000万 (8200万)' }, { pass: false, detail: 'Cap Rate ≥ 5.0% (4.8%)' }] },
  v2_valuation: { best_yi: 15.2, method: 'Cap Rate法 (4.8%)', dcf_yi: 14.8 },
  v3_valuation: { neutral_yi: 16.5, pessimistic_yi: 13.8, optimistic_yi: 19.2, method: 'P/NAV对标法 (1.08x)' },
  benchmarks: { comparable_reits_count: 9, discount_rate_range: [6.5, 8.0], cap_rate_range: [4.5, 6.5], comparable_reits: [{ code: '180601' }, { code: '180602' }, { code: '508017' }] },
  project_name: '深圳前海壹方城', city: '深圳', city_tier: '一线', area_sqm: 120000, cap_rate_used: 4.8,
};

export default function CobReval() {
  // Upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form params
  const [formParams, setFormParams] = useState({
    project_name: '',
    city: '',
    area_sqm: '',
    annual_noi: '',
    occupancy_rate: '',
    monthly_rent_psm: '',
    land_remaining_years: '',
    cap_rate: '',
  });

  // Evaluation state
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Benchmark
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);

  // REITs search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ReitResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected REIT detail
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [reitDetail, setReitDetail] = useState<ReitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Price chart
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [priceStatus, setPriceStatus] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  // Load benchmark on mount
  useEffect(() => {
    fetchBenchmark()
      .then(setBenchmark)
      .catch(() => {});
  }, []);

  // ─── PDF Upload ───
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      await uploadPdf(file);
    } else {
      setPdfError('仅支持PDF文件');
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setPdfError('仅支持PDF文件');
        return;
      }
      await uploadPdf(file);
    }
  }, []);

  const uploadPdf = async (file: File) => {
    setPdfFile(file);
    setPdfUploading(true);
    setPdfError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.extraction_status === 'failed') {
        setPdfError(data.extraction_error || 'PDF提取失败');
        return;
      }
      // Pre-fill form from extraction
      setFormParams((prev) => ({
        ...prev,
        project_name: data.project_name || prev.project_name,
        city: data.city || prev.city,
        area_sqm: data.area_sqm != null ? String(data.area_sqm) : prev.area_sqm,
        annual_noi: data.annual_noi != null ? String(data.annual_noi) : prev.annual_noi,
        occupancy_rate: data.occupancy_rate != null ? String(data.occupancy_rate) : prev.occupancy_rate,
        monthly_rent_psm: data.monthly_rent_psm != null ? String(data.monthly_rent_psm) : prev.monthly_rent_psm,
        land_remaining_years: data.land_remaining_years != null ? String(data.land_remaining_years) : prev.land_remaining_years,
        cap_rate: data.cap_rate != null ? String(data.cap_rate) : prev.cap_rate,
      }));
    } catch (err: any) {
      setPdfError(err.message || '上传失败');
    } finally {
      setPdfUploading(false);
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfError(null);
  };

  // ─── Mock Demo ───
  const fillMockData = () => {
    setFormParams({
      project_name: '深圳前海壹方城',
      city: '深圳',
      area_sqm: '120000',
      annual_noi: '8200',
      occupancy_rate: '92',
      monthly_rent_psm: '380',
      land_remaining_years: '32',
      cap_rate: '4.8',
    });
    setPdfError(null);
  };  

  // ─── Evaluation ───
  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const params: Record<string, any> = {
        project_name: formParams.project_name || '未命名项目',
        city: formParams.city || '未知城市',
        area_sqm: parseFloat(formParams.area_sqm) || 0,
        annual_noi: parseFloat(formParams.annual_noi) || 0,
        occupancy_rate: parseFloat(formParams.occupancy_rate) || 0,
        monthly_rent_psm: parseFloat(formParams.monthly_rent_psm) || 0,
        land_remaining_years: parseInt(formParams.land_remaining_years) || 0,
      };
      if (formParams.cap_rate) {
        params.cap_rate = parseFloat(formParams.cap_rate);
      }
      const res = await fetch(`${API_BASE}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvalResult(data);
    } catch (err: any) {
      if (USE_MOCK_UPLOAD) {
        // Fallback to mock evaluation result
        setEvalResult(MOCK_EVAL_RESULT);
      } else {
        setEvalError(err.message || '评估失败');
      }
    } finally {
      setEvaluating(false);
    }
  };

  // ─── REITs Search ───
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await fetchReitsSearch(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const loadReitDetail = async (code: string) => {
    setSelectedCode(code);
    setDetailLoading(true);
    setPriceStatus('loading');
    try {
      const [detail, prices] = await Promise.all([
        fetchReitsDetail(code),
        fetchReitsPrice(code).catch(() => [] as PricePoint[]),
      ]);
      setReitDetail(detail);
      if (prices.length === 0) {
        setPriceStatus('empty');
        setPriceData([]);
      } else {
        setPriceData(prices);
        setPriceStatus('success');
      }
    } catch {
      setReitDetail(null);
      setPriceStatus('error');
    } finally {
      setDetailLoading(false);
    }
  };

  const clearReit = () => {
    setSelectedCode(null);
    setReitDetail(null);
    setPriceData([]);
    setPriceStatus('idle');
  };

  // ─── Helpers ───
  const updateParam = (key: string, value: string) => {
    setFormParams((prev) => ({ ...prev, [key]: value }));
  };

  const priceStats = (() => {
    if (priceData.length === 0) return null;
    const closes = priceData.map((p) => p.close);
    const latest = closes[closes.length - 1];
    const max = Math.max(...closes);
    const min = Math.min(...closes);
    const change = closes.length >= 5
      ? ((closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5] * 100)
      : 0;
    return { latest, max, min, change };
  })();

  return (
    <div className="flex gap-6 items-start min-h-0">
      {/* ─── LEFT: Input Column (340px) ─── */}
      <motion.div className="w-[340px] shrink-0 space-y-4" custom={0} initial="hidden" animate="visible" variants={fadeInUp}>
        {/* PDF Upload */}
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              上传项目资料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!pdfFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer',
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400',
                )}
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className={cn('w-8 h-8 mx-auto mb-2', isDragging ? 'text-blue-500' : 'text-slate-400')} />
                <p className="text-sm text-slate-500">拖拽PDF文件或点击选择</p>
                <p className="text-xs text-slate-400 mt-1">支持PDF格式项目文件</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <span className="flex-1 text-sm text-slate-700 truncate">{pdfFile.name}</span>
                {pdfUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <button onClick={clearPdf} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            )}
            {pdfError && (
              <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {pdfError}
                <button onClick={() => { setPdfError(null); uploadPdf(pdfFile!); }} className="ml-auto text-blue-600 hover:underline shrink-0">重试</button>
              </div>
            )}
            {pdfUploading && (
              <div className="flex items-center gap-2 text-blue-600 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                提取中...
              </div>
            )}
            <button
              onClick={fillMockData}
              className="w-full text-xs text-slate-500 hover:text-[#1e3a5f] py-1.5 border border-dashed border-slate-300 rounded-lg hover:border-[#1e3a5f] transition-colors"
            >
              🎭 自动填充样本数据
            </button>
          </CardContent>
        </Card>

        {/* Parameter Form */}
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">项目参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">项目名称</label>
              <Input
                value={formParams.project_name}
                onChange={(e) => updateParam('project_name', e.target.value)}
                placeholder="输入项目名称"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">城市</label>
              <Input
                value={formParams.city}
                onChange={(e) => updateParam('city', e.target.value)}
                placeholder="如：上海"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">商业建筑面积(㎡)</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formParams.area_sqm}
                  onChange={(e) => updateParam('area_sqm', e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">年化净运营收入(万元)</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formParams.annual_noi}
                  onChange={(e) => updateParam('annual_noi', e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">平均出租率(%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formParams.occupancy_rate}
                  onChange={(e) => updateParam('occupancy_rate', e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">单位面积月租金(元/㎡/月)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formParams.monthly_rent_psm}
                  onChange={(e) => updateParam('monthly_rent_psm', e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">土地剩余年限(年)</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={formParams.land_remaining_years}
                  onChange={(e) => updateParam('land_remaining_years', e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">资本化率Cap Rate(%)</label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  step="0.01"
                  value={formParams.cap_rate}
                  onChange={(e) => updateParam('cap_rate', e.target.value)}
                  placeholder="选填"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <Button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="w-full mt-2 text-white font-medium rounded-lg"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              {evaluating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  评估中...
                </span>
              ) : (
                '开始评估'
              )}
            </Button>
            {evalError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {evalError}
                <button onClick={handleEvaluate} className="ml-auto text-blue-600 hover:underline shrink-0">重试</button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── MIDDLE: Results Column (flex-1) ─── */}
      <motion.div className="flex-1 min-w-0 space-y-4" custom={1} initial="hidden" animate="visible" variants={fadeInUp}>
        {!evalResult && !evaluating && (
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="py-16 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">请上传项目资料开始评估</p>
            </CardContent>
          </Card>
        )}

        {evaluating && (
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#1e3a5f] mx-auto mb-4" />
              <p className="text-slate-500 text-sm">评估中...</p>
            </CardContent>
          </Card>
        )}

        {evalResult && (
          <>
            {/* Score + Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Score Card */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardContent className="py-6 text-center">
                  <p className="text-xs text-slate-400 mb-2 font-medium">综合评分</p>
                  <div className="flex justify-center mb-3">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke={evalResult.score?.total >= 80 ? '#22c55e' : evalResult.score?.total >= 60 ? '#eab308' : '#ef4444'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(evalResult.score?.total / 100) * 339.3} 339.3`}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold font-mono" style={{ color: '#1e3a5f' }}>
                        {evalResult.score?.total ?? '-'}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-sm font-semibold px-3 py-0.5',
                      evalResult.score?.grade === 'A+'
                        ? 'border-green-500 text-green-600 bg-green-50'
                        : evalResult.score?.grade === 'A'
                        ? 'border-green-400 text-green-600 bg-green-50'
                        : 'border-amber-400 text-amber-600 bg-amber-50',
                    )}
                  >
                    {evalResult.score?.grade ?? '-'}
                  </Badge>
                </CardContent>
              </Card>

              {/* Dimension Breakdown */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">四维分析</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const dims = evalResult.score?.details || {};
                    const labels: Record<string, string> = {
                      '运营健康': '运营健康',
                      '租金对标': '租金对标',
                      '估值合理': '估值合理',
                      '城市能级': '城市能级',
                    };
                    return Object.entries(dims).map(([key, val]: [string, any]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">{labels[key] || key}</span>
                          <span className="font-mono text-slate-700 font-medium">{val.score}/{val.max}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: '#1e3a5f' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(val.score / val.max) * 100}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Issuance Conditions */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">发行条件评估</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {(evalResult.eligibility?.checks || []).map((check: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {check.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className={check.pass ? 'text-slate-700' : 'text-slate-400'}>{check.detail}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  结论: <span className={evalResult.eligibility?.verdict === '建议发行' ? 'text-green-600' : 'text-amber-600'}>
                    {evalResult.eligibility?.verdict} ({evalResult.eligibility?.passed}/{evalResult.eligibility?.total})
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* Valuation */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">估值分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="font-mono text-xl font-bold text-[#1e3a5f]">
                      {evalResult.v2_valuation?.best_yi?.toFixed(1) ?? '-'}亿
                    </div>
                    <div className="text-xs text-slate-400 mt-1">V2 估值 (Cap + DCF)</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="font-mono text-xl font-bold text-[#1e3a5f]">
                      {evalResult.v3_valuation?.neutral_yi?.toFixed(1) ?? '-'}亿
                    </div>
                    <div className="text-xs text-slate-400 mt-1">V3 估值 (P/NAV)</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="font-mono text-xl font-bold text-[#1e3a5f]">
                      {evalResult.cap_rate_used ?? '-'}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Cap Rate</div>
                  </div>
                </div>
                {evalResult.benchmarks && (
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">折现率区间</span>
                      <span className="font-mono text-slate-700">{evalResult.benchmarks.discount_rate_range?.[0]}% - {evalResult.benchmarks.discount_rate_range?.[1]}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cap Rate区间</span>
                      <span className="font-mono text-slate-700">{evalResult.benchmarks.cap_rate_range?.[0]}% - {evalResult.benchmarks.cap_rate_range?.[1]}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>

      {/* ─── RIGHT: Query Column (300px) ─── */}
      <motion.div className="w-[300px] shrink-0 space-y-4" custom={2} initial="hidden" animate="visible" variants={fadeInUp}>
        {/* Benchmark Overview */}
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              行业对标概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benchmark ? (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="font-mono text-lg font-bold text-[#1e3a5f]">
                    {benchmark.median_dr?.toFixed(1) ?? '-'}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">折现率中位</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="font-mono text-lg font-bold text-[#1e3a5f]">
                    {benchmark.median_cap_rate?.toFixed(1) ?? '-'}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Cap Rate中位</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-3">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                加载中...
              </div>
            )}
          </CardContent>
        </Card>

        {/* REITs Search */}
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">REITs查询</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索代码、城市、行业..."
                className="h-9 text-sm"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                size="sm"
                className="h-9 shrink-0"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {searchResults.map((reit) => (
                    <button
                      key={reit.code}
                      onClick={() => loadReitDetail(reit.code)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between',
                        selectedCode === reit.code
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-slate-50 text-slate-700',
                      )}
                    >
                      <div>
                        <span className="font-medium">{reit.code}</span>
                        <span className="text-slate-400 ml-2 text-xs">{reit.name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-xs text-slate-400 text-center py-4">无匹配REITs</p>
            )}
          </CardContent>
        </Card>

        {/* REIT Detail */}
        {(reitDetail || detailLoading) && (
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">
                {detailLoading ? '加载中...' : `${reitDetail?.code ?? ''} 详情`}
              </CardTitle>
              <button onClick={clearReit} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {detailLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                </div>
              ) : reitDetail ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{reitDetail.code}</span>
                    <Badge variant="secondary" className="text-xs">{reitDetail.sector}</Badge>
                    <span className="text-xs text-slate-400 ml-auto">{reitDetail.asset_count}项资产</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="font-mono font-semibold text-slate-800">{reitDetail.dr?.toFixed(1) ?? '-'}%</div>
                      <div className="text-[10px] text-slate-400">折现率</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="font-mono font-semibold text-slate-800">{reitDetail.cap_rate?.toFixed(1) ?? '-'}%</div>
                      <div className="text-[10px] text-slate-400">Cap Rate</div>
                    </div>
                  </div>

                  {reitDetail.d6_signal && (
                    <div className="bg-amber-50 rounded-lg p-2 text-xs">
                      <span className="text-amber-700 font-medium">D-6 溢价信号: </span>
                      <span className="text-amber-600">{reitDetail.d6_signal}</span>
                    </div>
                  )}

                  {/* Price Chart */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">价格走势</p>
                    {priceStatus === 'loading' && (
                      <div className="text-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                      </div>
                    )}
                    {priceStatus === 'empty' && (
                      <p className="text-xs text-slate-400 text-center py-8">暂无价格数据</p>
                    )}
                    {priceStatus === 'error' && (
                      <div className="text-center py-8">
                        <p className="text-xs text-slate-400 mb-1">加载失败</p>
                        <button
                          onClick={() => loadReitDetail(reitDetail.code)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          重试
                        </button>
                      </div>
                    )}
                    {priceStatus === 'success' && priceData.length > 0 && (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={priceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              tickFormatter={(v: string) => v.slice(5)}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              domain={['auto', 'auto']}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              width={45}
                              tickFormatter={(v: number) => v.toFixed(1)}
                            />
                            <Tooltip
                              contentStyle={{
                                fontSize: 12,
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                              }}
                              formatter={(value: number) => [value.toFixed(3), '收盘价']}
                              labelFormatter={(label: string) => `日期: ${label}`}
                            />
                            <defs>
                              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="close"
                              stroke="none"
                              fill="url(#priceGradient)"
                            />
                            <Line
                              type="monotone"
                              dataKey="close"
                              stroke="#2563eb"
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        {priceStats && (
                          <div className="grid grid-cols-4 gap-1 mt-2 text-center">
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-800">{priceStats.latest.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400">最新价</div>
                            </div>
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-800">{priceStats.max.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400">最高</div>
                            </div>
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-800">{priceStats.min.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400">最低</div>
                            </div>
                            <div>
                              <div className={cn('font-mono text-xs font-semibold', priceStats.change >= 0 ? 'text-green-600' : 'text-red-500')}>
                                {priceStats.change >= 0 ? '+' : ''}{priceStats.change.toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-slate-400">涨跌幅</div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Assets */}
                  {reitDetail.assets && reitDetail.assets.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        底层资产 ({reitDetail.assets.length})
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {reitDetail.assets.slice(0, 5).map((asset: any, i: number) => {
                          const name = typeof asset === 'string' ? asset : asset.name || '';
                          const city = typeof asset === 'object' ? asset.city : '';
                          return (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{name}{city ? ` · ${city}` : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
