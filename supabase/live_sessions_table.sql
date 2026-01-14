-- ============================================
-- LIVE SESSIONS TABLE - Required for Cross-Browser Sync
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create the live_sessions table
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY, -- Format: "machineName_shift_date"
  machine_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL,
  session_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT TRUE,
  
  -- JSON storage for entries (optional - for future sync)
  waste_entries JSONB DEFAULT '[]'::jsonb,
  downtime_entries JSONB DEFAULT '[]'::jsonb,
  speed_entries JSONB DEFAULT '[]'::jsonb,
  sachet_mass_entries JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (adjust based on your auth needs)
CREATE POLICY "Allow all operations on live_sessions" ON live_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_machine ON live_sessions(machine_name);
CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_live_sessions_locked ON live_sessions(is_locked);

-- ==========================================
-- ENABLE REALTIME - IMPORTANT!
-- ==========================================
-- This is required for cross-browser sync to work in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- Verify the table was created
SELECT 'live_sessions table created successfully!' as status;
