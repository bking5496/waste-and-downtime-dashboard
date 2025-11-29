-- Supabase SQL Schema for Waste and Downtime Dashboard
-- Run this in your Supabase SQL Editor to create the required tables

-- Enable Row Level Security (RLS) for production use
-- For now, we'll keep it simple without RLS

-- Create shift_submissions table
CREATE TABLE IF NOT EXISTS shift_submissions (
  id BIGSERIAL PRIMARY KEY,
  operator_name VARCHAR(255) NOT NULL,
  machine VARCHAR(255) NOT NULL,
  order_number VARCHAR(255) NOT NULL,
  product VARCHAR(255) NOT NULL,
  batch_number VARCHAR(255) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  submission_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create waste_records table
CREATE TABLE IF NOT EXISTS waste_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  waste_amount DECIMAL(10, 2) NOT NULL,
  waste_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create downtime_records table
CREATE TABLE IF NOT EXISTS downtime_records (
  id BIGSERIAL PRIMARY KEY,
  shift_submission_id BIGINT REFERENCES shift_submissions(id) ON DELETE CASCADE,
  downtime_minutes INTEGER NOT NULL,
  downtime_reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shift_submissions_date ON shift_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_operator ON shift_submissions(operator_name);
CREATE INDEX IF NOT EXISTS idx_shift_submissions_machine ON shift_submissions(machine);
CREATE INDEX IF NOT EXISTS idx_waste_records_submission ON waste_records(shift_submission_id);
CREATE INDEX IF NOT EXISTS idx_downtime_records_submission ON downtime_records(shift_submission_id);

-- Enable realtime for all tables (optional, for live updates)
-- ALTER PUBLICATION supabase_realtime ADD TABLE shift_submissions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE waste_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE downtime_records;
