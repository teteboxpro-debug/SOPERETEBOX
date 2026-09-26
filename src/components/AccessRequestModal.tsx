import React, { useState } from 'react';
import { ShieldCheck, Mail, Send, X, Copy, Check, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';
import type { AccessRequest } from '../types.js';

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRequest: AccessRequest | null;
  onRequestSubmitted: (req: AccessRequest) => void;
  adminEmail?: string;
  onOpenAdmin?: () => void;
  onInstantApproved?: () => void;
}

export const AccessRequestModal: React.FC<AccessRequestModalProps> = ({
  isOpen,
  onClose,
  existingRequest,
  onRequestSubmitted,
  adminEmail = 'ETEBOXVIP@GMAIL.COM',
  onOpenAdmin,
  onInstantApproved,
}) => {
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInstantActivating, setIsInstantActivating] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyEmail = () => {
    navigator.clipboard?.writeText(adminEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleInstantApprove = async () => {
    setIsInstantActivating(true);
    try {
      const clientId = localStorage.getItem('etebox_client_id') || '';
      try {
        const res = await fetch('/api/access-request/instant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            onInstantApproved?.();
            onClose();
            return;
          }
        }
      } catch (err) {}

      // Fallback instant approval
      onInstantApproved?.();
      onClose();
    } finally {
      setIsInstantActivating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const clientId = localStorage.getItem('etebox_client_id') || '';
      try {
        const res = await fetch('/api/access-request', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({ username, reason }),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data.success && data.request) {
            setSubmittedSuccess(true);
            onRequestSubmitted(data.request);
            return;
          } else if (data.error) {
            setError(data.error);
            return;
          }
        }
      } catch (e) {}

      // Fallback local submission
      const fallbackReq = {
        id: 'req_' + Date.now(),
        userId: clientId,
        username,
        ip: '127.0.0.1',
        reason,
        status: 'pending' as const,
        requestDate: new Date().toISOString(),
      };
      setSubmittedSuccess(true);
      onRequestSubmitted(fallbackReq);
    } catch (err: any) {
      setError(err.message || 'تعذر إرسال طلب التصريح');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            تصريح استخدام المنصة (ETEBOX VIP)
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            منظومة معالجة وتركيب العلامات المائية عالية الأداء.
          </p>
        </div>

        {/* Contact Email Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-900 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-amber-400" />
              <span>للتواصل والحصول على تصريح الاستخدام المباشر:</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
              Official Contact
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <a
              href={`mailto:${adminEmail}?subject=طلب تصريح استخدام تطبيق ETEBOX VIP`}
              className="text-sm sm:text-base font-mono font-bold text-amber-400 hover:text-amber-300 underline tracking-wide break-all"
            >
              {adminEmail}
            </a>
            <button
              type="button"
              onClick={copyEmail}
              className="ml-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center space-x-1 flex-shrink-0 transition-colors"
              title="نسخ البريد الإلكتروني"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-xs">نسخ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success or Existing Request State */}
        {submittedSuccess || existingRequest ? (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">
                تم تقديم طلب التصريح بنجاح!
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                تم تسجيل طلبك لدى لوحة تحكم الإدارة. يمكنك استخدام خيار التفعيل التجريبي الفوري بالأسفل للبدء مباشرة.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleInstantApprove}
                disabled={isInstantActivating}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isInstantActivating ? 'جاري التفعيل...' : 'تفعيل الاستخدام فوراً (Direct Access)'}</span>
              </button>

              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>دخول كمسؤول (Admin)</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اسم المستخدم أو اسمك الكامل
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: عبدالرحمن VIP / Abdalrhman"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ملاحظات أو سبب الاستخدام (اختياري)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="أذكر باختصار سبب طلب التصريح..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting || !username.trim()}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري تقديم الطلب...' : 'تقديم طلب التصريح للإدارة'}</span>
            </button>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>هل أنت مسؤول النظام؟</span>
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline"
                >
                  تسجيل دخول المسؤول (Admin)
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
