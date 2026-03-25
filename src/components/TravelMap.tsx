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
    // Verificar si ya existe para evitar duplicados
    if (document.getElementById('leaflet-css')) return;

    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if (!mapRef.current || mapInstance.current) return;

      // Pequeño delay para asegurar que el CSS se aplique y el contenedor tenga dimensiones
      setTimeout(() => {
        const L = (window as any).L;
        if (!L || !mapRef.current) return;
        
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false // Evitar scroll accidental
        }).setView([52.5, 11], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(mapInstance.current);

        if (activities.length > 0) {
          const pathPoints: [number, number][] = [];
          const bounds = L.latLngBounds([]);

          activities.forEach((act) => {
            if (act.lat && act.lng) {
              const markerIcon = L.divIcon({
                html: `<div class="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(245,158,11,1)]"></div>`,
                className: 'custom-div-icon',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              });

              L.marker([act.lat, act.lng], { icon: markerIcon })
                .addTo(mapInstance.current)
                .bindPopup(`<b style="color: #000">${act.title}</b><br/><span style="color: #666; font-size: 10px;">${act.location}</span>`);
              
              const pos: [number, number] = [act.lat, act.lng];
              pathPoints.push(pos);
              bounds.extend(pos);
            }
          });

          if (pathPoints.length > 1) {
            L.polyline(pathPoints, {
              color: '#f59e0b',
              weight: 3,
              opacity: 0.8,
              dashArray: '8, 12',
              lineJoin: 'round'
            }).addTo(mapInstance.current);
          }

          if (!bounds.isEmpty()) {
            mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
        
        // Forzar recalcular tamaño
        setTimeout(() => mapInstance.current?.invalidateSize(), 200);
      }, 300);
    };
    document.head.appendChild(script);

    return () => {
      // No removemos el script/css para evitar recargas constantes si el componente se remonta
    };
  }, [activities]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapRef} id="travel-map-container" className="w-full h-full min-h-[400px]" />
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-[10px] text-slate-400">
        <p className="font-bold text-amber-500 uppercase tracking-widest mb-1">Ruta Alemania 2026</p>
        <p>Hannover • Leipzig • Berlín</p>
      </div>
    </div>
  );
}
