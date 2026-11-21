import React from 'react';
import { BIKE_DISCIPLINE_LABELS, RiderProfile } from '../types/velovibe';
import { ArrowRight, Gauge, Activity, Sparkles, Navigation } from 'lucide-react';
import { sound } from '../utils/audio';

interface StatsCardsProps {
  profile: RiderProfile;
  onNavigate: (section: string) => void;
  onOpenGarage: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ profile, onNavigate, onOpenGarage }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-10">

      {/* CARD 1: Rider profile - numbered 01 */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">01</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-5 flex items-center justify-between">
            <span>🚲 Профіль велосипеда</span>
            <span className="text-[#FFC400] text-[9px] font-bold">ЗБЕРЕЖЕНІ ДАНІ</span>
          </div>

          <div className="mb-4">
            <h3 className="font-title text-2xl font-black uppercase tracking-wide text-white">
              {profile.bikeModel}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#FFC400]">
              {BIKE_DISCIPLINE_LABELS[profile.discipline]}
            </p>
          </div>

          <p className="text-[#9aa3b8] text-xs leading-relaxed">
            Вага: {profile.riderWeightKg} кг · зріст: {profile.riderHeightCm || '—'} см · рама: {profile.frameSize || 'не вказано'}. Дані підвіски додай у гаражі, якщо знаєш точні значення.
          </p>
        </div>

        <button
          onClick={() => { sound.playShifterClick(); onOpenGarage(); }}
          className="btn-kras clip-bevel-sm mt-6 self-start px-4 py-2 bg-[#FFC400] text-black text-[9px] font-extrabold tracking-[2px] uppercase hover:shadow-[0_0_20px_rgba(255,196,0,0.35)] transition-all cursor-pointer"
        >
          Гараж & Налаштування →
        </button>
      </div>

      {/* CARD 2: Drivetrain health - numbered 02 */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">02</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-5 flex items-center justify-between">
            <span>⚙️ Перевірка ланцюга</span>
          </div>

          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-title text-3xl font-black uppercase tracking-wide text-white">
              Немає виміру
            </span>
          </div>

          <p className="text-[#9aa3b8] text-xs leading-relaxed">
            Перевір ланцюг калібром. Межа заміни залежить від ланцюга й трансмісії — звір її з виробником.
          </p>
        </div>

        <button
          onClick={() => { sound.playShifterClick(); onNavigate('components'); }}
          className="btn-kras clip-bevel-sm mt-6 self-start px-4 py-2 bg-[#0b0b10] border border-white/10 hover:border-white/30 text-white text-[9px] font-extrabold tracking-[2px] uppercase transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Таблиця сумісності</span>
          <ArrowRight className="w-3 h-3 text-[#E10600]" />
        </button>
      </div>

      {/* CARD 3: Suspension & Tire Pressure - numbered 03 */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">03</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-5 flex items-center justify-between">
            <span>🌪 Тиск & SAG</span>
            <span className="text-[#FFC400] text-[9px] font-bold font-mono-nums">{profile.riderWeightKg} кг</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="p-3 bg-[#111118] border border-white/[0.04]">
              <div className="text-[8px] text-[#6b7a94] uppercase font-bold tracking-[1px]">
                Вилка {profile.forkTravelMm > 0 ? `${profile.forkTravelMm} мм` : 'не вказана'}
              </div>
              <div className="font-title text-lg font-bold text-white font-mono-nums mt-0.5">За мануалом</div>
              <div className="text-[9px] text-[#FFC400] font-mono-nums">Тиск і SAG залежать від моделі</div>
            </div>
            <div className="p-3 bg-[#111118] border border-white/[0.04]">
              <div className="text-[8px] text-[#6b7a94] uppercase font-bold tracking-[1px]">Шини F/R (Tubeless)</div>
              <div className="font-title text-2xl font-bold text-white font-mono-nums mt-0.5">
                {profile.frontTirePsi > 0 && profile.rearTirePsi > 0
                  ? `${profile.frontTirePsi}/${profile.rearTirePsi}`
                  : 'Не вказано'}
              </div>
              <div className="text-[9px] text-[#16A34A] font-mono-nums">Значення з профілю, PSI</div>
            </div>
          </div>

          <p className="text-[#9aa3b8] text-xs leading-relaxed">
            Тиск збережений у профілі, це не рекомендація. Враховуй покришки, обід, маса райдера та манометр.
          </p>
        </div>

        <button
          onClick={() => { sound.playShifterClick(); onNavigate('geometry'); }}
          className="btn-kras clip-bevel-sm mt-6 self-start px-4 py-2 bg-[#0b0b10] border border-white/10 hover:border-white/30 text-white text-[9px] font-extrabold tracking-[2px] uppercase transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Gauge className="w-3 h-3 text-[#FFC400]" />
          <span>Калькулятор геометрії</span>
        </button>
      </div>

      {/* CARD 4: Trail Radar - numbered 04 with category badge */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">04</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-5 flex items-center justify-between">
            <span>📍 Веломісця на мапі</span>
            <span className="text-[#FFC400] text-[9px] font-bold uppercase text-[8px] category-badge">OPENSTREETMAP</span>
          </div>

          <h3 className="font-title text-3xl font-extrabold text-white uppercase tracking-[1px] mb-1 leading-none">
            Дані з відкритої мапи
          </h3>
          <p className="text-[#FFC400] text-xs font-semibold uppercase tracking-wider mb-3">
            Погода оновлюється з Open-Meteo
          </p>

          <p className="text-[#9aa3b8] text-xs leading-relaxed">
            Показуємо велооб'єкти, позначені в OpenStreetMap. Їх наявність, доступ і стан трас не перевіряються на місцевості.
          </p>
        </div>

        <button
          onClick={() => { sound.playSecretUnlock(); onNavigate('spots'); }}
          className="btn-kras clip-bevel-sm mt-2 self-start px-4 py-2 bg-[#E10600] text-white text-[9px] font-extrabold tracking-[2px] uppercase hover:bg-[#b80500] shadow-[0_0_20px_rgba(225,6,0,0.35)] transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Відкрити мапу спотів →</span>
        </button>
      </div>

      {/* CARD 5: Safety Checklist - numbered 05 */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">05</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-4 flex items-center justify-between">
            <span>🛡 Перевір перед виїздом</span>
            <span className="text-[#FFC400] text-[9px] font-bold">ЗВІР ІЗ МАНУАЛОМ</span>
          </div>

          <ul className="space-y-2.5">
            {[
              'Оглянь раму, вилку, колеса й krytyшки на пошкодження.',
              'Перевір фіксацію коліс і моменти затягування за мануалом.',
              'Переконайся, що гальма працюють і ротори чисті.',
              'Перевір тиск за своїми умовами та обмеженнями виробника.',
              'Одягни шолом і візьми воду та базовий ремкомплект.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-[#9aa3b8]">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FFC400]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 pt-3 border-t border-white/[0.04] text-[9px] text-[#3a4255] tracking-[1.5px] uppercase font-mono">
            Якщо є пошкодження або sumніви — не виїжджай до огляду механіком.
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/[0.06] text-[9px] text-[#3a4255] tracking-[1.5px] uppercase font-mono">
          Якщо є пошкодження або сумніви — не виїжджай до огляду механіком.
        </div>
      </div>

      {/* CARD 6: Quick Actions - numbered 06 with premium active state and roadmap */}
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between corner-number">06</div>
      <div className="cab-card p-6 sm:p-8 flex flex-col justify-between premium">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-5 flex items-center justify-between">
            <span>⚡ Швидкі дії</span>
            <Activity className="w-3.5 h-3.5 text-[#E10600]" />
          </div>

          <p className="text-[#9aa3b8] text-xs leading-relaxed mb-4">
            Порада механіка щодо прокачки гальм, сумісності касети, налаштування підвіски або вибору геометрії рами?
          </p>

          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => { sound.playRatchet(); onNavigate('chat'); }}
              className="btn-kras clip-bevel-sm px-4 py-3 bg-[#E10600] hover:bg-[#b80500] text-white text-[9px] font-extrabold tracking-[2px] uppercase transition-all shadow-[0_0_25px_rgba(225,6,0,0.35)] cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Запустити AI Консультацію</span>
            </button>
            <button
              onClick={() => { sound.playShifterClick(); onNavigate('geometry'); }}
              className="btn-kras clip-bevel-sm px-4 py-2.5 bg-[#111118] border border-white/10 hover:border-white/30 text-white text-[9px] font-extrabold tracking-[2px] uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Navigation className="w-3.5 h-3.5 text-[#FFC400]" />
              <span>Підібрати геометрію рами</span>
            </button>
          </div>
        </div>
        <div className="state-indicator">
          <span className="state-dot ready">Готово ✓</span>
          <span className="state-dot processing">В процесі</span>
          <span className="state-dot pending">Очікує</span>
        </div>
        <div className="roadmap-tracker">
          <div className="roadmap-dot ready"></div>
          <div className="roadmap-dot processing"></div>
          <div className="roadmap-dot pending"></div>
        </div>
      </div>
    </div>
  );
};