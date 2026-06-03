-- Property360 Seed Data
-- Run after creating the schema
-- Replace 'YOUR_USER_ID' with your actual Supabase Auth user ID

DO $$
DECLARE
  v_owner_id UUID;
  v_market_id UUID;
  v_tenant_ids UUID[] := ARRAY[]::UUID[];
  v_apt_id UUID;
  v_car_id UUID;
  v_staff_id UUID;
  v_agreement_id UUID;
  i INTEGER;
  shop_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get first admin user (run after creating your account)
  SELECT id INTO v_owner_id FROM profiles WHERE role = 'admin' LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No admin user found. Please create an account first, then re-run seed.';
    RETURN;
  END IF;

  -- ===== MARKET =====
  INSERT INTO markets (owner_id, name, address, total_shops, manager_name, status)
  VALUES (v_owner_id, 'Central Trade Market', '45 Commerce Street, Dhaka', 25, 'Rahim Uddin', 'active')
  RETURNING id INTO v_market_id;

  -- ===== SHOPS (25) =====
  FOR i IN 1..25 LOOP
    DECLARE
      new_shop_id UUID;
    BEGIN
      INSERT INTO shops (owner_id, market_id, shop_number, size, business_type, monthly_rent, status)
      VALUES (
        v_owner_id,
        v_market_id,
        'S-' || LPAD(i::TEXT, 2, '0'),
        CASE WHEN i % 3 = 0 THEN 'Large' WHEN i % 3 = 1 THEN 'Medium' ELSE 'Small' END,
        CASE
          WHEN i % 5 = 0 THEN 'Electronics'
          WHEN i % 5 = 1 THEN 'Clothing'
          WHEN i % 5 = 2 THEN 'Food & Beverage'
          WHEN i % 5 = 3 THEN 'Hardware'
          ELSE 'General Store'
        END,
        CASE WHEN i % 3 = 0 THEN 8000 WHEN i % 3 = 1 THEN 6000 ELSE 5000 END,
        CASE WHEN i <= 10 THEN 'occupied' WHEN i > 22 THEN 'inactive' ELSE 'vacant' END
      )
      RETURNING id INTO new_shop_id;
      shop_ids := array_append(shop_ids, new_shop_id);
    END;
  END LOOP;

  -- ===== TENANTS (10) =====
  DECLARE
    tenant_names TEXT[] := ARRAY['Ahmed Ali', 'Bashir Khan', 'Chowdhury Rahman', 'Delwar Hossain', 'Ekram Uddin', 'Faruk Islam', 'Gias Uddin', 'Habib Ullah', 'Ibrahim Chowdhury', 'Jalal Ahmed'];
    tenant_phones TEXT[] := ARRAY['01711-111111', '01722-222222', '01733-333333', '01744-444444', '01755-555555', '01766-666666', '01777-777777', '01788-888888', '01799-999999', '01800-000000'];
    business_names TEXT[] := ARRAY['Ali Electronics', 'Khan Fashion', 'Chowdhury Hardware', 'Delwar Grocery', 'Ekram Pharma', 'Faruk Clothing', 'Gias Mobile', 'Habib Shoes', 'Ibrahim Foods', 'Jalal General'];
    new_tenant_id UUID;
  BEGIN
    FOR i IN 1..10 LOOP
      INSERT INTO tenants (owner_id, full_name, phone, email, business_name, address, status)
      VALUES (
        v_owner_id,
        tenant_names[i],
        tenant_phones[i],
        lower(replace(tenant_names[i], ' ', '.')) || '@example.com',
        business_names[i],
        'Shop ' || i || ', Central Trade Market, Dhaka',
        'active'
      )
      RETURNING id INTO new_tenant_id;
      tenant_ids := array_append(tenant_ids, new_tenant_id);
    END LOOP;
  END;

  -- ===== APARTMENT =====
  INSERT INTO apartments (owner_id, name, unit_number, address, bedrooms, bathrooms, service_charge, status)
  VALUES (v_owner_id, 'Green Valley Residence', 'A-301', '12 Green Road, Dhanmondi, Dhaka', 3, 2, 2000, 'occupied')
  RETURNING id INTO v_apt_id;

  -- ===== VEHICLE =====
  INSERT INTO vehicles (owner_id, name, registration_number, make, model, year, driver_name, driver_phone, status)
  VALUES (v_owner_id, 'Office Car', 'DHAKA-GA-11-5544', 'Toyota', 'Noah', 2020, 'Karim Driver', '01900-123456', 'rented')
  RETURNING id INTO v_car_id;

  -- ===== STAFF =====
  INSERT INTO staff (owner_id, name, phone, role, monthly_salary, start_date, status)
  VALUES (v_owner_id, 'Rahim Uddin', '01811-234567', 'Market Manager', 25000, '2023-01-01', 'active')
  RETURNING id INTO v_staff_id;

  -- ===== RENTAL AGREEMENTS for 10 shops =====
  FOR i IN 1..10 LOOP
    INSERT INTO rental_agreements (
      owner_id, tenant_id, asset_type, asset_id,
      start_date, monthly_rent, deposit_amount, monthly_deduction,
      deduction_start_month, deduction_start_year, status
    )
    VALUES (
      v_owner_id, tenant_ids[i], 'shop', shop_ids[i],
      '2024-01-01',
      CASE WHEN i % 3 = 0 THEN 8000 WHEN i % 3 = 1 THEN 6000 ELSE 5000 END,
      CASE WHEN i % 2 = 0 THEN 50000 ELSE 0 END,
      CASE WHEN i % 2 = 0 THEN 2000 ELSE 0 END,
      CASE WHEN i % 2 = 0 THEN 1 ELSE NULL END,
      CASE WHEN i % 2 = 0 THEN 2024 ELSE NULL END,
      'active'
    )
    RETURNING id INTO v_agreement_id;

    -- Generate 3 months of rent payments for each agreement
    FOR m IN 1..3 LOOP
      DECLARE
        v_rent NUMERIC;
        v_deduction NUMERIC;
        v_payable NUMERIC;
      BEGIN
        SELECT monthly_rent, monthly_deduction, monthly_cash_payable
        INTO v_rent, v_deduction, v_payable
        FROM rental_agreements WHERE id = v_agreement_id;

        INSERT INTO rent_payments (
          owner_id, agreement_id, tenant_id, asset_type, asset_id,
          month, year, monthly_rent, deduction_amount, cash_payable,
          paid_amount, payment_date, payment_method, status
        ) VALUES (
          v_owner_id, v_agreement_id, tenant_ids[i], 'shop', shop_ids[i],
          m, 2025, v_rent, v_deduction, v_payable,
          CASE WHEN m < 3 THEN v_payable ELSE 0 END,
          CASE WHEN m < 3 THEN MAKE_DATE(2025, m, 5) ELSE NULL END,
          CASE WHEN m < 3 THEN 'cash' ELSE NULL END,
          CASE WHEN m < 3 THEN 'paid' ELSE 'unpaid' END
        );
      END;
    END LOOP;
  END LOOP;

  -- ===== APARTMENT AGREEMENT =====
  INSERT INTO rental_agreements (
    owner_id, tenant_id, asset_type, asset_id,
    start_date, monthly_rent, deposit_amount, status
  )
  VALUES (v_owner_id, tenant_ids[1], 'apartment', v_apt_id, '2024-03-01', 35000, 70000, 'active');

  -- ===== VEHICLE AGREEMENT =====
  INSERT INTO rental_agreements (
    owner_id, tenant_id, asset_type, asset_id,
    start_date, monthly_rent, deposit_amount, status
  )
  VALUES (v_owner_id, tenant_ids[2], 'vehicle', v_car_id, '2024-06-01', 45000, 90000, 'active');

  -- ===== EXPENSES =====
  INSERT INTO expenses (owner_id, asset_type, asset_id, category, amount, expense_date, paid_to, payment_method, notes)
  VALUES
    (v_owner_id, 'market', v_market_id, 'Electricity', 8500, '2025-01-31', 'DESCO', 'bank', 'January electricity bill'),
    (v_owner_id, 'market', v_market_id, 'Cleaning', 3000, '2025-01-31', 'Cleaning Staff', 'cash', 'Monthly cleaning'),
    (v_owner_id, 'market', v_market_id, 'Security', 5000, '2025-01-31', 'Security Agency', 'bank', 'Monthly security'),
    (v_owner_id, 'market', v_market_id, 'Electricity', 9200, '2025-02-28', 'DESCO', 'bank', 'February electricity bill'),
    (v_owner_id, 'market', v_market_id, 'Repair', 12000, '2025-02-15', 'Local Contractor', 'cash', 'Roof repair shop 5-8'),
    (v_owner_id, 'vehicle', v_car_id, 'Fuel', 8000, '2025-01-31', 'Fuel Station', 'cash', 'Monthly fuel'),
    (v_owner_id, 'vehicle', v_car_id, 'Maintenance', 5000, '2025-01-20', 'Auto Workshop', 'cash', 'Oil change and service'),
    (v_owner_id, 'apartment', v_apt_id, 'Maintenance', 3500, '2025-01-25', 'Plumber', 'cash', 'Plumbing repair'),
    (v_owner_id, 'general', NULL, 'Accounting', 5000, '2025-01-31', 'Accountant', 'bank', 'Monthly accounting fee'),
    (v_owner_id, 'general', NULL, 'Office', 2000, '2025-02-01', 'Stationery Shop', 'cash', 'Office supplies'),
    (v_owner_id, 'market', v_market_id, 'Manager Salary', 25000, '2025-01-31', 'Rahim Uddin', 'bank', 'January manager salary'),
    (v_owner_id, 'market', v_market_id, 'Manager Salary', 25000, '2025-02-28', 'Rahim Uddin', 'bank', 'February manager salary');

  RAISE NOTICE 'Seed data created successfully for owner: %', v_owner_id;
END;
$$;
