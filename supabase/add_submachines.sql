-- ============================================
-- ADD SUBMACHINE ROWS TO MACHINES TABLE
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add parent_machine_id column to track submachine relationships
ALTER TABLE machines ADD COLUMN IF NOT EXISTS parent_machine_id TEXT REFERENCES machines(id);

-- 2. Add current_order and current_shift columns if missing
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_order TEXT;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_shift TEXT;

-- 3. Function to generate submachine rows for a parent machine
CREATE OR REPLACE FUNCTION generate_submachines(
  parent_id TEXT,
  parent_name TEXT,
  sub_count INTEGER
) RETURNS void AS $$
DECLARE
  i INTEGER;
  sub_id TEXT;
  sub_name TEXT;
BEGIN
  FOR i IN 1..sub_count LOOP
    sub_id := parent_id || '-sub-' || i;
    sub_name := parent_name || ' - Machine ' || i;

    -- Insert if doesn't exist
    INSERT INTO machines (id, name, status, parent_machine_id, created_at, updated_at)
    VALUES (sub_id, sub_name, 'idle', parent_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Generate submachines for all parent machines that have sub_machine_count > 0
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, name, sub_machine_count
    FROM machines
    WHERE sub_machine_count IS NOT NULL
      AND sub_machine_count > 0
      AND parent_machine_id IS NULL  -- Only process parent machines
  LOOP
    PERFORM generate_submachines(rec.id, rec.name, rec.sub_machine_count);
    RAISE NOTICE 'Generated % submachines for %', rec.sub_machine_count, rec.name;
  END LOOP;
END $$;

-- 5. Verify the submachines were created
SELECT id, name, status, parent_machine_id, current_operator, current_order
FROM machines
ORDER BY
  CASE WHEN parent_machine_id IS NULL THEN 0 ELSE 1 END,
  parent_machine_id NULLS FIRST,
  name;

-- ============================================
-- IMPORTANT: After running this, update the app code to:
-- 1. Use submachine ID instead of parent ID when locking
-- 2. Query submachines for status display
-- ============================================
