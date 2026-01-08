import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ChatMessageRecord,
  fetchRecentChatMessages,
  isSupabaseConfigured,
  supabase,
  sendChatMessage,
  subscribeChatMessages,
} from '../lib/supabase';

type ChatWidgetProps = {
  operatorName?: string;
  machineName?: string; // Current machine location (e.g., "Canline - Machine 1")
};

const STORAGE_KEY = 'chat_user_name';
const CLIENT_ID_KEY = 'chat_client_id';
const CURRENT_MACHINE_KEY = 'chat_current_machine'; // Tracks what machine user is currently on
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 2000; // 2 seconds between messages

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatWidget: React.FC<ChatWidgetProps> = ({ operatorName, machineName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [userName, setUserName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Resolve a kiosk-friendly name: operatorName from form > localStorage > empty
  useEffect(() => {
    const fromStorage = localStorage.getItem(STORAGE_KEY) || '';
    const initial = (operatorName || fromStorage).trim();
    setUserName(initial);
  }, [operatorName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userName);
  }, [userName]);

  // Format display name with machine location for sending
  const getDisplayNameForSending = useCallback(() => {
    const baseName = userName.trim() || 'Operator';
    // Use prop first, then fall back to localStorage
    const currentMachine = machineName || localStorage.getItem(CURRENT_MACHINE_KEY) || '';
    if (currentMachine) {
      // Extract just the machine identity for brevity (e.g., "Canline M1" from "Canline - Machine 1")
      const parts = currentMachine.split(' - ');
      const shortMachine = parts.length > 1
        ? `${parts[0]} M${parts[1].replace('Machine ', '')}`
        : currentMachine;
      return `${baseName} @ ${shortMachine}`;
    }
    return baseName;
  }, [userName, machineName]);

  // Presence: who is online right now.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const existingClientId = localStorage.getItem(CLIENT_ID_KEY);
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
    const clientId = existingClientId || cryptoObj?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    if (!existingClientId) localStorage.setItem(CLIENT_ID_KEY, clientId);

    const channel = supabase.channel('team-chat-presence', {
      config: {
        presence: { key: clientId },
      },
    });

    presenceChannelRef.current = channel;

    const computeOnline = () => {
      const state = channel.presenceState();
      const names: string[] = [];

      Object.values(state).forEach((metas) => {
        // metas is an array of presence payloads
        (metas as Array<Record<string, unknown>>).forEach((meta) => {
          const name = (meta?.user_name as string | undefined) || '';
          if (name.trim()) names.push(name.trim());
        });
      });

      // Deduplicate but keep stable ordering.
      const unique = Array.from(new Set(names));
      setOnlineUsers(unique);
    };

    channel
      .on('presence', { event: 'sync' }, computeOnline)
      .on('presence', { event: 'join' }, computeOnline)
      .on('presence', { event: 'leave' }, computeOnline);

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({
        user_name: (userName || 'Operator').trim(),
        online_at: new Date().toISOString(),
      });
    });

    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-track when the operator name changes.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = presenceChannelRef.current;
    if (!channel) return;
    channel.track({
      user_name: (userName || 'Operator').trim(),
      online_at: new Date().toISOString(),
    });
  }, [userName]);

  const unreadCount = useMemo(() => {
    if (isOpen) return 0;
    // simplest: show a dot if there are messages
    return messages.length > 0 ? 1 : 0;
  }, [isOpen, messages.length]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setError(null);
        const data = await fetchRecentChatMessages(100);
        if (!isMounted) return;
        setMessages(data);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load chat messages.');
      }
    };

    load();

    const unsubscribe = subscribeChatMessages((message) => {
      setMessages((prev) => {
        // avoid duplicates (reconnects / optimistic inserts)
        if (message.id && prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Scroll to bottom when opened or messages update while open
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Check rate limit
  const canSend = useCallback(() => {
    const now = Date.now();
    const timeSinceLastSend = now - lastSentTime;
    return timeSinceLastSend >= RATE_LIMIT_MS;
  }, [lastSentTime]);

  const handleSend = async () => {
    // Check rate limit
    if (!canSend()) {
      setRateLimitWarning(true);
      setTimeout(() => setRateLimitWarning(false), 2000);
      return;
    }

    try {
      if (!isSupabaseConfigured) {
        setError('Chat is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY and redeploy.');
        return;
      }

      const trimmedDraft = draft.trim();
      if (!trimmedDraft) return;
      if (trimmedDraft.length > MAX_MESSAGE_LENGTH) {
        setError(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
        return;
      }

      setError(null);
      setIsSending(true);
      setLastSentTime(Date.now());

      const sent = await sendChatMessage(getDisplayNameForSending(), trimmedDraft);

      // Optimistic UI: show the message immediately for the sender.
      // This also covers cases where Realtime is not enabled (subscription won't fire).
      setMessages((prev) => {
        if (sent.id && prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });

      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow typing but enforce max length
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setDraft(value);
    }
  };

  const charsRemaining = MAX_MESSAGE_LENGTH - draft.length;
  const showCharWarning = charsRemaining <= 50;

  return (
    <div className="chat-widget">
      <button
        type="button"
        className="chat-toggle"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Open chat"
      >
        💬 Chat{unreadCount ? ' •' : ''}
      </button>

      {isOpen && (
        <div className="chat-panel" role="dialog" aria-label="Chat">
          <div className="chat-header">
            <div className="chat-title">Team Chat</div>
            <div className="chat-online">
              <span className="online-dot"></span>
              {onlineUsers.length} online
            </div>
            <button type="button" className="chat-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className="chat-presence" aria-label="Online operators">
            {onlineUsers.length === 0 ? (
              <span className="chat-presence-empty">No one online</span>
            ) : (
              <span className="chat-presence-list">{onlineUsers.join(', ')}</span>
            )}
          </div>

          <div className="chat-name-row">
            <label className="chat-name-label">
              Your Name
              <input
                className="chat-name-input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
              />
            </label>
          </div>

          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty-state">
                No messages yet. Start the conversation!
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id ?? `${m.user_name}-${m.created_at}-${m.content}`} className="chat-message">
                <div className="chat-message-meta">
                  <span className="chat-message-name">{m.user_name}</span>
                  <span className="chat-message-time">{formatTime(m.created_at)}</span>
                </div>
                <div className="chat-message-body">{m.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="chat-error" role="alert">{error}</div>}
          {rateLimitWarning && (
            <div className="chat-rate-limit" role="alert">
              Please wait before sending another message.
            </div>
          )}

          <div className="chat-compose">
            <div className="chat-compose-wrapper">
              <input
                ref={inputRef}
                className="chat-compose-input"
                value={draft}
                onChange={handleDraftChange}
                placeholder="Type a message…"
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={isSending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              {draft.length > 0 && (
                <span className={`chat-char-count ${showCharWarning ? 'warning' : ''}`}>
                  {charsRemaining}
                </span>
              )}
            </div>
            <button
              type="button"
              className="chat-send"
              onClick={handleSend}
              disabled={isSending || !draft.trim() || !userName.trim()}
              aria-label="Send message"
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
