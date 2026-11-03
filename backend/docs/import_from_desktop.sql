-- One-time import of the old JavaFX desktop data into the new Haven Realty schema.
--
-- HOW TO USE
--   1. Start the new backend once with SPRING_PROFILES_ACTIVE=mysql so Flyway creates `haven_realty`.
--   2. Work on a COPY / backup of the old data first. Then run this script as a user that can read both databases.
--
-- ASSUMPTIONS (the old DDL was not available, so column names are taken from the desktop app's SQL):
--   properity_mysql_database.customers(mobile, cname, address, city, email, ctype, pic, aadhaar, <date>)
--   properity_mysql_database.properties(property_id, owner_mobile, property_address, Area, city, size, front, rear,
--       leftt, rightt, facing, property_type, construction_type, approved_by, expected_price, property_description,
--       property_image, optional_image, listing_status, <time>)
--   properity_mysql_database.deals(property_id, seller_mobile, buyer_mobile, final_amount, down_payment, deal_date,
--       registry_date, total_commission, advance_received, balance_received, status, <time>)
-- If your real columns differ, adjust the SELECT lists below.
--
-- WHAT IS NOT CARRIED OVER
--   * Photos / Aadhaar images (BLOBs). They live in private file storage in the new app; re-upload them through the UI.
--   * Passwords: the desktop app had none. Imported people get an unusable password and must use "Forgot password".
--   * Imported people are marked email/mobile UNVERIFIED and sellers are NOT verified - the agent should review them
--     (set users.seller_enabled = 1 only after checking documents, or ask them to apply in the portal).

USE haven_realty;

-- 1. Customers -> users (mobile becomes a unique column; the old mobile primary key is no longer the identity)
INSERT INTO users (email, password, full_name, phone, city, address, role, account_enabled, email_verified,
                   phone_verified, buyer_enabled, seller_enabled, created_at)
SELECT COALESCE(NULLIF(TRIM(c.email), ''), CONCAT(c.mobile, '@imported.invalid')),
       '!imported-no-password', c.cname, RIGHT(c.mobile, 10), c.city, c.address,
       'CUSTOMER', 1, 0, 0, 1, 0, NOW()
FROM properity_mysql_database.customers c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.phone = RIGHT(c.mobile, 10));

-- 2. Properties -> properties (owner looked up by mobile)
INSERT INTO properties (seller_id, title, property_type, category, description, city, locality, address, area,
                        measurement_unit, price, parking_available, construction_type, facing, approved_by, status,
                        view_count, created_at, updated_at)
SELECT u.id,
       CONCAT(p.property_type, ' in ', COALESCE(NULLIF(p.Area, ''), p.city)),
       p.property_type, 'SALE', p.property_description, p.city, p.Area, p.property_address,
       COALESCE(NULLIF(CAST(p.size AS DECIMAL(14,2)), 0), 1), 'sq ft', COALESCE(p.expected_price, 1), 0,
       p.construction_type, p.facing, p.approved_by,
       CASE p.listing_status WHEN 'Available' THEN 'PUBLISHED' WHEN 'Sold' THEN 'SOLD' ELSE 'INACTIVE' END,
       0, NOW(), NOW()
FROM properity_mysql_database.properties p
JOIN users u ON u.phone = RIGHT(p.owner_mobile, 10);

-- 3. Deals -> sale_transactions
INSERT INTO sale_transactions (property_id, buyer_id, seller_id, final_amount, down_payment, deal_date, registry_date,
                               total_commission, advance_received, balance_received, status, created_at)
SELECT np.id, b.id, s.id, d.final_amount, COALESCE(d.down_payment, 0), d.deal_date, d.registry_date,
       COALESCE(d.total_commission, 0), COALESCE(d.advance_received, 0), COALESCE(d.balance_received, 0),
       UPPER(d.status), NOW()
FROM properity_mysql_database.deals d
JOIN users b ON b.phone = RIGHT(d.buyer_mobile, 10)
JOIN users s ON s.phone = RIGHT(d.seller_mobile, 10)
JOIN properties np ON np.seller_id = s.id
JOIN properity_mysql_database.properties op ON op.property_id = d.property_id
     AND np.address = op.property_address;

-- 4. Sanity check
SELECT (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER') AS customers,
       (SELECT COUNT(*) FROM properties) AS properties,
       (SELECT COUNT(*) FROM sale_transactions) AS sales;
