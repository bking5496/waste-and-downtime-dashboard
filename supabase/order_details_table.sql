-- Create order_details table for storing admin-set order information
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS order_details (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL,
  product TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on is_active for faster queries
CREATE INDEX IF NOT EXISTS idx_order_details_is_active ON order_details(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE order_details ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on order_details" ON order_details
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_order_details_updated_at
  BEFORE UPDATE ON order_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
