import React, { useEffect, useState } from 'react';
import { AlertCircle, CloudSun, Crosshair, Droplets, RefreshCw, Wind } from 'lucide-react';

interface CurrentWeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  timezone: string;
  source: string;
  fetchedAt: string;
  observationType: 'modelled-current-conditions';
}

interface WeatherLocation {
  label: string;
  lat: number;
  lon: number;
}

const WEATHER_CITIES: Record<string, WeatherLocation> = {
  vinnytsia: { label: 'Вінниця', lat: 49.2328, lon: 28.481 },
  kyiv: { label: 'Київ', lat: 50.4501, lon: 30.5234 },
  lviv: { label: 'Львів', lat: 49.8397, lon: 24.0297 },
  dnipro: { label: 'Дніпро', lat: 48.4647, lon: 35.0462 },
  odesa: { label: 'Одеса', lat: 46.4825, lon: 30.7233 },
  kharkiv: { label: 'Харків', lat: 49.9935, lon: 36.2304 },
  ivanoFrankivsk: { label: 'Івано-Франківськ', lat: 48.9226, lon: 24.7111 },
  uzhhorod: { label: 'Ужгород', lat: 48.6208, lon: 22.2879 },
  chernivtsi: { label: 'Чернівці', lat: 48.2921, lon: 25.9358 },
  zaporizhzhia: { label: 'Запоріжжя', lat: 47.8388, lon: 35.1396 },
};

interface CurrentWeatherProps {
  onAskAi: (prompt: string) => void;
}

const describeWeather = (code: number): string => {
  if (code === 0) return 'Ясно';
  if ([1, 2].includes(code)) return 'Переважно ясно / мінлива хмарність';
  if (code === 3) return 'Хмарно';
  if ([45, 48].includes(code)) return 'Туман';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Мряка';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Дощ';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Сніг';
  if ([95, 96, 99].includes(code)) return 'Гроза';
  return 'Поточні умови';
};

const windDirection = (degrees: number): string => {
  const directions = ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'];
  return directions[Math.round(degrees / 45) % directions.length];
};

export const CurrentWeather: React.FC<CurrentWeatherProps> = ({ onAskAi }) => {
  const [weather, setWeather] = useState<CurrentWeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCity, setSelectedCity] = useState(() => {
    try {
      const saved = localStorage.getItem('velovibe_weather_city');
      return saved && saved in WEATHER_CITIES ? saved : 'vinnytsia';
    } catch (storageError) {
      console.warn('Не вдалося завантажити збережене місто для погоди', storageError);
      return 'vinnytsia';
    }
  });
  const [customLocation, setCustomLocation] = useState<WeatherLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const location = customLocation ?? WEATHER_CITIES[selectedCity];
  const locationLabel = location.label;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setWeather(null);

    const refresh = refreshKey > 0 ? '&refresh=1' : '';
    fetch(`/api/velovibe/weather?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}${refresh}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json() as CurrentWeatherResponse | { error?: string };
        if (!response.ok) {
          throw new Error('error' in result && result.error ? result.error : 'Не вдалося завантажити погоду.');
        }
        setWeather(result as CurrentWeatherResponse);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'Не вдалося завантажити погоду.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [location.lat, location.lon, refreshKey]);

  const handleCityChange = (city: string) => {
    if (!(city in WEATHER_CITIES)) return;
    setSelectedCity(city);
    setCustomLocation(null);
    setLocationError(null);
    try {
      localStorage.setItem('velovibe_weather_city', city);
    } catch (storageError) {
      console.warn('Не вдалося зберегти місто для погоди', storageError);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Браузер не підтримує геолокацію. Обери місто зі списку.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomLocation({
          label: 'Моє місце',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (geoError) => {
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Доступ до геолокації відхилено. Обери місто зі списку.'
            : 'Не вдалося визначити місце. Обери місто зі списку.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const askAiAboutWeather = () => {
    if (!weather) return;
    const current = weather.current;
    onAskAi(
      `Поясни, як поточні погодні умови можуть вплинути на велопоїздку в місці «${locationLabel}». Дані Open-Meteo (модельні поточні умови, не замір метеостанції), локальний час ${current.time} (${weather.timezone}): температура ${current.temperature_2m} °C, відчувається як ${current.apparent_temperature} °C, вологість ${current.relative_humidity_2m}%, опади ${current.precipitation} мм, вітер ${current.wind_speed_10m} км/год, пориви ${current.wind_gusts_10m} км/год, код погоди WMO ${current.weather_code}. Не роби висновків про стан трейлу чи безпеку маршруту без окремих актуальних даних.`
    );
  };

  return (
    <section className="mb-5 rounded-xl border border-sky-300/15 bg-gradient-to-br from-sky-300/[0.07] via-[#111118] to-[#0b0b10] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">
            <CloudSun className="h-4 w-4" />
            Погода райдера · {locationLabel}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="weather-city" className="sr-only">Місто для погоди</label>
            <select
              id="weather-city"
              value={customLocation ? 'custom' : selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs text-white outline-none focus:border-sky-200/50"
            >
              {customLocation && <option value="custom">Моє місце</option>}
              {Object.entries(WEATHER_CITIES).map(([id, city]) => (
                <option key={id} value={id}>{city.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-sky-200/30 disabled:opacity-50"
            >
              <Crosshair className={`h-3.5 w-3.5 ${isLocating ? 'animate-pulse' : ''}`} />
              {isLocating ? 'Визначаю…' : 'Моя геолокація'}
            </button>
          </div>
          {locationError && <p role="status" className="mt-2 text-xs text-amber-200">{locationError}</p>}
          {isLoading && <p className="mt-3 text-sm text-slate-300">Запитую погодні дані…</p>}
          {error && (
            <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {weather && (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <span className="font-title text-4xl font-black text-white">
                  {Math.round(weather.current.temperature_2m)}°
                </span>
                <span className="pb-1 text-sm text-slate-200">{describeWeather(weather.current.weather_code)}</span>
                <span className="pb-1 text-xs text-slate-400">
                  Відчувається як {Math.round(weather.current.apparent_temperature)}°
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <WeatherValue
                  icon={<Droplets className="h-3.5 w-3.5" />}
                  label="Вологість"
                  value={`${weather.current.relative_humidity_2m}%`}
                />
                <WeatherValue
                  icon={<CloudSun className="h-3.5 w-3.5" />}
                  label="Опади зараз"
                  value={`${weather.current.precipitation} мм`}
                />
                <WeatherValue
                  icon={<Wind className="h-3.5 w-3.5" />}
                  label={`Вітер · ${windDirection(weather.current.wind_direction_10m)}`}
                  value={`${Math.round(weather.current.wind_speed_10m)} км/год`}
                />
                <WeatherValue
                  icon={<Wind className="h-3.5 w-3.5" />}
                  label="Пориви"
                  value={`${Math.round(weather.current.wind_gusts_10m)} км/год`}
                />
              </div>
              <p className="mt-3 text-[10px] text-slate-400">
                Станом на {weather.current.time.replace('T', ' ')} · {weather.timezone}
                {' · '}Отримано {new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(weather.fetchedAt))}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-sky-200/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Оновити
          </button>
          <button
            type="button"
            onClick={askAiAboutWeather}
            disabled={!weather}
            className="rounded-lg bg-[#E10600] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b80500] disabled:opacity-50"
          >
            Порада AI
          </button>
        </div>
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-slate-400">
        Джерело:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-sky-200 hover:text-white">
          Open-Meteo
        </a>
        . Це модельні поточні умови, не вимірювання локальної метеостанції й не прогноз стану траси.
      </p>
    </section>
  );
};

const WeatherValue: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
      {icon}
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
  </div>
);
