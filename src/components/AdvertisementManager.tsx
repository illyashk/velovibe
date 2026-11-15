import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, Megaphone, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  image_path: string | null;
  target_url: string;
  placement: 'dashboard' | 'spots';
  enabled: boolean;
}

interface AdvertisementManagerProps {
  userId: string;
}

export const AdvertisementManager: React.FC<AdvertisementManagerProps> = ({ userId }) => {
  const [items, setItems] = useState<Advertisement[]>([]);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [placement, setPlacement] = useState<Advertisement['placement']>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from('advertisement_slots')
      .select('id, title, image_url, image_path, target_url, placement, enabled')
      .order('created_at', { ascending: false });
    if (loadError) setError(`Не вдалося завантажити партнерів: ${loadError.message}`);
    else setItems(data as Advertisement[]);
    setIsLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setError(null);
    if (!imageFile && !imageUrl.trim()) {
      setError('Додай файл банера або пряме HTTPS-посилання на зображення.');
      return;
    }

    let uploadedPath: string | null = null;
    let resolvedImageUrl = imageUrl.trim();
    if (imageFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
        setError('Дозволено JPG, PNG або WebP розміром до 5 МБ.');
        return;
      }
      const extension = imageFile.type === 'image/jpeg' ? 'jpg' : imageFile.type === 'image/png' ? 'png' : 'webp';
      uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('partner-assets')
        .upload(uploadedPath, imageFile, { contentType: imageFile.type, upsert: false });
      if (uploadError) {
        setError(`Не вдалося завантажити банер: ${uploadError.message}`);
        return;
      }
      resolvedImageUrl = supabase.storage.from('partner-assets').getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { error: insertError } = await supabase.from('advertisement_slots').insert({
      title: title.trim(),
      image_url: resolvedImageUrl,
      image_path: uploadedPath,
      target_url: targetUrl.trim(),
      placement,
      enabled: false,
      created_by: userId,
    });
    if (insertError) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('partner-assets').remove([uploadedPath]);
        if (cleanupError) console.error('Failed to clean up uploaded sponsor image:', cleanupError.message);
      }
      setError(`Не вдалося додати партнера: ${insertError.message}`);
      return;
    }
    setTitle('');
    setImageUrl('');
    setImageFile(null);
    setTargetUrl('');
    await load();
  };

  const toggle = async (item: Advertisement) => {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from('advertisement_slots')
      .update({ enabled: !item.enabled, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateError) setError(`Не вдалося змінити статус: ${updateError.message}`);
    else await load();
  };

  const remove = async (item: Advertisement) => {
    if (!supabase || !window.confirm(`Видалити партнерський блок «${item.title}»?`)) return;
    const { error: deleteError } = await supabase.from('advertisement_slots').delete().eq('id', item.id);
    if (deleteError) {
      setError(`Не вдалося видалити блок: ${deleteError.message}`);
      return;
    }
    if (item.image_path) {
      const { error: storageError } = await supabase.storage.from('partner-assets').remove([item.image_path]);
      if (storageError) setError(`Блок видалено, але банер не вдалося прибрати зі сховища: ${storageError.message}`);
    }
    await load();
  };

  return (
    <section className="space-y-5">
      <header>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFC400]"><Megaphone className="h-4 w-4" />Партнерські розміщення</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Додавай лише погоджені матеріали партнерів. Нові блоки спершу вимкнені. Банер можна завантажити прямо в захищене сховище.</p>
      </header>
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs text-rose-100"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-300">Назва партнера / кампанії<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/50" /></label>
        <label className="text-xs text-slate-300">Розміщення<select value={placement} onChange={(event) => setPlacement(event.target.value as Advertisement['placement'])} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2.5 text-sm text-white"><option value="dashboard">Кабінет</option><option value="spots">Мапа спотів</option></select></label>
        <label className="text-xs text-slate-300">Файл банера (JPG, PNG, WebP · до 5 МБ)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:text-white" /></label>
        <label className="text-xs text-slate-300">Або HTTPS-посилання на банер<input type="url" pattern="https://.*" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/50" /></label>
        <label className="text-xs text-slate-300">HTTPS-посилання переходу<input type="url" pattern="https://.*" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required placeholder="https://…" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/50" /></label>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.08] sm:col-span-2"><Plus className="h-4 w-4" />Додати вимкнений блок</button>
      </form>
      {isLoading ? <p className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Завантажую…</p> : (
        <div className="space-y-2">
          {!items.length && <p className="text-xs text-slate-500">Партнерів ще не додано — на сайті показується чесний placeholder.</p>}
          {items.map((item) => (
            <article key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/20 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[10px] text-slate-500">{item.placement === 'dashboard' ? 'Кабінет' : 'Мапа'} · {item.enabled ? 'Активне' : 'Вимкнене'}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => void toggle(item)} className={`rounded-lg border px-3 py-2 text-[10px] ${item.enabled ? 'border-amber-300/25 text-amber-200' : 'border-emerald-300/25 text-emerald-200'}`}>{item.enabled ? 'Вимкнути' : 'Опублікувати'}</button>
                <button type="button" onClick={() => void remove(item)} aria-label={`Видалити ${item.title}`} className="rounded-lg border border-rose-300/20 p-2 text-rose-200"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
