import React, { useState } from 'react';
import { MailCheck, ArrowRight, Sun, Moon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SOCUserIdentity } from '../types';
import { verifyPasswordlessEmail } from '../services/api';

interface EmailLoginScreenProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  initialEmail?: string;
  onLoginSuccess: (user: SOCUserIdentity) => void;
}

export const EmailLoginScreen: React.FC<EmailLoginScreenProps> = ({
  darkMode,
  setDarkMode,
  initialEmail = '',
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (targetEmail: string) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMsg('กรุณากรอกอีเมลให้ถูกต้อง (เช่น owner@sentinelai.soc)');
      return;
    }
    setErrorMsg(null);
    try {
      setLoading(true);
      const res = await verifyPasswordlessEmail({ email: clean });
      onLoginSuccess(res.user);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วยอีเมลนี้ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-screen flex flex-col items-center justify-center p-4 ${
        darkMode ? 'theme-bg-dark' : 'theme-bg-light'
      } text-slate-900 dark:text-slate-100 sylva-transition relative`}
    >
      {/* ปุ่มสลับโหมดมืด/สว่าง มุมขวาบน */}
      <div className="absolute top-5 right-5">
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="px-3.5 py-2 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" /> โหมดสว่าง
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-700" /> โหมดมืด
            </>
          )}
        </button>
      </div>

      {/* กล่องล็อกอินด้วยอีเมลตรงกลางหน้าแรก */}
      <div className="sylva-glass-card w-full max-w-lg rounded-[30px] p-8 sm:p-10 space-y-6 border-2 border-emerald-500/40 shadow-2xl">
        {/* โลโก้และชื่อระบบ */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
                stroke="#ffffff"
                strokeWidth="2"
                fill="rgba(255,255,255,0.2)"
              />
              <circle cx="12" cy="11.5" r="2.5" fill="#ffffff" />
            </svg>
          </div>

          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              AI-Powered SOC Collaboration Platform
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Sentinel<span className="text-emerald-600 dark:text-emerald-400">AI</span>
            </h1>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
              เข้าสู่ระบบด้วยอีเมลเท่านั้น (Login with E-mail Only)
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ฟอร์มกรอกอีเมล */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin(email);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">
              อีเมลผู้ใช้งาน (E-mail Address)
            </label>
            <div className="relative">
              <MailCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ เช่น owner@sentinelai.soc"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-mono font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/25 transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <span>{loading ? 'กำลังตรวจสอบอีเมล...' : 'เข้าสู่ระบบด้วยอีเมล (Login with E-mail)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* ปุ่มเลือกอีเมลทดสอบ 3 บทบาทในคลิกเดียว */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center">
            หรือคลิกเลือกบัญชีอีเมลตัวอย่างเพื่อเข้าสู่ระบบทันที:
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                email: 'owner@sentinelai.soc',
                role: 'OWNER (เจ้าของห้อง)',
                desc: 'จัดการห้อง เชิญสมาชิก นำเข้าข้อมูล และอนุมัติผล',
              },
              {
                email: 'analyst@sentinelai.soc',
                role: 'ANALYST (ผู้วิเคราะห์)',
                desc: 'นำเข้าข้อมูล วิเคราะห์ด้วย AI และอนุมัติผลในห้องที่ได้รับเชิญ',
              },
              {
                email: 'viewer@sentinelai.soc',
                role: 'VIEWER (ผู้ดูข้อมูล)',
                desc: 'ดู Dashboard และรายการแจ้งเตือนแบบอ่านอย่างเดียว',
              },
            ].map((item) => (
              <button
                key={item.email}
                type="button"
                disabled={loading}
                onClick={() => {
                  setEmail(item.email);
                  handleLogin(item.email);
                }}
                className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-400 truncate">
                    {item.email}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.desc}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400/40 shrink-0">
                  {item.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>ระบบจะแสดงเฉพาะห้องทำงานที่อีเมลของคุณได้รับอนุญาตเท่านั้น</span>
        </div>
      </div>
    </div>
  );
};
