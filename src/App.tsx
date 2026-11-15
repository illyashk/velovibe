import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RiderProfile } from './types/velovibe';
import { Navbar } from './components/Navbar';
import { CabinetHeader } from './components/CabinetHeader';
import { StatsCards } from './components/StatsCards';
import { BikeBlueprint } from './components/BikeBlueprint';
import { AiWorkshop } from './components/AiWorkshop';
import { GeometryLab } from './components/GeometryLab';
import { SpotsRadar } from './components/SpotsRadar';
import { ComponentsMatrix } from './components/ComponentsMatrix';
import { CurrentWeather } from './components/CurrentWeather';
import { GarageModal } from './components/GarageModal';
import { AuthScreen } from './components/AuthScreen';
import { RiderOnboarding } from './components/RiderOnboarding';
import { AdminPanel } from './components/AdminPanel';
import { SupportChat } from './components/SupportChat';
import { AdSlot } from './components/AdSlot';
import { BrandImage } from './components/BrandImage';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { LoaderCircle } from 'lucide-react';

const isRiderProfile = (value: unknown): value is RiderProfile => {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return typeof profile.username === 'string' &&
    typeof profile.callsign === 'string' &&
    typeof profile.bikeModel === 'string' &&
    typeof profile.riderWeightKg === 'number' &&
    typeof profile.forkTravelMm === 'number' &&
    typeof profile.shockTravelMm === 'number' &&
    typeof profile.frontTirePsi === 'number' &&
    typeof profile.rearTirePsi === 'number' &&
    ['XC', 'Trail', 'Enduro', 'DH', 'Gravel'].includes(String(profile.discipline)) &&
    (profile.riderHeightCm === undefined || typeof profile.riderHeightCm === 'number') &&
    (profile.frameSize === undefined || typeof profile.frameSize === 'string');
};

const getSupabaseErrorMessage = (error: unknown): string => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (
    code === 'PGRST205' ||
    message.includes("Could not find the table 'public.profiles'") ||
    message.includes('schema cache')
  ) {
    return 'У Supabase ще немає таблиці профілів. Відкрий SQL Editor у Supabase Dashboard, виконай файл supabase/migrations/202611120001_initial_community_schema.sql, дочекайся завершення та перезавантаж цю сторінку.';
  }
  return message || 'Не вдалося виконати запит до Supabase. Перевір, чи застосована SQL-міграція.';
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [aiHistoryConsent, setAiHistoryConsent] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [accountWarning, setAccountWarning] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('cabinet');
  const [activeSection, setActiveSection] = useState<string>('all');
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setProfileError(`Не вдалося відновити сесію: ${error.message}`);
      setSession(data.session);
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setProfileError(error instanceof Error ? error.message : 'Не вдалося перевірити сесію.');
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setProfileReady(false);
      setNeedsOnboarding(false);
      setAiHistoryConsent(false);
      setProfileError(null);
      setAccountWarning(null);
      setIsAdmin(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!session || !client) {
      setProfile(null);
      setProfileReady(false);
      setNeedsOnboarding(false);
      return;
    }

    let active = true;
    const loadAccount = async () => {
      setProfileReady(false);
      setProfileError(null);
      setAccountWarning(null);
      try {
        const roleResponse = await fetch('/api/auth/bootstrap-admin', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const roleResult = await roleResponse.json() as { role?: string; refreshSession?: boolean; error?: string };
        if (!roleResponse.ok) {
          setIsAdmin(session.user.app_metadata.role === 'admin');
          setAccountWarning(roleResult.error || 'Не вдалося перевірити роль акаунта. Звернись до адміністратора.');
        } else {
          setIsAdmin(roleResult.role === 'admin');
        }
        if (roleResponse.ok && roleResult.refreshSession) {
          const { error: refreshError } = await client.auth.refreshSession();
          if (refreshError) setAccountWarning(`Роль адміністратора призначено, але сесію не оновлено: ${refreshError.message}`);
        }

        const { data, error } = await client
          .from('profiles')
          .select('display_name, rider_profile, onboarding_complete, ai_history_consent')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        setAiHistoryConsent(data?.ai_history_consent === true);

        const savedProfile: unknown = data?.rider_profile;
        if (data?.onboarding_complete && isRiderProfile(savedProfile)) {
          setProfile(savedProfile);
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      } catch (error: unknown) {
        if (!active) return;
        setProfileError(getSupabaseErrorMessage(error));
      } finally {
        if (active) setProfileReady(true);
      }
    };

    void loadAccount();
    return () => {
      active = false;
    };
  }, [session]);

  // Route to AI chat with a specific query from geometry, spots, or components
  const handleAskAi = (prompt: string) => {
    setChatPrompt(prompt);
    setActiveTab('chat');
    setActiveSection('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateFromCards = (section: string) => {
    setActiveTab(section);
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveProfile = async (updated: RiderProfile, saveAiHistory = aiHistoryConsent) => {
    if (!supabase || !session) throw new Error('Потрібно увійти, щоб зберегти профіль.');
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: updated.username,
        rider_profile: updated,
        onboarding_complete: true,
        ai_history_consent: saveAiHistory,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(getSupabaseErrorMessage(error));
    setProfile(updated);
    setAiHistoryConsent(saveAiHistory);
    setNeedsOnboarding(false);
  };

  const handleAiHistoryConsentChange = async (enabled: boolean) => {
    if (!supabase || !session) throw new Error('Потрібно увійти, щоб змінити налаштування приватності.');
    if (!enabled) {
      const { error: deleteError } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('user_id', session.user.id);
      if (deleteError) throw deleteError;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ ai_history_consent: enabled, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
    if (error) throw error;
    setAiHistoryConsent(enabled);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setProfileError(`Не вдалося вийти з акаунта: ${error.message}`);
  };

  const handleDeleteAccount = async () => {
    if (!session) throw new Error('Потрібно увійти, щоб видалити акаунт.');
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const result = await response.json() as { error?: string };
      throw new Error(result.error || 'Не вдалося видалити акаунт.');
    }
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060608] text-slate-300">
        <div className="flex items-center gap-3 text-sm"><LoaderCircle className="h-5 w-5 animate-spin text-[#E10600]" />Перевіряю сесію…</div>
      </main>
    );
  }

  if (!isSupabaseConfigured || !supabase) return <AuthScreen configurationError={profileError} />;
  if (!session) return <AuthScreen configurationError={profileError} />;

  if (!profileReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060608] text-slate-300">
        <div className="flex items-center gap-3 text-sm"><LoaderCircle className="h-5 w-5 animate-spin text-[#E10600]" />Завантажую профіль…</div>
      </main>
    );
  }

  if (needsOnboarding || !profile) {
    return (
      <RiderOnboarding
        email={session.user.email || ''}
        initialName={typeof session.user.user_metadata.display_name === 'string' ? session.user.user_metadata.display_name : ''}
        initialError={profileError}
        onSave={handleSaveProfile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#060608] text-[#f2f2fa] flex flex-col font-body selection:bg-[#E10600] selection:text-white">
      {/* Top Navbar in Krasdrop Studios style */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'cabinet') {
            setActiveSection(tab);
          } else {
            setActiveSection('all');
          }
        }}
        profile={profile}
        onOpenGarage={() => setIsGarageOpen(true)}
        onSignOut={handleSignOut}
        isAdmin={isAdmin}
      />

      {/* Main Cabinet Page Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 md:px-10 pt-24 pb-20">
        {profileError && (
          <div role="alert" className="mb-5 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-sm text-rose-100">
            {profileError}
          </div>
        )}
        {accountWarning && (
          <div role="status" className="mb-5 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] p-3 text-sm text-amber-100">
            {accountWarning}
          </div>
        )}
        {activeTab !== 'admin' && (
          <CabinetHeader
            profile={profile}
            onOpenGarage={() => setIsGarageOpen(true)}
            activeSection={activeSection}
            setActiveSection={(sec) => {
              setActiveSection(sec);
              if (sec === 'all') {
                setActiveTab('cabinet');
              } else {
                setActiveTab(sec);
              }
            }}
          />
        )}

        {activeTab !== 'admin' && <CurrentWeather onAskAi={handleAskAi} />}
        {activeTab === 'cabinet' && activeSection === 'all' && <AdSlot placement="dashboard" />}

        {activeTab === 'admin' && isAdmin && <AdminPanel userId={session.user.id} />}

        {/* Dynamic View Display */}
        {activeTab === 'cabinet' && activeSection === 'all' && (
          <div className="space-y-10">
            {/* 6-Card Dashboard Matrix */}
            <StatsCards
              profile={profile}
              onNavigate={handleNavigateFromCards}
              onOpenGarage={() => setIsGarageOpen(true)}
            />

            {/* Interactive Bike Blueprint Digital Twin */}
            <section id="blueprint-section">
              <BikeBlueprint profile={profile} onAskAi={handleAskAi} />
            </section>

            {/* Spots Radar Section */}
            <section id="spots-section">
              <SpotsRadar onAskAi={handleAskAi} />
              <AdSlot placement="spots" />
            </section>

            {/* AI Workshop Feature Section */}
            <section id="workshop-section">
              <AiWorkshop
                initialPrompt={chatPrompt}
                userId={session.user.id}
                accessToken={session.access_token}
                riderProfile={profile}
                historyConsent={aiHistoryConsent}
                onHistoryConsentChange={handleAiHistoryConsentChange}
              />
            </section>

            {/* Geometry Lab Section */}
            <section id="geometry-section">
              <GeometryLab onAskAi={handleAskAi} />
            </section>

            {/* Components Matrix Section */}
            <section id="components-section">
              <ComponentsMatrix onAskAi={handleAskAi} />
            </section>
          </div>
        )}

        {/* Specific Tab Views */}
        {(activeTab === 'blueprint' || activeSection === 'blueprint') && (
          <div className="animate-in fade-in duration-300">
            <BikeBlueprint profile={profile} onAskAi={handleAskAi} />
          </div>
        )}

        {(activeTab === 'chat' || activeSection === 'chat') && (
          <div className="animate-in fade-in duration-300">
            <AiWorkshop
              initialPrompt={chatPrompt}
              userId={session.user.id}
              accessToken={session.access_token}
              riderProfile={profile}
              historyConsent={aiHistoryConsent}
              onHistoryConsentChange={handleAiHistoryConsentChange}
            />
          </div>
        )}

        {(activeTab === 'geometry' || activeSection === 'geometry') && (
          <div className="animate-in fade-in duration-300">
            <GeometryLab onAskAi={handleAskAi} />
          </div>
        )}

        {(activeTab === 'components' || activeSection === 'components') && (
          <div className="animate-in fade-in duration-300">
            <ComponentsMatrix onAskAi={handleAskAi} />
          </div>
        )}

        {(activeTab === 'spots' || activeSection === 'spots') && (
          <div className="animate-in fade-in duration-300">
            <SpotsRadar onAskAi={handleAskAi} />
            <AdSlot placement="spots" />
          </div>
        )}
      </main>

      {/* Garage / Settings Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
        onDeleteAccount={handleDeleteAccount}
      />

      {isSupportOpen && (
        <SupportChat
          userId={session.user.id}
          isAdmin={isAdmin}
          onClose={() => setIsSupportOpen(false)}
        />
      )}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={() => setIsSupportOpen((open) => !open)}
          aria-label={isSupportOpen ? 'Закрити чат з адміністрацією' : 'Написати адміністрації'}
          title={isSupportOpen ? 'Закрити чат' : isAdmin ? 'Звернення райдерів' : 'Написати адміністрації'}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#111118] text-white shadow-xl transition hover:scale-105 hover:border-white/30"
        >
          <BrandImage src="/brand/support-logo.png" fallbackSrc="/brand/support-logo.svg" alt="" className="h-7 w-7 rounded-full object-contain" />
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('chat');
            setActiveSection('chat');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Відкрити AI-копілота"
          title="AI-копілот"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E10600]/60 bg-[#E10600] text-white shadow-[0_8px_30px_rgba(225,6,0,0.35)] transition hover:scale-105 hover:bg-[#b80500]"
        >
          <BrandImage src="/brand/ai-logo.png" fallbackSrc="/brand/ai-logo.svg" alt="" className="h-8 w-8 rounded-full object-contain" />
        </button>
      </div>

      {/* Footer Masterpiece — Krasdrop Studios Design */}
      <footer className="relative border-t border-white/[0.04] bg-[#0a0a0e] py-14 px-4 sm:px-10 text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#E10600]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#FFC400]/05 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-[#060608] via-transparent to-[#060608] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-[1.5px] bg-gradient-to-r from-transparent via-[#E10600] to-transparent" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="mb-8">
            <p className="font-brand text-xl md:text-3xl text-gray-200 font-black uppercase tracking-[0.2em] leading-tight mb-2">
              © 2026 СТВОРЕНО З ЛЮБОВ’Ю ДО ВЕЛОСПОРТУ
            </p>
            <div className="flex items-center justify-center gap-3">
              <BrandImage src="/brand/team-logo.png" fallbackSrc="/brand/team-logo.svg" alt="Логотип команди" className="h-10 w-10 object-contain md:h-12 md:w-12" />
              <div className="font-brand text-2xl md:text-4xl text-[#E10600] drop-shadow-[0_0_12px_rgba(225,6,0,0.7)] font-black uppercase tracking-[0.18em] leading-none">
                KRASDROP STUDIOS
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-6 text-xs text-gray-500 flex-wrap">
            <a href="https://www.instagram.com/ishachok_na_ashane/?hl=uk" target="_blank" rel="noopener noreferrer" className="hover:text-[#FFC400] transition-colors uppercase tracking-[0.2em] font-semibold">
              INSTAGRAM
            </a>
            <a href="https://www.tiktok.com/@n0nam6_" target="_blank" rel="noopener noreferrer" className="hover:text-[#FFC400] transition-colors uppercase tracking-[0.2em] font-semibold">
              TIKTOK
            </a>
            <a href="mailto:krasnovilla9@gmail.com" className="hover:text-[#E10600] transition-colors uppercase tracking-[0.2em] font-semibold">
              KRASNOVILLA9@GMAIL.COM
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 mb-6 flex-wrap mt-8">
            <a
              href="https://www.instagram.com/ishachok_na_ashane/?hl=uk"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1 transition-all hover:scale-110"
            >
              <div className="w-10 h-10 rounded-none clip-bevel-sm bg-gradient-to-br from-[#E10600] to-[#FFC400] flex items-center justify-center shadow-[0_0_20px_rgba(225,6,0,0.4)] group-hover:shadow-[0_0_30px_rgba(255,196,0,0.6)] transition-shadow">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z" />
                </svg>
              </div>
              <span className="text-[9px] text-[#9aa3b8] uppercase tracking-[2px] group-hover:text-[#E10600] transition-colors font-bold">
                Instagram
              </span>
            </a>

            <a
              href="https://www.tiktok.com/@n0nam6_"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1 transition-all hover:scale-110"
            >
              <div className="w-10 h-10 rounded-none clip-bevel-sm bg-[#111118] border border-white/[0.15] hover:border-[#FFC400]/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-shadow">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </div>
              <span className="text-[9px] text-[#9aa3b8] uppercase tracking-[2px] group-hover:text-white transition-colors font-bold">
                TikTok
              </span>
            </a>

            <a
              href="mailto:krasnovilla9@gmail.com"
              className="group flex flex-col items-center gap-1 transition-all hover:scale-110"
            >
              <div className="w-10 h-10 rounded-none clip-bevel-sm bg-[#111118] border border-white/[0.15] hover:border-[#E10600]/70 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_25px_rgba(225,6,0,0.2)] transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[9px] text-[#9aa3b8] uppercase tracking-[2px] group-hover:text-[#E10600] transition-colors font-bold">
                Пошта
              </span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/[0.06]">
            <div className="text-left">
              <div className="font-title text-sm font-black text-white uppercase tracking-wider mb-1">
                VeloVibe AI
              </div>
              <div className="text-[10px] text-[#6b7a94] leading-relaxed">
                Цифровий кабінет для аналізу геометрії, сумісності компонентів і пошуку місць для катання в Україні. Створений для будівничих трас, механіків і райдерів.
              </div>
            </div>

            <div className="text-center">
              <div className="font-title text-sm font-black text-white uppercase tracking-wider mb-1">
                Технології
              </div>
              <div className="text-[10px] text-[#6b7a94] leading-relaxed">
                React · TypeScript · Vite · TailwindCSS · Framer Motion · Leaflet · Web Audio API · Gemini 3.8 Flash
              </div>
            </div>

            <div className="text-right">
              <div className="font-title text-sm font-black text-white uppercase tracking-wider mb-1">
                Підтримка
              </div>
              <div className="text-[10px] text-[#6b7a94] leading-relaxed">
                Профілі зберігаються у вашому акаунті. AI-історія — лише за згодою; погода та мапа надходять від Open-Meteo й OpenStreetMap.
              </div>
            </div>
          </div>

          {/* Заключна лінія */}
          <div className="mt-10 pt-4 border-t border-white/[0.04]">
            <div className="text-[8px] text-[#3a4255] uppercase tracking-[3px] font-mono">
              © 2026 KRASDROP STUDIOS · УСІ ПРАВА ЗАХИЩЕНО · ПРОЄКТ № VLBIKE-042
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
