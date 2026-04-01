-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  property_address TEXT,
  contract_price NUMERIC,
  staging_date DATE,
  final_day_of_service DATE,
  sqft INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  payment_method TEXT DEFAULT 'zelle',
  contract_status TEXT DEFAULT 'draft',
  invoice_status TEXT DEFAULT 'draft',
  project_status TEXT DEFAULT 'active',
  docusign_status TEXT DEFAULT 'not_sent',
  approval_status TEXT DEFAULT 'pending',
  followup_status TEXT DEFAULT 'none',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Approval queue table
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
