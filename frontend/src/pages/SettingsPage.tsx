import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Shield,
  KeyRound,
  Monitor,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

interface SettingItem {
  label: string;
  desc: string;
  enabled: boolean;
}

function SettingSwitch({ label, desc, enabled: initial }: SettingItem) {
  const [enabled, setEnabled] = useState(initial);
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-[13px] font-medium text-slate-900">{label}</div>
        <div className="text-[12px] text-slate-400 mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={cn(
          'w-10 h-6 rounded-full transition-all relative',
          enabled ? 'bg-blue-500' : 'bg-slate-200'
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm',
            enabled ? 'left-5' : 'left-1'
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">系统设置</h1>
        <p className="text-[13px] text-slate-500 mt-1">管理您的账户偏好、通知与系统参数</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Notifications */}
        <motion.div
          custom={0}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">通知设置</h3>
              <p className="text-[12px] text-slate-400">控制各类消息推送方式</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            <SettingSwitch label="投决完成提醒" desc="当项目投决流程结束时推送通知" enabled={true} />
            <SettingSwitch label="REITs 市场异动" desc="REITs 产品价格波动超过 5% 时提醒" enabled={true} />
            <SettingSwitch label="周报日报推送" desc="每周一推送市场周报摘要" enabled={false} />
            <SettingSwitch label="邮件通知" desc="通过邮件接收重要系统通知" enabled={true} />
          </div>
        </motion.div>

        {/* Data & Security */}
        <motion.div
          custom={1}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">数据与安全</h3>
              <p className="text-[12px] text-slate-400">管理数据存储与访问权限</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            <SettingSwitch label="自动备份知识库" desc="每日自动备份笔记与书签数据" enabled={true} />
            <SettingSwitch label="报告加密存储" desc="对投决报告进行端到端加密" enabled={true} />
            <SettingSwitch label="操作日志记录" desc="记录所有用户操作以便审计" enabled={true} />
            <SettingSwitch label="API 访问限制" desc="仅允许内网 IP 访问后端 API" enabled={false} />
          </div>
        </motion.div>

        {/* AI Preferences */}
        <motion.div
          custom={2}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">AI 偏好</h3>
              <p className="text-[12px] text-slate-400">配置模型参数与 Agent 行为</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-[13px] font-medium text-slate-900">默认模型</div>
                <div className="text-[12px] text-slate-400 mt-0.5">当前使用 gpt-4o</div>
              </div>
              <button className="flex items-center gap-1 text-[12px] text-blue-600 font-medium hover:underline">
                切换
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-[13px] font-medium text-slate-900">投决部门</div>
                <div className="text-[12px] text-slate-400 mt-0.5">默认启用 9 个部门</div>
              </div>
              <button className="flex items-center gap-1 text-[12px] text-blue-600 font-medium hover:underline">
                配置
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="text-[13px] font-medium text-slate-900">投资大师</div>
                <div className="text-[12px] text-slate-400 mt-0.5">默认启用 32 位大师</div>
              </div>
              <button className="flex items-center gap-1 text-[12px] text-blue-600 font-medium hover:underline">
                配置
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <SettingSwitch label="流式输出" desc="SSE 实时推送分析结果" enabled={true} />
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div
          custom={3}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Monitor className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">系统信息</h3>
              <p className="text-[12px] text-slate-400">版本与运行状态</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            {[
              { label: '系统版本', value: 'v7.0.0' },
              { label: '前端版本', value: 'v7.0.0-build-20250622' },
              { label: '后端状态', value: '在线', valueColor: 'text-emerald-600' },
              { label: 'LLM 连接', value: '正常', valueColor: 'text-emerald-600' },
              { label: '数据存储', value: '本地文件系统', valueColor: 'text-slate-600' },
              { label: '最后更新', value: '2025-06-22 14:00' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-4">
                <div className="text-[13px] font-medium text-slate-900">{item.label}</div>
                <div className={cn('text-[13px] font-medium', item.valueColor || 'text-slate-600')}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
