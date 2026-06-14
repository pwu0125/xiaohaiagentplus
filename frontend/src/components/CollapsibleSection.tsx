import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FileJson, Text } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: 'json' | 'text';
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'success' | 'info' | 'warning';
}

function CollapsibleSectionComponent({
  title,
  subtitle,
  icon = 'json',
  children,
  defaultOpen = false,
  variant = 'default',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    default: 'border-slate-700 bg-slate-800/50',
    success: 'border-green-700/50 bg-green-900/10',
    info: 'border-blue-700/50 bg-blue-900/10',
    warning: 'border-amber-700/50 bg-amber-900/10',
  };

  return (
    <div className={cn('rounded-xl border overflow-hidden', variantStyles[variant])}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {icon === 'json' ? <FileJson className="w-4 h-4" /> : <Text className="w-4 h-4" />}
          </span>
          <div className="text-left">
            <h4 className="font-medium text-slate-100 text-sm">{title}</h4>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/50 p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(CollapsibleSectionComponent);
