import React, { useEffect, useMemo, useRef, useState } from 'react';
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
};

const STORAGE_KEY = 'chat_user_name';
const CLIENT_ID_KEY = 'chat_client_id';

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatWidget: React.FC<ChatWidgetProps> = ({ operatorName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [userName, setUserName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const presenceChannelRef = useRef<any>(null);

  // Resolve a kiosk-friendly name: operatorName from form > localStorage > empty
  useEffect(() => {
    const fromStorage = localStorage.getItem(STORAGE_KEY) || '';
    const initial = (operatorName || fromStorage).trim();
    setUserName(initial);
  }, [operatorName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userName);
  }, [userName]);

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

  const handleSend = async () => {
    try {
      if (!isSupabaseConfigured) {
        setError('Chat is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY and redeploy.');
        return;
      }

      setError(null);
      const sent = await sendChatMessage(userName, draft);

      // Optimistic UI: show the message immediately for the sender.
      // This also covers cases where Realtime is not enabled (subscription won't fire).
      setMessages((prev) => {
        if (sent.id && prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });

      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message.');
    }
  };

  return (
    <div className="chat-widget">
      <button
        type="button"
        className="chat-toggle"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Open chat"
      >
        Chat{unreadCount ? ' •' : ''}
      </button>

      {isOpen && (
        <div className="chat-panel" role="dialog" aria-label="Chat">
          <div className="chat-header">
            <div className="chat-title">Team Chat</div>
            <div className="chat-online">Online: {onlineUsers.length}</div>
            <button type="button" className="chat-close" onClick={() => setIsOpen(false)}>
              Close
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
              Name
              <input
                className="chat-name-input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Operator"
              />
            </label>
          </div>

          <div className="chat-messages" aria-live="polite">
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

          {error && <div className="chat-error">{error}</div>}

          <div className="chat-compose">
            <input
              className="chat-compose-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button type="button" className="chat-send" onClick={handleSend}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
