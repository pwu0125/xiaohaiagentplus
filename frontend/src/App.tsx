import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, BookOpen, Users } from 'lucide-react';
import Home from './pages/Home';
import MaterialAnalysis from './pages/MaterialAnalysis';
import KnowledgeBase from './pages/KnowledgeBase';
import MultiAgentChat from './pages/MultiAgentChat';

const TABS = [
  { path: '/pdf', label: '材料分析', icon: FileText },
  { path: '/', label: '模拟投决会', icon: Users },
  { path: '/chat', label: '多Agent对话', icon: Users },
  { path: '/knowledge', label: '知识库', icon: BookOpen },
];

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <header className="h-16 border-b border-slate-700 bg-slate-800/50 backdrop-blur flex items-center px-4 sticky top-0 z-50">
      <div className="flex items-center gap-2 mr-6 shrink-0">
        <img src="/xiaohai-original.png" alt="小海" className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/50" />
        <span className="text-lg font-bold text-slate-100 hidden sm:inline">小海Agent</span>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = currentPath === tab.path;
          const Icon = tab.icon;
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50')}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="min-h-[100dvh] bg-slate-900 text-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pdf" element={<MaterialAnalysis />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/chat" element={<MultiAgentChat />} />
        </Routes>
      </main>
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
