import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  LayoutDashboard,
  TrendingUp,
  Upload,
  Users,
  BookOpen,
  MessageSquare,
  Settings,
  Search,
  Bell,
  FileText,
  Building2,
} from 'lucide-react';
import HomePage from './pages/Home';
import ReitsDashboard from './pages/ReitsDashboard';
import Committee from './pages/Committee';
import ProjectManagement from './pages/ProjectManagement';
import ReportCenter from './pages/ReportCenter';
import MaterialAnalysis from './pages/MaterialAnalysis';
import KnowledgeBase from './pages/KnowledgeBase';
import MultiAgentChat from './pages/MultiAgentChat';
import SettingsPage from './pages/SettingsPage';
import CobReval from './pages/CobReval';

/* ------------------------------------------------------------------ */
/* Navigation structure                                               */
/* ------------------------------------------------------------------ */

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '工作台',
    items: [
      { label: '系统主页', path: '/', icon: Home },
      { label: '项目管理', path: '/projects', icon: LayoutDashboard, badge: '12' },
      { label: '分析报告', path: '/reports', icon: FileText },
    ],
  },
  {
    title: '智能分析',
    items: [
      { label: 'REITs 指标看板', path: '/reits', icon: TrendingUp },
      { label: '项目资料上传', path: '/pdf', icon: Upload },
      { label: '模拟投决会', path: '/committee', icon: Users },
      { label: '专家圆桌讨论', path: '/chat', icon: MessageSquare },
      { label: '知识库', path: '/knowledge', icon: BookOpen },
      { label: '不动产估值', path: '/cob-reval', icon: Building2 },
    ],
  },
  {
    title: '系统',
    items: [
      { label: '系统设置', path: '/settings', icon: Settings },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sidebar                                                            */
/* ------------------------------------------------------------------ */

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 bottom-0 z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500/20 flex items-center justify-center shrink-0">
            <img
              src="/xiaohai-original.png"
              alt="小海"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 leading-tight">小海Agent</div>
            <div className="text-[11px] text-slate-400 font-normal mt-0.5">商业不动产智能投决系统</div>
          </div>
        </div>
      </div>

      {/* Nav menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = currentPath === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5',
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[hsl(212,60%,24%)] flex items-center justify-center text-white text-xs font-semibold shrink-0">
            投
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">投资经理</div>
            <div className="text-[11px] text-slate-400 truncate">中海地产 · 资产管理部</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function Header() {
  const location = useLocation();

  const getBreadcrumb = () => {
    const pathMap: Record<string, string> = {
      '/': '系统主页',
      '/reits': 'REITs 指标看板',
      '/pdf': '项目资料上传',
      '/committee': '模拟投决会',
      '/chat': '专家圆桌讨论',
      '/knowledge': '知识库',
      '/settings': '系统设置',
      '/projects': '项目管理',
      '/reports': '分析报告',
      '/cob-reval': '不动产估值',
    };
    return pathMap[location.pathname] || '系统主页';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-500">
          工作台 <span className="text-slate-300 mx-1">/</span>
          <span className="text-slate-900 font-medium">{getBreadcrumb()}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 w-72">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="搜索项目、报告或知识库..."
            className="bg-transparent border-none outline-none text-sm text-slate-900 w-full placeholder:text-slate-400"
          />
        </div>
        <button className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors relative">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <button className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                             */
/* ------------------------------------------------------------------ */

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/reits" element={<ReitsDashboard />} />
            <Route path="/committee" element={<Committee />} />
            <Route path="/projects" element={<ProjectManagement />} />
            <Route path="/reports" element={<ReportCenter />} />
            <Route path="/pdf" element={<MaterialAnalysis />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/chat" element={<MultiAgentChat />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/cob-reval" element={<CobReval />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
}

export default App;
