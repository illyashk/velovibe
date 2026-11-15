import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { BIKE_DISCIPLINE_LABELS, GeometryData, BikeDiscipline } from '../types/velovibe';
import { GEOMETRY_ARCHETYPES } from '../data/bikeData';
import { Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

interface GeometryLabProps {
  onAskAi: (prompt: string) => void;
}

interface SliderProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  ticks: { v: number; l: string }[];
  onChange: (v: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, unit, value, min, max, step, color, ticks, onChange }) => (
  <div className="p-3 bg-[#111118] border border-white/[0.04]">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-xs text-white font-bold uppercase tracking-wider">{label}</span>
      <span className="font-mono-nums font-bold text-sm" style={{ color }}>{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
      className="w-full cursor-pointer accent-[#E10600]"
      style={{ accentColor: color }}
    />
    <div className="flex justify-between text-[9px] text-[#6b7a94] mt-0.5 font-mono">
      {ticks.map((t) => <span key={t.v}>{t.l}</span>)}
    </div>
  </div>
);

const FORK_LEN_MM = 560;
const FRAME_SCALE = 0.28;
const BB_SCREEN = { x: 236, y: 286 };

interface ScreenPoint {
  x: number;
  y: number;
}

interface FrameLayout {
  bb: ScreenPoint;
  head: ScreenPoint;
  headTop: ScreenPoint;
  headBot: ScreenPoint;
  axle: ScreenPoint;
  rear: ScreenPoint;
  seat: ScreenPoint;
  wheelR: number;
  wheelbaseMm: number;
}

/** Millimetres, Y up, BB at origin. Head angle is from the horizontal, the way a geo chart prints it. */
function layoutFrame(geo: GeometryData): FrameLayout {
  const ha = (geo.headAngleDeg * Math.PI) / 180;
  const sta = (geo.seatTubeAngleDeg * Math.PI) / 180;
  const seatLen = 460;
  const headTube = 130;

  const head = { x: geo.reachMm, y: geo.stackMm };
  const axle = {
    x: head.x + Math.cos(ha) * FORK_LEN_MM,
    y: head.y - Math.sin(ha) * FORK_LEN_MM,
  };
  const rear = { x: -geo.chainstayMm, y: 0 };
  const seat = {
    x: -Math.cos(sta) * seatLen,
    y: Math.sin(sta) * seatLen,
  };
  const headTop = {
    x: head.x - Math.cos(ha) * 36,
    y: head.y + Math.sin(ha) * 36,
  };
  const headBot = {
    x: head.x + Math.cos(ha) * (headTube - 36),
    y: head.y - Math.sin(ha) * (headTube - 36),
  };

  const toScreen = (p: { x: number; y: number }): ScreenPoint => ({
    x: BB_SCREEN.x + p.x * FRAME_SCALE,
    y: BB_SCREEN.y - p.y * FRAME_SCALE,
  });

  return {
    bb: toScreen({ x: 0, y: 0 }),
    head: toScreen(head),
    headTop: toScreen(headTop),
    headBot: toScreen(headBot),
    axle: toScreen(axle),
    rear: toScreen(rear),
    seat: toScreen(seat),
    wheelR: 78,
    wheelbaseMm: Math.round(axle.x - rear.x),
  };
}

// Deep technical verdict with industry-standard comparisons
function getVerdict(geo: GeometryData, wheelbaseMm: number): { title: string; desc: string; color: string; wheelbaseVerdict: string } {
  const ratio = geo.reachMm / geo.stackMm;
  const wb = wheelbaseMm;

  let wheelbaseVerdict = '';
  if (wb > 1270) wheelbaseVerdict = `Колісна база ${Math.round(wb)} мм — типово для агресивних DH/Enduro байків (Norco Sight, Specialized Enduro).`;
  else if (wb > 1210) wheelbaseVerdict = `Колісна база ${Math.round(wb)} мм — відповідає сучасному All-Mountain стандарту (Trek Remedy, Giant Reign).`;
  else wheelbaseVerdict = `Колісна база ${Math.round(wb)} мм — маневрений Trail/XC формат (Santa Cruz Tallboy, Trek Top Fuel).`;

  if (ratio > 0.785) {
    return {
      title: 'Агресивна гонкова розтягнута стійка',
      desc: `Reach/Stack = ${ratio.toFixed(3)} — вище стандарту ендуро (0.76–0.78). Низька передня частина максимально завантажує переднє колесо на крутих зʼїздах. Кут кермової ${geo.headAngleDeg}° — ${geo.headAngleDeg < 64 ? 'DH-рівень стабільності на 50+ км/год' : 'типовий агресивний ендуро'}. ${wheelbaseVerdict}`,
      color: '#E10600',
      wheelbaseVerdict,
    };
  }
  if (ratio >= 0.74) {
    return {
      title: 'Збалансований Trail/Enduro баланс',
      desc: `Reach/Stack = ${ratio.toFixed(3)} — золотий діапазон (0.74–0.78) для сучасного ендуро та трейлу. Кут кермової ${geo.headAngleDeg}° — ${geo.headAngleDeg < 65.5 ? 'ендуро-орієнтований, стабільний на технічних секціях' : 'трейлово-нейтральний, рівний баланс підйом/спуск'}. ${wheelbaseVerdict}`,
      color: '#FFC400',
      wheelbaseVerdict,
    };
  }
  return {
    title: 'Вертикальна XC/Gravel посадка',
    desc: `Reach/Stack = ${ratio.toFixed(3)} — компактна висока стійка. Кут кермової ${geo.headAngleDeg}° — ${geo.headAngleDeg > 68 ? 'крос-кантрійний, максимальна ефективність педалювання' : 'Gravel/Adventure формат'}. ${wheelbaseVerdict}`,
    color: '#16A34A',
    wheelbaseVerdict,
  };
}

export const GeometryLab: React.FC<GeometryLabProps> = ({ onAskAi }) => {
  const [geo, setGeo] = useState<GeometryData>({ ...GEOMETRY_ARCHETYPES['Enduro'] });

  const loadPreset = useCallback((disc: BikeDiscipline) => {
    sound.playShifterClick();
    setGeo((prev) => ({ ...GEOMETRY_ARCHETYPES[disc], riderHeightCm: prev.riderHeightCm }));
  }, []);

  const update = useCallback(<K extends keyof GeometryData>(key: K, val: GeometryData[K]) => {
    setGeo((prev) => ({ ...prev, [key]: val }));
  }, []);

  const frame = useMemo(() => layoutFrame(geo), [geo]);
  const verdict = getVerdict(geo, frame.wheelbaseMm);
  const ratio = (geo.reachMm / geo.stackMm).toFixed(3);

  const estimateSize = (r: number, h: number): string => {
    if (r < 435 || h < 165) return 'S';
    if (r < 465 || h < 176) return 'M';
    if (r < 495 || h < 187) return 'L';
    return 'XL';
  };

  const disciplines: BikeDiscipline[] = ['XC', 'Trail', 'Enduro', 'DH', 'Gravel'];
  const spring = { type: 'spring' as const, stiffness: 160, damping: 22 };

  return (
    <div className="cab-card p-6 sm:p-8 mb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-white/[0.04] gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#6b7a94] uppercase tracking-[3px] mb-1">
            Інженерний модуль · Геометрія рами
          </div>
          <h2 className="font-title text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-[1.5px]">
            Лабораторія геометрії рами
          </h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {disciplines.map((disc) => (
            <button
              key={disc}
              onClick={() => loadPreset(disc)}
              className={`px-3 py-1.5 text-[9px] font-extrabold tracking-[1px] uppercase transition-all duration-200 cursor-pointer ${
                geo.discipline === disc
                  ? 'bg-[#E10600] text-white clip-bevel-sm shadow-[0_0_15px_rgba(225,6,0,0.3)]'
                  : 'bg-[#111118] text-[#9aa3b8] hover:text-white border border-white/[0.05]'
              }`}
            >
              {BIKE_DISCIPLINE_LABELS[disc]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Frame preview */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-4 bg-[#111118] border border-white/[0.06] relative">
            <div className="absolute top-3 left-3 text-[9px] font-bold text-[#6b7a94] tracking-[2px] uppercase font-mono">
              Reach: {geo.reachMm}мм · Stack: {geo.stackMm}мм · Head: {geo.headAngleDeg}° · База: {frame.wheelbaseMm}мм
            </div>

            <div className="w-full h-72 sm:h-80 flex items-center justify-center pt-6">
              <svg viewBox="0 0 640 400" className="w-full h-full" aria-label="Схема геометрії рами">
                <defs>
                  <linearGradient id="frameGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E10600" />
                    <stop offset="100%" stopColor="#FFC400" />
                  </linearGradient>
                </defs>

                <line x1="24" y1={frame.bb.y} x2="616" y2={frame.bb.y} stroke="#3a4255" strokeWidth="1" strokeDasharray="4 4" />

                <motion.circle
                  r={frame.wheelR}
                  fill="none"
                  stroke="#252535"
                  strokeWidth={2.5}
                  initial={false}
                  animate={{ cx: frame.rear.x, cy: frame.rear.y }}
                  transition={spring}
                />
                <motion.circle
                  r={frame.wheelR}
                  fill="none"
                  stroke="#FFC400"
                  strokeWidth={2.5}
                  initial={false}
                  animate={{ cx: frame.axle.x, cy: frame.axle.y }}
                  transition={spring}
                />

                <motion.line
                  stroke="url(#frameGrad2)" strokeWidth={3.5} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.bb.x, y1: frame.bb.y, x2: frame.rear.x, y2: frame.rear.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="#9aa3b8" strokeWidth={2} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.seat.x, y1: frame.seat.y, x2: frame.rear.x, y2: frame.rear.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="url(#frameGrad2)" strokeWidth={4} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.bb.x, y1: frame.bb.y, x2: frame.seat.x, y2: frame.seat.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="url(#frameGrad2)" strokeWidth={4.5} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.bb.x, y1: frame.bb.y, x2: frame.head.x, y2: frame.head.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="url(#frameGrad2)" strokeWidth={3.5} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.seat.x, y1: frame.seat.y, x2: frame.headTop.x, y2: frame.headTop.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="#E10600" strokeWidth={6} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.headTop.x, y1: frame.headTop.y, x2: frame.headBot.x, y2: frame.headBot.y }}
                  transition={spring}
                />
                <motion.line
                  stroke="#FFC400" strokeWidth={3.5} strokeLinecap="round" initial={false}
                  animate={{ x1: frame.headBot.x, y1: frame.headBot.y, x2: frame.axle.x, y2: frame.axle.y }}
                  transition={spring}
                />

                <circle cx={frame.bb.x} cy={frame.bb.y} r="6" fill="#060608" stroke="#E10600" strokeWidth="2" />

                <line x1={frame.bb.x} y1={frame.bb.y} x2={frame.bb.x} y2={frame.head.y} stroke="#6b7a94" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                <line x1={frame.bb.x} y1={frame.head.y} x2={frame.head.x} y2={frame.head.y} stroke="#6b7a94" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                <text x={frame.bb.x - 6} y={(frame.bb.y + frame.head.y) / 2} fill="#6b7a94" fontSize="9" fontFamily="monospace" textAnchor="end">STACK</text>
                <text x={(frame.bb.x + frame.head.x) / 2} y={frame.head.y - 8} fill="#6b7a94" fontSize="9" fontFamily="monospace" textAnchor="middle">REACH</text>
                <motion.text
                  fill="#FFC400"
                  fontSize="13"
                  fontWeight="700"
                  fontFamily="monospace"
                  initial={false}
                  animate={{ x: frame.headBot.x + 8, y: frame.headBot.y + 4 }}
                  transition={spring}
                >
                  {geo.headAngleDeg}°
                </motion.text>
              </svg>
            </div>
          </div>

          {/* Verdict */}
          <div className="p-4 bg-[#111118] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[1.5px] text-[#6b7a94]">Співвідношення річ / стак:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-white">{ratio}</span>
                <span className="text-[9px] px-2 py-0.5 font-black uppercase" style={{ background: `${verdict.color}20`, color: verdict.color, border: `1px solid ${verdict.color}40` }}>
                  {estimateSize(geo.reachMm, geo.riderHeightCm)} — {BIKE_DISCIPLINE_LABELS[geo.discipline]}
                </span>
              </div>
            </div>
            <div className="font-title text-base font-bold text-white uppercase tracking-wide mb-1" style={{ color: verdict.color }}>
              {verdict.title}
            </div>
            <p className="text-xs text-[#9aa3b8] leading-relaxed">{verdict.desc}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <Slider
            label="Reach (Річ)" unit=" мм"
            value={geo.reachMm} min={400} max={525} step={1}
            color="#FFC400"
            ticks={[{ v: 400, l: '400 (S)' }, { v: 465, l: '465 (M/L)' }, { v: 525, l: '525 (XL)' }]}
            onChange={(v) => update('reachMm', v)}
          />
          <Slider
            label="Stack (Стак)" unit=" мм"
            value={geo.stackMm} min={570} max={665} step={1}
            color="#FFC400"
            ticks={[{ v: 570, l: '570 (низький)' }, { v: 625, l: '625 трейл' }, { v: 665, l: '665 (високий)' }]}
            onChange={(v) => update('stackMm', v)}
          />
          <Slider
            label="Кут кермової (Head Angle)" unit="°"
            value={geo.headAngleDeg} min={62.5} max={71.0} step={0.5}
            color="#E10600"
            ticks={[{ v: 63, l: '63° DH' }, { v: 65.5, l: '65.5° Enduro' }, { v: 70, l: '70° XC' }]}
            onChange={(v) => update('headAngleDeg', v)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Slider
              label="Задні пера" unit=" мм"
              value={geo.chainstayMm} min={420} max={455} step={1}
              color="#9aa3b8"
              ticks={[{ v: 420, l: '420' }, { v: 437, l: '437' }, { v: 455, l: '455' }]}
              onChange={(v) => update('chainstayMm', v)}
            />
            <Slider
              label="Зріст райдера" unit=" см"
              value={geo.riderHeightCm} min={155} max={200} step={1}
              color="#9aa3b8"
              ticks={[{ v: 155, l: '155' }, { v: 178, l: '178' }, { v: 200, l: '200' }]}
              onChange={(v) => update('riderHeightCm', v)}
            />
          </div>

          <button
            onClick={() => {
              sound.playRatchet();
              onAskAi(
                `Проаналізуй геометрію: Reach ${geo.reachMm}мм, Stack ${geo.stackMm}мм, кут кермової ${geo.headAngleDeg}°, пера ${geo.chainstayMm}мм. Зріст райдера ${geo.riderHeightCm}см. Стиль: ${geo.discipline}. Які нюанси посадки, чи варто коригувати offset вилки чи проставки кермової?`
              );
            }}
            className="btn-kras clip-bevel-sm w-full py-3 bg-[#E10600] hover:bg-[#b80500] text-white text-[10px] font-extrabold tracking-[2px] uppercase shadow-[0_0_20px_rgba(225,6,0,0.35)] cursor-pointer flex items-center justify-center gap-2 mt-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Аналіз цієї геометрії</span>
          </button>
        </div>
      </div>
    </div>
  );
};
