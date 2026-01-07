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

-- 3. Enable RLS (but allow public access for Kiosk mode)
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

-- 4. Enable Realtime for chat messages
-- Note: You might need to check "Replication" settings in the Dashboard if this SQL doesn't trigger it automatically on some plans.
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
