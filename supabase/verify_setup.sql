-- ============================================
-- SUPABASE SETUP VERIFICATION SCRIPT
-- Run this to check if everything is properly configured
-- ============================================

-- 1. Check if machines table exists and has correct columns
SELECT
  '1. machines table' as check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machines')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run create_machines_table.sql'
  END as status;

-- 2. Check if machines table has required columns
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('current_order', 'current_shift', 'current_operator') THEN '✅ Required for sync'
    ELSE '📋 Standard'
  END as importance
FROM information_schema.columns
WHERE table_name = 'machines'
ORDER BY ordinal_position;

-- 3. Check if live_sessions table exists
SELECT
  '2. live_sessions table' as check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_sessions')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING - Run live_sessions_table.sql'
  END as status;

-- 4. Check realtime publication
SELECT
  '3. Realtime enabled for:' as check_item,
  tablename as table_name,
  '✅ ENABLED' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('machines', 'live_sessions');

-- 5. Check if any active sessions exist
SELECT
  '4. Active sessions today' as check_item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '📋 Found locked sessions' ELSE '✅ No active sessions' END as status
FROM live_sessions
WHERE session_date = CURRENT_DATE AND is_locked = true;

-- 6. Show current machine statuses
SELECT
  id,
  name,
  status,
  current_operator,
  current_order,
  current_shift,
  updated_at
FROM machines
ORDER BY name;

-- ============================================
-- IF REALTIME IS NOT ENABLED, RUN THESE:
-- ============================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE machines;
-- ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- ============================================
-- IF live_sessions TABLE IS MISSING, RUN:
-- supabase/live_sessions_table.sql
-- ============================================

-- ============================================
-- IF current_order/current_shift COLUMNS ARE MISSING:
-- ============================================
-- ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_order TEXT;
-- ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_shift TEXT;
