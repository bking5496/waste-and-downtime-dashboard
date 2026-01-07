import React, { useEffect, useMemo, useState } from 'react';
import {
  ChatMessageRecord,
  fetchRecentChatMessages,
  isSupabaseConfigured,
  subscribeChatMessages,
} from '../lib/supabase';

type ChatMessageSentEvent = CustomEvent<ChatMessageRecord>;

type LatestMessageBarProps = {
  label?: string;
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const LatestMessageBar: React.FC<LatestMessageBarProps> = ({ label = 'Latest' }) => {
  const [latest, setLatest] = useState<ChatMessageRecord | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const msgs = await fetchRecentChatMessages(1);
        if (!isMounted) return;
        setLatest(msgs[0] ?? null);
      } catch {
        // Ignore; chat widget will show any errors.
      }
    };

    load();

    const unsubscribe = isSupabaseConfigured
      ? subscribeChatMessages((message) => {
          setLatest(message);
        })
      : () => {};

    const onLocalSend = (e: Event) => {
      const ev = e as ChatMessageSentEvent;
      if (ev?.detail) setLatest(ev.detail);
    };

    window.addEventListener('chat_message_sent', onLocalSend);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('chat_message_sent', onLocalSend);
    };
  }, []);

  const text = useMemo(() => {
    if (!latest) return 'No messages yet';
    const t = formatTime(latest.created_at);
    return `${latest.user_name}${t ? ` (${t})` : ''}: ${latest.content}`;
  }, [latest]);

  return (
    <div className="latest-message-bar" role="status" aria-label="Latest chat message">
      <div className="latest-message-label">{label}:</div>
      <div className="latest-message-text" title={text}>
        {text}
      </div>
    </div>
  );
};

export default LatestMessageBar;
