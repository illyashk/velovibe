import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, MapPin, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { SpotType } from '../types/velovibe';
import { supabase } from '../lib/supabase';
import { AdvertisementManager } from './AdvertisementManager';
import { SupportChat } from './SupportChat';

interface AdminSpot {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  source_url: string;
  description: string;
  status: 'pending' | 'verified';
  type: SpotType;
  created_at: string;
}

const SPOT_TYPES: Array<{ value: SpotType; label: string }> = [
  { value: 'bikepark', label: 'Байк-парк' },
  { value: 'pumptrack', label: 'Памптрек' },
  { value: 'enduro', label: 'Ендуро-трейл' },
  { value: 'dirt', label: 'Дьорт / стрибки' },
  { value: 'street', label: 'Інше веломісце' },
];

interface AdminPanelProps {
  userId: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ userId }) => {
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<SpotType>('bikepark');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSpots = async () => {
    if (!supabase) {
      setError('Supabase не налаштовано.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('spots')
      .select('id, name, region, latitude, longitude, source_url, description, status, type, created_at')
      .order('created_at', { ascending: false });
    if (loadError) {
      setError(`Не вдалося завантажити споти: ${loadError.message}`);
    } else {
      setSpots(data as AdminSpot[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadSpots();
  }, []);

  const addSpot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setIsSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('spots').insert({
        name: name.trim(),
        region: region.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        source_url: sourceUrl.trim(),
        description: description.trim(),
        type,
        status: 'pending',
        created_by: userId,
      });
      if (insertError) throw insertError;
      setName('');
      setRegion('');
      setLatitude('');
      setLongitude('');
      setSourceUrl('');
      setDescription('');
      await loadSpots();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося додати спот.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (spot: AdminSpot, status: AdminSpot['status']) => {
    if (!supabase) return;
    setError(null);
    const { error: updateError } = await supabase
      .from('spots')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', spot.id);
    if (updateError) {
      setError(`Не вдалося змінити статус: ${updateError.message}`);
      return;
    }
    await loadSpots();
  };

  const deleteSpot = async (spot: AdminSpot) => {
    if (!supabase || !window.confirm(`Видалити «${spot.name}»?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('spots').delete().eq('id', spot.id);
    if (deleteError) {
      setError(`Не вдалося видалити спот: ${deleteError.message}`);
      return;
    }
    await loadSpots();
  };

  return (
    <section className="cab-card mb-10 space-y-8 p-6 sm:p-8">
      <header className="border-b border-white/[0.06] pb-5">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E10600]">
          <ShieldCheck className="h-4 w-4" /> Керування спільнотою
        </p>
        <h1 className="mt-2 font-title text-3xl font-black uppercase tracking-wide text-white">Адмінпанель</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Нові місця публікуються лише після перевірки координат і джерела. Додавай точку входу або чітко позначений центр об’єкта — не приблизний пін.
        </p>
      </header>

      <div className="rounded-lg border border-sky-300/20 bg-sky-300/[0.06] p-4 text-xs leading-relaxed text-sky-100">
        <strong>Ключі API:</strong> секрети Gemini та серверний ключ Supabase налаштовуються у змінних середовища хостингу (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), не в браузері. Не вставляй їх у форму чи чат.
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div>
          <AdvertisementManager userId={userId} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Підтримка райдерів</h2>
          <SupportChat userId={userId} isAdmin embedded />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs text-rose-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={addSpot} className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white sm:col-span-2">Додати веломісце</h2>
        <label className="text-xs text-slate-300">
          Назва
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <label className="text-xs text-slate-300">
          Місто / область
          <input value={region} onChange={(event) => setRegion(event.target.value)} maxLength={120} required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <label className="text-xs text-slate-300">
          Широта
          <input type="number" step="any" min={-90} max={90} value={latitude} onChange={(event) => setLatitude(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <label className="text-xs text-slate-300">
          Довгота
          <input type="number" step="any" min={-180} max={180} value={longitude} onChange={(event) => setLongitude(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <label className="text-xs text-slate-300">
          Тип місця
          <select value={type} onChange={(event) => setType(event.target.value as SpotType)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60">
            {SPOT_TYPES.map((spotType) => <option key={spotType.value} value={spotType.value}>{spotType.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-300">
          Посилання на джерело координат
          <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <label className="text-xs text-slate-300 sm:col-span-2">
          Примітка про точність / доступ
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
        </label>
        <button type="submit" disabled={isSaving} className="btn-kras flex items-center justify-center gap-2 rounded-lg bg-[#E10600] px-4 py-3 text-xs font-bold tracking-widest text-white transition-colors hover:bg-[#b80500] disabled:opacity-50 sm:col-span-2">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSaving ? 'Додаю…' : 'Додати на перевірку'}
        </button>
      </form>

      <div>
        <div className="mb-4 flex items-center justify-between border-t border-white/[0.06] pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Каталог спільноти</h2>
          <button type="button" onClick={() => void loadSpots()} className="text-xs text-slate-400 hover:text-white">Оновити</button>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Завантажую…</p>
        ) : spots.length === 0 ? (
          <p className="text-sm text-slate-500">У базі поки немає спотів.</p>
        ) : (
          <div className="space-y-3">
            {spots.map((spot) => (
              <article key={spot.id} className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold text-white"><MapPin className="h-4 w-4 shrink-0 text-[#E10600]" />{spot.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{spot.region} · {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}</p>
                  <a href={spot.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block max-w-full truncate text-xs text-sky-300 hover:text-white">{spot.source_url}</a>
                  {spot.description && <p className="mt-1 text-xs text-slate-500">{spot.description}</p>}
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${spot.status === 'verified' ? 'border-emerald-300/25 text-emerald-200' : 'border-amber-300/25 text-amber-200'}`}>
                    {spot.status === 'verified' ? 'Опубліковано' : 'Очікує перевірки'}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {spot.status === 'pending' && (
                    <button type="button" onClick={() => void updateStatus(spot, 'verified')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/25 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-300/10">
                      <Check className="h-3.5 w-3.5" />Перевірено
                    </button>
                  )}
                  {spot.status === 'verified' && (
                    <button type="button" onClick={() => void updateStatus(spot, 'pending')} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs text-amber-200 hover:bg-amber-300/10">Зняти з мапи</button>
                  )}
                  <button type="button" onClick={() => void deleteSpot(spot)} aria-label={`Видалити ${spot.name}`} className="rounded-lg border border-rose-300/20 p-2 text-rose-200 hover:bg-rose-300/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
