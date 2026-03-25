"use client";

import { useEffect, useRef } from 'react';

interface Activity {
  id: string;
  day_number: number;
  date_str: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  icon: string;
}

interface TravelMapProps {
  activities: Activity[];
}

export default function TravelMap({ activities }: TravelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    // Cargar Leaflet desde CDN dinámicamente
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (!mapRef.current || mapInstance.current) return;

      const L = (window as any).L;
      
      // Inicializar mapa centrado en Alemania
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([52.5, 11], 6);

      // Capa de mapa oscura (Premium Look)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(mapInstance.current);

      const pathPoints: [number, number][] = [];

      activities.forEach((act) => {
        if (act.lat && act.lng) {
          const markerIcon = L.divIcon({
            html: `<div class="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>`,
            className: 'custom-div-icon',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          L.marker([act.lat, act.lng], { icon: markerIcon })
            .addTo(mapInstance.current)
            .bindPopup(`<b style="color: #000">${act.title}</b><br/><span style="color: #666">${act.location}</span>`);
          
          pathPoints.push([act.lat, act.lng]);
        }
      });

      // Dibujar línea de ruta (Hannover -> Leipzig -> Berlín -> Hannover)
      if (pathPoints.length > 1) {
        L.polyline(pathPoints, {
          color: '#f59e0b',
          weight: 3,
          opacity: 0.6,
          dashArray: '10, 10',
          lineJoin: 'round'
        }).addTo(mapInstance.current);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [activities]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-[10px] text-slate-400">
        <p className="font-bold text-amber-500 uppercase tracking-widest mb-1">Ruta Alemania 2026</p>
        <p>Hannover • Leipzig • Berlín</p>
      </div>
    </div>
  );
}
