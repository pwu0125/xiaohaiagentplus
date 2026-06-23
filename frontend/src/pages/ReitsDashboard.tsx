import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Loader2,
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
import { fetchCReitsIndex, fetchReitsDashboard } from '@/lib/api';
import type { ReitDashboardItem, ReitsDashboardData } from '@/types';

/* ------------------------------------------------------------------ */
/* Animation helper                                                   */
/* ------------------------------------------------------------------ */

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<string, { color: string; bg: string; tagClass: string }> = {
  '消费':    { color: '#f472b6', bg: 'bg-pink-500',   tagClass: 'bg-pink-50 text-pink-600' },
  '产业园':  { color: '#2563eb', bg: 'bg-blue-500',   tagClass: 'bg-blue-50 text-blue-600' },
  '仓储物流': { color: '#059669', bg: 'bg-emerald-500', tagClass: 'bg-emerald-50 text-emerald-600' },
  '保租房':  { color: '#d97706', bg: 'bg-amber-500',  tagClass: 'bg-amber-50 text-amber-600' },
  '高速公路': { color: '#fbbf24', bg: 'bg-yellow-500', tagClass: 'bg-yellow-50 text-yellow-600' },
  '能源':    { color: '#fb923c', bg: 'bg-orange-500', tagClass: 'bg-orange-50 text-orange-600' },
  '环保':    { color: '#0891b2', bg: 'bg-cyan-500',   tagClass: 'bg-cyan-50 text-cyan-600' },
  '水利':    { color: '#60a5fa', bg: 'bg-sky-500',    tagClass: 'bg-sky-50 text-sky-600' },
};

const FALLBACK_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#f472b6', '#fbbf24', '#fb923c', '#60a5fa', '#22c55e'];
const FALLBACK_BG = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500', 'bg-orange-500', 'bg-sky-500', 'bg-green-500'];
const FALLBACK_TAG = ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-amber-50 text-amber-600', 'bg-violet-50 text-violet-600', 'bg-cyan-50 text-cyan-600', 'bg-pink-50 text-pink-600', 'bg-yellow-50 text-yellow-600', 'bg-orange-50 text-orange-600', 'bg-sky-50 text-sky-600', 'bg-green-50 text-green-600'];

function getTypeStyle(type: string, idx: number) {
  const match = TYPE_COLORS[type];
  if (match) return match;
  const i = idx % FALLBACK_COLORS.length;
  return { color: FALLBACK_COLORS[i], bg: FALLBACK_BG[i], tagClass: FALLBACK_TAG[i] };
}

const TIME_RANGE = ['1M', '3M', '6M', '1Y', 'YTD'];

/* ------------------------------------------------------------------ */
/* C-REITs Index line chart (Recharts)                                 */
/* ------------------------------------------------------------------ */

interface IndexPoint {
  date: string;
  index: number;
}

function CReitsIndexChart() {
  const [indexData, setIndexData] = useState<IndexPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState('6M');

  useEffect(() => {
    fetchCReitsIndex()
      .then(setIndexData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredData = (() => {
    if (!indexData.length) return [];
    const lastDate = new Date(indexData[indexData.length - 1].date);
    let daysBack: number;
    switch (activeRange) {
      case '1M': daysBack = 22; break;
      case '3M': daysBack = 66; break;
      case '6M': daysBack = 132; break;
      case '1Y': daysBack = 252; break;
      case 'YTD':
        return indexData.filter((p) => new Date(p.date) >= new Date(lastDate.getFullYear(), 0, 1));
      default: daysBack = 132;
    }
    return indexData.slice(Math.max(0, indexData.length - daysBack));
  })();

  const latest = indexData.length > 0 ? indexData[indexData.length - 1] : null;
  const prev = indexData.length > 1 ? indexData[indexData.length - 2] : null;
  const change = prev && latest ? latest.index - prev.index : 0;
  const changePct = prev && latest ? ((change / prev.index) * 100).toFixed(2) : '0.00';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const tooltipDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center h-[340px]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-bold text-slate-900">C-REITs指数走势</h3>
        <div className="flex gap-1.5">
          {TIME_RANGE.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeRange === r
                  ? 'bg-[hsl(212,60%,24%)] text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-slate-900">{latest.index.toFixed(2)}</span>
          <span className={cn('text-sm font-medium flex items-center gap-0.5', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct}%)
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="indexAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#dbeafe" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
            }}
            labelFormatter={(label) => tooltipDate(label as string)}
            formatter={(value: number) => [value.toFixed(2), '指数']}
          />
          <Area type="monotone" dataKey="index" fill="url(#indexAreaGrad)" stroke="none" />
          <Line
            type="monotone"
            dataKey="index"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pie chart component                                                */
/* ------------------------------------------------------------------ */

interface PieSegment {
  label: string;
  value: number;
  color: string;
  colorBg: string;
  pct: string;
}

function PieChart({ segments }: { segments: PieSegment[] }) {
  if (!segments.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">暂无数据</p>
      </div>
    );
  }

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let accumulated = 0;
  const conicGradient = segments
    .map((s) => {
      const startPct = accumulated / total * 100;
      accumulated += s.value;
      const endPct = accumulated / total * 100;
      return `${s.color} ${startPct * 3.6}deg ${endPct * 3.6}deg`;
    })
    .join(', ');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-bold text-slate-900">类型分布</h3>
      </div>
      <div className="flex justify-center">
        <div
          className="w-40 h-40 rounded-full relative"
          style={{ background: `conic-gradient(${conicGradient})` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white flex items-center justify-center">
            <span className="text-lg font-bold text-slate-700">{segments.length}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-2 max-h-[200px] overflow-y-auto">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <div className={cn('w-2.5 h-2.5 rounded-sm shrink-0', item.colorBg)} />
            <span className="text-slate-500 text-xs">{item.label}</span>
            <span className="ml-auto text-xs font-semibold text-slate-900">{item.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ReitsDashboard() {
  const [dashboardData, setDashboardData] = useState<ReitsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [sortField, setSortField] = useState<'name' | 'price' | 'change' | 'scanned_docs'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchReitsDashboard()
      .then(setDashboardData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">加载失败，请检查后端服务是否运行。</p>
      </div>
    );
  }

  const allReits: ReitDashboardItem[] = dashboardData.reits || [];
  const types = Array.from(new Set(allReits.map((r) => r.type).filter(Boolean))).sort();
  const FILTERS = ['全部', ...types];

  const filteredReits = activeFilter === '全部'
    ? allReits
    : allReits.filter((r) => r.type === activeFilter);

  const sortedReits = [...filteredReits].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortField) {
      case 'price': return dir * ((a.price ?? 0) - (b.price ?? 0));
      case 'change': return dir * (parseFloat(a.change) - parseFloat(b.change));
      case 'scanned_docs': return dir * (a.scanned_docs - b.scanned_docs);
      default: return dir * a.name.localeCompare(b.name, 'zh');
    }
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // Compute pie segments from real data
  const typeCounts: Record<string, number> = {};
  allReits.forEach((r) => {
    const t = r.type || '其他';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const totalReits = allReits.length;
  const pieSegments = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count], idx) => {
      const style = getTypeStyle(label, idx);
      const pct = totalReits > 0 ? ((count / totalReits) * 100).toFixed(1) + '%' : '0%';
      return { label, value: count, color: style.color, colorBg: style.bg, pct };
    });

  const topAccentColors = ['before:bg-blue-500', 'before:bg-emerald-500', 'before:bg-amber-500'];
  const stats = dashboardData.market_stats || [];

  return (
    <div className="space-y-6">
      {/* Title + summary banner */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">公募 REITs 指标看板</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          共 {dashboardData.total_reits} 只REITs · {dashboardData.total_docs.toLocaleString()} 份公告已入库
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
              activeFilter === f
                ? 'bg-[hsl(212,60%,24%)] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className={cn(
              'bg-white border border-slate-200 rounded-xl p-5 relative transition-all hover:border-slate-300 hover:shadow-md',
              'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:rounded-t-xl',
              topAccentColors[i % topAccentColors.length]
            )}
          >
            <div className="text-xs text-slate-400 font-medium mb-3">{stat.label}</div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {stat.value}<span className="text-base ml-0.5">{stat.unit}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <CReitsIndexChart />
        </div>
        <div>
          <PieChart segments={pieSegments} />
        </div>
      </div>

      {/* Table */}
      <motion.div
        custom={10}
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-slate-900">
            REITs 产品明细
            <span className="text-[12px] font-normal text-slate-400 ml-2">
              {filteredReits.length} / {allReits.length} 只
            </span>
          </h3>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 transition-all">
            <Download className="w-3.5 h-3.5" />
            导出数据
          </button>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th
                className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none"
                onClick={() => handleSort('name')}
              >
                产品名称 {sortField === 'name' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">物业类型</th>
              <th
                className="text-right py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none"
                onClick={() => handleSort('price')}
              >
                最新价 {sortField === 'price' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none"
                onClick={() => handleSort('change')}
              >
                涨跌幅 {sortField === 'change' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 select-none"
                onClick={() => handleSort('scanned_docs')}
              >
                已扫描公告 {sortField === 'scanned_docs' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">上市日期</th>
            </tr>
          </thead>
          <tbody>
            {sortedReits.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">暂无匹配的REITs数据</td>
              </tr>
            ) : (
              sortedReits.map((item, _idx) => {
                const typeStyle = getTypeStyle(item.type, types.indexOf(item.type));
                const isZhonghai = item.code.includes('180607');
                return (
                  <tr key={item.code} className={cn('border-b border-slate-50 hover:bg-slate-50/50 transition-colors', isZhonghai && 'bg-amber-50/60')}>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        {isZhonghai && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            中海
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.code}</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', typeStyle.tagClass)}>
                        {item.type}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <div className="font-semibold">{item.price != null ? item.price.toFixed(2) : '-'}</div>
                    </td>
                    <td className={cn('py-4 px-3 text-right font-semibold', item.positive ? 'text-emerald-600' : 'text-red-500')}>
                      {item.positive ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                      {item.change}
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className={cn('font-semibold', item.scanned_docs > 0 ? 'text-slate-700' : 'text-slate-300')}>
                        {item.scanned_docs > 0 ? `${item.scanned_docs} 份` : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right font-medium text-slate-500 text-[12px]">
                      {item.list_date || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
