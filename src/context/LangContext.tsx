"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import es from "@/i18n/es.json";
import en from "@/i18n/en.json";

export type Lang = "es" | "en";
const dictionaries: Record<Lang, any> = { es, en };

interface LangContextType {
  lang: Lang;
  t: (keyPath: string, ...args: any[]) => string;
  changeLang: (newLang: Lang) => void;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Prioridad: localStorage
    const saved = localStorage.getItem("freeboli_lang") as Lang;
    if (saved && (saved === "es" || saved === "en")) {
      setLang(saved);
    } else {
      // 2. Segunda prioridad: Idioma del navegador
      const browserLang = navigator.language.split("-")[0];
      if (browserLang === "en") {
        setLang("en");
      } else {
        setLang("es");
      }
    }
    setMounted(true);
  }, []);

  const changeLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("freeboli_lang", newLang);
  };

  const t = (keyPath: string, ...args: any[]): string => {
    const keys = keyPath.split(".");
    let current: any = dictionaries[lang];
    let found = true;
    
    for (const key of keys) {
      if (!current || current[key] === undefined) {
        found = false;
        break;
      }
      current = current[key];
    }

    if (!found) {
      // Fallback al español
      current = dictionaries["es"];
      for (const key of keys) {
        if (!current || current[key] === undefined) {
          return keyPath;
        }
        current = current[key];
      }
    }

    let result = (current !== undefined ? current : keyPath).toString();
    
    // Interpolación {0}, {1}, etc.
    if (args && args.length > 0) {
      args.forEach((arg, i) => {
        result = result.replace(`{${i}}`, arg?.toString() || "");
      });
    }
    
    return result;
  };

  return (
    <LangContext.Provider value={{ lang, t, changeLang }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>
        {children}
      </div>
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang debe usarse dentro de LangProvider");
  return context;
}
