"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Lang = "es" | "en";
type Category = "all" | "faucet" | "prediction" | "hilo" | "general" | "levels";

interface Message {
  id: number;
  category: Category;
  label: string;
  text: string;
}

interface KitImage {
  id: number;
  src: string;
  alt: string;
  category: Category;
}

// ─── MENSAJES ─────────────────────────────────────────────────────────────────
const content: Record<Lang, {
  hero: string;
  heroSub: string;
  messagesTitle: string;
  imagesTitle: string;
  copyBtn: string;
  copiedBtn: string;
  downloadBtn: string;
  filterAll: string;
  categories: Record<Category, string>;
  cta: string;
  ctaSub: string;
  messages: Message[];
}> = {
  es: {
    hero: "Kit del Influencer 🤝",
    heroSub: "Elige un mensaje, cópialo y publícalo en tus redes. ¡Así de fácil!",
    messagesTitle: "📋 Mensajes Listos para Publicar",
    imagesTitle: "🖼️ Imágenes para tus Posts",
    copyBtn: "📋 Copiar",
    copiedBtn: "✅ ¡Copiado!",
    downloadBtn: "⬇️ Descargar",
    filterAll: "Todos",
    categories: {
      all: "Todos",
      faucet: "Faucet",
      prediction: "Predicción",
      hilo: "HI-LO",
      general: "General",
      levels: "Niveles",
    },
    cta: "¿Listo para activar tu cuenta de Influencer?",
    ctaSub: "Regístrate gratis y pide tu código de influencer en FreeBoli.",
    messages: [
      {
        id: 1,
        category: "faucet",
        label: "Faucet — Gana Gratis",
        text: `¿Buscas ganar criptos gratis sin invertir un solo centavo? 💸

En #FreeBoli el tiempo es dinero. ¡Literalmente!
🕒 Reclama puntos GRATIS cada hora en nuestro Faucet.
📈 Sube de nivel para multiplicar tus recompensas.
💎 Retira directamente en $BOLIS de Solana.

Empieza ahora mismo aquí:
👉 https://freeboli.win

#Bolicoin #Solana #Bitcoin`,
      },
      {
        id: 2,
        category: "general",
        label: "Lanzamiento General",
        text: `🔥 ¿Lista para ganar cripto GRATIS solo jugando?

🎮 FreeBoli ya está en Solana.
✅ Reclama puntos gratis cada hora con el Faucet.
📊 Predice el precio de BTC/SOL y gana BOLIS.
🎲 Multiplicador HI-LO: hasta x4,900.
🏆 7 niveles de jugador + premios del Ranking diario.

Sin inversión. Juegas GRATIS. Retiras cripto REAL 🚀

👉 https://freeboli.win

#FreeBoli #Solana #CryptoGaming #PlayToEarn #BOLIS`,
      },
      {
        id: 3,
        category: "hilo",
        label: "HI-LO — Multiplica tus Puntos",
        text: `¡Multiplica tu suerte hasta x4,900! 🎲🚀

¿Te sientes con suerte hoy? El juego HI-LO de FreeBoli es simple, rápido y 100% justo (Provably Fair).
Apuesta tus puntos, elige Mayor o Menor y mira cómo crecen tus BOLIS.

✅ Sin límites, solo pura acción.
✅ Retiros rápidos en la red Solana.

Prueba tu estrategia en:
👉 https://freeboli.win/hi-lo

#Gaming #Solana #Altcoins #Bolicoin #HiLo`,
      },
      {
        id: 4,
        category: "prediction",
        label: "Predicción BTC/SOL",
        text: `¿Subirá o bajará el BTC hoy? 📈📉

En #FreeBoli puedes apostar sobre el precio de BTC, SOL y BOLIS.
⏱️ Rondas rápidas de 1 hora
🎯 Modo Normal, Mini y Micro
🏆 Gana puntos que conviertes a BOLIS de Solana

¡Es gratis comenzar!
👉 https://freeboli.win/predicciones

#Bitcoin #Solana #Crypto #FreeBoli`,
      },
      {
        id: 5,
        category: "levels",
        label: "Niveles — De Novato a Leyenda",
        text: `¡De Novato a LEYENDA! 🏆✨

En FreeBoli premiamos tu lealtad. Escala entre los 7 niveles de jugador y desbloquea beneficios exclusivos.
💰 Premios diarios en el Ranking de 24h.
🎁 +100,000 puntos de bono al alcanzar el nivel Leyenda.

¿Tienes lo necesario para estar en el Top?
👉 https://freeboli.win

#CryptoCommunity #Gamer #FreeBoli #BOLIS #Solana`,
      },
      {
        id: 6,
        category: "general",
        label: "Palabra Secreta — Bonus Diario",
        text: `🎁 ¿Encontraste la Palabra Secreta de hoy?

¡Te esperan +1,000 puntos extra! Solo el 80% del pool está disponible, ¡date prisa antes de que se agote!

Se publica en Twitter todos los días 👇
👉 Síguenos en @bolicoin360 para no perderte nada

Juega ya en: https://freeboli.win

#FreeBoli #BOLIS #Solana #Airdrop #CryptoRewards`,
      },
      {
        id: 7,
        category: "faucet",
        label: "Faucet — Racha de Días",
        text: `🔥 ¿Sabías que en FreeBoli el Faucet tiene RACHA?

Cuantos más días seguidos reclames, mayor es tu multiplicador.
📅 Día 1: x1 puntos
📅 Día 7+: hasta x3 puntos + 100% bono diario

¡Una semana constante = el triple de BOLIS!

Entra gratis en: https://freeboli.win/faucet

#FreeBoli #BOLIS #Solana #Faucet #CryptoGratis`,
      },
      {
        id: 8,
        category: "general",
        label: "Afiliados — Comparte y Gana",
        text: `💸 ¿Sabías que puedes ganar puntos por invitar amigos a FreeBoli?

🔗 Comparte tu enlace único.
✅ Cada amigo que se registre y verifique su correo = BONIS para ti.
📊 Además ganas comisión del 10% de sus logros.

Sin inversión. Solo invita y gana.

Obtén tu link en: https://freeboli.win/afiliados

#Referral #FreeBoli #Solana #BOLIS`,
      },
    ],
  },

  en: {
    hero: "Influencer Kit 🤝",
    heroSub: "Pick a message, copy it and post on your socials. That easy!",
    messagesTitle: "📋 Ready-to-Post Messages",
    imagesTitle: "🖼️ Images for Your Posts",
    copyBtn: "📋 Copy",
    copiedBtn: "✅ Copied!",
    downloadBtn: "⬇️ Download",
    filterAll: "All",
    categories: {
      all: "All",
      faucet: "Faucet",
      prediction: "Prediction",
      hilo: "HI-LO",
      general: "General",
      levels: "Levels",
    },
    cta: "Ready to activate your Influencer account?",
    ctaSub: "Sign up for free and request your Influencer code at FreeBoli.",
    messages: [
      {
        id: 1,
        category: "general",
        label: "General Launch",
        text: `🔥 Ready to earn FREE crypto just by playing?

🎮 FreeBoli is LIVE on Solana!
✅ Claim FREE points every hour via Faucet
📊 Predict BTC/SOL prices → Win BOLIS tokens
🎲 HI-LO multiplier: up to 4,900x
🏆 7 Player levels + Daily Ranking rewards

Zero investment. Play FREE. Withdraw REAL crypto 🚀

👉 https://freeboli.win

#FreeBoli #Solana #CryptoGaming #PlayToEarn #BOLIS`,
      },
      {
        id: 2,
        category: "general",
        label: "Secret Word — Daily Bonus",
        text: `The hunt is on at FreeBoli 🎁
https://freeboli.win

Have you found today's Secret Word yet? There are +1,000 PTS waiting for you! Only 80% of the pool is left, so hurry up before it's all gone!

#FreeBoli #BOLIS #Solana #Airdrop #CryptoRewards #SecretWord`,
      },
      {
        id: 3,
        category: "faucet",
        label: "Faucet — Earn Every Hour",
        text: `Earn free points every hour in BOLIS 🔥

Play the faucet, multiply in HI-LO and withdraw in BOLIS from Solana.
👉 https://freeboli.win

No investment. No risk. Just play and earn 🚀

#FreeBoli #Solana #PlayToEarn #BOLIS #Faucet`,
      },
      {
        id: 4,
        category: "levels",
        label: "Levels — From Novice to Legend",
        text: `It's time to level up in FreeBoli! 🚀

Each rank unlocks more power, higher limits, and exclusive prizes.
👉 http://freeboli.win

What level are you at today? From Novice to Legend, the journey is just beginning! 🔥

#FreeBoli #Gaming #LevelUp #Crypto`,
      },
      {
        id: 5,
        category: "prediction",
        label: "Prediction Game BTC/SOL",
        text: `📈 Up or Down? You decide — and WIN!

At FreeBoli you can predict BTC, SOL & BOLIS price movements and earn points that convert into real Solana tokens.

✅ Fast 1-hour rounds
✅ Normal, Mini & Micro modes
✅ No investment needed

Start predicting at:
👉 https://freeboli.win/predicciones

#BTCPrice #Solana #FreeBoli #PlayToEarn`,
      },
      {
        id: 6,
        category: "hilo",
        label: "HI-LO — Up to 4,900x Multiplier",
        text: `Think you're lucky? 🎲

FreeBoli's HI-LO game is simple, fast and Provably Fair.
Bet your points → pick Higher or Lower → watch your BOLIS multiply up to 4,900x!

✅ 98% RTP — one of the fairest around.
✅ Instant withdrawals on Solana.

Play now:
👉 https://freeboli.win/hi-lo

#HiLo #CryptoCasino #Solana #BOLIS #FreeBoli`,
      },
      {
        id: 7,
        category: "faucet",
        label: "Faucet Streak — Triple Your Points",
        text: `🔥 Did you know FreeBoli's Faucet has a STREAK system?

The more consecutive days you claim, the higher your multiplier:
📅 Day 1: x1 points
📅 Day 7+: up to x3 points + 100% daily bonus

One week = triple the BOLIS. 🚀

Claim yours at: https://freeboli.win/faucet

#FreeBoli #Faucet #Solana #BOLIS #DeFi`,
      },
      {
        id: 8,
        category: "general",
        label: "Referral — Invite & Earn",
        text: `💸 Earn crypto just by sharing FreeBoli with friends!

🔗 Share your unique referral link.
✅ Every friend who signs up & verifies their email = points for YOU.
📊 Plus earn 10% commission on their achievements.

No investment. Just share and earn.

Get your link at: https://freeboli.win/afiliados

#Referral #FreeBoli #Solana #BOLIS`,
      },
    ],
  },
};

// ─── IMÁGENES COMPARTIDAS ─────────────────────────────────────────────────────
const kitImages: KitImage[] = [
  { id: 1, src: "/kit/faucet_es.jpg",       alt: "FreeBoli — Gana BOLIS gratis cada hora",  category: "faucet" },
  { id: 2, src: "/kit/freeboli_live.jpg",   alt: "FreeBoli is LIVE on Solana",               category: "general" },
  { id: 3, src: "/kit/secret_word.jpg",     alt: "FreeBoli Secret Word — +1,000 PTS",        category: "general" },
  { id: 4, src: "/kit/earn_points.jpg",     alt: "Earn free BOLIS every hour",               category: "faucet" },
  { id: 5, src: "/kit/level_up.jpg",        alt: "Level up — From Novice to Legend",         category: "levels" },
  { id: 6, src: "/kit/mobile_faucet_es.png", alt: "FreeBoli — Gana BOLIS Gratis (Mobile)",  category: "faucet" },
];

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function InfluencerKitPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [filter, setFilter] = useState<Category>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const t = content[lang];
  const allCategories: Category[] = ["all", "faucet", "prediction", "hilo", "levels", "general"];

  const filteredMessages = t.messages.filter(
    (m) => filter === "all" || m.category === filter
  );
  const filteredImages = kitImages.filter(
    (img) => filter === "all" || img.category === filter
  );

  function handleCopy(id: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #080d1a 0%, #0d1526 50%, #090e1d 100%)", fontFamily: "'Inter', sans-serif", color: "#fff" }}>

      {/* ── FUENTES ──────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1526; }
        ::-webkit-scrollbar-thumb { background: #f59e0b55; border-radius: 3px; }
        .card-hover { transition: all 0.25s ease; }
        .card-hover:hover { transform: translateY(-3px); border-color: #f59e0b55 !important; box-shadow: 0 8px 32px #f59e0b18; }
        .copy-btn { transition: all 0.2s ease; }
        .copy-btn:hover { transform: scale(1.04); }
        .copy-btn:active { transform: scale(0.97); }
        .filter-btn { transition: all 0.2s ease; }
        .filter-btn:hover { background: #f59e0b22 !important; }
        .img-card:hover .img-overlay { opacity: 1 !important; }
        .img-card { transition: transform 0.25s ease; }
        .img-card:hover { transform: scale(1.02); }
        .lang-btn { transition: all 0.2s ease; }
        .lang-btn:hover { opacity: 0.85; }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)", background: "rgba(8,13,26,0.85)", borderBottom: "1px solid #ffffff0f", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="https://freeboli.win" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.5px" }}>FreeBoli</span>
          <span style={{ fontSize: "0.7rem", background: "#f59e0b22", color: "#f59e0b", padding: "2px 8px", borderRadius: "50px", border: "1px solid #f59e0b44", fontWeight: 700 }}>KIT</span>
        </Link>

        {/* Selector de idioma */}
        <div style={{ display: "flex", gap: "8px", background: "#ffffff0a", padding: "6px", borderRadius: "50px", border: "1px solid #ffffff11" }}>
          <button
            className="lang-btn"
            onClick={() => setLang("es")}
            style={{ padding: "6px 16px", borderRadius: "50px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: lang === "es" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "transparent", color: lang === "es" ? "#000" : "#aaa", transition: "all 0.2s" }}
          >
            🇪🇸 ES
          </button>
          <button
            className="lang-btn"
            onClick={() => setLang("en")}
            style={{ padding: "6px 16px", borderRadius: "50px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: lang === "en" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "transparent", color: lang === "en" ? "#000" : "#aaa", transition: "all 0.2s" }}
          >
            🇺🇸 EN
          </button>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "64px 24px 40px", maxWidth: "760px", margin: "0 auto" }}>
        <div style={{ display: "inline-block", background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: "50px", padding: "6px 18px", fontSize: "0.78rem", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
          freeboli.win — Programa de Influencers
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: "16px", background: "linear-gradient(135deg, #fff 30%, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {t.hero}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "1.05rem", maxWidth: "520px", margin: "0 auto 36px" }}>
          {t.heroSub}
        </p>

        {/* Stats rápidos */}
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap" }}>
          {[
            { icon: "💎", val: "1 BOLIS", label: lang === "es" ? "por referido" : "per referral" },
            { icon: "🚀", val: "Solana", label: lang === "es" ? "retiro directo" : "direct withdrawal" },
            { icon: "🆓", val: lang === "es" ? "GRATIS" : "FREE", label: lang === "es" ? "para tu comunidad" : "for your community" },
          ].map((s) => (
            <div key={s.val} style={{ background: "#ffffff08", border: "1px solid #ffffff11", borderRadius: "16px", padding: "16px 24px", textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "1.4rem" }}>{s.icon}</div>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#f59e0b" }}>{s.val}</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FILTRO POR CATEGORÍA ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", padding: "0 24px 40px", maxWidth: "900px", margin: "0 auto" }}>
        {allCategories.map((cat) => (
          <button
            key={cat}
            className="filter-btn"
            onClick={() => setFilter(cat)}
            style={{
              padding: "7px 18px", borderRadius: "50px", border: "1px solid", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem",
              borderColor: filter === cat ? "#f59e0b" : "#ffffff18",
              background: filter === cat ? "linear-gradient(135deg, #f59e0b22, #f59e0b11)" : "#ffffff06",
              color: filter === cat ? "#f59e0b" : "#94a3b8",
            }}
          >
            {t.categories[cat]}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "0 20px 80px" }}>

        {/* ── MENSAJES ─────────────────────────────────────────────────────── */}
        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
          {t.messagesTitle}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "16px", marginBottom: "60px" }}>
          {filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className="card-hover"
              style={{ background: "#0d1830", border: "1px solid #ffffff12", borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              {/* Label */}
              <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #ffffff09" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f59e0b", background: "#f59e0b11", padding: "3px 10px", borderRadius: "50px", border: "1px solid #f59e0b22" }}>
                  {msg.label}
                </span>
              </div>

              {/* Text */}
              <div style={{ padding: "16px 18px", flexGrow: 1 }}>
                <pre style={{ fontFamily: "'Inter', sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.88rem", lineHeight: 1.65, color: "#cbd5e1" }}>
                  {msg.text}
                </pre>
              </div>

              {/* Copy button */}
              <div style={{ padding: "14px 18px", borderTop: "1px solid #ffffff09" }}>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy(msg.id, msg.text)}
                  style={{
                    width: "100%", padding: "11px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem",
                    background: copiedId === msg.id ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#000", letterSpacing: "0.02em",
                  }}
                >
                  {copiedId === msg.id ? t.copiedBtn : t.copyBtn}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── IMÁGENES ─────────────────────────────────────────────────────── */}
        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
          {t.imagesTitle}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
          {filteredImages.map((img) => (
            <div
              key={img.id}
              className="img-card"
              style={{ position: "relative", borderRadius: "18px", overflow: "hidden", border: "1px solid #ffffff12", background: "#0d1830", cursor: "pointer" }}
            >
              <img
                src={img.src}
                alt={img.alt}
                style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
              />
              {/* Overlay con botón descarga */}
              <div
                className="img-overlay"
                style={{ position: "absolute", inset: 0, background: "rgba(8,13,26,0.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", opacity: 0, transition: "opacity 0.25s ease" }}
              >
                <p style={{ fontSize: "0.8rem", color: "#e2e8f0", textAlign: "center", padding: "0 12px", fontWeight: 600 }}>
                  {img.alt}
                </p>
                <a
                  href={img.src}
                  download
                  style={{ padding: "10px 22px", borderRadius: "12px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}
                >
                  {t.downloadBtn}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: "70px", background: "linear-gradient(135deg, #f59e0b18, #8b5cf618)", border: "1px solid #f59e0b33", borderRadius: "24px", padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🚀</div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: "10px" }}>{t.cta}</h2>
          <p style={{ color: "#94a3b8", marginBottom: "28px", maxWidth: "440px", margin: "0 auto 28px" }}>{t.ctaSub}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="https://freeboli.win"
              style={{ padding: "14px 32px", borderRadius: "14px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: "1rem", textDecoration: "none" }}
            >
              {lang === "es" ? "Ir a FreeBoli.win →" : "Go to FreeBoli.win →"}
            </a>
            <a
              href="https://x.com/bolicoin360"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "14px 32px", borderRadius: "14px", background: "#ffffff0f", border: "1px solid #ffffff22", color: "#fff", fontWeight: 700, fontSize: "1rem", textDecoration: "none" }}
            >
              {lang === "es" ? "Seguir en Twitter →" : "Follow on Twitter →"}
            </a>
          </div>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid #ffffff09", color: "#475569", fontSize: "0.8rem" }}>
        <p>© 2026 FreeBoli.win · <a href="https://x.com/bolicoin360" target="_blank" rel="noopener noreferrer" style={{ color: "#f59e0b", textDecoration: "none" }}>@bolicoin360</a> · Solana</p>
      </footer>
    </div>
  );
}
