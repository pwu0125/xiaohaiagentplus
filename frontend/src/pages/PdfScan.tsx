import { motion } from 'framer-motion';
import FileUpload from '@/components/FileUpload';

export default function PdfScan() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}>

        <div className="text-center mb-10">
          <motion.img src="/xiaohai-original.png" alt="小海Agent"
            className="w-32 h-32 rounded-full object-cover border-4 border-blue-500/30 shadow-xl shadow-blue-500/20 mx-auto mb-5"
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} />
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl font-bold text-slate-100 mb-3">小海Agent</motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-xl text-blue-400 mb-2">智能投资分析</motion.p>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-base text-slate-400 max-w-xl mx-auto">上传项目材料，由多Agent协同完成结构化提取、部门分析、大师洞察和最终决策</motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="flex flex-col items-center justify-center py-6 text-slate-400">
          {/* Reuse FileUpload component for real uploads */}
          <div className="w-full max-w-3xl">
            {/* FileUpload is a lazy client component; import locally to avoid SSR issues */}
            <FileUpload showProjectTypes={false} showDepts={false} showMasters={false} onStart={async (files: File[]) => {
              // simple client-side upload to backend endpoint
              const form = new FormData();
              // upload files sequentially for simplicity
              for (const f of files) {
                form.append('file', f);
                try {
                  const res = await fetch('/api/pdf/upload', { method: 'POST', body: form });
                  if (!res.ok) {
                    console.error('上传失败', await res.text());
                  } else {
                    console.log('上传成功', await res.json());
                  }
                } catch (err) {
                  console.error('上传异常', err);
                }
                form.delete('file');
              }
            }} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
