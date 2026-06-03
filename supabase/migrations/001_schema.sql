-- Property360 Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PROFILES ====================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PROPERTIES ====================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('market', 'apartment', 'vehicle')),
  address TEXT,
  description TEXT,
  ownership_details TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MARKETS ====================
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  total_shops INTEGER DEFAULT 0,
  manager_name TEXT,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SHOPS ====================
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  shop_number TEXT NOT NULL,
  size TEXT,
  business_type TEXT,
  monthly_rent NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TENANTS ====================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nid_passport TEXT,
  address TEXT,
  emergency_contact TEXT,
  business_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== APARTMENTS ====================
CREATE TABLE apartments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_number TEXT,
  address TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  floor_area NUMERIC(10,2),
  service_charge NUMERIC(12,2) DEFAULT 0,
  utility_included BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== VEHICLES ====================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  registration_number TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  driver_name TEXT,
  driver_phone TEXT,
  insurance_expiry DATE,
  fitness_expiry DATE,
  tax_token_expiry DATE,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RENTAL AGREEMENTS ====================
CREATE TABLE rental_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('shop', 'apartment', 'vehicle')),
  asset_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_rent NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12,2) DEFAULT 0,
  monthly_deduction NUMERIC(12,2) DEFAULT 0,
  monthly_cash_payable NUMERIC(12,2) GENERATED ALWAYS AS (monthly_rent - COALESCE(monthly_deduction, 0)) STORED,
  deduction_start_month INTEGER CHECK (deduction_start_month BETWEEN 1 AND 12),
  deduction_start_year INTEGER,
  deduction_end_date DATE,
  total_deducted NUMERIC(12,2) DEFAULT 0,
  deposit_balance NUMERIC(12,2) GENERATED ALWAYS AS (deposit_amount - COALESCE(total_deducted, 0)) STORED,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RENT PAYMENTS ====================
CREATE TABLE rent_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES rental_agreements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  asset_type TEXT NOT NULL,
  asset_id UUID NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  monthly_rent NUMERIC(12,2) NOT NULL,
  deduction_amount NUMERIC(12,2) DEFAULT 0,
  cash_payable NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  due_amount NUMERIC(12,2) GENERATED ALWAYS AS (cash_payable - COALESCE(paid_amount, 0)) STORED,
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'mobile_banking', 'cheque', NULL)),
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== EXPENSES ====================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_type TEXT CHECK (asset_type IN ('market', 'shop', 'apartment', 'vehicle', 'general')),
  asset_id UUID,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  paid_to TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'mobile_banking', 'cheque')),
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== STAFF ====================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL,
  assigned_property_id UUID,
  assigned_property_type TEXT,
  monthly_salary NUMERIC(12,2) DEFAULT 0,
  start_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== STAFF SALARY PAYMENTS ====================
CREATE TABLE staff_salary_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'mobile_banking', 'cheque')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== DOCUMENTS ====================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  related_id UUID NOT NULL,
  related_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX idx_shops_market_id ON shops(market_id);
CREATE INDEX idx_shops_status ON shops(status);
CREATE INDEX idx_rental_agreements_tenant_id ON rental_agreements(tenant_id);
CREATE INDEX idx_rental_agreements_status ON rental_agreements(status);
CREATE INDEX idx_rent_payments_agreement_id ON rent_payments(agreement_id);
CREATE INDEX idx_rent_payments_month_year ON rent_payments(month, year);
CREATE INDEX idx_expenses_owner_date ON expenses(owner_id, expense_date);
CREATE INDEX idx_notifications_owner_read ON notifications(owner_id, is_read);

-- ==================== FUNCTIONS ====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_markets_updated_at BEFORE UPDATE ON markets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_apartments_updated_at BEFORE UPDATE ON apartments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_agreements_updated_at BEFORE UPDATE ON rental_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: auto-update deduction_end_date on rental_agreements
CREATE OR REPLACE FUNCTION calc_deduction_end_date()
RETURNS TRIGGER AS $$
DECLARE
  months_to_finish INTEGER;
  start_date DATE;
BEGIN
  IF NEW.monthly_deduction > 0 AND NEW.deposit_amount > 0 AND NEW.deduction_start_month IS NOT NULL AND NEW.deduction_start_year IS NOT NULL THEN
    months_to_finish := CEIL(NEW.deposit_amount / NEW.monthly_deduction);
    start_date := MAKE_DATE(NEW.deduction_start_year, NEW.deduction_start_month, 1);
    NEW.deduction_end_date := start_date + (months_to_finish || ' months')::INTERVAL;
  ELSE
    NEW.deduction_end_date := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calc_deduction_end_date
BEFORE INSERT OR UPDATE ON rental_agreements
FOR EACH ROW EXECUTE FUNCTION calc_deduction_end_date();

-- Function: handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Owner sees all their data (admin role)
CREATE POLICY "properties_owner" ON properties FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "markets_owner" ON markets FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "shops_owner" ON shops FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "tenants_owner" ON tenants FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "apartments_owner" ON apartments FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "vehicles_owner" ON vehicles FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "agreements_owner" ON rental_agreements FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "rent_payments_owner" ON rent_payments FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "expenses_owner" ON expenses FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "staff_owner" ON staff FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "salary_payments_owner" ON staff_salary_payments FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "notifications_owner" ON notifications FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "documents_owner" ON documents FOR ALL USING (owner_id = auth.uid());
