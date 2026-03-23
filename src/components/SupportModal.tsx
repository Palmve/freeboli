"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/context/LangContext";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: string;
  userEmail?: string;
}

export function SupportModal({ isOpen, onClose, defaultType = "error", userEmail = "" }: SupportModalProps) {
  const { t } = useLang();
  const [type, setType] = useState(defaultType);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Sincronizar email de sesión cuando se abre el modal
  useEffect(() => {
    if (isOpen && userEmail) {
      setEmail(userEmail);
    }
  }, [isOpen, userEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, message, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("support.error_send"));

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSubject("");
        setMessage("");
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{t("support.title")}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {sent ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-bold text-lg">{t("support.success_title")}</p>
              <p className="text-slate-400 mt-2">{t("support.success_desc")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t("support.label_type")}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border-slate-700 text-white p-3 text-sm focus:ring-amber-500 border focus:border-amber-500 outline-none transition"
                >
                  <option value="dispute">{t("support.type_dispute")}</option>
                  <option value="delay">{t("support.type_delay")}</option>
                  <option value="error">{t("support.type_error")}</option>
                  <option value="other">{t("support.type_other")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t("support.label_email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("support.placeholder_email")}
                  className="w-full rounded-lg bg-slate-800 border-slate-700 text-white p-3 text-sm focus:ring-amber-500 border focus:border-amber-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t("support.label_subject")}</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("support.placeholder_subject")}
                  className="w-full rounded-lg bg-slate-800 border-slate-700 text-white p-3 text-sm focus:ring-amber-500 border focus:border-amber-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t("support.label_message")}</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder={t("support.placeholder_message")}
                  className="w-full rounded-lg bg-slate-800 border-slate-700 text-white p-3 text-sm focus:ring-amber-500 border focus:border-amber-500 outline-none transition resize-none"
                />
              </div>

              {error && <p className="text-red-400 text-xs font-bold bg-red-400/10 p-2 rounded">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 text-slate-900 font-bold py-3 rounded-lg hover:bg-amber-400 transition transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? t("support.btn_sending") : t("support.btn_send")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
