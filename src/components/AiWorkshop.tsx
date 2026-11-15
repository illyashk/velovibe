import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw, Copy, Check, Terminal, Bike, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../types/velovibe';
import { QUICK_PROMPTS } from '../data/bikeData';
import { sound } from '../utils/audio';
import { supabase } from '../lib/supabase';
import { RiderProfile } from '../types/velovibe';

interface AiWorkshopProps {
  initialPrompt?: string;
  userId: string;
  historyConsent: boolean;
  onHistoryConsentChange: (enabled: boolean) => Promise<void>;
  accessToken: string;
  riderProfile: RiderProfile;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `Вітаю у VeloVibe AI. 🚲

Допоможу розібратися з геометрією, сумісністю деталей і базовим обслуговуванням. Для точної відповіді вкажи модель велосипеда та компонентів.

Каталог веломісць поки не містить підтверджених координат. Не використовую неперевірені GPS-точки чи описи маршрутів як факти. Якщо маєш GPX або посилання на надійне джерело, надішли його — допоможу перевірити дані перед поїздкою.

Обирай тему нижче або опиши свій технічний запит.`,
  timestamp: 'Щойно',
};

export const AiWorkshop: React.FC<AiWorkshopProps> = ({
  initialPrompt,
  userId,
  historyConsent,
  onHistoryConsentChange,
  accessToken,
  riderProfile,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [codeCopiedId, setCodeCopiedId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    const client = supabase;
    if (!historyConsent || !client) {
      setConversationId(null);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const { data: conversation, error: conversationError } = await client
          .from('ai_conversations')
          .select('id')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (conversationError) throw conversationError;
        if (!conversation) {
          if (active) {
            setConversationId(null);
            setMessages([WELCOME_MESSAGE]);
          }
          return;
        }

        const { data, error } = await client
          .from('ai_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!active) return;

        const loadedMessages: ChatMessage[] = (data || [])
          .filter((message) =>
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string'
          )
          .map((message) => ({
            id: message.id,
            role: message.role === 'user' ? 'user' : 'assistant',
            text: message.content,
            timestamp: new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' })
              .format(new Date(message.created_at)),
          }));
        setConversationId(conversation.id);
        setMessages(loadedMessages.length ? loadedMessages : [WELCOME_MESSAGE]);
      } catch (error: unknown) {
        if (active) {
          setWarningMessage(error instanceof Error
            ? `Не вдалося завантажити збережену історію: ${error.message}`
            : 'Не вдалося завантажити збережену історію.');
        }
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    };

    void loadHistory();
    return () => { active = false; };
  }, [historyConsent, userId]);

  const persistMessage = async (role: ChatMessage['role'], content: string) => {
    const client = supabase;
    if (!historyConsent || !client) return;
    let id = conversationId;
    if (!id) {
      const { data, error } = await client
        .from('ai_conversations')
        .insert({ user_id: userId, title: content.slice(0, 80) || 'Розмова про велосипед' })
        .select('id')
        .single();
      if (error) throw error;
      id = data.id;
      setConversationId(id);
    }
    const { error: messageError } = await client
      .from('ai_messages')
      .insert({ conversation_id: id, role, content });
    if (messageError) throw messageError;
    const { error: updateError } = await client
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) throw updateError;
  };

  const toggleHistoryConsent = async () => {
    setIsSavingConsent(true);
    setWarningMessage(null);
    try {
      await onHistoryConsentChange(!historyConsent);
    } catch (error: unknown) {
      setWarningMessage(error instanceof Error ? error.message : 'Не вдалося змінити налаштування приватності.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading || isLoadingHistory) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setWarningMessage(null);
    try {
      await persistMessage('user', text);
    } catch (error: unknown) {
      setWarningMessage(error instanceof Error
        ? `Повідомлення не збережено в історії: ${error.message}`
        : 'Повідомлення не збережено в історії.');
    }

    try {
      const response = await fetch('/api/velovibe/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6),
          riderProfile: {
            username: riderProfile.username,
            bikeModel: riderProfile.bikeModel,
            discipline: riderProfile.discipline,
            riderWeightKg: riderProfile.riderWeightKg,
            riderHeightCm: riderProfile.riderHeightCm,
            frameSize: riderProfile.frameSize,
            forkTravelMm: riderProfile.forkTravelMm,
            shockTravelMm: riderProfile.shockTravelMm,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok && !data.reply) {
        throw new Error(data.error || 'Помилка зʼєднання з сервером копілота');
      }

      if (data.warning) {
        setWarningMessage(data.warning);
      }

      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      try {
        await persistMessage('assistant', botMsg.text);
      } catch (error: unknown) {
        setWarningMessage(error instanceof Error
          ? `Відповідь не збережено в історії: ${error.message}`
          : 'Відповідь не збережено в історії.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Не вдалося отримати відповідь від сервера';
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ Помилка звʼязку: ${message}. Перевір зʼєднання та повтори спробу.`,
        timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setWarningMessage('Не вдалося скопіювати текст. Спробуй ще раз.');
      setTimeout(() => setWarningMessage(null), 3000);
    }
  };

  const handleCodeCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCodeCopiedId(id);
      setTimeout(() => setCodeCopiedId(null), 2000);
    } catch {
      setWarningMessage('Не вдалося скопіювати код. Спробуй ще раз.');
      setTimeout(() => setWarningMessage(null), 3000);
    }
  };

  const handleReset = async () => {
    const client = supabase;
    if (historyConsent && conversationId && client) {
      const { error } = await client.from('ai_conversations').delete().eq('id', conversationId);
      if (error) {
        setWarningMessage(`Не вдалося видалити історію з акаунта: ${error.message}`);
        return;
      }
      setConversationId(null);
    }
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        text: 'Чат очищено. Чим можу допомогти по байку зараз?',
        timestamp: 'Щойно',
      },
    ]);
  };

  // Simple clean markdown parser for VeloVibe responses (handles tables, bold, headers, code blocks, lists)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let tableRows: string[] = [];

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const rows = [...tableRows];
        tableRows = [];
        elements.push(
          <div key={key} className="my-3 overflow-x-auto border border-white/[0.08] bg-[#111118]">
            <table className="w-full text-left text-xs border-collapse">
              <tbody>
                {rows.map((row, rIdx) => {
                  const cols = row
                    .split('|')
                    .map((c) => c.trim())
                    .filter((c, i, arr) => i > 0 && i < arr.length);
                  if (cols.length === 0 || cols.every((c) => /^:?-+:?$/.test(c))) {
                    return null;
                  }
                  const isHeader = rIdx === 0;
                  return (
                    <tr
                      key={rIdx}
                      className={
                        isHeader
                          ? 'bg-[#18181f] text-white font-bold border-b border-white/[0.08]'
                          : 'border-b border-white/[0.04] text-[#9aa3b8] hover:bg-white/[0.02]'
                      }
                    >
                      {cols.map((col, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 border-r border-white/[0.04] last:border-none">
                          {renderInlineMarkdown(col)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    };

    lines.forEach((line, index) => {
      // Code block detection
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          const codeText = codeContent.join('\n');
          const codeId = `code-${index}`;
          inCodeBlock = false;
          elements.push(
            <div key={codeId} className="my-2.5 bg-[#111118] border border-white/[0.08] font-mono text-[11px] text-[#FFC400] overflow-x-auto relative group">
              <div className="flex items-center justify-between bg-[#18181f] px-2.5 py-1.5 border-b border-white/[0.08] text-[9px] text-[#6b7a94] uppercase tracking-[1.5px]">
                <span>code</span>
                <button
                  type="button"
                  onClick={() => handleCodeCopy(codeId, codeText)}
                  className="inline-flex items-center gap-1.5 text-[#9aa3b8] hover:text-white transition-colors cursor-pointer"
                >
                  {codeCopiedId === codeId ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
                  <span>{codeCopiedId === codeId ? 'Скопійовано' : 'Копіювати'}</span>
                </button>
              </div>
              <pre className="p-3 whitespace-pre-wrap break-words">{codeText}</pre>
            </div>
          );
          codeContent = [];
        } else {
          flushTable(`table-before-code-${index}`);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Table line detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableRows.push(line);
        return;
      } else {
        flushTable(`table-${index}`);
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={index} className="text-sm font-extrabold text-[#FFC400] uppercase tracking-wider mt-3 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={index} className="font-title text-lg font-bold text-white uppercase tracking-wide mt-3.5 mb-1.5">
            {line.replace('## ', '')}
          </h3>
        );
        return;
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-[#9aa3b8] my-1 ml-1">
            <span className="text-[#E10600] font-bold">•</span>
            <span>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</span>
          </div>
        );
        return;
      }

      // Numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-[#9aa3b8] my-1 ml-1">
            <span className="text-[#FFC400] font-mono font-bold text-[10px]">
              {line.match(/^\d+\./)?.[0]}
            </span>
            <span>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</span>
          </div>
        );
        return;
      }

      // Regular paragraph or empty line
      if (line.trim() === '') {
        elements.push(<div key={index} className="h-2" />);
      } else {
        elements.push(
          <p key={index} className="text-xs text-[#f2f2fa]/90 leading-relaxed my-1">
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    });

    flushTable('table-final');
    return elements;
  };

  const renderInlineMarkdown = (text: string) => {
    // Bold
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="cab-card p-6 sm:p-8 flex flex-col mb-10">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-5 mb-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none clip-bevel-sm bg-[#E10600] flex items-center justify-center text-white font-black text-sm">
            <Bike className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-title text-xl text-white tracking-[2px] uppercase font-bold leading-none">
              Майстерня VeloVibe AI · чат із копілотом
            </h2>
            <p className="text-[9px] text-[#6b7a94] uppercase tracking-[1.5px] mt-1">
              Діалог у реальному часі · Модель: Gemini 3.8 Flash
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="text-[9px] font-bold text-[#6b7a94] hover:text-[#E10600] uppercase tracking-[1.5px] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Почати нову бесіду"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Очистити</span>
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
        <p className="text-xs leading-relaxed text-slate-400">
          {historyConsent
            ? 'Історія цього чату зберігається у твоєму приватному профілі.'
            : 'Історія зберігається лише до закриття сторінки.'}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={historyConsent}
          disabled={isSavingConsent}
          onClick={() => void toggleHistoryConsent()}
          className={`rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${historyConsent ? 'border-emerald-300/30 text-emerald-200 hover:bg-emerald-300/10' : 'border-white/10 text-slate-300 hover:bg-white/[0.05]'}`}
        >
          {isSavingConsent ? 'Зберігаю…' : historyConsent ? 'Вимкнути й видалити історію' : 'Увімкнути приватну історію'}
        </button>
      </div>

      {/* Warning banner if fallback used */}
      {warningMessage && (
        <div className="mb-4 p-3 bg-[#FFC400]/10 border border-[#FFC400]/25 text-[#FFC400] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Quick query chips */}
      <div className="mb-5">
        <div className="text-[9px] font-extrabold text-[#3a4255] tracking-[2px] uppercase mb-2">
          Швидкі байк-запити:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="text-[10px] text-[#9aa3b8] hover:text-white bg-[#111118] hover:bg-[#18181f] border border-white/[0.05] hover:border-[#E10600]/40 px-3 py-1.5 transition-all text-left cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 min-h-[380px] max-h-[520px] overflow-y-auto space-y-4 pr-2 mb-4">
        {isLoadingHistory && <p className="text-xs text-slate-500">Завантажую приватну історію…</p>}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 text-[9px] text-[#6b7a94] uppercase tracking-[1px]">
                <span className={isUser ? 'text-[#FFC400] font-bold' : 'text-[#E10600] font-bold'}>
                  {isUser ? 'ТИ' : 'VELOVIBE AI'}
                </span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`p-4 max-w-[92%] sm:max-w-[85%] rounded-none relative group ${
                  isUser
                    ? 'bg-[#18181f] border border-white/[0.08] text-white clip-bevel-sm'
                    : msg.isError
                    ? 'bg-[#290808] border border-[#E10600]/40 text-[#f2f2fa]'
                    : 'bg-[#0f0f15] border border-white/[0.04] text-[#f2f2fa]'
                }`}
              >
                {!isUser && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="absolute top-2 right-2 p-1 text-[#6b7a94] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Копіювати текст"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {isUser ? (
                  <p className="text-xs leading-relaxed font-medium">{msg.text}</p>
                ) : (
                  <div>{renderFormattedText(msg.text)}</div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="text-[9px] text-[#E10600] font-bold uppercase tracking-[1px] mb-1">
              VELOVIBE AI АНАЛІЗУЄ...
            </div>
            <div className="p-4 bg-[#0f0f15] border border-white/[0.04] flex items-center gap-3">
              <div className="loading-spinner" />
              <span className="text-xs text-[#9aa3b8]">Підбираю спеки та шукаю мануали...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-3 border-t border-white/[0.04]"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Запитай про сумісність деталей, геометрію рами або тиск у вилці..."
            className="w-full bg-[#111118] border border-white/[0.06] focus:border-[#E10600]/70 px-4 py-3 text-xs text-white placeholder-[#6b7a94] outline-none transition-colors font-body"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="btn-kras clip-bevel-sm px-6 py-3 bg-[#E10600] hover:bg-[#b80500] disabled:opacity-40 disabled:hover:bg-[#E10600] text-white text-[10px] font-extrabold tracking-[2px] uppercase shadow-[0_0_20px_rgba(225,6,0,0.35)] cursor-pointer flex items-center gap-2"
        >
          <span>Надіслати</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
