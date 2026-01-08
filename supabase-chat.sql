-- Chat System Schema
-- Run this in Supabase SQL Editor

-- 1. Create the chat table
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for sorting
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 3. Add constraint for message length (max 500 characters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_chat_content_length'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chk_chat_content_length CHECK (char_length(content) <= 500);
  END IF;
END $$;

-- 4. Add constraint for user name length (max 50 characters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_chat_user_name_length'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chk_chat_user_name_length CHECK (char_length(user_name) <= 50);
  END IF;
END $$;

-- 5. Enable RLS (but allow public access for Kiosk mode)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Kiosk mode: allow anyone to read and post messages.
-- No UPDATE/DELETE policies are created.
DROP POLICY IF EXISTS "Public chat read" ON chat_messages;
DROP POLICY IF EXISTS "Public chat insert" ON chat_messages;

CREATE POLICY "Public chat read"
ON chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Public chat insert"
ON chat_messages
FOR INSERT
WITH CHECK (true);

-- 6. Enable Realtime for chat messages
-- This allows the chat to update in real-time across all connected clients
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 7. Optional: Create a function to clean up old messages (run periodically)
-- This keeps only the last 1000 messages to prevent unbounded growth
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE id NOT IN (
    SELECT id FROM chat_messages
    ORDER BY created_at DESC
    LIMIT 1000
  );
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup via pg_cron (if available)
-- SELECT cron.schedule('cleanup-chat', '0 3 * * *', 'SELECT cleanup_old_chat_messages()');
