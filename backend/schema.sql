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

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  email TEXT,
  pin TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'clocked_out',
  last_clockin TIMESTAMPTZ,
  last_clockout TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Time entries table (clock-in / clock-out)
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  clockin_time TIMESTAMPTZ NOT NULL,
  clockout_time TIMESTAMPTZ,
  total_hours NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 1,
  quantity_available INTEGER NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'good',
  purchase_price NUMERIC,
  estimated_value NUMERIC,
  sku TEXT UNIQUE,
  notes TEXT,
  image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project inventory assignments
CREATE TABLE IF NOT EXISTS project_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  rate NUMERIC,
  rate_type TEXT DEFAULT 'flat',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project vendor assignments
CREATE TABLE IF NOT EXISTS project_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  service_date DATE,
  cost NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schedule days table
CREATE TABLE IF NOT EXISTS schedule_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_type TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TEXT DEFAULT '08:00',
  end_time TEXT DEFAULT '17:00',
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  week_start DATE,
  created_at TIMESTAMPTZ DEFAULT now()
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
