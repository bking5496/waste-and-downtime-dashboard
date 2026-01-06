-- Supabase SQL Schema for Waste and Downtime Dashboard
-- Run this in your Supabase SQL Editor.
-- This file is kept in sync with the client writes in src/lib/supabase.ts.

-- Notes on security:
-- - The app uses the browser (anon) key, so your primary protection should be RLS.
-- - If you do not enable RLS (or if you enable it with permissive policies), anyone with your site URL can read/write.

-- ==========================================
-- SHIFT SUBMISSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS shift_submissions (
  id BIGSERIAL PRIMARY KEY,
  operator_name TEXT NOT NULL,
  machine TEXT NOT NULL,
  sub_machine TEXT,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  shift TEXT NOT NULL,
  submission_date DATE NOT NULL,
  is_early_submission BOOLEAN DEFAULT FALSE,
  will_changeover BOOLEAN,
  will_maintenance_cleaning BOOLEAN,
  total_waste NUMERIC(10, 2) DEFAULT 0,
  total_downtime INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backwards/forwards compatibility (safe to run repeatedly)
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS sub_machine TEXT;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS is_early_submission BOOLEAN DEFAULT FALSE;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS will_changeover BOOLEAN;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS will_maintenance_cleaning BOOLEAN;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS total_waste NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE shift_submissions ADD COLUMN IF NOT EXISTS total_downtime INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shift_submissions_date ON shift_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_operator ON shift_submissions(operator_name);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_machine ON shift_submissions(machine);

-- ==========================================
-- WASTE / DOWNTIME
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

CREATE TABLE IF NOT EXISTS downtime_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  downtime_minutes INTEGER NOT NULL,
  downtime_reason TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE downtime_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_waste_records_submission ON waste_records(shift_submission_id);
CREATE INDEX IF NOT EXISTS idx_downtime_records_submission ON downtime_records(shift_submission_id);

-- ==========================================
-- OPTIONAL: SPEED + SACHET MASS
-- ==========================================

CREATE TABLE IF NOT EXISTS speed_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  speed_ppm NUMERIC(10, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sachet_mass_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  mass_grams NUMERIC(10, 3) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LEGACY: CASES PER HOUR (optional)
-- ==========================================

CREATE TABLE IF NOT EXISTS cases_per_hour_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  cases_count INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PRODUCT CONFIRMATION: LOOSE CASES + PALLET SCANS
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
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_pallet_scan_per_shift'
  ) THEN
    ALTER TABLE pallet_scan_records
      ADD CONSTRAINT uq_pallet_scan_per_shift UNIQUE (shift_submission_id, qr_code);
  END IF;
END $$;

-- ==========================================
-- MACHINES (used for realtime + dashboard state)
-- ==========================================

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'idle', 'maintenance')),
  current_operator TEXT,
  last_submission TIMESTAMPTZ,
  today_waste NUMERIC(10, 2),
  today_downtime INTEGER,
  sub_machine_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_name_unique ON machines(name);

-- ==========================================
-- REALTIME (optional)
-- ==========================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE machines;
-- ALTER PUBLICATION supabase_realtime ADD TABLE shift_submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE waste_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE downtime_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE loose_cases_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE pallet_scan_records;
