"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import AdminNav from "@/app/admin/AdminNav";

// Extend window for Chart and L (Leaflet)
declare global {
  interface Window {
    Chart: any;
    L: any;
  }
}

export default function AdminVisitasPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processedUsers, setProcessedUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSort, setUserSort] = useState("lastActive");

  const mapRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const miniChartRef = useRef<any>(null);

  const supabase = createClient();

  // Carga de datos
  useEffect(() => {
    async function loadStats() {
      const { data: events, error } = await supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (!error && events) {
        setData(events);
        processStats(events);
      }
      setLoading(false);
    }
    loadStats();

    // Suscripción en tiempo real
    const channel = supabase
      .channel("analytics_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analytics_events" }, (payload) => {
        setData((prev) => [payload.new, ...prev].slice(0, 2000));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Procesamiento de estadísticas (similar a la lógica original)
  function processStats(events: any[]) {
    const usersMap: Record<string, any> = {};
    const cityPop: Record<string, number> = {};
    const countryPop: Record<string, number> = {};

    events.forEach(e => {
      const uid = e.user_id || `anon-${e.metadata?.ua?.slice(0, 10)}-${e.metadata?.city}`;
      if (!usersMap[uid]) {
        usersMap[uid] = {
          userId: uid,
          lastActive: 0,
          location: e.metadata || {},
          events: [],
          itemsVisited: new Set()
        };
      }
      const u = usersMap[uid];
      u.events.push(e);
      const ts = new Date(e.created_at).getTime();
      if (ts > u.lastActive) u.lastActive = ts;
      if (e.path) u.itemsVisited.add(e.path);

      const city = e.metadata?.city || "Desconocido";
      const country = e.metadata?.country || "Desconocido";
      cityPop[city] = (cityPop[city] || 0) + 1;
      countryPop[country] = (countryPop[country] || 0) + 1;
    });

    const processed = Object.values(usersMap).map((u: any) => ({
      ...u,
      itemsCount: u.itemsVisited.size,
      cityPopularity: cityPop[u.location.city] || 0,
      countryPopularity: countryPop[u.location.country] || 0,
      totalTime: calculateUserTime(u.events)
    }));

    setProcessedUsers(processed);
  }

  function calculateUserTime(events: any[]) {
    if (events.length < 2) return 0;
    const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let totalMs = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = new Date(sorted[i + 1].created_at).getTime() - new Date(sorted[i].created_at).getTime();
      if (diff < 1800000) totalMs += diff;
    }
    return Math.floor(totalMs / 60000);
  }

  // Render Maps and Charts (triggered when tab changes or data updates)
  useEffect(() => {
    if (activeTab === "charts") renderMainChart();
    if (activeTab === "geo") renderMap();
    if (activeTab === "all") renderMiniChart();
  }, [activeTab, data]);

  function renderMainChart() {
    if (!window.Chart || data.length === 0) return;
    const ctx = document.getElementById("statsChartMain") as HTMLCanvasElement;
    if (!ctx) return;

    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    }).reverse();

    const counts = last7Days.map(day => {
      return data.filter(e => new Date(e.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) === day).length;
    });

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: last7Days,
        datasets: [{
          label: "Visitas",
          data: counts,
          borderColor: "#fbbf24",
          backgroundColor: "rgba(251, 191, 36, 0.1)",
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function renderMiniChart() {
    if (!window.Chart || data.length === 0) return;
    const ctx = document.getElementById("chart-mini") as HTMLCanvasElement;
    if (!ctx) return;

    // Datos de las últimas 24h
    const hours = [...Array(24)].map((_, i) => (new Date().getHours() - i + 24) % 24).reverse();
    const counts = hours.map(h => {
      return data.filter(e => new Date(e.created_at).getHours() === h && (Date.now() - new Date(e.created_at).getTime() < 86400000)).length;
    });

    if (miniChartRef.current) miniChartRef.current.destroy();
    miniChartRef.current = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: hours.map(h => `${h}:00`),
        datasets: [{
          data: counts,
          borderColor: "#60a5fa",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  function renderMap() {
    if (!window.L || data.length === 0) return;
    if (mapRef.current) return; // Ya inicializado

    setTimeout(() => {
      const map = window.L.map("map-geo").setView([20, 0], 2);
      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);

      processedUsers.forEach(u => {
        if (u.location?.lat && u.location?.lon) {
          window.L.circleMarker([u.location.lat, u.location.lon], {
            radius: 5,
            fillColor: "#fbbf24",
            color: "#000",
            weight: 1,
            fillOpacity: 0.9
          }).addTo(map).bindPopup(`<b>${u.location.city}</b><br>${u.userId.slice(0, 8)}`);
        }
      });
      mapRef.current = map;
    }, 100);
  }

  const kpis = {
    views: data.length,
    users: new Set(data.map(e => e.user_id || e.metadata?.city + e.metadata?.ua)).size,
    pages: new Set(data.map(e => e.path)).size,
    installs: data.filter(e => e.type === "install").length
  };

  const topContent = Object.entries(
    data.reduce((acc: any, e) => {
      acc[e.path] = (acc[e.path] || 0) + 1;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-6">
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/@phosphor-icons/web" strategy="afterInteractive" />

      {/* Header Estilo Premium */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800">
        <div className="text-center lg:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center justify-center lg:justify-start gap-2">
            <i className="ph-duotone ph-chart-polar text-amber-500 text-3xl"></i> Visitas
          </h1>
          <p className="text-xs text-slate-500 mt-1">Actividad en tiempo real (Supabase)</p>
        </div>

        <div className="flex flex-wrap justify-center bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          {[
            { id: "all", label: "Dashboard" },
            { id: "charts", label: "Gráficos" },
            { id: "content", label: "Top" },
            { id: "users", label: "Sesiones" },
            { id: "geo", label: "Mapa" }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === t.id ? "bg-amber-500 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">En Vivo</span>
        </div>
      </div>

      {/* Carga de Tablas y Gráficos */}
      <div className="min-h-[500px]">
        {activeTab === "all" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard label="Visitas" val={kpis.views} color="text-white" />
              <KpiCard label="Usuarios" val={kpis.users} color="text-blue-400" />
              <KpiCard label="Páginas" val={kpis.pages} color="text-yellow-500" />
              <KpiCard label="Eventos" val={data.length} color="text-purple-400" border="border-l-emerald-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-64 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-tighter">Actividad 24h</h3>
                <div className="flex-1"><canvas id="chart-mini"></canvas></div>
              </div>
              <div className="card h-64 overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-tighter">Top 5 Rutas</h3>
                <div className="overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <tbody>
                      {topContent.slice(0, 5).map(([path, count]: any) => (
                        <tr key={path} className="border-b border-slate-800">
                          <td className="py-2.5 truncate max-w-[200px]">{path}</td>
                          <td className="py-2.5 text-right font-bold text-amber-500">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "charts" && (
          <div className="card h-[500px] flex flex-col animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-6">Análisis de Tendencias (7 días)</h3>
            <div className="flex-1 pb-4"><canvas id="statsChartMain"></canvas></div>
          </div>
        )}

        {activeTab === "content" && (
          <div className="card animate-in slide-in-from-right-4">
            <h3 className="text-lg font-bold text-white mb-4">Ranking de Páginas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/50 text-slate-500">
                  <tr>
                    <th className="p-4">Ruta / Página</th>
                    <th className="p-4 text-right">Vistas</th>
                  </tr>
                </thead>
                <tbody>
                  {topContent.map(([path, count]: any, idx) => (
                    <tr key={path} className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                      <td className="p-4"><span className="text-amber-500 font-bold mr-3">#{idx + 1}</span> {path}</td>
                      <td className="p-4 text-right font-mono font-bold text-white">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[600px]">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                <h3 className="font-bold text-white flex items-center gap-2 mb-3"><i className="ph-users text-blue-400"></i> Explorador</h3>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Ordenar por:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUserSort("lastActive")}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${userSort === "lastActive" ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-slate-800 text-slate-500"}`}
                    >
                      <i className="ph-clock"></i> Recientes
                    </button>
                    <button
                      onClick={() => setUserSort("items")}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${userSort === "items" ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-slate-800 text-slate-500"}`}
                    >
                      <i className="ph-files"></i> Actividad
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {processedUsers
                  .sort((a, b) => userSort === "items" ? b.itemsCount - a.itemsCount : b.lastActive - a.lastActive)
                  .map(u => (
                    <div
                      key={u.userId}
                      onClick={() => setSelectedUser(u)}
                      className={`p-4 border-b border-slate-800 hover:bg-slate-800 cursor-pointer transition flex flex-col gap-1 ${selectedUser?.userId === u.userId ? "bg-slate-800/50 border-r-2 border-r-amber-500" : ""}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-bold text-xs ${u.userId.startsWith('anon-') ? 'text-slate-500' : 'text-amber-400'}`}>
                          {u.userId.startsWith('anon-') 
                            ? `#${u.userId.slice(5, 9)}` 
                            : `...${u.userId.slice(-6)}`}
                        </span>
                        <span className="text-[10px] text-slate-500">{new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {u.location.city ? decodeURIComponent(u.location.city) : "Desconocido"}
                        </span>
                        <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-amber-500 font-bold border border-amber-500/20">
                          {u.itemsCount} {u.itemsCount === 1 ? 'visita' : 'visitas'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="lg:col-span-2 card min-h-[400px] flex flex-col relative overflow-hidden">
              {selectedUser ? (
                <div className="p-4 space-y-6">
                  <div className="flex justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-xl text-white">Detalle de Sesión</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {decodeURIComponent(selectedUser.location.city || "")}, {selectedUser.location.country}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-500">{selectedUser.totalTime}m</p>
                      <p className="text-[10px] text-slate-600 uppercase">Tiempo total</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {selectedUser.events.slice(0, 20).map((e: any, i: number) => (
                      <div key={i} className="flex gap-4 border-l border-slate-800 pl-4 relative">
                        <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-slate-800 border-2 border-amber-500"></div>
                        <div className="text-xs font-mono text-slate-500 py-1">{new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex-1 text-sm text-slate-300">
                          Vio: <span className="text-white font-medium">{e.path}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                  <i className="ph-user-square text-6xl opacity-20 mb-4"></i>
                  <p>Selecciona un usuario para ver su actividad</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "geo" && (
          <div className="card h-[600px] flex flex-col animate-in fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Mapa de Conexiones Globales</h3>
            <div id="map-geo" className="flex-1 rounded-2xl overflow-hidden z-0 bg-slate-800"></div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur flex items-center justify-center z-[200]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, val, color, border = "border-slate-800" }: any) {
  return (
    <div className={`bg-slate-900 p-4 sm:p-5 rounded-2xl border ${border}`}>
      <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold ${color}`}>{val.toLocaleString()}</div>
    </div>
  );
}
