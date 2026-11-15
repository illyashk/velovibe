import React, { useEffect, useState } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
}

interface AdSlotProps {
  placement: 'dashboard' | 'spots';
}

interface AdSenseWindow extends Window {
  adsbygoogle?: Record<string, never>[];
}

const isSafeHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export const AdSlot: React.FC<AdSlotProps> = ({ placement }) => {
  const [advertisement, setAdvertisement] = useState<Advertisement | null>(null);
  const [adsenseError, setAdsenseError] = useState<string | null>(null);
  const adsenseClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim() || '';
  const adsenseSlotId = placement === 'dashboard'
    ? import.meta.env.VITE_ADSENSE_DASHBOARD_SLOT?.trim() || ''
    : import.meta.env.VITE_ADSENSE_SPOTS_SLOT?.trim() || '';
  const isAdsenseConfigured = /^ca-pub-\d+$/.test(adsenseClientId) && /^\d+$/.test(adsenseSlotId);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from('advertisement_slots')
      .select('id, title, image_url, target_url')
      .eq('placement', placement)
      .eq('enabled', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load sponsor placement:', error.message);
          return;
        }
        if (
          active &&
          data &&
          isSafeHttpUrl(data.image_url) &&
          isSafeHttpUrl(data.target_url)
        ) setAdvertisement(data);
      });
    return () => { active = false; };
  }, [placement]);

  useEffect(() => {
    if (!isAdsenseConfigured) return;

    let active = true;
    let script = document.querySelector<HTMLScriptElement>('script[data-adsense-client]');
    if (!script) {
      script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.adsenseClient = adsenseClientId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`;
      document.head.appendChild(script);
    }

    const handleScriptError = () => {
      if (active) {
        setAdsenseError('Google Ads не завантажилися. Перевір налаштування реклами або блокувальник реклами.');
      }
    };
    script.addEventListener('error', handleScriptError, { once: true });

    try {
      const adsenseWindow = window as AdSenseWindow;
      adsenseWindow.adsbygoogle = adsenseWindow.adsbygoogle || [];
      adsenseWindow.adsbygoogle.push({});
    } catch (error: unknown) {
      console.error('Failed to request a Google AdSense placement:', error);
      setAdsenseError('Не вдалося показати рекламу Google.');
    }

    return () => {
      active = false;
      script?.removeEventListener('error', handleScriptError);
    };
  }, [adsenseClientId, adsenseSlotId, isAdsenseConfigured]);

  if (!advertisement && !isAdsenseConfigured) {
    return (
      <aside className="my-7 overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Партнерський блок · {placement === 'dashboard' ? 'кабінет' : 'мапа'}</p>
              <p className="mt-1 text-xs text-slate-500">Місце для реклами веломайстерень, магазинів та подій. Рекламодавця ще не додано.</p>
            </div>
          </div>
          <a href="mailto:krasnovilla9@gmail.com?subject=Партнерство%20з%20VeloVibe" className="shrink-0 text-xs font-semibold text-slate-300 transition-colors hover:text-white">
            Стати партнером <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        </div>
      </aside>
    );
  }

  return (
    <div className="my-7 space-y-4">
      {advertisement && (
        <aside aria-label={`Реклама: ${advertisement.title}`} className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10]">
          <a href={advertisement.target_url} target="_blank" rel="noopener noreferrer sponsored" className="group relative block min-h-28">
            <img src={advertisement.image_url} alt={advertisement.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45 transition-opacity group-hover:opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060608] via-[#060608]/80 to-transparent" />
            <div className="relative flex min-h-28 items-end justify-between gap-4 p-5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFC400]">Партнер VeloVibe</span>
                <h2 className="mt-1 text-lg font-bold text-white">{advertisement.title}</h2>
              </div>
              <span className="mb-1 shrink-0 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white">Перейти <ExternalLink className="ml-1 inline h-3 w-3" /></span>
            </div>
          </a>
        </aside>
      )}
      {isAdsenseConfigured && (
        <aside aria-label="Реклама Google" className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10] p-3 sm:p-4">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Реклама</p>
          <ins
            className="adsbygoogle block min-h-24 w-full"
            style={{ display: 'block' }}
            data-ad-client={adsenseClientId}
            data-ad-slot={adsenseSlotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
          {adsenseError && <p role="status" className="mt-2 text-xs text-slate-500">{adsenseError}</p>}
        </aside>
      )}
    </div>
  );
};
