-- ============================================
-- MIGRATION: Add missing columns to machines table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add current_order column (needed for cross-browser status sync)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_order TEXT;

-- Add current_shift column (needed to track which shift is using the machine)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_shift TEXT;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'machines'
ORDER BY ordinal_position;

-- ============================================
-- VERIFY REALTIME IS ENABLED
-- ============================================
-- Check if machines table is in realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- If machines is not listed above, run:
-- ALTER PUBLICATION supabase_realtime ADD TABLE machines;

-- ============================================
-- ALSO ENSURE live_sessions TABLE EXISTS
-- ============================================
-- If you haven't created the live_sessions table yet, run:
-- See: supabase/live_sessions_table.sql
