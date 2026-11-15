import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spot } from '../types/velovibe';
import { Layers, Maximize2, Navigation, Sparkles, LocateFixed, MapPin, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface InteractiveMapProps {
  spots: Spot[];
  activeSpot?: Spot;
  isLoadingSpots?: boolean;
  spotsError?: string | null;
  onSelectSpot: (spot: Spot) => void;
  onAskAi: (prompt: string) => void;
}

type MapLayerType = 'esriDark' | 'satellite' | 'topo' | 'osm';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  spots,
  activeSpot,
  isLoadingSpots = false,
  spotsError,
  onSelectSpot,
  onAskAi,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isUserLocationLoading, setIsUserLocationLoading] = useState(false);

  const TILE_PROVIDERS: Record<MapLayerType, { url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
    osm: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri World Imagery',
      maxZoom: 19,
    },
    topo: {
      url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap',
      maxZoom: 17,
    },
    esriDark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20,
      subdomains: 'abcd',
    },
  };

  const mountTiles = useCallback((map: L.Map, layer: MapLayerType) => {
    try {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      const spec = TILE_PROVIDERS[layer];
      const tiles = L.tileLayer(spec.url, {
        attribution: spec.attribution,
        maxZoom: spec.maxZoom,
        subdomains: spec.subdomains ?? 'abc',
      });
      tiles.addTo(map);
      tileLayerRef.current = tiles;
      map.invalidateSize();
    } catch (err) {
      console.error('Tile layer failed', err);
      setMapError('Шар карти не піднявся. Спробуй інший режим.');
    }
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setMapError('Цей браузер не підтримує геолокацію.');
      return;
    }

    setIsUserLocationLoading(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(location);
        mapInstanceRef.current?.flyTo([location.lat, location.lng], 15, { duration: 0.8 });
        setIsUserLocationLoading(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Немає дозволу на геолокацію. Дозволь доступ у налаштуваннях браузера.'
          : error.code === error.POSITION_UNAVAILABLE
          ? 'Браузер не зміг визначити місцеположення.'
          : 'Час очікування геолокації вичерпано. Спробуй ще раз надворі.';
        setMapError(message);
        setIsUserLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const getCityCode = (spot: Spot): string => {
    if (spot.city === 'vinnytsia' || spot.region.includes('Вінниц')) return 'ВН';
    if (spot.city === 'kyiv' || spot.region.includes('Київ')) return 'КВ';
    if (spot.city === 'karpaty' || spot.region.includes('Карпат') || spot.region.includes('Боржав')) return 'КП';
    if (spot.city === 'lviv' || spot.region.includes('Львів')) return 'ЛВ';
    if (spot.city === 'dnipro' || spot.region.includes('Дніпро')) return 'ДП';
    if (spot.city === 'odesa' || spot.region.includes('Одес')) return 'ОД';
    if (spot.city === 'kharkiv' || spot.region.includes('Харків')) return 'ХК';
    if (spot.city === 'ivano-frankivsk') return 'ІФ';
    if (spot.city === 'uzhhorod') return 'УЖ';
    if (spot.city === 'zaporizhzhia') return 'ЗП';
    if (spot.city === 'chernivtsi') return 'ЧВ';
    if (spot.city === 'poltava') return 'ПЛ';
    return 'MTB';
  };

  const createCustomMarkerIcon = (spot: Spot, isSelected: boolean) => {
    const cityCode = getCityCode(spot);
    const pinColor = isSelected ? '#E10600' : '#FFC400';
    const pinGradient = isSelected
      ? 'linear-gradient(135deg, #EF4444, #991B1B)'
      : 'linear-gradient(135deg, #FFD700, #EA580C)';

    const html = `
      <div style="position: relative; width: 36px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; cursor: pointer; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.85));">

        ${isSelected ? `
            <div style="
              position: absolute;
              top: -4px;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              border: 2px solid ${pinColor};
              animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
              opacity: 0.85;
              pointer-events: none;
            "></div>
          ` : ''}

        <div style="
          width: 36px;
          height: 36px;
          clip-path: polygon(50% 0%, 63% 38%, 100% 38%, 69% 59%, 82% 100%, 50% 74%, 18% 100%, 31% 59%, 0% 38%, 37% 38%);
          background: ${pinGradient};
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          box-shadow: 0 0 16px ${pinColor}aa;
          filter: drop-shadow(0 0 6px ${pinColor});
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 900;
            color: #000000;
            font-family: monospace;
          ">
            ${cityCode}
          </div>
        </div>

        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${pinColor};
          border: 2px solid #000;
          margin-top: 2px;
          box-shadow: 0 0 8px ${pinColor};
        "></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-bike-marker',
      iconSize: [36, 50],
      iconAnchor: [18, 48], // Direct bottom anchor at the exact geographic ground point
      popupAnchor: [0, -48],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
          center: [49.2483278, 28.4292258],
          zoom: 15,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mountTiles(map, 'osm');
      mapInstanceRef.current = map;

      const kick = () => {
        try {
          map.invalidateSize();
        } catch (err) {
          console.error('invalidateSize failed', err);
        }
      };
      kick();
      const t1 = window.setTimeout(kick, 80);
      const t2 = window.setTimeout(kick, 320);
      const observed = mapContainerRef.current;
      const ro = new ResizeObserver(kick);
      ro.observe(observed);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        ro.disconnect();
        map.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      };
    } catch (err) {
      console.error('Leaflet init failed', err);
      setMapError('Карта не зібралась. Онови сторінку — тайли лишились на місці.');
      return undefined;
    }
    // Mount once. Later camera moves go through flyTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountTiles]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    mountTiles(map, activeLayer);
  }, [activeLayer, mountTiles]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const kick = () => {
      try {
        map.invalidateSize();
      } catch (err) {
        console.error('invalidateSize failed', err);
      }
    };
    kick();
    const timer = window.setTimeout(kick, 160);
    return () => window.clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
    }).addTo(map).bindTooltip('Ваше місцеположення');
  }, [userLocation]);

  // Update Markers when spots or activeSpot changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    spots.forEach((spot) => {
      if (
        spot.locationStatus !== 'verified' ||
        !spot.locationSource?.startsWith('http') ||
        !spot.coords ||
        !Number.isFinite(spot.coords.lat) ||
        !Number.isFinite(spot.coords.lng)
      ) return;
      const isSelected = spot.id === activeSpot?.id;
      const icon = createCustomMarkerIcon(spot, isSelected);

      const marker = L.marker([spot.coords.lat, spot.coords.lng], { icon }).addTo(map);

      // Custom Dark Popup Content
      const popupHtml = document.createElement('div');
      popupHtml.className = 'kras-map-popup';
      popupHtml.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #fff;">
            ${escapeHtml(spot.name)}
          </div>
        </div>
        <div style="font-size: 10px; color: #6b7a94; margin-bottom: 6px;">
          ${escapeHtml(spot.region)}
        </div>
        <div style="font-size: 10px; color: #6b7a94; margin-bottom: 8px;">
          Координату взято з OpenStreetMap · виїзної перевірки немає
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <a 
            href="https://www.google.com/maps/search/?api=1&query=${spot.coords.lat},${spot.coords.lng}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="
              background: #E10600;
              color: #fff;
              padding: 5px 10px;
              font-size: 9px;
              font-weight: 900;
              text-transform: uppercase;
              text-decoration: none;
              letter-spacing: 1px;
              clip-path: polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%);
              display: inline-block;
            "
          >
            Відкрити в Google Картах ↗
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320 });

      marker.on('click', () => {
        sound.playShifterClick();
        onSelectSpot(spot);
      });

      markersRef.current[spot.id] = marker;
    });
  }, [spots, activeSpot]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeSpot || activeSpot.locationStatus !== 'verified' || !activeSpot.coords) return;

    const spotId = activeSpot.id;
    let cancelled = false;
    const openPopup = () => {
      if (cancelled) return;
      try {
        markersRef.current[spotId]?.openPopup();
        map.invalidateSize();
      } catch (err) {
        console.error('Popup open failed', err);
      }
    };

    map.once('moveend', openPopup);
    try {
      map.flyTo([activeSpot.coords.lat, activeSpot.coords.lng], 15, {
        duration: 1.15,
        easeLinearity: 0.25,
      });
    } catch (err) {
      console.error('flyTo failed', err);
      setMapError('Камера не долетіла до споту.');
    }

    return () => {
      cancelled = true;
      map.off('moveend', openPopup);
    };
  }, [activeSpot]);

  const handleFocusCity = (lat: number, lng: number, zoom: number = 13) => {
    sound.playShifterClick();
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
  };

  return (
    <div
      className={`relative w-full overflow-hidden border border-white/[0.08] bg-[#060608] transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[440px] sm:h-[500px]'
      }`}
    >
      {/* Top red laser accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent z-[450] pointer-events-none" />

      {/* Map layer switcher & controls HUD (top-left) */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-1 p-1 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] shadow-lg">
        <Layers className="w-3.5 h-3.5 text-[#FFC400] ml-1 mr-0.5" />
        {(
          [
            { id: 'esriDark', label: 'Темна мапа' },
            { id: 'satellite', label: 'Супутник HD' },
            { id: 'topo', label: 'Рельєф / Топо' },
            { id: 'osm', label: 'Вулиці OSM' },
          ] as { id: MapLayerType; label: string }[]
        ).map((layer) => (
          <button
            key={layer.id}
            onClick={() => {
              sound.playShifterClick();
              setActiveLayer(layer.id);
            }}
            className={`px-2 py-1 text-[9px] font-bold uppercase transition-all cursor-pointer ${
              activeLayer === layer.id
                ? 'bg-[#E10600] text-white clip-bevel-sm shadow-[0_0_10px_rgba(225,6,0,0.4)]'
                : 'text-[#6b7a94] hover:text-white'
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Map controls (top-right) */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 flex-wrap justify-end max-w-[70%] sm:max-w-none">
        <button
          onClick={locateMe}
          disabled={isUserLocationLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300/20 bg-[#0b0b10]/95 px-2.5 py-1.5 text-[9px] font-semibold text-blue-100 hover:border-blue-300/50 disabled:opacity-60"
          title="Показати ваше поточне місцеположення на цій мапі"
        >
          <LocateFixed className={`h-3 w-3 ${isUserLocationLoading ? 'animate-pulse' : ''}`} />
          <span>{isUserLocationLoading ? 'Визначаю…' : 'Де я'}</span>
        </button>

        {/* Quick cities dropdown or pills */}
        <button
          onClick={() => handleFocusCity(50.4501, 30.5234, 12)}
          className="px-2 py-1.5 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] hover:border-white/30 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer hidden md:inline-flex"
        >
          Київ
        </button>

        <button
          onClick={() => handleFocusCity(48.3582, 24.4121, 11)}
          className="px-2 py-1.5 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] hover:border-white/30 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer hidden md:inline-flex"
        >
          Карпати
        </button>

        <button
          onClick={() => handleFocusCity(48.8, 31.0, 6)}
          className="px-2 py-1.5 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] hover:border-white/30 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
          title="Показати всю Україну"
        >
          <Navigation className="w-3 h-3 text-[#FFC400]" />
          <span className="hidden sm:inline">Вся Україна</span>
        </button>

        <button
          onClick={() => {
            sound.playShifterClick();
            setIsFullscreen(!isFullscreen);
          }}
          className="p-1.5 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] hover:border-white/30 text-white cursor-pointer"
          title={isFullscreen ? 'Згорнути' : 'На весь екран'}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {mapError && (
        <div role="alert" className="absolute left-3 right-3 top-14 z-[450] flex items-start justify-between gap-3 rounded-lg border border-red-400/30 bg-[#170b0b]/95 p-3 text-xs text-red-100 shadow-xl sm:left-auto sm:max-w-md">
          <span>{mapError}</span>
          <button onClick={() => setMapError(null)} aria-label="Закрити повідомлення" className="text-red-200/70 hover:text-white">✕</button>
        </div>
      )}

      {spots.length === 0 && (
        <div className="absolute left-1/2 top-1/2 z-[400] w-[min(90%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-200/20 bg-[#0b0b10]/95 p-4 text-center shadow-xl backdrop-blur">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-amber-200" />
          <p className="text-sm font-semibold text-white">
            {isLoadingSpots
              ? 'Завантажую дані OpenStreetMap…'
              : spotsError
              ? 'Дані OpenStreetMap тимчасово недоступні'
              : 'За цим фільтром позначених об’єктів немає'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {isLoadingSpots
              ? 'Карта доступна, точки з’являться після відповіді сервера.'
              : spotsError
              ? 'Помилку показано вище. Спробуй оновити дані пізніше.'
              : 'Центр мапи — точка з твого посилання, а не підтверджений велоспот.'}
          </p>
        </div>
      )}

      {/* Selected place quick HUD overlay */}
      <div className="absolute bottom-3 left-3 z-[400] max-w-[92%] sm:max-w-md p-3.5 bg-[#0b0b10]/95 backdrop-blur-md border border-white/[0.08] shadow-[0_10px_25px_rgba(0,0,0,0.85)]">
        {activeSpot ? <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-title text-base text-white uppercase tracking-wider font-bold">
                {activeSpot.name}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-[#9aa3b8]">
              {activeSpot.region} · координати з OSM, не перевірено на місцевості
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeSpot.name}, ${activeSpot.region}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-kras clip-bevel-sm px-2.5 py-1.5 bg-[#E10600] text-white text-[8px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Знайти</span>
            </a>
            <button
              onClick={() => {
                sound.playShifterClick();
                onAskAi(
                  `Розглядаю об’єкт «${activeSpot.name}» у районі «${activeSpot.region}». Координати взяті з OpenStreetMap, але не перевірені на місцевості; точний вхід, маршрут і умови невідомі. Не вигадуй трейли, покриття, складність, доступ чи небезпеки; поясни, що треба перевірити з місцевими перед виїздом.`
                );
              }}
              className="btn-kras clip-bevel-sm px-2.5 py-1.5 bg-[#18181f] border border-white/10 text-white text-[8px] font-extrabold uppercase tracking-wider cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-[#FFC400]" />
              <span>Запитати AI</span>
            </button>
          </div>
        </div> : (
          <div className="text-[10px] text-[#cbd5e1]">
            <div className="font-title text-sm font-bold uppercase tracking-wider text-white">Вінниця · центр мапи</div>
            <div className="mt-1">Точка з твого Google Maps-посилання, не велоспот</div>
          </div>
        )}
      </div>

      {/* Leaflet DOM container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
