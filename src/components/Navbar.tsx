import React, { useState, useEffect } from 'react';
import { Bike, Sparkles, Navigation, Layers, Compass, Wrench, Volume2, VolumeX, Menu, X, LogOut, ShieldCheck } from 'lucide-react';
import { BIKE_DISCIPLINE_LABELS, RiderProfile } from '../types/velovibe';
import { sound } from '../utils/audio';
import { BrandImage } from './BrandImage';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: RiderProfile;
  onOpenGarage: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, profile, onOpenGarage, onSignOut, isAdmin }) => {
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const navItems = [
    { id: 'cabinet',    label: 'Кабінет',    icon: Layers },
    { id: 'chat',       label: 'AI Копілот', icon: Sparkles },
    { id: 'geometry',   label: 'Геометрія',  icon: Navigation },
    { id: 'components', label: 'Сумісність', icon: Wrench },
    { id: 'spots',      label: 'Мапа спотів', icon: Compass },
    ...(isAdmin ? [{ id: 'admin', label: 'Адмінка', icon: ShieldCheck }] : []),
  ];

  const handleNav = (id: string) => {
    sound.playShifterClick();
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-10 h-16 kras-nav-line transition-all duration-300 ${
          scrolled
            ? 'bg-[#060608]/98 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.6)]'
            : 'bg-[#060608]/80 backdrop-blur-xl border-b border-white/[0.03]'
        }`}
      >
        {/* Brand */}
        <button
          onClick={() => handleNav('cabinet')}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-full border border-[#E10600]/60 bg-[#11090A] flex items-center justify-center shadow-[0_0_15px_rgba(225,6,0,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(225,6,0,0.6)] transition-all duration-200">
            <BrandImage src="/brand/site-logo.png" fallbackSrc="/brand/site-logo.svg" alt="" className="h-8 w-8 rounded-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-title text-lg tracking-[4px] text-white font-extrabold">
              VELOVIBE
            </div>
            <div className="text-[#FFC400] text-[8px] font-extrabold tracking-[4px] uppercase flex items-center gap-1">
              <span>AI-КОПІЛОТ</span>
              <span className="text-[#3a4255]">·</span>
              <span className="text-white/50">ПРО-РАЙДЕР</span>
            </div>
          </div>
        </button>

        {/* Desktop Nav */}
        <ul className="hidden md:flex items-center gap-5 lg:gap-7 list-none">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <li key={id}>
                <button
                  onClick={() => handleNav(id)}
                  className={`flex items-center gap-1.5 text-[10px] font-bold tracking-[2px] uppercase transition-all duration-200 cursor-pointer py-1 relative ${
                    isActive ? 'text-white' : 'text-[#f2f2fa]/35 hover:text-white/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E10600]' : 'text-current'}`} />
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E10600] to-transparent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Right Zone */}
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
            className={`p-2 border transition-all duration-200 cursor-pointer ${
              isMuted
                ? 'bg-[#0b0b10] border-white/[0.05] text-[#3a4255] hover:border-white/[0.15] hover:text-[#6b7a94]'
                : 'bg-[#FFC400]/10 border-[#FFC400]/30 text-[#FFC400] hover:bg-[#FFC400]/20'
            }`}
          >
            {isMuted
              ? <VolumeX className="w-3.5 h-3.5" />
              : <Volume2 className="w-3.5 h-3.5" />
            }
          </button>

          {/* Profile chip */}
          <button
            onClick={() => { sound.playShifterClick(); onOpenGarage(); }}
            className="hidden sm:flex items-center gap-2.5 p-1 pr-3 bg-[#0b0b10] border border-white/[0.05] hover:border-white/[0.18] transition-all duration-200 cursor-pointer group"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-[#E10600] to-[#500000] clip-bevel-sm flex items-center justify-center text-white font-title text-sm font-bold">
              {profile.username.charAt(0)}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-extrabold text-white tracking-[1px] uppercase group-hover:text-[#FFC400] transition-colors">
                {profile.username}
              </span>
              <span className="text-[8px] text-[#6b7a94] tracking-[1.5px] uppercase">
                {BIKE_DISCIPLINE_LABELS[profile.discipline]} · {profile.riderWeightKg} кг
              </span>
            </div>
          </button>

          {/* AI CTA */}
          <button
            onClick={() => { sound.playRatchet(); setActiveTab('chat'); setMobileOpen(false); }}
            className="btn-kras clip-bevel-sm px-3.5 py-2 bg-[#E10600] hover:bg-[#b80500] text-white text-[9px] font-extrabold tracking-[2px] uppercase shadow-[0_0_20px_rgba(225,6,0,0.35)] cursor-pointer"
          >
            <Sparkles className="w-3 h-3 mr-1 inline" />
            <span className="hidden sm:inline">AI Запит</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            title="Вийти з акаунта"
            aria-label="Вийти з акаунта"
            className="p-2 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 bg-[#0b0b10] border border-white/[0.06] text-white cursor-pointer"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col pt-16 bg-[#060608]/98 backdrop-blur-2xl md:hidden animate-fade-in-up">
          <div className="flex flex-col gap-1 p-4">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-bold tracking-[2px] uppercase transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[#E10600]/10 border-[#E10600]/40 text-white'
                      : 'bg-transparent border-white/[0.04] text-[#6b7a94] hover:text-white hover:border-white/[0.12]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#E10600]' : 'text-current'}`} />
                  <span>{label}</span>
                </button>
              );
            })}

            <button
              onClick={() => { sound.playShifterClick(); onOpenGarage(); setMobileOpen(false); }}
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold tracking-[2px] uppercase border border-white/[0.04] text-[#FFC400] cursor-pointer mt-2"
            >
              <div className="w-5 h-5 bg-gradient-to-br from-[#E10600] to-[#500000] clip-bevel-sm flex items-center justify-center text-white font-title text-xs font-bold">
                {profile.username.charAt(0)}
              </div>
              <span>Гараж · {profile.username}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
