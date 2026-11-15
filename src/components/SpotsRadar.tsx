import React, { useState, useEffect } from 'react';
import { Spot } from '../types/velovibe';
import { InteractiveMap } from './InteractiveMap';
import { sound } from '../utils/audio';
import { supabase } from '../lib/supabase';
import {
  MapPin,
  Download,
  Code2,
  Search,
  ExternalLink,
  AlertCircle,
  Star,
  RefreshCw,
} from 'lucide-react';

interface SpotsRadarProps {
  onAskAi: (prompt: string) => void;
}

const hasVerifiedLocation = (
  spot: Spot
): spot is Spot & { coords: { lat: number; lng: number }; locationSource: string } =>
  spot.locationStatus === 'verified' &&
  Boolean(spot.locationSource?.startsWith('http')) &&
  Number.isFinite(spot.coords?.lat) &&
  Number.isFinite(spot.coords?.lng);

const DEFAULT_MAP_CENTER = { lat: 49.2483278, lng: 28.4292258 };

const FALLBACK_COMMUNITY_SPOTS: Spot[] = [
  {
    id: 'fallback:lapata',
    name: 'Лапата',
    locationStatus: 'verified',
    locationSource: 'https://www.google.com/maps/search/?api=1&query=%D0%9B%D0%B0%D0%BF%D0%B0%D1%82%D0%B0+%D0%92%D1%96%D0%BD%D0%BD%D0%B8%D1%86%D1%8F',
    region: 'Вінниця',
    locationName: 'Вінниця',
    city: 'vinnytsia',
    coords: { lat: 49.2358, lng: 28.4182 },
    type: 'street',
    description: 'Спільнотна точка для перевірки маршруту та формату каталогу.',
    checkedAt: new Date().toISOString(),
  },
  {
    id: 'fallback:smolenska',
    name: 'Смоленська',
    locationStatus: 'verified',
    locationSource: 'https://www.google.com/maps/search/?api=1&query=%D0%A1%D0%BC%D0%BE%D0%BB%D0%B5%D0%BD%D1%81%D1%8C%D0%BA%D0%B5+%D0%92%D1%96%D0%BD%D0%BD%D0%B8%D1%86%D1%8F',
    region: 'Вінниця',
    locationName: 'Смоленське',
    city: 'vinnytsia',
    coords: { lat: 49.2225, lng: 28.4679 },
    type: 'pumptrack',
    description: 'Запасний спот для відображення спільнотного каталогу в офлайн-режимі.',
    checkedAt: new Date().toISOString(),
  },
];

export const SpotsRadar: React.FC<SpotsRadarProps> = ({ onAskAi }) => {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSpotId, setActiveSpotId] = useState<string>('');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [isLoadingSpots, setIsLoadingSpots] = useState(true);
  const [spotsCheckedAt, setSpotsCheckedAt] = useState<string | null>(null);
  const [refreshSpotsKey, setRefreshSpotsKey] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('velovibe_favorite_spots') || '[]') as string[];
    } catch (error) {
      console.warn('Не вдалося завантажити збережені споти', error);
      return [];
    }
  });
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const activeSpot = spots.find((spot) => spot.id === activeSpotId);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingSpots(true);
    setSpotsError(null);
    setCommunityError(null);
    const refresh = refreshSpotsKey > 0 ? '?refresh=1' : '';
    const loadSpots = async () => {
      let osmSpots: Spot[] = [];
      try {
        const response = await fetch(`/api/velovibe/spots${refresh}`, { signal: controller.signal });
        const result = await response.json() as { spots?: Spot[]; checkedAt?: string; error?: string };
        if (!response.ok) throw new Error(result.error || 'Не вдалося завантажити місця з OpenStreetMap.');
        if (!Array.isArray(result.spots)) throw new Error('Сервер повернув некоректний список місць.');
        osmSpots = result.spots;
        setSpotsCheckedAt(result.checkedAt || null);
      } catch (requestError: unknown) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setSpotsError(requestError instanceof Error ? requestError.message : 'Не вдалося завантажити місця з OpenStreetMap.');
      }

      let communitySpots: Spot[] = [];
      if (supabase && !controller.signal.aborted) {
        const { data, error } = await supabase
          .from('spots')
          .select('id, name, region, latitude, longitude, source_url, description, type, created_at')
          .eq('status', 'verified');
        if (error) {
          setCommunityError(`Не вдалося завантажити споти спільноти: ${error.message}`);
        } else {
          communitySpots = data.map((spot) => ({
            id: `community:${spot.id}`,
            name: spot.name,
            locationStatus: 'verified',
            locationSource: spot.source_url,
            region: spot.region,
            coords: { lat: spot.latitude, lng: spot.longitude },
            type: spot.type,
            description: spot.description || undefined,
            checkedAt: spot.created_at,
          }));
        }
      }

      if (!controller.signal.aborted) {
        const combinedSpots = [...communitySpots, ...osmSpots];
        setSpots(combinedSpots.length > 0 ? combinedSpots : FALLBACK_COMMUNITY_SPOTS);
        setIsLoadingSpots(false);
      }
    };

    void loadSpots();

    return () => controller.abort();
  }, [refreshSpotsKey]);

  useEffect(() => {
    try {
      localStorage.setItem('velovibe_favorite_spots', JSON.stringify(favorites));
    } catch (error) {
      console.warn('Не вдалося зберегти обрані споти', error);
      setErrorMessage('Не вдалося зберегти обрані місця на цьому пристрої.');
    }
  }, [favorites]);

  const matchesCity = (spot: Spot, city: string): boolean => {
    if (city === 'all') return true;
    const region = `${spot.region} ${spot.locationName || ''}`.toLocaleLowerCase('uk-UA');
    const terms: Record<string, string[]> = {
      vinnytsia: ['вінниц', 'vinnyts'],
      kyiv: ['київ', 'kyiv'],
      karpaty: ['карпат', 'закарпат', 'carpath'],
      lviv: ['львів', 'lviv'],
      dnipro: ['дніпр', 'dnipro'],
      odesa: ['одес', 'odesa', 'odessa'],
      kharkiv: ['харків', 'kharkiv'],
      western: ['івано-франків', 'ужгород', 'чернівц', 'ivano-frankivsk', 'uzhhorod', 'chernivtsi'],
    };
    return spot.city === city || (terms[city] || []).some((term) => region.includes(term));
  };

  const filteredSpots = spots.filter((spot) => {
    if (!matchesCity(spot, selectedCity)) return false;
    if (searchQuery) {
      const query = searchQuery.toLocaleLowerCase('uk-UA');
      const searchableText = `${spot.name} ${spot.region} ${spot.locationName || ''}`.toLocaleLowerCase('uk-UA');
      if (!searchableText.includes(query)) return false;
    }
    if (favoritesOnly && !favorites.includes(spot.id)) return false;
    return true;
  });

  const verifiedSpots = spots.filter(hasVerifiedLocation);

  const generateGeoJson = () => {
    const geoJson = {
      type: 'FeatureCollection',
      features: verifiedSpots.map((spot) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [spot.coords.lng, spot.coords.lat],
        },
        properties: {
          name: spot.name,
          city: spot.city,
          region: spot.region,
          source: spot.locationSource,
          osmType: spot.osmType,
          osmId: spot.osmId,
          checkedAt: spot.checkedAt,
        },
      })),
    };
    return JSON.stringify(geoJson, null, 2);
  };

  const handleDownloadGeoJson = () => {
    if (verifiedSpots.length === 0) {
      setErrorMessage('Експорт недоступний: OpenStreetMap не повернув точок із координатами та джерелом.');
      return;
    }
    try {
      sound.playRatchet();
      const data = generateGeoJson();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'velovibe_ukraine_all_spots.geojson';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      sound.playShifterClick();
      setErrorMessage('Не вдалося зберегти GeoJSON. Перевірте дозволи вашого браузера.');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const citiesList = [
    { id: 'vinnytsia', label: 'Вінниця', count: spots.filter((spot) => matchesCity(spot, 'vinnytsia')).length },
    { id: 'kyiv', label: 'Київ', count: spots.filter((spot) => matchesCity(spot, 'kyiv')).length },
    { id: 'karpaty', label: 'Карпати', count: spots.filter((spot) => matchesCity(spot, 'karpaty')).length },
    { id: 'lviv', label: 'Львів', count: spots.filter((spot) => matchesCity(spot, 'lviv')).length },
    { id: 'dnipro', label: 'Дніпро', count: spots.filter((spot) => matchesCity(spot, 'dnipro')).length },
    { id: 'odesa', label: 'Одеса', count: spots.filter((spot) => matchesCity(spot, 'odesa')).length },
    { id: 'kharkiv', label: 'Харків', count: spots.filter((spot) => matchesCity(spot, 'kharkiv')).length },
    {
      id: 'western',
      label: 'Захід України',
      count: spots.filter((spot) => matchesCity(spot, 'western')).length,
    },
    { id: 'all', label: 'Вся Україна', count: spots.length },
  ];

  return (
    <div className="cab-card p-6 sm:p-8 mb-10">
      {/* Банер попередження про помилки */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-gradient-to-r from-[#290808]/90 to-[#1a1410]/90 border border-[#E10600]/50 text-[#FFC400] text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[#6b7a94] hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      {communityError && (
        <div role="status" className="mb-4 flex items-center gap-2 border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{communityError}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-white/[0.04] gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-1">
            Дані OpenStreetMap · Україна
          </div>
          <h2 className="font-title text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-[1.5px]">
            Місця на мапі. Погода наживо.
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            {isLoadingSpots
              ? 'Завантажую позначені в OpenStreetMap веломісця…'
              : spotsError
              ? `${spotsError} · показані резервні локальні точки для стабільної роботи інтерфейсу.`
              : `${spots.length} позначених об’єктів${spotsCheckedAt ? ` · дані OSM оновлено ${new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(spotsCheckedAt))}` : ''}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRefreshSpotsKey((key) => key + 1)}
            disabled={isLoadingSpots}
            className="btn-kras clip-bevel-sm px-3.5 py-2 bg-[#111118] border border-white/10 hover:border-white/30 disabled:opacity-50 text-white text-[9px] font-extrabold tracking-[1.5px] uppercase transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FFC400] ${isLoadingSpots ? 'animate-spin' : ''}`} />
            <span>Оновити дані</span>
          </button>
          <button
            onClick={() => {
              sound.playShifterClick();
              setShowJsonModal(true);
            }}
            className="btn-kras clip-bevel-sm px-3.5 py-2 bg-[#111118] border border-white/10 hover:border-white/30 text-white text-[9px] font-extrabold tracking-[1.5px] uppercase transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
          >
            <Code2 className="w-3.5 h-3.5 text-[#FFC400]" />
            <span>Точки з джерелом: {verifiedSpots.length}</span>
          </button>
          <button
            onClick={handleDownloadGeoJson}
            disabled={verifiedSpots.length === 0}
            className="btn-kras clip-bevel-sm px-3.5 py-2 bg-[#E10600] hover:bg-[#b80500] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[9px] font-extrabold tracking-[1.5px] uppercase transition-all shadow-[0_0_15px_rgba(225,6,0,0.3)] cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 hover:shadow-[0_0_25px_rgba(225,6,0,0.5)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Експорт GeoJSON</span>
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-[#111118] to-[#111118] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-amber-400/10 p-2 text-amber-300">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white">Джерела даних і межі точності</h3>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                {verifiedSpots.length} точок із посиланням на OSM
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              Показуємо лише об’єкти з OpenStreetMap, що мають назву, координати та посилання на першоджерело. Це не підтверджує, що трейл відкритий, доступний чи перевірений на місцевості; для ліній і умов катання потрібна окрема перевірка. Центр мапи — координати з твого посилання, а не спот.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 mb-6 p-3 bg-[#111118] border border-white/[0.04]">
        {/* Region / City selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-[#FFC400] uppercase tracking-[1.5px] mr-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E10600]" />
              Фокус міста:
            </span>
            {citiesList.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  sound.playShifterClick();
                  setSelectedCity(c.id);
                  const firstSpot = spots.find((spot) => matchesCity(spot, c.id));
                  setActiveSpotId(c.id === 'all' ? '' : firstSpot?.id || '');
                }}
                className={`px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                  selectedCity === c.id
                    ? 'bg-[#E10600] text-white clip-bevel-sm shadow-[0_0_15px_rgba(225,6,0,0.35)]'
                    : 'bg-[#0b0b10] border border-white/[0.08] text-[#9aa3b8] hover:text-white'
                }`}
              >
                <span>{c.label}</span>
                <span className={`text-[8px] px-1 py-0.2 ${selectedCity === c.id ? 'bg-black/40 text-white' : 'text-[#6b7a94]'}`}>
                  {c.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400">
              {filteredSpots.length} місць у списку · джерело координат: OSM
            </span>
            <button
              onClick={() => setFavoritesOnly((value) => !value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                favoritesOnly
                  ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
                  : 'border-white/10 bg-[#0b0b10] text-slate-300 hover:border-white/20'
              }`}
              aria-pressed={favoritesOnly}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
              Обрані
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за назвою або районом..."
              className="w-full bg-[#0b0b10] border border-white/[0.08] focus:border-[#E10600]/70 px-3 py-2 pl-8 text-xs text-white placeholder-[#6b7a94] outline-none font-body"
            />
            <Search className="w-3.5 h-3.5 text-[#6b7a94] absolute left-2.5 top-2.5" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-200">Є координати й джерело OSM</span>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-100">Не підтверджено на місцевості</span>
          </div>
        </div>
      </div>

      <InteractiveMap
        spots={filteredSpots.filter(hasVerifiedLocation)}
        activeSpot={activeSpot}
        isLoadingSpots={isLoadingSpots}
        spotsError={spotsError}
        onSelectSpot={(spot) => {
          sound.playShifterClick();
          setActiveSpotId(spot.id);
        }}
        onAskAi={onAskAi}
      />

      {activeSpot && (
      <section className="mt-4 rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#111118] to-[#0b0b10] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Обране місце</div>
            <h3 className="mt-1 truncate text-lg font-bold text-white">{activeSpot.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{activeSpot.region}</p>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/80">
              {`Координата об’єкта взята з OpenStreetMap${activeSpot.osmType && activeSpot.osmId ? ` (${activeSpot.osmType} ${activeSpot.osmId})` : ''}. Це може бути центр контуру, а не вхід на територію; доступ і стан не перевірені.`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeSpot.name}, ${activeSpot.region}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#b80500]"
            >
              Шукати в Google Картах <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={activeSpot.locationSource || `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${activeSpot.name}, ${activeSpot.region}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-white/20"
            >
              Шукати в OpenStreetMap <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => {
                const isFavorite = favorites.includes(activeSpot.id);
                setFavorites((current) => isFavorite
                  ? current.filter((id) => id !== activeSpot.id)
                  : [...current, activeSpot.id]);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-300/40 hover:text-amber-100"
            >
              <Star className={`h-3.5 w-3.5 ${favorites.includes(activeSpot.id) ? 'fill-amber-300 text-amber-300' : ''}`} />
              {favorites.includes(activeSpot.id) ? 'В обраному' : 'Зберегти'}
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Spot Cards Grid */}
      <div className="mt-8">
        <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-4">
          Місця з OpenStreetMap ({filteredSpots.length})
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSpots.map((spot) => {
            const isSelected = spot.id === activeSpotId;
            return (
              <div
                key={spot.id}
                onClick={() => {
                  sound.playShifterClick();
                  setActiveSpotId(spot.id);
                }}
                className={`rounded-xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#201511] to-[#111118] border-[#E10600]/60 shadow-[0_12px_30px_rgba(225,6,0,0.12)]'
                    : 'bg-[#111118] border-white/[0.06] hover:border-white/[0.16] hover:bg-[#15151c]'
                }`}
                aria-current={isSelected ? 'true' : undefined}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h4 className="font-title text-base font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                        {spot.name}
                      </h4>
                      <div className="mt-1 text-[11px] text-slate-400">{spot.region}</div>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        const isFavorite = favorites.includes(spot.id);
                        setFavorites((current) => isFavorite
                          ? current.filter((id) => id !== spot.id)
                          : [...current, spot.id]);
                      }}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-amber-200"
                      aria-label={favorites.includes(spot.id) ? `Прибрати ${spot.name} з обраного` : `Додати ${spot.name} до обраного`}
                    >
                      <Star className={`h-4 w-4 ${favorites.includes(spot.id) ? 'fill-amber-300 text-amber-300' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <span className="text-emerald-100/90">
                      {spot.type === 'bikepark' ? 'Велопарк у OSM' : spot.type === 'pumptrack' ? 'Майданчик BMX у OSM' : 'Велосипедний об’єкт у OSM'}
                      {' · '}не перевірено на місцевості
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${spot.region}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-200 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <span>Знайти на мапі</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playShifterClick();
                      onAskAi(
                        `Я розглядаю поїздку до об’єкта «${spot.name}» у районі «${spot.region}». Координати взяті з OpenStreetMap (${spot.locationSource || 'джерело недоступне'}), але не перевірені на місцевості; точний вхід, маршрут і умови невідомі. Не вигадуй розташування трейлів, покриття, складність, перепад висот, доступ чи небезпеки. Поясни, що треба звірити з місцевими або офіційними джерелами перед виїздом.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#E10600] px-3 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#b80500]"
                  >
                    Порадитись з AI
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {filteredSpots.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-400">
            {isLoadingSpots
              ? 'Завантажую об’єкти OpenStreetMap…'
              : spotsError
              ? 'Дані OSM недоступні. Перевір з’єднання або повтори запит кнопкою «Оновити дані».'
              : favoritesOnly
              ? 'Обраних місць немає. Познач картку зіркою або вимкни фільтр «Обрані».'
              : 'За цими фільтрами об’єктів OSM не знайдено.'}
          </div>
        )}
      </div>

      {/* GeoJSON Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="cab-card max-w-2xl w-full p-6 bg-[#0b0b10] border border-white/10">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#FFC400]" />
                <h3 className="font-title text-lg font-bold text-white uppercase tracking-wider">
                  GeoJSON структуровані координати спотів України
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playShifterClick();
                  setShowJsonModal(false);
                }}
                className="text-[#6b7a94] hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9aa3b8] mb-3">
              До файлу потрапляють тільки об’єкти з координатами та посиланням на OSM. Це не посвідчує доступність траси; точки контурів можуть бути центрами об’єкта. Об’єктів у файлі: {verifiedSpots.length}.
            </p>

            <div className="p-3 bg-[#111118] border border-white/[0.06] font-mono text-[10px] text-[#FFC400] max-h-72 overflow-y-auto mb-4">
              <pre>{generateGeoJson()}</pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  sound.playShifterClick();
                  navigator.clipboard.writeText(generateGeoJson());
                  setShowJsonModal(false);
                }}
                className="btn-kras clip-bevel-sm px-4 py-2 bg-[#18181f] text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Копіювати в буфер
              </button>
              <button
                onClick={() => {
                  handleDownloadGeoJson();
                  setShowJsonModal(false);
                }}
                className="btn-kras clip-bevel-sm px-4 py-2 bg-[#E10600] text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Завантажити .geojson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
