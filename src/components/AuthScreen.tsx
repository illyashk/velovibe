import React, { useState } from 'react';
import { AlertCircle, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { BrandImage } from './BrandImage';

interface AuthScreenProps {
  configurationError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ configurationError }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    if (!supabase) {
      setError('Supabase не налаштовано. Перевір серверні та VITE-змінні в .env і перезапусти сервер.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (oauthError) throw oauthError;
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося почати вхід через соцмережу.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase не налаштовано. Перевір серверні та VITE-змінні в .env і перезапусти сервер.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice('Перевір пошту та підтвердь адресу за посиланням. Після цього увійди в кабінет.');
        }
      } else if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setNotice('Якщо для цієї адреси є обліковий запис, надіслано лист для скидання пароля.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося виконати запит. Спробуй ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'signup' ? 'Створити акаунт' : mode === 'reset' ? 'Відновити пароль' : 'Увійти';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060608] px-4 py-12 text-[#f2f2fa]">
      <section className="cab-card w-full max-w-md border border-white/10 bg-[#0b0b10] p-6 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E10600]/50 bg-[#E10600]/15 text-[#E10600]">
            <BrandImage src="/brand/site-logo.png" fallbackSrc="/brand/site-logo.svg" alt="" className="h-11 w-11 rounded-xl object-contain" />
          </div>
          <div>
            <p className="font-title text-lg font-black tracking-[0.18em] text-white">VELOVIBE</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Кабінет української велоспільноти</p>
          </div>
        </div>

        <h1 className="font-title text-2xl font-black uppercase tracking-wide text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {mode === 'signup'
            ? 'Створи профіль райдера. Після реєстрації підтвердь email, щоб продовжити.'
            : mode === 'reset'
            ? 'Вкажи email, на який надіслати інструкцію зі скидання пароля.'
            : 'Увійди, щоб отримати доступ до свого профілю та збережених розмов.'}
        </p>

        {!isSupabaseConfigured && (
          <div role="alert" className="mt-5 flex gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] p-3 text-xs leading-relaxed text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Не задано `VITE_SUPABASE_URL` або `VITE_SUPABASE_ANON_KEY`. Додай їх у `.env` і перезапусти застосунок.</span>
          </div>
        )}
        {configurationError && (
          <div role="alert" className="mt-5 flex gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs leading-relaxed text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{configurationError}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 flex gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-xs leading-relaxed text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="mt-5 flex gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.08] p-3 text-xs leading-relaxed text-emerald-100">
            {mode === 'signup' ? <MailCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice}</span>
          </div>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleSocialSignIn('google')}
            disabled={isSubmitting || !isSupabaseConfigured}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:border-[#E10600]/60 hover:bg-[#E10600]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#0b0b10]">G</span>
            Google
          </button>
          <button
            type="button"
            onClick={() => void handleSocialSignIn('facebook')}
            disabled={isSubmitting || !isSupabaseConfigured}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:border-[#E10600]/60 hover:bg-[#E10600]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-[10px] font-black text-white">f</span>
            Facebook
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/[0.08]" />
          <span>або пошта</span>
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-xs font-semibold text-slate-300">Ім’я або нік</label>
              <input
                id="signup-name"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
                required
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-slate-300">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60"
            />
          </div>
          {mode !== 'reset' && (
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-xs font-semibold text-slate-300">Пароль</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E10600]/60"
              />
              {mode === 'signup' && <p className="mt-1 text-[11px] text-slate-500">Не менше 8 символів.</p>}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !isSupabaseConfigured}
            className="btn-kras flex w-full items-center justify-center gap-2 rounded-lg bg-[#E10600] px-4 py-3 text-xs font-bold tracking-widest text-white transition-colors hover:bg-[#b80500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Зачекай…' : title}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => { setError(null); setNotice(null); setMode('signup'); }} className="hover:text-white">
                Зареєструватися
              </button>
              <button type="button" onClick={() => { setError(null); setNotice(null); setMode('reset'); }} className="hover:text-white">
                Забули пароль?
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button type="button" onClick={() => { setError(null); setNotice(null); setMode('signin'); }} className="hover:text-white">
              Повернутися до входу
            </button>
          )}
        </div>
        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-500">
          Профіль і діалоги приватні. Пароль обробляє Supabase Auth і він не зберігається у VeloVibe.
        </p>
      </section>
    </main>
  );
};
