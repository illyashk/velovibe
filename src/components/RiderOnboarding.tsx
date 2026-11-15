import React, { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { BIKE_DISCIPLINE_LABELS, BikeDiscipline, RiderProfile } from '../types/velovibe';
import { BrandImage } from './BrandImage';

interface RiderOnboardingProps {
  email: string;
  initialName: string;
  initialError?: string | null;
  onSave: (profile: RiderProfile, saveAiHistory: boolean) => Promise<void>;
}

export const RiderOnboarding: React.FC<RiderOnboardingProps> = ({ email, initialName, initialError, onSave }) => {
  const [username, setUsername] = useState(initialName);
  const [bikeModel, setBikeModel] = useState('');
  const [discipline, setDiscipline] = useState<BikeDiscipline>('Trail');
  const [riderWeightKg, setRiderWeightKg] = useState('');
  const [riderHeightCm, setRiderHeightCm] = useState('');
  const [frameSize, setFrameSize] = useState('');
  const [saveAiHistory, setSaveAiHistory] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const profile: RiderProfile = {
      username: username.trim(),
      callsign: username.trim(),
      discipline,
      bikeModel: bikeModel.trim(),
      riderWeightKg: Number(riderWeightKg),
      riderHeightCm: Number(riderHeightCm),
      frameSize: frameSize.trim(),
      forkTravelMm: 0,
      shockTravelMm: 0,
      frontTirePsi: 0,
      rearTirePsi: 0,
    };

    try {
      await onSave(profile, saveAiHistory);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : saveError && typeof saveError === 'object' && 'message' in saveError && typeof saveError.message === 'string'
          ? saveError.message
          : 'Не вдалося зберегти профіль.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060608] px-4 py-12 text-[#f2f2fa]">
      <section className="cab-card w-full max-w-2xl border border-white/10 bg-[#0b0b10] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E10600]/15 text-[#E10600]">
            <BrandImage src="/brand/site-logo.png" fallbackSrc="/brand/site-logo.svg" alt="" className="h-11 w-11 rounded-lg object-contain" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Перший запуск</p>
            <h1 className="font-title text-2xl font-black uppercase tracking-wide">Профіль райдера</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          Заповни базові дані, щоб персоналізувати кабінет. Технічні налаштування можна додати пізніше — ми не підставляємо вигадані значення.
        </p>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="rider-email" className="mb-1.5 block text-xs font-semibold text-slate-300">Email акаунта</label>
            <input id="rider-email" value={email} readOnly className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm text-slate-400" />
          </div>
          <div>
            <label htmlFor="rider-name" className="mb-1.5 block text-xs font-semibold text-slate-300">Ім’я або нік</label>
            <input id="rider-name" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={60} required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
          </div>
          <div>
            <label htmlFor="rider-bike" className="mb-1.5 block text-xs font-semibold text-slate-300">Велосипед</label>
            <input id="rider-bike" value={bikeModel} onChange={(event) => setBikeModel(event.target.value)} maxLength={100} placeholder="Марка й модель, якщо відомі" required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
          </div>
          <div>
            <label htmlFor="rider-height" className="mb-1.5 block text-xs font-semibold text-slate-300">Зріст, см</label>
            <input id="rider-height" type="number" min={130} max={220} value={riderHeightCm} onChange={(event) => setRiderHeightCm(event.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
          </div>
          <div>
            <label htmlFor="rider-weight" className="mb-1.5 block text-xs font-semibold text-slate-300">Вага, кг</label>
            <input id="rider-weight" type="number" min={30} max={200} step={0.1} value={riderWeightKg} onChange={(event) => setRiderWeightKg(event.target.value)} required className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
          </div>
          <div>
            <label htmlFor="rider-size" className="mb-1.5 block text-xs font-semibold text-slate-300">Розмір рами, якщо знаєш</label>
            <input id="rider-size" value={frameSize} onChange={(event) => setFrameSize(event.target.value)} maxLength={30} placeholder="Наприклад, M або L" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60" />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-xs font-semibold text-slate-300">Основна дисципліна</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BIKE_DISCIPLINE_LABELS) as BikeDiscipline[]).map((value) => (
                <button key={value} type="button" onClick={() => setDiscipline(value)} aria-pressed={discipline === value} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${discipline === value ? 'border-[#E10600]/60 bg-[#E10600]/15 text-white' : 'border-white/10 bg-black/20 text-slate-400 hover:text-white'}`}>
                  {BIKE_DISCIPLINE_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-black/20 p-3 text-xs leading-relaxed text-slate-300 sm:col-span-2">
            <input type="checkbox" checked={saveAiHistory} onChange={(event) => setSaveAiHistory(event.target.checked)} className="mt-0.5 accent-[#E10600]" />
            <span>Зберігати мої AI-розмови в акаунті для продовження згодом. Історія приватна, доступна лише мені; її можна видалити або вимкнути.</span>
          </label>
          {error && <p role="alert" className="sm:col-span-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs text-rose-100">{error}</p>}
          <button type="submit" disabled={isSaving} className="btn-kras flex items-center justify-center gap-2 rounded-lg bg-[#E10600] px-4 py-3 text-xs font-bold tracking-widest text-white transition-colors hover:bg-[#b80500] disabled:opacity-50 sm:col-span-2">
            {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Зберігаю…' : 'Зберегти профіль'}
          </button>
        </form>
      </section>
    </main>
  );
};
