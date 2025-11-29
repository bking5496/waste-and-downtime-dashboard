-- ============================================
-- WASTE AND DOWNTIME DASHBOARD - DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. MACHINES TABLE (if not already created)
-- ============================================
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('running', 'idle', 'maintenance')),
  current_operator TEXT,
  last_submission TIMESTAMP WITH TIME ZONE,
  today_waste DECIMAL(10, 2) DEFAULT 0,
  today_downtime INTEGER DEFAULT 0,
  sub_machine_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth needs)
CREATE POLICY IF NOT EXISTS "Allow all operations on machines" ON machines
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 2. SHIFT SUBMISSIONS TABLE (main record)
-- ============================================
CREATE TABLE IF NOT EXISTS shift_submissions (
  id SERIAL PRIMARY KEY,
  operator_name TEXT NOT NULL,
  machine TEXT NOT NULL,
  sub_machine TEXT, -- For sub-machine selection (e.g., "Universal 2 - Machine 1")
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Day', 'Night')),
  submission_date DATE NOT NULL,
  
  -- Changeover information (captured when submitting outside window)
  is_early_submission BOOLEAN DEFAULT FALSE,
  will_changeover BOOLEAN,
  will_maintenance_cleaning BOOLEAN,
  
  -- Totals
  total_waste DECIMAL(10, 2) DEFAULT 0,
  total_downtime INTEGER DEFAULT 0, -- in minutes
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shift_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on shift_submissions" ON shift_submissions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_shift_submissions_date ON shift_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_machine ON shift_submissions(machine);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_operator ON shift_submissions(operator_name);

-- ============================================
-- 3. WASTE RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS waste_records (
  id SERIAL PRIMARY KEY,
  shift_submission_id INTEGER NOT NULL REFERENCES shift_submissions(id) ON DELETE CASCADE,
  waste_amount DECIMAL(10, 2) NOT NULL, -- in kg
  waste_type TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on waste_records" ON waste_records
  FOR ALL USING (true) WITH CHECK (true);

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_waste_records_submission ON waste_records(shift_submission_id);

-- ============================================
-- 4. DOWNTIME RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS downtime_records (
  id SERIAL PRIMARY KEY,
  shift_submission_id INTEGER NOT NULL REFERENCES shift_submissions(id) ON DELETE CASCADE,
  downtime_minutes INTEGER NOT NULL,
  downtime_reason TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE downtime_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on downtime_records" ON downtime_records
  FOR ALL USING (true) WITH CHECK (true);

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_downtime_records_submission ON downtime_records(shift_submission_id);

-- ============================================
-- 5. SPEED RECORDS TABLE (Machine Speed - PPM)
-- ============================================
CREATE TABLE IF NOT EXISTS speed_records (
  id SERIAL PRIMARY KEY,
  shift_submission_id INTEGER NOT NULL REFERENCES shift_submissions(id) ON DELETE CASCADE,
  speed_ppm INTEGER NOT NULL, -- Packs Per Minute
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE speed_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on speed_records" ON speed_records
  FOR ALL USING (true) WITH CHECK (true);

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_speed_records_submission ON speed_records(shift_submission_id);

-- ============================================
-- 6. SACHET MASS RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sachet_mass_records (
  id SERIAL PRIMARY KEY,
  shift_submission_id INTEGER NOT NULL REFERENCES shift_submissions(id) ON DELETE CASCADE,
  mass_grams DECIMAL(8, 2) NOT NULL, -- in grams
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sachet_mass_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on sachet_mass_records" ON sachet_mass_records
  FOR ALL USING (true) WITH CHECK (true);

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_sachet_mass_records_submission ON sachet_mass_records(shift_submission_id);

-- ============================================
-- 7. CASES PER HOUR RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cases_per_hour_records (
  id SERIAL PRIMARY KEY,
  shift_submission_id INTEGER NOT NULL REFERENCES shift_submissions(id) ON DELETE CASCADE,
  cases_count INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23), -- 0-23
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cases_per_hour_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on cases_per_hour_records" ON cases_per_hour_records
  FOR ALL USING (true) WITH CHECK (true);

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_cases_per_hour_records_submission ON cases_per_hour_records(shift_submission_id);

-- ============================================
-- 8. SHIFT SESSIONS TABLE (for persisting locked shift details)
-- ============================================
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one session per machine per shift per day
  UNIQUE(machine_name, shift, session_date)
);

-- Enable RLS
ALTER TABLE shift_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on shift_sessions" ON shift_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_shift_sessions_lookup ON shift_sessions(machine_name, shift, session_date);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

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

-- ============================================
-- FUNCTIONS FOR UPDATING TOTALS
-- ============================================

-- Function to update shift submission totals
CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total waste
  UPDATE shift_submissions
  SET total_waste = (
    SELECT COALESCE(SUM(waste_amount), 0)
    FROM waste_records
    WHERE shift_submission_id = NEW.shift_submission_id
  )
  WHERE id = NEW.shift_submission_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for waste records
DROP TRIGGER IF EXISTS trigger_update_waste_totals ON waste_records;
CREATE TRIGGER trigger_update_waste_totals
AFTER INSERT OR UPDATE OR DELETE ON waste_records
FOR EACH ROW
EXECUTE FUNCTION update_shift_totals();

-- Function to update downtime totals
CREATE OR REPLACE FUNCTION update_downtime_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total downtime
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

-- Trigger for downtime records
DROP TRIGGER IF EXISTS trigger_update_downtime_totals ON downtime_records;
CREATE TRIGGER trigger_update_downtime_totals
AFTER INSERT OR UPDATE OR DELETE ON downtime_records
FOR EACH ROW
EXECUTE FUNCTION update_downtime_totals();

-- ============================================
-- ENABLE REALTIME (optional but recommended)
-- ============================================
-- Run these in Supabase Dashboard > Database > Replication
-- Or uncomment and run here:

-- ALTER PUBLICATION supabase_realtime ADD TABLE machines;
-- ALTER PUBLICATION supabase_realtime ADD TABLE shift_submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE waste_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE downtime_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE speed_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE sachet_mass_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE cases_per_hour_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- ============================================
-- LIVE SESSIONS TABLE (for real-time sync across devices)
-- ============================================
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY, -- Format: machine_shift_date (e.g., "machine-a_Day_2025-11-27")
  machine_name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL,
  session_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT TRUE,
  
  -- JSON storage for entries (for real-time sync)
  waste_entries JSONB DEFAULT '[]'::jsonb,
  downtime_entries JSONB DEFAULT '[]'::jsonb,
  speed_entries JSONB DEFAULT '[]'::jsonb,
  sachet_mass_entries JSONB DEFAULT '[]'::jsonb,
  cases_per_hour_entries JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on live_sessions" ON live_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_machine ON live_sessions(machine_name);
CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date);

-- Enable realtime for live_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample data

/*
INSERT INTO machines (id, name, status) VALUES
  ('machine-a', 'Machine A', 'running'),
  ('machine-b', 'Machine B', 'idle'),
  ('machine-c', 'Machine C', 'running'),
  ('machine-d', 'Machine D', 'maintenance');
*/

COMMENT ON TABLE shift_submissions IS 'Main table for shift data submissions';
COMMENT ON TABLE waste_records IS 'Individual waste entries linked to shift submissions';
COMMENT ON TABLE downtime_records IS 'Individual downtime entries linked to shift submissions';
COMMENT ON TABLE speed_records IS 'Machine speed recordings (PPM) during the shift';
COMMENT ON TABLE sachet_mass_records IS 'Sachet mass measurements in grams';
COMMENT ON TABLE cases_per_hour_records IS 'Hourly case production counts';
COMMENT ON TABLE shift_sessions IS 'Locked shift details that persist throughout a shift';
