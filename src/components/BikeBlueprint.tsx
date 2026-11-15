import React, { useRef, useState } from 'react';
import { RiderProfile } from '../types/velovibe';
import { sound } from '../utils/audio';
import { Sparkles, Activity } from 'lucide-react';

interface BikeBlueprintProps {
  profile: RiderProfile;
  onAskAi: (prompt: string) => void;
}

interface ComponentHotspot {
  id: string;
  name: string;
  category: string;
  position: { top: string; left: string };
  specs: string;
  status: 'ok' | 'tune' | 'warning';
  statusText: string;
  details: string;
  prompt: string;
}

export const BikeBlueprint: React.FC<BikeBlueprintProps> = ({ profile, onAskAi }) => {
  const [activeId, setActiveId] = useState<string>('fork');
  const lastRatchetAt = useRef(0);

  const coastHub = () => {
    const now = performance.now();
    if (now - lastRatchetAt.current < 320) return;
    lastRatchetAt.current = now;
    sound.playRatchet();
  };

  const selectHotspot = (spot: ComponentHotspot) => {
    sound.playShifterClick();
    setActiveId(spot.id);
    onAskAi(spot.prompt);
  };

  const hotspots: ComponentHotspot[] = [
    {
      id: 'fork',
      name: 'Вилка',
      category: 'Передня підвіска',
      position: { top: '35%', left: '78%' },
      specs: profile.forkTravelMm > 0 ? `Хід у профілі: ${profile.forkTravelMm} мм · модель не підтверджена` : 'Хід не вказаний · модель не підтверджена',
      status: 'tune',
      statusText: 'УТОЧНИТИ МОДЕЛЬ',
      details: 'Тиск, SAG і кліки налаштувань не вказані: вони залежать від точної моделі вилки та рекомендацій виробника.',
      prompt: `${profile.forkTravelMm > 0 ? `У профілі вказано хід вилки ${profile.forkTravelMm} мм` : 'Хід вилки не вказаний'}; вага райдера ${profile.riderWeightKg} кг, модель вилки невідома. Поясни, які дані потрібні для безпечного налаштування тиску та SAG; не вигадуй значень.`,
    },
    {
      id: 'shock',
      name: 'Задній амортизатор',
      category: 'Задній амортизатор',
      position: { top: '48%', left: '46%' },
      specs: profile.shockTravelMm > 0 ? `Хід у профілі: ${profile.shockTravelMm} мм · модель не підтверджена` : 'Хід не вказаний · модель не підтверджена',
      status: 'tune',
      statusText: 'УТОЧНИТИ МОДЕЛЬ',
      details: 'Тиск і налаштування амортизатора не внесені. Для рекомендацій потрібні його модель, хід, важільність рами та мануал.',
      prompt: `Вага райдера ${profile.riderWeightKg} кг, ${profile.shockTravelMm > 0 ? `хід амортизатора у профілі ${profile.shockTravelMm} мм` : 'хід амортизатора не вказаний'}; точна модель та рама не підтверджені. Які дані треба зібрати, щоб налаштувати амортизатор за інструкцією виробника?`,
    },
    {
      id: 'drivetrain',
      name: 'Трансмісія та ланцюг',
      category: 'Трансмісія & Ланцюг',
      position: { top: '65%', left: '32%' },
      specs: 'Вимір зносу не проводився',
      status: 'tune',
      statusText: 'ПОТРІБНА ПЕРЕВІРКА',
      details: 'Застосунок не вимірює знос. Перевір ланцюг відповідним калібром і звір межу заміни з виробником.',
      prompt: 'Як правильно виміряти знос ланцюга калібром і як визначити межу заміни за моделлю ланцюга та касети?',
    },
    {
      id: 'tires',
      name: 'Покришки та колеса',
      category: 'Вілсет & Безкамерка',
      position: { top: '68%', left: '82%' },
      specs: profile.frontTirePsi > 0 && profile.rearTirePsi > 0
        ? `Тиск у профілі: ${profile.frontTirePsi} / ${profile.rearTirePsi} PSI · покришки не вказані`
        : 'Тиск не вказаний · покришки не вказані',
      status: 'tune',
      statusText: 'ЗВІРИТИ ДАНІ',
      details: 'Тип покришок, ширина, обід і наявність камери не підтверджені. Тиск у профілі не є рекомендацією.',
      prompt: `Вага райдера ${profile.riderWeightKg} кг, ${profile.frontTirePsi > 0 && profile.rearTirePsi > 0 ? `у профілі записано тиск ${profile.frontTirePsi}/${profile.rearTirePsi} PSI` : 'тиск у профілі не вказаний'}. Покришки, обід і камера/безкамерка невідомі. Які параметри треба перевірити перед підбором тиску?`,
    },
    {
      id: 'brakes',
      name: 'Гальма',
      category: 'Гальмівна система',
      position: { top: '56%', left: '72%' },
      specs: 'Модель і стан не внесені',
      status: 'tune',
      statusText: 'ПОТРІБЕН ОГЛЯД',
      details: 'Застосунок не перевіряє знос колодок, роторів або стан гальм. Не виїжджай, якщо ручка провалюється чи гальмування нестабільне.',
      prompt: 'Які дані та ознаки перевірити для оцінки стану гальм велосипеда? Не вигадуй модель, тип рідини чи момент затягування.',
    },
    {
      id: 'dropper',
      name: 'Підсідельний штир',
      category: 'Дроппер & Кокпіт',
      position: { top: '28%', left: '38%' },
      specs: 'Модель, діаметр і хід не внесені',
      status: 'tune',
      statusText: 'УТОЧНИТИ МОДЕЛЬ',
      details: 'Перевір діаметр і сумісність із рамою за маркуванням та документацією виробника.',
      prompt: 'Як підібрати підсідельний штир за діаметром рами, доступною глибиною вставлення та потрібним ходом?',
    },
  ];

  const active = hotspots.find((h) => h.id === activeId) || hotspots[0];

  return (
    <div className="cab-card p-6 sm:p-8 mb-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-white/[0.04] gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Цифрова схема велосипеда</span>
          </div>
          <h2 className="font-title text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-[1.5px]">
            {profile.bikeModel}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#16A34A]/20 border border-[#16A34A]/40 text-[#16A34A] text-[9px] font-extrabold uppercase tracking-wider">
            ● Дані профілю
          </span>
          <span className="text-[9px] text-[#6b7a94] font-mono">
            {hotspots.length} вузлів огляду
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Interactive Blueprint */}
        <div className="lg:col-span-7 relative bg-[#09090d] border border-white/[0.06] p-4 sm:p-6 min-h-[300px] sm:min-h-[380px] flex items-center justify-center overflow-hidden clip-bevel">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#E10600]/5 to-transparent h-16 animate-scanline pointer-events-none" />
          <div className="absolute inset-0 bg-carbon opacity-60 pointer-events-none" />

          {/* SVG */}
          <svg
            viewBox="0 0 800 460"
            className="w-full h-full max-h-[320px] drop-shadow-[0_0_20px_rgba(225,6,0,0.2)]"
            fill="none"
            stroke="currentColor"
          >
            {/* Wheels — hover coasts the freehub */}
            <g onMouseEnter={coastHub} style={{ cursor: 'crosshair' }}>
              <circle cx="210" cy="310" r="95" stroke="#3a4255" strokeWidth="4" />
              <circle cx="210" cy="310" r="82" stroke="rgba(255,196,0,0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="210" cy="310" r="14" stroke="#FFC400" strokeWidth="3" fill="#0b0b10" />
              <circle cx="210" cy="310" r="95" fill="transparent" />
            </g>
            <g onMouseEnter={coastHub} style={{ cursor: 'crosshair' }}>
              <circle cx="640" cy="310" r="95" stroke="#3a4255" strokeWidth="4" />
              <circle cx="640" cy="310" r="82" stroke="rgba(255,196,0,0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="640" cy="310" r="14" stroke="#FFC400" strokeWidth="3" fill="#0b0b10" />
              <circle cx="640" cy="310" r="95" fill="transparent" />
            </g>

            {/* Frame */}
            <circle cx="395" cy="310" r="16" stroke="#E10600" strokeWidth="3.5" fill="#111118" />
            <line x1="210" y1="310" x2="395" y2="310" stroke="#f2f2fa" strokeWidth="5" strokeLinecap="round" />
            <line x1="395" y1="310" x2="335" y2="185" stroke="#f2f2fa" strokeWidth="5" strokeLinecap="round" />
            <line x1="335" y1="185" x2="310" y2="135" stroke="#E10600" strokeWidth="4" strokeLinecap="round" />
            <path d="M 270 135 Q 310 130 350 138" stroke="#f2f2fa" strokeWidth="5.5" strokeLinecap="round" />
            <line x1="395" y1="310" x2="550" y2="175" stroke="#f2f2fa" strokeWidth="7" strokeLinecap="round" />
            <line x1="335" y1="185" x2="550" y2="175" stroke="#f2f2fa" strokeWidth="5.5" strokeLinecap="round" />
            <line x1="550" y1="175" x2="560" y2="150" stroke="#E10600" strokeWidth="7" strokeLinecap="round" />
            <line x1="560" y1="150" x2="640" y2="310" stroke="#FFC400" strokeWidth="6" strokeLinecap="round" />
            <line x1="575" y1="180" x2="640" y2="310" stroke="#f2f2fa" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="560" y1="150" x2="550" y2="135" stroke="#f2f2fa" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="550" cy="135" r="5" fill="#E10600" />
            <line x1="535" y1="130" x2="565" y2="140" stroke="#f2f2fa" strokeWidth="4" strokeLinecap="round" />
            <line x1="395" y1="310" x2="420" y2="235" stroke="#FFC400" strokeWidth="4" />
            <line x1="420" y1="235" x2="480" y2="215" stroke="#E10600" strokeWidth="5" strokeLinecap="round" />
            <rect x="430" y="215" width="35" height="15" rx="3" fill="#18181f" stroke="#FFC400" strokeWidth="2" transform="rotate(-20 445 222)" />
            <line x1="210" y1="310" x2="335" y2="185" stroke="#f2f2fa" strokeWidth="4.5" strokeLinecap="round" />
          </svg>

          {/* Hotspot sensors */}
          {hotspots.map((spot) => {
            const isActive = spot.id === activeId;
            return (
              <button
                key={spot.id}
                onClick={() => selectHotspot(spot)}
                style={{ top: spot.position.top, left: spot.position.left }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 transition-all duration-200 cursor-pointer z-20 ${
                  isActive ? 'scale-125' : 'hover:scale-110'
                }`}
                aria-label={`Вибір ${spot.name}`}
              >
                <div className="relative">
                  <span
                    className={`absolute -inset-1 rounded-full animate-ping-slow ${
                      isActive ? 'bg-[#E10600]/55' : 'bg-[#FFC400]/35'
                    }`}
                  />
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                      isActive
                        ? 'bg-[#E10600] text-white border-white shadow-[0_0_15px_rgba(225,6,0,0.8)]'
                        : 'bg-[#111118] text-[#FFC400] border-[#FFC400]/60 hover:bg-[#FFC400] hover:text-black'
                    }`}
                  >
                    +
                  </div>
                </div>
              </button>
            );
          })}

          <div className="absolute bottom-3 left-3 text-[9px] text-[#6b7a94] font-mono tracking-wider">
            УЗАГАЛЬНЕНА СХЕМА · НЕ МАСШТАБНА
          </div>
        </div>

        {/* Diagnostics Card */}
        <div className="lg:col-span-5 bg-[#111118] border border-white/[0.06] p-5 sm:p-6 flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-extrabold text-[#FFC400] uppercase tracking-[2px]">
                {active.category}
              </span>
              <span
                className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                  active.status === 'ok'
                    ? 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/40'
                    : active.status === 'warning'
                    ? 'bg-[#FFC400]/20 text-[#FFC400] border-[#FFC400]/40'
                    : 'bg-[#E10600]/20 text-[#E10600] border-[#E10600]/40'
                }`}
              >
                {active.statusText}
              </span>
            </div>

            <h3 className="font-title text-xl sm:text-2xl font-black text-white uppercase tracking-wide mb-2">
              {active.name}
            </h3>

            <div className="p-3 bg-[#0b0b10] border border-white/[0.04] text-xs font-mono text-[#f2f2fa] mb-4">
              <div className="text-[8px] text-[#6b7a94] uppercase tracking-wider mb-1">
                Дані профілю:
              </div>
              <div className="text-white font-semibold">{active.specs}</div>
            </div>

            <p className="text-xs text-[#9aa3b8] leading-relaxed mb-4">
              {active.details}
            </p>
          </div>

          <div className="pt-4 border-t border-white/[0.04] space-y-2">
            <button
              onClick={() => { sound.playRatchet(); onAskAi(active.prompt); }}
              className="btn-kras clip-bevel-sm w-full py-2.5 bg-[#E10600] hover:bg-[#b80500] text-white text-[9px] font-extrabold tracking-[2px] uppercase shadow-[0_0_20px_rgba(225,6,0,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFC400]" />
              <span>Запитати AI щодо тюнінгу цього вузла</span>
            </button>

            <div className="flex items-center justify-between text-[9px] text-[#6b7a94] px-1 font-mono">
              <span>ТЕХНІЧНИЙ СТАН НЕ ПЕРЕВІРЕНО</span>
              <span>ЗВІР ДАНІ З МАНУАЛОМ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
