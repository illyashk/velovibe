import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, MessageCircle, RefreshCw, Send, Shield, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SupportConversation {
  id: string;
  rider_id: string;
  status: 'open' | 'closed';
  updated_at: string;
}

interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface SupportChatProps {
  userId: string;
  isAdmin: boolean;
  embedded?: boolean;
  onClose?: () => void;
}

export const SupportChat: React.FC<SupportChatProps> = ({ userId, isAdmin, embedded = false, onClose }) => {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { data, error: loadError } = await supabase
      .from('support_conversations')
      .select('id, rider_id, status, updated_at')
      .order('updated_at', { ascending: false });
    if (loadError) {
      setError(`Не вдалося завантажити чат підтримки. Перевір SQL-міграцію: ${loadError.message}`);
      return;
    }
    const loaded = data as SupportConversation[];
    setConversations(loaded);
    if (activeConversation && !loaded.some((conversation) => conversation.id === activeConversation)) {
      setActiveConversation(null);
      setMessages([]);
    } else if (!activeConversation && !isAdmin && loaded.length) {
      setActiveConversation(loaded[0].id);
    }
  }, [activeConversation, isAdmin]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setIsLoading(true);
      await loadConversations();
      if (active) setIsLoading(false);
    };
    void initialize();
    const timer = window.setInterval(() => { void loadConversations(); }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadConversations]);

  useEffect(() => {
    const client = supabase;
    if (!client || !activeConversation) {
      setMessages([]);
      return;
    }
    let active = true;
    const loadMessages = async () => {
      const { data, error: loadError } = await client
        .from('support_messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .eq('conversation_id', activeConversation)
        .order('created_at', { ascending: true });
      if (!active) return;
      if (loadError) {
        setError(`Не вдалося завантажити повідомлення: ${loadError.message}`);
        return;
      }
      setMessages(data as SupportMessage[]);
    };
    void loadMessages();
    const timer = window.setInterval(() => { void loadMessages(); }, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeConversation]);

  const startConversation = async () => {
    if (!supabase || isAdmin) return;
    setError(null);
    setIsSending(true);
    try {
      const { data, error: createError } = await supabase
        .from('support_conversations')
        .insert({ rider_id: userId })
        .select('id')
        .single();
      if (createError) throw createError;
      setActiveConversation(data.id);
      await loadConversations();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося відкрити чат підтримки.');
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!supabase || !activeConversation || !content || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const { error: sendError } = await supabase.from('support_messages').insert({
        conversation_id: activeConversation,
        sender_id: userId,
        content,
      });
      if (sendError) throw sendError;
      setDraft('');
      const { error: updateError } = await supabase
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConversation);
      if (updateError && !isAdmin) throw updateError;
      await loadConversations();
      const { data } = await supabase
        .from('support_messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .eq('conversation_id', activeConversation)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as SupportMessage[]);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося надіслати повідомлення.');
    } finally {
      setIsSending(false);
    }
  };

  const closeConversation = async () => {
    if (!supabase || !activeConversation || !isAdmin) return;
    const { error: closeError } = await supabase
      .from('support_conversations')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', activeConversation);
    if (closeError) {
      setError(`Не вдалося закрити звернення: ${closeError.message}`);
      return;
    }
    setActiveConversation(null);
    await loadConversations();
  };

  const activeThread = conversations.find((conversation) => conversation.id === activeConversation);
  const shellClass = embedded
    ? 'flex min-h-[480px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10]'
    : 'fixed bottom-24 right-4 z-[70] flex h-[min(620px,calc(100dvh-8rem))] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#0b0b10] shadow-2xl sm:bottom-24 sm:right-6';

  return (
    <section aria-label={isAdmin ? 'Звернення райдерів' : 'Чат з адміністрацією'} className={shellClass}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E10600]/15 text-[#E10600]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{isAdmin ? 'Звернення райдерів' : 'Зв’язок з адміністрацією'}</h2>
              <p className="text-[10px] text-slate-500">{isAdmin ? `${conversations.filter((item) => item.status === 'open').length} відкритих` : 'Приватний канал підтримки'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadConversations()} aria-label="Оновити список" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><RefreshCw className="h-4 w-4" /></button>
            {!embedded && onClose && <button type="button" onClick={onClose} aria-label="Закрити чат" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {(isAdmin || conversations.length > 1) && (
            <aside className="w-[36%] shrink-0 overflow-y-auto border-r border-white/[0.06]">
              {conversations.map((conversation) => (
                <button key={conversation.id} type="button" onClick={() => setActiveConversation(conversation.id)} className={`w-full border-b border-white/[0.05] p-3 text-left transition-colors ${activeConversation === conversation.id ? 'bg-[#E10600]/10' : 'hover:bg-white/[0.03]'}`}>
                  <span className="block truncate text-[11px] font-semibold text-slate-200">{isAdmin ? `Райдер · ${conversation.rider_id.slice(0, 8)}` : `Звернення ${conversation.id.slice(0, 6)}`}</span>
                  <span className={`mt-1 inline-block text-[9px] ${conversation.status === 'open' ? 'text-emerald-300' : 'text-slate-500'}`}>{conversation.status === 'open' ? 'Відкрите' : 'Закрите'}</span>
                </button>
              ))}
              {isAdmin && conversations.length === 0 && !isLoading && <p className="p-3 text-[10px] text-slate-500">Звернень поки немає.</p>}
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {!activeConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                {isLoading ? <LoaderCircle className="h-6 w-6 animate-spin text-slate-500" /> : <MessageCircle className="h-8 w-8 text-slate-600" />}
                <p className="mt-3 text-sm text-slate-300">{isAdmin ? 'Обери звернення зі списку' : 'Потрібна допомога адміністрації?'}</p>
                {!isAdmin && <button type="button" disabled={isSending} onClick={() => void startConversation()} className="mt-4 rounded-lg bg-[#E10600] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#b80500] disabled:opacity-50">Нове звернення</button>}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                  <p className="truncate text-[10px] text-slate-500">{isAdmin ? `Райдер ${activeThread?.rider_id.slice(0, 8)}` : 'Твоє звернення'}</p>
                  {activeThread?.status === 'closed' && <span className="text-[10px] text-slate-500">Закрите</span>}
                  {isAdmin && activeThread?.status === 'open' && <button type="button" onClick={() => void closeConversation()} className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"><CheckCircle2 className="h-3 w-3" />Закрити</button>}
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {messages.map((message) => {
                    const mine = message.sender_id === userId;
                    return (
                      <div key={message.id} className={`max-w-[88%] rounded-xl px-3 py-2 ${mine ? 'ml-auto bg-[#E10600]/20 text-white' : 'bg-white/[0.05] text-slate-200'}`}>
                        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
                        <p className="mt-1 text-right text-[9px] text-slate-500">{new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}</p>
                      </div>
                    );
                  })}
                  {!messages.length && <p className="text-center text-[11px] text-slate-500">Напиши нам, щоб почати діалог.</p>}
                </div>
                {activeThread?.status === 'open' && (
                  <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/[0.06] p-3">
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Напиши повідомлення…" className="min-w-0 flex-1 resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-[#E10600]/50" />
                    <button type="submit" disabled={isSending || !draft.trim()} aria-label="Надіслати" className="self-end rounded-lg bg-[#E10600] p-2.5 text-white hover:bg-[#b80500] disabled:opacity-40">{isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {error && <p role="alert" className="border-t border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-[10px] text-rose-200">{error}</p>}
      </div>
    </section>
  );
};
