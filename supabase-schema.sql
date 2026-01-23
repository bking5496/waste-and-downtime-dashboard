-- ============================================
-- WASTE AND DOWNTIME DASHBOARD - COMPLETE DATABASE SCHEMA
-- ============================================
-- This is the SINGLE SOURCE OF TRUTH for all database tables.
-- Run this in your Supabase SQL Editor.
-- Last updated: 2026-01-09
--
-- Notes on security:
-- - The app uses the browser (anon) key, so your primary protection should be RLS.
-- - Current policies are permissive for development. Tighten for production.
-- ============================================

-- ==========================================
-- 1. MACHINES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'idle', 'maintenance')),
  current_operator TEXT,
  current_order TEXT,
  current_shift TEXT CHECK (current_shift IS NULL OR current_shift IN ('Day', 'Night')),
  last_submission TIMESTAMPTZ,
  today_waste NUMERIC(10, 2),
  today_downtime INTEGER,
  sub_machine_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist (for existing installations)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_order TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_shift TEXT CHECK (current_shift IS NULL OR current_shift IN ('Day', 'Night'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_name_unique ON machines(name);

-- Enable RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on machines" ON machines;
CREATE POLICY "Allow all operations on machines" ON machines
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 2. SHIFT SUBMISSIONS (main record)
-- ==========================================

CREATE TABLE IF NOT EXISTS shift_submissions (
  id BIGSERIAL PRIMARY KEY,
  operator_name TEXT NOT NULL,
  machine TEXT NOT NULL,
  sub_machine TEXT,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Day', 'Night')),
  submission_date DATE NOT NULL,
  is_early_submission BOOLEAN DEFAULT FALSE,
  will_changeover BOOLEAN,
  will_maintenance_cleaning BOOLEAN,
  total_waste NUMERIC(10, 2) DEFAULT 0,
  total_downtime INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backwards compatibility columns
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS sub_machine TEXT;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS is_early_submission BOOLEAN DEFAULT FALSE;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS will_changeover BOOLEAN;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS will_maintenance_cleaning BOOLEAN;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS total_waste NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS total_downtime INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shift_submissions_date ON shift_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_operator ON shift_submissions(operator_name);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_machine ON shift_submissions(machine);

-- Enable RLS
ALTER TABLE shift_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on shift_submissions" ON shift_submissions;
CREATE POLICY "Allow all operations on shift_submissions" ON shift_submissions
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 3. WASTE RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS waste_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  waste_amount NUMERIC(10, 2) NOT NULL,
  waste_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waste_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_waste_records_submission ON waste_records(shift_submission_id);

-- Enable RLS
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on waste_records" ON waste_records;
CREATE POLICY "Allow all operations on waste_records" ON waste_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 4. DOWNTIME RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS downtime_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  downtime_minutes INTEGER NOT NULL,
  downtime_reason TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE downtime_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_downtime_records_submission ON downtime_records(shift_submission_id);

-- Enable RLS
ALTER TABLE downtime_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on downtime_records" ON downtime_records;
CREATE POLICY "Allow all operations on downtime_records" ON downtime_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. SPEED RECORDS (Machine Speed - PPM)
-- ==========================================

CREATE TABLE IF NOT EXISTS speed_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  speed_ppm NUMERIC(10, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speed_records_submission ON speed_records(shift_submission_id);

-- Enable RLS
ALTER TABLE speed_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on speed_records" ON speed_records;
CREATE POLICY "Allow all operations on speed_records" ON speed_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 6. SACHET MASS RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS sachet_mass_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  mass_grams NUMERIC(10, 3) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sachet_mass_records_submission ON sachet_mass_records(shift_submission_id);

-- Enable RLS
ALTER TABLE sachet_mass_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on sachet_mass_records" ON sachet_mass_records;
CREATE POLICY "Allow all operations on sachet_mass_records" ON sachet_mass_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. CASES PER HOUR RECORDS (Legacy)
-- ==========================================

CREATE TABLE IF NOT EXISTS cases_per_hour_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  cases_count INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_per_hour_records_submission ON cases_per_hour_records(shift_submission_id);

-- Enable RLS
ALTER TABLE cases_per_hour_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on cases_per_hour_records" ON cases_per_hour_records;
CREATE POLICY "Allow all operations on cases_per_hour_records" ON cases_per_hour_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 8. LOOSE CASES RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS loose_cases_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  cases_count INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loose_cases_submission ON loose_cases_records(shift_submission_id);

-- Enable RLS
ALTER TABLE loose_cases_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on loose_cases_records" ON loose_cases_records;
CREATE POLICY "Allow all operations on loose_cases_records" ON loose_cases_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 9. PALLET SCAN RECORDS
-- ==========================================

CREATE TABLE IF NOT EXISTS pallet_scan_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  pallet_number TEXT NOT NULL,
  cases_count INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallet_scans_submission ON pallet_scan_records(shift_submission_id);
CREATE INDEX IF NOT EXISTS idx_pallet_scans_batch ON pallet_scan_records(batch_number);

-- Prevent duplicate scans within the same submitted shift
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_pallet_scan_per_shift'
  ) THEN
    ALTER TABLE pallet_scan_records
      ADD CONSTRAINT uq_pallet_scan_per_shift UNIQUE (shift_submission_id, qr_code);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE pallet_scan_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on pallet_scan_records" ON pallet_scan_records;
CREATE POLICY "Allow all operations on pallet_scan_records" ON pallet_scan_records
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 10. ORDER DETAILS (Legacy global orders)
-- ==========================================

CREATE TABLE IF NOT EXISTS order_details (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_details_active ON order_details(is_active);

-- Enable RLS
ALTER TABLE order_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on order_details" ON order_details;
CREATE POLICY "Allow all operations on order_details" ON order_details
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 11. MACHINE ORDER QUEUE (per-machine orders with priority)
-- ==========================================

CREATE TABLE IF NOT EXISTS machine_order_queue (
  id BIGSERIAL PRIMARY KEY,
  machine_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_order_queue_machine ON machine_order_queue(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_order_queue_priority ON machine_order_queue(machine_id, priority);
CREATE INDEX IF NOT EXISTS idx_machine_order_queue_active ON machine_order_queue(is_active);

-- Ensure unique priority per machine (no two orders have same priority on same machine)
CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_order_queue_unique_priority
  ON machine_order_queue(machine_id, priority) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE machine_order_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on machine_order_queue" ON machine_order_queue;
CREATE POLICY "Allow all operations on machine_order_queue" ON machine_order_queue
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 12. CHAT MESSAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Message length constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_chat_content_length'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chk_chat_content_length CHECK (char_length(content) <= 500);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_chat_user_name_length'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chk_chat_user_name_length CHECK (char_length(user_name) <= 50);
  END IF;
END $$;

-- Enable RLS (read + insert only, no update/delete)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public chat read" ON chat_messages;
CREATE POLICY "Public chat read" ON chat_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public chat insert" ON chat_messages;
CREATE POLICY "Public chat insert" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 13. SHIFT SESSIONS (locked shift state)
-- ==========================================

CREATE TABLE IF NOT EXISTS shift_sessions (
  id SERIAL PRIMARY KEY,
  machine_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Day', 'Night')),
  session_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(machine_name, shift, session_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_lookup ON shift_sessions(machine_name, shift, session_date);

-- Enable RLS
ALTER TABLE shift_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on shift_sessions" ON shift_sessions;
CREATE POLICY "Allow all operations on shift_sessions" ON shift_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 14. LIVE SESSIONS (real-time sync storage)
-- ==========================================

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  machine_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL,
  session_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT TRUE,
  waste_entries JSONB DEFAULT '[]'::jsonb,
  downtime_entries JSONB DEFAULT '[]'::jsonb,
  speed_entries JSONB DEFAULT '[]'::jsonb,
  sachet_mass_entries JSONB DEFAULT '[]'::jsonb,
  cases_per_hour_entries JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_machine ON live_sessions(machine_name);
CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date);

-- Enable RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on live_sessions" ON live_sessions;
CREATE POLICY "Allow all operations on live_sessions" ON live_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- VIEWS FOR REPORTING
-- ==========================================

-- Daily summary view
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  submission_date,
  machine,
  shift,
  COUNT(*) as submission_count,
  SUM(total_waste) as total_waste_kg,
  SUM(total_downtime) as total_downtime_minutes,
  COUNT(CASE WHEN will_changeover THEN 1 END) as changeover_count,
  COUNT(CASE WHEN will_maintenance_cleaning THEN 1 END) as maintenance_count
FROM shift_submissions
GROUP BY submission_date, machine, shift
ORDER BY submission_date DESC, machine, shift;

-- Machine performance view
CREATE OR REPLACE VIEW machine_performance AS
SELECT
  s.machine,
  s.submission_date,
  s.shift,
  s.total_waste,
  s.total_downtime,
  COALESCE(AVG(sp.speed_ppm), 0) as avg_speed_ppm,
  COALESCE(AVG(sm.mass_grams), 0) as avg_sachet_mass,
  COALESCE(SUM(cph.cases_count), 0) as total_cases
FROM shift_submissions s
LEFT JOIN speed_records sp ON s.id = sp.shift_submission_id
LEFT JOIN sachet_mass_records sm ON s.id = sm.shift_submission_id
LEFT JOIN cases_per_hour_records cph ON s.id = cph.shift_submission_id
GROUP BY s.id, s.machine, s.submission_date, s.shift, s.total_waste, s.total_downtime
ORDER BY s.submission_date DESC, s.machine;

-- ==========================================
-- TRIGGER FUNCTIONS
-- ==========================================

-- Function to update shift submission waste totals
CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shift_submissions
  SET total_waste = (
    SELECT COALESCE(SUM(waste_amount), 0)
    FROM waste_records
    WHERE shift_submission_id = COALESCE(NEW.shift_submission_id, OLD.shift_submission_id)
  )
  WHERE id = COALESCE(NEW.shift_submission_id, OLD.shift_submission_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_waste_totals ON waste_records;
CREATE TRIGGER trigger_update_waste_totals
AFTER INSERT OR UPDATE OR DELETE ON waste_records
FOR EACH ROW
EXECUTE FUNCTION update_shift_totals();

-- Function to update downtime totals
CREATE OR REPLACE FUNCTION update_downtime_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shift_submissions
  SET total_downtime = (
    SELECT COALESCE(SUM(downtime_minutes), 0)
    FROM downtime_records
    WHERE shift_submission_id = COALESCE(NEW.shift_submission_id, OLD.shift_submission_id)
  )
  WHERE id = COALESCE(NEW.shift_submission_id, OLD.shift_submission_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_downtime_totals ON downtime_records;
CREATE TRIGGER trigger_update_downtime_totals
AFTER INSERT OR UPDATE OR DELETE ON downtime_records
FOR EACH ROW
EXECUTE FUNCTION update_downtime_totals();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_order_details_updated_at ON order_details;
CREATE TRIGGER update_order_details_updated_at
  BEFORE UPDATE ON order_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_machine_order_queue_updated_at ON machine_order_queue;
CREATE TRIGGER update_machine_order_queue_updated_at
  BEFORE UPDATE ON machine_order_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old chat messages (keeps last 1000)
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

-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- ==========================================
-- Enable these for real-time functionality.
-- Run each line individually if needed.

ALTER PUBLICATION supabase_realtime ADD TABLE machines;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- Optional: Enable for other tables if needed
-- ALTER PUBLICATION supabase_realtime ADD TABLE shift_submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE machine_order_queue;

-- ==========================================
-- TABLE COMMENTS
-- ==========================================

COMMENT ON TABLE machines IS 'Machine configurations and real-time status';
COMMENT ON TABLE shift_submissions IS 'Main table for shift data submissions';
COMMENT ON TABLE waste_records IS 'Individual waste entries linked to shift submissions';
COMMENT ON TABLE downtime_records IS 'Individual downtime entries linked to shift submissions';
COMMENT ON TABLE speed_records IS 'Machine speed recordings (PPM) during the shift';
COMMENT ON TABLE sachet_mass_records IS 'Sachet mass measurements in grams';
COMMENT ON TABLE cases_per_hour_records IS 'Hourly case production counts (legacy)';
COMMENT ON TABLE loose_cases_records IS 'Cases not part of full pallets';
COMMENT ON TABLE pallet_scan_records IS 'QR code pallet scans with batch/pallet/cases info';
COMMENT ON TABLE order_details IS 'Global order information (legacy - use machine_order_queue)';
COMMENT ON TABLE machine_order_queue IS 'Per-machine order queues with priority ordering';
COMMENT ON TABLE chat_messages IS 'Team chat messages for real-time communication';
COMMENT ON TABLE shift_sessions IS 'Locked shift session state';
COMMENT ON TABLE live_sessions IS 'Real-time session sync storage (JSON entries)';

-- ==========================================
-- ACTIVE SESSIONS (for session locking)
-- Added: 2026-01-20
-- ==========================================

CREATE TABLE IF NOT EXISTS active_sessions (
  id BIGSERIAL PRIMARY KEY,
  machine_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Day', 'Night')),
  session_date DATE NOT NULL,
  browser_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate sessions per browser
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions_unique
  ON active_sessions(machine_name, shift, session_date, browser_id);

-- Index for quick lookup of active sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_lookup
  ON active_sessions(machine_name, shift, session_date, is_active);

-- Index for heartbeat cleanup
CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat
  ON active_sessions(last_heartbeat) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on active_sessions" ON active_sessions;
CREATE POLICY "Allow all operations on active_sessions" ON active_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Add production_timer column to live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS production_timer JSONB;

COMMENT ON TABLE active_sessions IS 'Session locking to prevent concurrent edits on same machine/shift';
COMMENT ON COLUMN active_sessions.browser_id IS 'Unique identifier per browser tab/session';
COMMENT ON COLUMN active_sessions.last_heartbeat IS 'Updated periodically to detect stale sessions';
COMMENT ON COLUMN live_sessions.production_timer IS 'Persistent production timer state (JSON)';

-- Enable realtime for active_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE active_sessions;

-- ==========================================
-- FACILITY SETTINGS TABLE
-- Added: 2026-01-20
-- ==========================================

CREATE TABLE IF NOT EXISTS facility_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Enable RLS
ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on facility_settings" ON facility_settings;
CREATE POLICY "Allow all operations on facility_settings" ON facility_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO facility_settings (setting_key, setting_value, description) VALUES
  ('shift_config', '{"dayShiftStart": 6, "dayShiftEnd": 18, "timezoneOffset": 2, "submissionWindowMinutes": 15}', 'Shift timing configuration'),
  ('facility_info', '{"name": "Production Facility", "location": "South Africa"}', 'Facility information')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE facility_settings IS 'Configurable facility-wide settings';
