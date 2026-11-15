import React, { useState } from 'react';
import { COMPONENT_COMPATIBILITY_LIST } from '../data/bikeData';
import { CompatibilityCheckItem } from '../types/velovibe';
import { Wrench, CheckCircle2, XCircle, AlertTriangle, Search, Sparkles, Sliders } from 'lucide-react';

interface ComponentsMatrixProps {
  onAskAi: (prompt: string) => void;
}

export const ComponentsMatrix: React.FC<ComponentsMatrixProps> = ({ onAskAi }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Custom Pair Checker state
  const [selectedFreehub, setSelectedFreehub] = useState('Micro Spline');
  const [selectedCassette, setSelectedCassette] = useState('Shimano 12s XT');

  const categories = [
    { id: 'all', label: 'Всі категорії' },
    { id: 'Drivetrain', label: 'Трансмісії' },
    { id: 'Freehub', label: 'Барабани втулок' },
    { id: 'BottomBracket', label: 'Каретки' },
    { id: 'Axle', label: 'Осі та втулки' },
  ];

  const filteredItems = COMPONENT_COMPATIBILITY_LIST.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (
      searchQuery &&
      !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.details.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Evaluate interactive freehub test
  const getCustomPairResult = () => {
    if (selectedFreehub === 'Micro Spline' && selectedCassette.includes('Shimano 12s')) {
      return {
        compatible: true,
        status: 'ПОВНІСТЮ СУМІСНО ✅',
        badgeClass: 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/40',
        note: 'Рідний стандарт Shimano для 12-швидкісних касет з найменшою зіркою 10T.',
      };
    }
    if (selectedFreehub === 'SRAM XD' && selectedCassette.includes('SRAM Eagle (XG)')) {
      return {
        compatible: true,
        status: 'ПОВНІСТЮ СУМІСНО ✅',
        badgeClass: 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/40',
        note: 'Різьбове кріплення SRAM XD для цільнофрезерованих касет XG (10-50T / 10-52T).',
      };
    }
    if (selectedFreehub === 'Standard HG' && selectedCassette.includes('SRAM NX Eagle')) {
      return {
        compatible: true,
        status: 'СУМІСНО ✅',
        badgeClass: 'bg-[#16A34A]/20 text-[#16A34A] border-[#16A34A]/40',
        note: 'Касета NX Eagle має зірку 11T і сідає на класичний HG барабан без заміни колеса.',
      };
    }
    return {
      compatible: false,
      status: 'НЕСУМІСНО ❌',
      badgeClass: 'bg-[#E10600]/20 text-[#E10600] border-[#E10600]/40',
      note: 'Шліци або різьба барабана не збігаються з посадкою цієї касети. Потрібна заміна барабана втулки або вибір іншої моделі касети.',
    };
  };

  const pairResult = getCustomPairResult();

  return (
    <div className="cab-card p-6 sm:p-8 mb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-white/[0.04] gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-1">
            Технічний аналізатор · Специфікації та стандарти
          </div>
          <h2 className="font-title text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-[1.5px]">
            Матриця сумісності компонентів
          </h2>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук стандарту (UDH, Micro Spline, DUB)..."
            className="w-full bg-[#111118] border border-white/[0.06] focus:border-[#E10600]/60 px-3 py-2 pl-8 text-xs text-white placeholder-[#6b7a94] outline-none font-body"
          />
          <Search className="w-3.5 h-3.5 text-[#6b7a94] absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Interactive Quick Pair Checker Box */}
      <div className="p-5 bg-gradient-to-r from-[#111118] to-[#181822] border border-white/[0.06] mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-[#FFC400]" />
          <h3 className="font-title text-base font-bold text-white uppercase tracking-wider">
            Швидкий тест пари: Барабан втулки ↔ Касета
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-[9px] font-bold text-[#6b7a94] uppercase tracking-wider block mb-1.5">
              Барабан задньої втулки:
            </label>
            <select
              value={selectedFreehub}
              onChange={(e) => setSelectedFreehub(e.target.value)}
              className="w-full bg-[#0b0b10] border border-white/[0.08] text-xs text-white p-2.5 outline-none font-body"
            >
              <option value="Micro Spline">Shimano Micro Spline (12-шв.)</option>
              <option value="SRAM XD">SRAM XD Driver (Eagle 10-52T)</option>
              <option value="Standard HG">Shimano / SRAM HG (8-11 шв.)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold text-[#6b7a94] uppercase tracking-wider block mb-1.5">
              Касета для встановлення:
            </label>
            <select
              value={selectedCassette}
              onChange={(e) => setSelectedCassette(e.target.value)}
              className="w-full bg-[#0b0b10] border border-white/[0.08] text-xs text-white p-2.5 outline-none font-body"
            >
              <option value="Shimano 12s XT">Shimano Deore / XT M8100 12s (10-51T)</option>
              <option value="SRAM Eagle (XG)">SRAM GX / X01 Eagle XG-1275 (10-52T)</option>
              <option value="SRAM NX Eagle">SRAM NX Eagle PG-1230 (11-50T)</option>
            </select>
          </div>

          <div className="p-3 bg-[#0b0b10] border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[8px] text-[#6b7a94] uppercase tracking-wider">Результат перевірки:</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{pairResult.status}</div>
            </div>
            <button
              onClick={() =>
                onAskAi(
                  `Поясни технічні деталі сумісності: барабан ${selectedFreehub} та касета ${selectedCassette}. Які нюанси встановлення та чи потрібні спейсери?`
                )
              }
              className="btn-kras clip-bevel-sm px-2.5 py-1.5 bg-[#E10600] text-white text-[8px] font-extrabold uppercase cursor-pointer"
            >
              Деталі AI
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#9aa3b8] mt-2.5">{pairResult.note}</p>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-5">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 text-[9px] font-extrabold tracking-[1px] uppercase transition-all cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-[#E10600] text-white clip-bevel-sm shadow-[0_0_15px_rgba(225,6,0,0.3)]'
                : 'bg-[#111118] text-[#9aa3b8] hover:text-white border border-white/[0.04]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-5 bg-[#111118] border border-white/[0.04] hover:border-white/[0.12] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[9px] font-extrabold text-[#6b7a94] uppercase tracking-[1.5px]">
                  {item.category}
                </span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-bold border uppercase ${
                    item.isCompatible
                      ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30'
                      : 'bg-[#E10600]/10 text-[#E10600] border-[#E10600]/30'
                  }`}
                >
                  {item.statusText}
                </span>
              </div>

              <h4 className="font-title text-base font-bold text-white uppercase tracking-wide mb-2">
                {item.name}
              </h4>

              <div className="flex items-center gap-2 text-[10px] text-[#6b7a94] mb-3 font-mono">
                <span className="text-[#FFC400]">{item.standardA}</span>
                <span>↔</span>
                <span className="text-white">{item.standardB}</span>
              </div>

              <p className="text-xs text-[#9aa3b8] leading-relaxed mb-3">
                {item.details}
              </p>

              {item.warningNote && (
                <div className="p-2.5 bg-[#FFC400]/10 border border-[#FFC400]/20 text-[#FFC400] text-[10px] mb-3 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{item.warningNote}</span>
                </div>
              )}
            </div>

            <button
              onClick={() =>
                onAskAi(
                  `Чи сумісні ${item.standardA} та ${item.standardB}? Поясни детально чому ${
                    item.isCompatible ? 'сумісно' : 'ні'
                  } та які є альтернативи для апгрейду.`
                )
              }
              className="btn-kras clip-bevel-sm self-start px-3 py-1.5 bg-[#0b0b10] border border-white/10 hover:border-white/30 text-white text-[9px] font-extrabold tracking-[1px] uppercase transition-all cursor-pointer flex items-center gap-1.5 mt-2"
            >
              <Sparkles className="w-3 h-3 text-[#E10600]" />
              <span>Запитати копілота</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
