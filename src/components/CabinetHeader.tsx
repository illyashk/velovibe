import React from 'react';
import { BIKE_DISCIPLINE_LABELS, RiderProfile } from '../types/velovibe';
import { Flame, Settings2, MapPin, Bike, Activity } from 'lucide-react';
import { sound } from '../utils/audio';

interface CabinetHeaderProps {
  profile: RiderProfile;
  onOpenGarage: () => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
}

export const CabinetHeader: React.FC<CabinetHeaderProps> = ({
  profile,
  onOpenGarage,
  activeSection,
  setActiveSection,
}) => {
  const tabs = [
    { id: 'all',        label: 'Огляд кабінету',       icon: Bike,     badge: null },
    { id: 'spots',      label: 'Мапа місць',             icon: MapPin,   badge: null },
    { id: 'blueprint',  label: 'Блюпринт байка',        icon: Activity, badge: 'ОГЛЯД' },
    { id: 'chat',       label: 'AI Воркшоп',            icon: null,     badge: null },
    { id: 'geometry',   label: 'Лаб. геометрії',        icon: null,     badge: null },
    { id: 'components', label: 'Сумісність деталей',    icon: null,     badge: null },
  ];

  return (
    <div className="relative mb-10 pb-8 border-b border-white/[0.04]">
      <div className="absolute -bottom-[1px] left-0 w-36 h-[2px] bg-gradient-to-r from-[#E10600] via-[#FFC400] to-transparent" />

      {/* Profile Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5 sm:gap-7">
          {/* Avatar */}
          <button
            className="relative group cursor-pointer focus:outline-none"
            onClick={onOpenGarage}
            aria-label="Відкрити гараж"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#E10600] via-[#a80500] to-[#3a0000] clip-bevel flex items-center justify-center font-title text-3xl sm:text-4xl text-white font-black flex-shrink-0 shadow-[0_0_35px_rgba(225,6,0,0.4),0_4px_20px_rgba(0,0,0,0.8)] border border-white/20 transition-transform duration-200 group-hover:scale-105">
              {profile.username.charAt(0)}
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-title text-3xl sm:text-5xl text-white uppercase tracking-[2px] font-black leading-none">
                {profile.username}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FFC400]/10 border border-[#FFC400]/40 text-[#FFC400] text-[9px] font-black tracking-[1.5px] uppercase shadow-[0_0_10px_rgba(255,196,0,0.2)]">
                <Flame className="w-3 h-3" />
                {BIKE_DISCIPLINE_LABELS[profile.discipline]} · РАЙДЕР
              </span>
            </div>

            <p className="text-[#6b7a94] text-xs sm:text-sm mt-1.5 flex items-center gap-2 flex-wrap font-body">
              <span className="text-white font-bold">{profile.bikeModel}</span>
              <span className="text-white/20">|</span>
              <span className="font-mono text-[#FFC400] text-[11px]">{profile.callsign}</span>
            </p>

            <div className="mt-2 text-[9px] uppercase tracking-[2px] text-[#6b7a94]">
              Дані профілю · перевір актуальність у гаражі
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
          <div className="px-3.5 py-2 bg-[#0b0b10] border border-white/[0.06] text-right hidden sm:block">
            <div className="text-[8px] text-[#6b7a94] uppercase tracking-wider font-mono">
              СТАН ДАНИХ ПРО СПОТИ
            </div>
            <div className="text-xs font-title font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1 justify-end">
              <span>GPS-точки ще не перевірені</span>
            </div>
          </div>

          <button
            onClick={() => { sound.playShifterClick(); onOpenGarage(); }}
            className="btn-kras px-4 sm:px-5 py-3 bg-[#111118] border border-white/10 hover:border-white/30 text-white text-[10px] font-extrabold tracking-[2px] uppercase transition-all cursor-pointer flex items-center gap-2"
          >
            <Settings2 className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Кабінет байка</span>
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-xs text-slate-300">
        <MapPin className="h-4 w-4 shrink-0 text-amber-200" />
        <span>Погоду та стан трас не підключено. Перевіряй їх у місцевих джерелах перед виїздом.</span>
      </div>

      {/* Section Switcher */}
      <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(({ id, label, badge }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => { sound.playShifterClick(); setActiveSection(id); }}
              className={`px-3.5 py-2 text-[10px] font-extrabold tracking-[1.5px] uppercase transition-all duration-200 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-[#E10600] text-white clip-bevel-sm shadow-[0_0_15px_rgba(225,6,0,0.3)]'
                  : 'bg-[#0b0b10] border border-white/[0.04] text-[#6b7a94] hover:text-white hover:border-white/[0.12]'
              }`}
            >
              <span>{label}</span>
              {badge && (
                <span className={`text-[8px] px-1 font-black ${
                  isActive ? 'bg-black/40 text-[#FFC400]' : 'bg-[#FFC400]/15 text-[#FFC400]'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
