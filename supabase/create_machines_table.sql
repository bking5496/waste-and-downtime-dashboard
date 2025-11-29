-- Create machines table for syncing across devices
-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/inmrzpmuzwcltionxzcl/sql/new

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'idle', 'maintenance')),
  current_operator TEXT,
  last_submission TEXT,
  today_waste NUMERIC,
  today_downtime NUMERIC,
  sub_machine_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for anonymous users
-- (In production, you'd want more restrictive policies)
CREATE POLICY "Allow all access to machines" ON machines
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for the machines table
ALTER PUBLICATION supabase_realtime ADD TABLE machines;

-- Insert default machines if the table is empty
INSERT INTO machines (id, name, status, sub_machine_count)
SELECT * FROM (VALUES
  ('machine-1', 'Rofin 1', 'idle', NULL),
  ('machine-2', 'Rofin 2', 'idle', NULL),
  ('machine-3', 'Universal 1', 'idle', NULL),
  ('machine-4', 'Universal 2', 'idle', 4),
  ('machine-5', 'K300', 'idle', NULL),
  ('machine-6', 'Sisma', 'idle', NULL),
  ('machine-7', 'Trumpf', 'idle', NULL),
  ('machine-8', 'Haas ST10', 'idle', NULL),
  ('machine-9', 'Haas VF2', 'idle', NULL),
  ('machine-10', 'Wire Cut', 'idle', NULL)
) AS default_machines(id, name, status, sub_machine_count)
WHERE NOT EXISTS (SELECT 1 FROM machines LIMIT 1);
