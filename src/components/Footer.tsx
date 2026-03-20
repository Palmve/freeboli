"use client";

import { useLang } from "@/context/LangContext";

export function Footer() {
  const { t } = useLang();

  return (
    <footer className="mt-8 border-t border-slate-800 bg-slate-900/50 py-4">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-slate-500">
          {t("footer.bolis_info").split("{0}")[0]}
          <a 
            href="https://bolis.money/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 font-bold underline underline-offset-4 transition"
          >
            bolis.money
          </a>
          {t("footer.bolis_info").split("{0}")[1]}
        </p>
        <p className="mt-1 text-[9px] text-slate-500 uppercase tracking-widest font-medium">
          &copy; {new Date().getFullYear()} FreeBoli - Built on Solana
        </p>
      </div>
    </footer>
  );
}
