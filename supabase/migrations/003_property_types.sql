-- Migration: Flexible Property Types
-- Safe to run multiple times (idempotent)

-- ==================== PROPERTY_TYPES TABLE ====================
CREATE TABLE IF NOT EXISTS property_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_property_types_updated_at ON property_types;
CREATE TRIGGER trigger_property_types_updated_at
BEFORE UPDATE ON property_types
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Unique: default type names are globally unique; custom types unique per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_types_default_name
  ON property_types(name) WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_types_owner_name
  ON property_types(owner_id, name) WHERE is_default = false AND owner_id IS NOT NULL;

-- ==================== RLS ====================
ALTER TABLE property_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_types_select" ON property_types;
CREATE POLICY "property_types_select" ON property_types
  FOR SELECT USING (is_default = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "property_types_insert" ON property_types;
CREATE POLICY "property_types_insert" ON property_types
  FOR INSERT WITH CHECK (is_default = false AND owner_id = auth.uid());

DROP POLICY IF EXISTS "property_types_update" ON property_types;
CREATE POLICY "property_types_update" ON property_types
  FOR UPDATE USING (is_default = false AND owner_id = auth.uid());

DROP POLICY IF EXISTS "property_types_delete" ON property_types;
CREATE POLICY "property_types_delete" ON property_types
  FOR DELETE USING (is_default = false AND owner_id = auth.uid());

-- ==================== SEED DEFAULT TYPES ====================
INSERT INTO property_types (name, is_default) VALUES
  ('Market', true),
  ('Shopping Complex', true),
  ('Shop', true),
  ('Apartment', true),
  ('House', true),
  ('Building', true),
  ('Office Space', true),
  ('Commercial Space', true),
  ('Warehouse', true),
  ('Land', true),
  ('Garage', true),
  ('Parking Space', true),
  ('Vehicle', true),
  ('Car', true),
  ('Microbus', true),
  ('Truck', true),
  ('Motorcycle', true),
  ('Equipment', true),
  ('Machinery', true),
  ('Farm', true),
  ('Storage Unit', true),
  ('Hall / Community Centre', true),
  ('Other', true)
ON CONFLICT DO NOTHING;

-- ==================== ALTER PROPERTIES TABLE ====================
-- Step 1: Remove the old restrictive CHECK constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check;

-- Step 2: Add property_type column (free text, no check constraint)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type TEXT;

-- Step 3: Migrate existing data from 'type' column → 'property_type' (capitalize)
UPDATE properties
SET property_type = CASE type
  WHEN 'market'    THEN 'Market'
  WHEN 'apartment' THEN 'Apartment'
  WHEN 'vehicle'   THEN 'Vehicle'
  ELSE initcap(type)
END
WHERE property_type IS NULL;

-- Step 4: Set NOT NULL now that data is migrated
-- (only if all rows have property_type filled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM properties WHERE property_type IS NULL) THEN
    ALTER TABLE properties ALTER COLUMN property_type SET NOT NULL;
  END IF;
END $$;

-- Note: The old 'type' column is kept for backward compatibility.
-- The application now reads/writes 'property_type'.
-- You can drop 'type' column after confirming everything works:
-- ALTER TABLE properties DROP COLUMN type;
