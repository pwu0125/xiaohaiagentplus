import { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Upload, File, X, TrendingUp, Factory, Home, Briefcase, Hotel, KeyRound, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MASTER_OPTIONS } from '@/data/masters';

const PROJECT_TYPES = [
  { value: 'office_building', label: '写字楼', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'retail', label: '零售商业', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'hotel', label: '酒店', icon: <Hotel className="w-4 h-4" /> },
  { value: 'long_term_rental', label: '长租公寓', icon: <KeyRound className="w-4 h-4" /> },
  { value: 'residential', label: '住宅项目', icon: <Home className="w-4 h-4" /> },
  { value: 'industrial', label: '产业园区', icon: <Factory className="w-4 h-4" /> },
];

const DEPARTMENT_OPTIONS = [
  { value: 'investment', label: '投资部', color: 'red' },
  { value: 'asset_management', label: '资管部', color: 'indigo' },
  { value: 'market', label: '市场部', color: 'cyan' },
  { value: 'operation', label: '运营部', color: 'teal' },
  { value: 'financial', label: '财务部', color: 'emerald' },
  { value: 'design', label: '设计部', color: 'pink' },
  { value: 'engineering', label: '工程部', color: 'orange' },
  { value: 'cost', label: '成本部', color: 'yellow' },
  { value: 'legal', label: '法律部', color: 'violet' },
];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  red: { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  indigo: { border: 'border-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400' },
  cyan: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  teal: { border: 'border-teal-500', bg: 'bg-teal-500/10', text: 'text-teal-400', dot: 'bg-teal-400' },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  pink: { border: 'border-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400', dot: 'bg-pink-400' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  yellow: { border: 'border-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  violet: { border: 'border-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-400' },
};

interface FileUploadProps {
  onStart: (files: File[], projectType: string, selectedDepts: string[], selectedMasters: string[]) => void;
  showProjectTypes?: boolean;
  showDepts?: boolean;
  showMasters?: boolean;
}

function FileUploadComponent({ onStart, showProjectTypes = true, showDepts = true, showMasters = true }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedMasters, setSelectedMasters] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const toggleProjectType = (value: string) => {
    setProjectTypes((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value],
    );
  };

  const toggleDept = (value: string) => {
    setSelectedDepts((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value],
    );
  };

  const toggleMaster = (value: string) => {
    setSelectedMasters((prev) =>
      prev.includes(value)
        ? prev.filter((m) => m !== value)
        : [...prev, value],
    );
  };

  const selectAllMasters = () => setSelectedMasters(MASTER_OPTIONS.map((m) => m.value));
  const clearAllMasters = () => setSelectedMasters([]);

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

  const handleStart = useCallback(async () => {
    if (files.length === 0) return;
    if (selectedDepts.length === 0) return;
    setIsUploading(true);
    await onStart(files, projectTypes.join(','), selectedDepts, selectedMasters);
    setIsUploading(false);
  }, [files, projectTypes, selectedDepts, selectedMasters, onStart]);

  const startLabel = (() => {
    const parts: string[] = [];
    if (selectedDepts.length > 0) parts.push(`${selectedDepts.length}部门`);
    if (selectedMasters.length > 0) parts.push(`${selectedMasters.length}大师`);
    if (parts.length === 0) return '开始分析';
    return `开始分析 (${parts.join(' · ')})`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="max-w-2xl mx-auto"
    >
      {/* 项目类型选择 */}
      {showProjectTypes ? (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">选择项目类型（可多选）</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PROJECT_TYPES.map((type) => {
              const selected = projectTypes.includes(type.value);
              return (
                <button
                  key={type.value}
                  onClick={() => toggleProjectType(type.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200',
                    selected
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-700/30',
                  )}
                >
                  {type.icon}
                  <span className="text-xs font-medium">{type.label}</span>
                  {selected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 部门选择 */}
      {showDepts ? (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            选择参与分析的部门（可多选）
            <span className="text-slate-500 ml-2 text-xs">已选 {selectedDepts.length}/9</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DEPARTMENT_OPTIONS.map((dept) => {
              const colors = COLOR_MAP[dept.color];
              const isSelected = selectedDepts.includes(dept.value);
              return (
                <button
                  key={dept.value}
                  onClick={() => toggleDept(dept.value)}
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200',
                    isSelected
                      ? `${colors.border} ${colors.bg} ${colors.text}`
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600',
                  )}
                >
                  <img
                    src={`/depts/${dept.value}.png`}
                    alt={dept.label}
                    className={cn(
                      'w-14 h-14 rounded-full object-cover shrink-0 border-2',
                      isSelected ? colors.border : 'border-slate-600',
                    )}
                  />
                  <span className="text-base font-medium">{dept.label}</span>
                  {isSelected && <Check className="w-5 h-5 ml-auto" />}
                </button>
              );
            })}
          </div>
          {selectedDepts.length === 0 && selectedMasters.length === 0 && (
            <p className="text-xs text-amber-400 mt-2">未选择部门和大师，将只执行秘书Agent和决策者Agent</p>
          )}
        </div>
      ) : null}

      {/* 投资大师选择 */}
      {showMasters ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              选择投资大师（可多选）
              <span className="text-slate-500 ml-2 text-xs">已选 {selectedMasters.length}/{MASTER_OPTIONS.length}</span>
            </label>
            <div className="flex gap-2">
              <button onClick={selectAllMasters} className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors">全选</button>
              <button onClick={clearAllMasters} className="text-xs text-slate-500 hover:text-slate-400 px-2 py-1 rounded hover:bg-slate-700 transition-colors">清空</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {MASTER_OPTIONS.map((master) => {
              const isSelected = selectedMasters.includes(master.value);
              return (
                <button
                  key={master.value}
                  onClick={() => toggleMaster(master.value)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-200',
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600',
                  )}
                >
                  <img
                    src={`/masters/${master.value}.png`}
                    alt={master.label}
                    className={cn(
                      'w-10 h-10 rounded-full object-cover shrink-0 border',
                      isSelected ? 'border-amber-400' : 'border-slate-600',
                    )}
                  />
                  <div className="text-left min-w-0">
                    <div className="text-xs font-medium truncate">{master.label}</div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 拖拽上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800',
        )}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/png,image/jpeg,text/markdown"
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
            isDragging ? 'bg-blue-500/20' : 'bg-slate-700',
          )}>
            <Upload className={cn('w-6 h-6', isDragging ? 'text-blue-400' : 'text-slate-400')} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">
              {isDragging ? '释放以上传文件' : '拖拽文件到此处，或点击选择文件'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              支持：PDF、Word、Excel、PNG、JPEG、CSV、Markdown（可多选）
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
              className="flex items-center gap-3 bg-slate-800/80 rounded-lg px-3 py-2 border border-slate-700"
            >
              <File className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="flex-1 text-sm text-slate-300 truncate">{file.name}</span>
              <span className="text-xs text-slate-500 shrink-0">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* 开始分析按钮 */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleStart}
          disabled={files.length === 0 || isUploading}
          size="lg"
          className={cn(
            'px-8 py-3 text-base font-medium rounded-xl transition-all duration-300',
            files.length > 0
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed',
          )}
        >
          {isUploading ? (
            <span className="flex items-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              />
              分析中...
            </span>
          ) : (
            startLabel
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default memo(FileUploadComponent);
