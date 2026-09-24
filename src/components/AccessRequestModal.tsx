import React, { useState } from 'react';
import { Lock, Mail, Send, X, ExternalLink, ShieldCheck, Copy, Check } from 'lucide-react';
import type { AccessRequest } from '../types.js';

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRequest: AccessRequest | null;
  onRequestSubmitted: (req: AccessRequest) => void;
  adminEmail?: string;
}

export const AccessRequestModal: React.FC<AccessRequestModalProps> = ({
  isOpen,
  onClose,
  existingRequest,
  onRequestSubmitted,
  adminEmail = 'ETEBOXVIP@GMAIL.COM',
}) => {
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyEmail = () => {
    navigator.clipboard?.writeText(adminEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        onRequestSubmitted(data.request);
      } else {
        setError(data.error || 'Failed to submit access request');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            يتطلب تصريح من المسؤول (Admin)
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            لا يمكن استخدام التطبيق إلا بعد الحصول على تصريح وموافقة من الإدارة.
          </p>
        </div>

        {/* Contact Email Banner (Mandatory) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-900 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-amber-400" />
              <span>للتواصل والحصول على تصريح الاستخدام:</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
              Direct Contact
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

          <p className="text-[11px] text-slate-400 text-center">
            يرجى إرسال رسالة إلى البريد أعلاه أو إرسال طلب تصريح مباشر أدناه ليصل فوراً إلى لوحة تحكم الأدمن.
          </p>
        </div>

        {/* Direct Request Form (Sends notification to Admin Panel) */}
        {existingRequest ? (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <span>حالة الطلب في لوحة التحكم:</span>
              <span className="uppercase font-mono">{existingRequest.status}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              تم إرسال إشعار بطلبك إلى لوحة تحكم المسؤول بتاريخ {new Date(existingRequest.requestDate).toLocaleDateString()}.
              ستتمكن من استخدام التطبيق فور موافقة الأدمن، أو تواصل مباشرة عبر البريد الإلكتروني أعلاه.
            </p>
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
                placeholder="مثال: محمد علي / Ahmed VIP"
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
              <span>{isSubmitting ? 'جاري الإرسال إلى الأدمن...' : 'إرسال إشعار فوري إلى لوحة تحكم الأدمن'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
