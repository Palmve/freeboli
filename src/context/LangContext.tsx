"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import es from "@/i18n/es.json";
import en from "@/i18n/en.json";

export type Lang = "es" | "en";
const dictionaries: Record<Lang, any> = { es, en };

interface LangContextType {
  lang: Lang;
  t: (keyPath: string) => string;
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

  const t = (keyPath: string): string => {
    const keys = keyPath.split(".");
    let current: any = dictionaries[lang];
    
    for (const key of keys) {
      if (!current || current[key] === undefined) {
        // Fallback al español si no existe en el idioma actual
        let fallback: any = dictionaries["es"];
        for (const fKey of keys) {
          if (!fallback || fallback[fKey] === undefined) return keyPath;
          fallback = fallback[fKey];
        }
        return typeof fallback === "string" ? fallback : keyPath;
      }
      current = current[key];
    }
    return typeof current === "string" ? current : keyPath;
  };

  // Evitar fallos de hidratación en SSR al esperar a que el componente monte en cliente
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <LangContext.Provider value={{ lang, t, changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang debe usarse dentro de LangProvider");
  return context;
}
