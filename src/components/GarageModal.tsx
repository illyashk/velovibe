import React, { useState, useEffect } from 'react';
import { BIKE_DISCIPLINE_LABELS, RiderProfile, BikeDiscipline } from '../types/velovibe';
import { X, Check, Bike, Save } from 'lucide-react';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RiderProfile;
  onSave: (updated: RiderProfile) => void | Promise<void>;
  onDeleteAccount: () => Promise<void>;
}

export const GarageModal: React.FC<GarageModalProps> = ({ isOpen, onClose, profile, onSave, onDeleteAccount }) => {
  const [form, setForm] = useState<RiderProfile>({ ...profile });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) setForm({ ...profile });
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const set = <K extends keyof RiderProfile>(k: K, v: RiderProfile[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const email = window.prompt('Для підтвердження введи слово ВИДАЛИТИ. Акаунт і збережені дані буде стерто.');
    if (email !== 'ВИДАЛИТИ') return;
    setSaveError(null);
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Не вдалося видалити акаунт.');
    } finally {
      setIsDeleting(false);
    }
  };

  const fields: { label: string; key: keyof RiderProfile; type: string; min?: number; max?: number }[] = [
    { label: 'Нікнейм райдера',    key: 'username',        type: 'text' },
    { label: 'Модель байка / Вилка', key: 'bikeModel',     type: 'text' },
    { label: 'Вага райдера (кг)',  key: 'riderWeightKg',   type: 'number', min: 40, max: 140 },
    { label: 'Зріст райдера (см)', key: 'riderHeightCm',   type: 'number', min: 130, max: 220 },
    { label: 'Розмір рами',        key: 'frameSize',       type: 'text' },
    { label: 'Хід вилки (мм)',     key: 'forkTravelMm',    type: 'number', min: 80, max: 210 },
    { label: 'Хід аморта (мм)',    key: 'shockTravelMm',   type: 'number', min: 0,  max: 215 },
    { label: 'Тиск переднє (PSI)', key: 'frontTirePsi',    type: 'number', min: 15, max: 60 },
    { label: 'Тиск заднє (PSI)',   key: 'rearTirePsi',     type: 'number', min: 15, max: 60 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Гараж та налаштування"
    >
      <div className="cab-card max-w-lg w-full p-6 sm:p-8 bg-[#0b0b10] border border-white/10 relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#6b7a94] hover:text-[#E10600] p-1 cursor-pointer transition-colors"
          aria-label="Закрити"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-white/[0.06]">
          <div className="w-7 h-7 bg-[#E10600] clip-bevel-sm flex items-center justify-center">
            <Bike className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-title text-xl font-extrabold text-white uppercase tracking-wider">
              Гараж & Налаштування
            </h2>
            <p className="text-[9px] text-[#6b7a94] uppercase tracking-[1.5px]">
              Спеки для розрахунку тиску та геометрії
            </p>
          </div>
        </div>

        {saved && (
          <div className="mb-4 p-3 bg-[#16A34A]/20 border border-[#16A34A]/40 text-[#16A34A] text-xs flex items-center gap-2 animate-fade-in-up">
            <Check className="w-4 h-4" />
            <span>Збережено в кабінеті!</span>
          </div>
        )}
        {saveError && <p role="alert" className="mb-4 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs text-rose-100">{saveError}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Discipline selector */}
          <div>
            <label className="text-[9px] font-bold text-[#6b7a94] uppercase tracking-wider block mb-1.5">
              Основна дисципліна
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(['Enduro', 'Trail', 'DH', 'XC', 'Gravel'] as BikeDiscipline[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('discipline', d)}
                  className={`px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[1px] transition-all cursor-pointer ${
                    form.discipline === d
                      ? 'bg-[#E10600] text-white clip-bevel-sm'
                      : 'bg-[#111118] text-[#9aa3b8] border border-white/[0.08] hover:text-white'
                  }`}
                >
                  {BIKE_DISCIPLINE_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ label, key, type, min, max }) => (
              <div key={key} className={key === 'username' || key === 'bikeModel' ? 'sm:col-span-2' : ''}>
                <label className="text-[9px] font-bold text-[#6b7a94] uppercase tracking-wider block mb-1">
                  {label}
                </label>
                <input
                  type={type}
                  min={min}
                  max={max}
                  value={form[key] === 0 ? '' : (form[key] ?? '') as string | number}
                  onChange={(e) =>
                    set(key, type === 'number' ? (parseInt(e.target.value, 10) || 0) as RiderProfile[typeof key] : e.target.value as RiderProfile[typeof key])
                  }
                  className="w-full bg-[#111118] border border-white/[0.08] focus:border-[#E10600] px-3 py-2 text-xs text-white outline-none transition-colors font-body"
                  required={key === 'username' || key === 'bikeModel'}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-2.5 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={isDeleting || isSaving}
              className="rounded-lg border border-rose-300/20 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-300/10 disabled:opacity-50"
            >
              {isDeleting ? 'Видаляю…' : 'Видалити акаунт'}
            </button>
            <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-kras clip-bevel-sm px-4 py-2.5 bg-transparent border border-white/10 hover:border-white/30 text-[#9aa3b8] text-[9px] font-extrabold tracking-[2px] uppercase cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSaving || isDeleting}
              className="btn-kras clip-bevel-sm px-6 py-2.5 bg-[#E10600] hover:bg-[#b80500] text-white text-[9px] font-extrabold tracking-[2px] uppercase shadow-[0_0_20px_rgba(225,6,0,0.35)] cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Збереження…' : 'Зберегти'}</span>
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
