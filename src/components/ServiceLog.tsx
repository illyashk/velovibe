import React, { useState, useEffect } from 'react';
import { Wrench, Plus, CheckCircle2, AlertTriangle, Clock, Calendar, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

export interface ServiceItem {
  id: string;
  component: string;
  operation: string;
  lastServiceKm: number;
  lastServiceDate: string;
  intervalKm: number;
  intervalDays: number;
  currentKm: number;
  notes?: string;
}

const DEFAULT_SERVICE_ITEMS: ServiceItem[] = [
  {
    id: 's1',
    component: 'Ланцюг та трансмісія',
    operation: 'Миття та змащування ланцюга',
    lastServiceKm: 120,
    lastServiceDate: '2026-11-01',
    intervalKm: 250,
    intervalDays: 14,
    currentKm: 340,
    notes: 'Використано парафінове мастило.',
  },
  {
    id: 's2',
    component: 'Вилка (Suspension Fork)',
    operation: 'Сервіс повітряної камери та сальників (50г)',
    lastServiceKm: 0,
    lastServiceDate: '2026-09-15',
    intervalKm: 1000,
    intervalDays: 180,
    currentKm: 850,
    notes: 'Заміна мастила в штанах.',
  },
  {
    id: 's3',
    component: 'Гідравлічні гальма',
    operation: 'Прокачування та заміна рідини',
    lastServiceKm: 0,
    lastServiceDate: '2026-06-10',
    intervalKm: 2000,
    intervalDays: 365,
    currentKm: 1450,
    notes: 'Перевірка колодок і роторів.',
  },
  {
    id: 's4',
    component: 'Задній амортизатор',
    operation: 'Малий сервіс повітряної банки',
    lastServiceKm: 0,
    lastServiceDate: '2026-08-01',
    intervalKm: 800,
    intervalDays: 180,
    currentKm: 720,
    notes: 'Заміна ущільнювачів.',
  },
];

interface ServiceLogProps {
  currentBikeMileageKm?: number;
}

export const ServiceLog: React.FC<ServiceLogProps> = ({ currentBikeMileageKm = 450 }) => {
  const [items, setItems] = useState<ServiceItem[]>(() => {
    const saved = localStorage.getItem('velovibe_service_log');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_SERVICE_ITEMS;
      }
    }
    return DEFAULT_SERVICE_ITEMS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [component, setComponent] = useState('Трансмісія');
  const [operation, setOperation] = useState('Обслуговування');
  const [intervalKm, setIntervalKm] = useState(300);
  const [intervalDays, setIntervalDays] = useState(30);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    localStorage.setItem('velovibe_service_log', JSON.stringify(items));
  }, [items]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playShifterClick();
    const newItem: ServiceItem = {
      id: `service_${Date.now()}`,
      component,
      operation,
      lastServiceKm: currentBikeMileageKm,
      lastServiceDate: new Date().toISOString().split('T')[0],
      intervalKm: Number(intervalKm) || 300,
      intervalDays: Number(intervalDays) || 30,
      currentKm: currentBikeMileageKm,
      notes: notes.trim(),
    };
    setItems([newItem, ...items]);
    setIsModalOpen(false);
    setNotes('');
  };

  const handleServiceNow = (id: string) => {
    sound.playShifterClick();
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          lastServiceKm: currentBikeMileageKm,
          lastServiceDate: new Date().toISOString().split('T')[0],
          currentKm: currentBikeMileageKm,
        };
      }
      return item;
    }));
  };

  const handleDelete = (id: string) => {
    sound.playShifterClick();
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="cab-card rounded-2xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#E10600]" />
            <h2 className="font-title text-xl font-extrabold uppercase tracking-wide text-white">
              Сервісний Журнал Байка
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Контроль зносу деталей та нагадування про планове обслуговування (як у автомобіля)
          </p>
        </div>
        <button
          onClick={() => {
            sound.playShifterClick();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#E10600] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#E10600]/30 hover:bg-[#ff0700] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Додати вузол / регламент</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const kmSinceService = currentBikeMileageKm - item.lastServiceKm;
          const kmRemaining = item.intervalKm - kmSinceService;
          const percentUsed = Math.min(100, Math.max(0, (kmSinceService / item.intervalKm) * 100));

          let statusColor = 'bg-emerald-500';
          let textColor = 'text-emerald-400';
          let borderColor = 'border-emerald-500/30 bg-emerald-500/5';
          let statusText = 'Все в порядку';
          let StatusIcon = ShieldCheck;

          if (percentUsed >= 100) {
            statusColor = 'bg-rose-500';
            textColor = 'text-rose-400';
            borderColor = 'border-rose-500/40 bg-rose-500/10';
            statusText = 'Час обслуговувати!';
            StatusIcon = AlertTriangle;
          } else if (percentUsed >= 80) {
            statusColor = 'bg-amber-500';
            textColor = 'text-amber-400';
            borderColor = 'border-amber-500/40 bg-amber-500/10';
            statusText = 'Скоро заміна/сервіс';
            StatusIcon = AlertCircle;
          }

          return (
            <div key={item.id} className={`rounded-xl border ${borderColor} p-4 flex flex-col justify-between transition-all`}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFC400]">
                      {item.component}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{item.operation}</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${textColor} border border-current/20 bg-black/40`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusText}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="text-slate-400">Пробіг після сервісу:</span>
                    <span className="font-semibold text-white">{kmSinceService} км / {item.intervalKm} км</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 ${statusColor}`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Останній сервіс: {item.lastServiceDate}
                    </span>
                    <span className={`font-medium ${kmRemaining < 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                      {kmRemaining < 0 ? `Протерміновано на ${Math.abs(kmRemaining)} км` : `Залишилось ~${kmRemaining} км`}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-slate-400 italic bg-black/30 p-2 rounded-lg mt-2 border border-white/5">
                      💬 {item.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleServiceNow(item.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Зроблено щойно</span>
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Видалити запис"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="cab-card w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b10] p-6 text-white shadow-2xl">
            <h3 className="text-lg font-bold uppercase tracking-wide mb-4">Додати новий вузол на контроль</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Компонент</label>
                <input
                  type="text"
                  value={component}
                  onChange={(e) => setComponent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:border-[#E10600] focus:outline-none"
                  placeholder="Наприклад: Вилка, Ланцюг, Гальма"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Операція / регламент</label>
                <input
                  type="text"
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:border-[#E10600] focus:outline-none"
                  placeholder="Наприклад: Мийка і змащування, заміна масла"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Інтервал (км)</label>
                  <input
                    type="number"
                    value={intervalKm}
                    onChange={(e) => setIntervalKm(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:border-[#E10600] focus:outline-none"
                    min="10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Інтервал (днів)</label>
                  <input
                    type="number"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:border-[#E10600] focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Примітки / масло</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:border-[#E10600] focus:outline-none"
                  placeholder="Наприклад: 5WT у демпфер, 15WT у штани"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#E10600] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#E10600]/30 hover:bg-[#ff0700] transition-all cursor-pointer"
                >
                  Зберегти в журнал
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
