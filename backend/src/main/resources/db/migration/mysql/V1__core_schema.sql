-- Generated core schema (portable across MySQL 8 and H2 in MySQL mode)

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  password VARCHAR(100) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  city VARCHAR(80),
  state VARCHAR(80),
  address VARCHAR(300),
  postal_code VARCHAR(12),
  role VARCHAR(20) NOT NULL,
  account_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  seller_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferences TEXT,
  created_at DATETIME NOT NULL,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_phone UNIQUE (phone)
);

CREATE TABLE verification_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  channel VARCHAR(10) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code_hash VARCHAR(100) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_verification_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);

CREATE TABLE seller_verifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  review_notes TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at DATETIME NOT NULL,
  reviewed_at DATETIME,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_seller_verifications_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_seller_verifications_user_id ON seller_verifications(user_id);

CREATE TABLE verification_documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  verification_id BIGINT NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  stored_name VARCHAR(100) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_at DATETIME NOT NULL,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_verification_documents_verification_id FOREIGN KEY (verification_id) REFERENCES seller_verifications(id)
);

CREATE INDEX idx_verification_documents_verification_id ON verification_documents(verification_id);

CREATE TABLE verification_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  verification_id BIGINT NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  note TEXT,
  actor_id BIGINT,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_verification_history_verification_id FOREIGN KEY (verification_id) REFERENCES seller_verifications(id)
);

CREATE INDEX idx_verification_history_verification_id ON verification_history(verification_id);

CREATE TABLE properties (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  property_type VARCHAR(30) NOT NULL,
  category VARCHAR(10) NOT NULL,
  description TEXT,
  city VARCHAR(80) NOT NULL,
  locality VARCHAR(120),
  address VARCHAR(300) NOT NULL,
  postal_code VARCHAR(12),
  area DECIMAL(14,2) NOT NULL,
  measurement_unit VARCHAR(20) NOT NULL DEFAULT 'sq ft',
  price DECIMAL(14,2) NOT NULL,
  bedrooms INT,
  bathrooms INT,
  furnishing_status VARCHAR(30),
  parking_available BOOLEAN NOT NULL DEFAULT FALSE,
  amenities VARCHAR(1000),
  construction_type VARCHAR(30),
  facing VARCHAR(20),
  approved_by VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  rejection_reason TEXT,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_properties_seller_id FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE INDEX idx_properties_seller_id ON properties(seller_id);

CREATE TABLE property_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT NOT NULL,
  stored_name VARCHAR(100) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_property_images_property_id FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX idx_property_images_property_id ON property_images(property_id);

CREATE TABLE property_documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  stored_name VARCHAR(100) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  uploaded_at DATETIME NOT NULL,
  CONSTRAINT fk_property_documents_property_id FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX idx_property_documents_property_id ON property_documents(property_id);

CREATE TABLE property_approvals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT NOT NULL,
  decision VARCHAR(20) NOT NULL,
  reason TEXT,
  actor_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_property_approvals_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_property_approvals_actor_id FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX idx_property_approvals_property_id ON property_approvals(property_id);

CREATE INDEX idx_property_approvals_actor_id ON property_approvals(actor_id);

CREATE TABLE wishlist (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  property_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_wishlist_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_wishlist_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT uq_wishlist_user_id_property_id UNIQUE (user_id, property_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);

CREATE INDEX idx_wishlist_property_id ON wishlist(property_id);

CREATE TABLE recently_viewed (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  property_id BIGINT NOT NULL,
  viewed_at DATETIME NOT NULL,
  CONSTRAINT fk_recently_viewed_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_recently_viewed_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT uq_recently_viewed_user_id_property_id UNIQUE (user_id, property_id)
);

CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);

CREATE INDEX idx_recently_viewed_property_id ON recently_viewed(property_id);

CREATE TABLE enquiries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  enquiry_type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
  follow_up_date DATE,
  closure_reason TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_enquiries_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_enquiries_customer_id FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE INDEX idx_enquiries_property_id ON enquiries(property_id);

CREATE INDEX idx_enquiries_customer_id ON enquiries(customer_id);

CREATE TABLE buyer_agent_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id BIGINT NOT NULL,
  sender_role VARCHAR(10) NOT NULL,
  sender_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_buyer_agent_messages_enquiry_id FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
);

CREATE INDEX idx_buyer_agent_messages_enquiry_id ON buyer_agent_messages(enquiry_id);

CREATE TABLE seller_agent_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT NOT NULL,
  property_id BIGINT,
  sender_role VARCHAR(10) NOT NULL,
  sender_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_seller_agent_messages_seller_id FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_seller_agent_messages_property_id FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX idx_seller_agent_messages_seller_id ON seller_agent_messages(seller_id);

CREATE INDEX idx_seller_agent_messages_property_id ON seller_agent_messages(property_id);

CREATE TABLE site_visits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id BIGINT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_site_visits_enquiry_id FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
);

CREATE INDEX idx_site_visits_enquiry_id ON site_visits(enquiry_id);

CREATE TABLE property_offers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id BIGINT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_property_offers_enquiry_id FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
);

CREATE INDEX idx_property_offers_enquiry_id ON property_offers(enquiry_id);

CREATE TABLE rental_agreements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id BIGINT,
  property_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  rent_amount DECIMAL(14,2) NOT NULL,
  security_deposit DECIMAL(14,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_rental_agreements_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_rental_agreements_tenant_id FOREIGN KEY (tenant_id) REFERENCES users(id)
);

CREATE INDEX idx_rental_agreements_property_id ON rental_agreements(property_id);

CREATE INDEX idx_rental_agreements_tenant_id ON rental_agreements(tenant_id);

CREATE TABLE sale_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id BIGINT,
  property_id BIGINT NOT NULL,
  buyer_id BIGINT NOT NULL,
  seller_id BIGINT NOT NULL,
  final_amount DECIMAL(14,2) NOT NULL,
  down_payment DECIMAL(14,2) NOT NULL DEFAULT 0,
  deal_date DATE NOT NULL,
  registry_date DATE,
  total_commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_received BOOLEAN NOT NULL DEFAULT FALSE,
  balance_received BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'ONGOING',
  notes TEXT,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_sale_transactions_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_sale_transactions_buyer_id FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_sale_transactions_seller_id FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE INDEX idx_sale_transactions_property_id ON sale_transactions(property_id);

CREATE INDEX idx_sale_transactions_buyer_id ON sale_transactions(buyer_id);

CREATE INDEX idx_sale_transactions_seller_id ON sale_transactions(seller_id);

CREATE TABLE notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link VARCHAR(200),
  read_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id BIGINT,
  details TEXT,
  created_at DATETIME NOT NULL
);

CREATE INDEX idx_properties_status ON properties(status);

CREATE INDEX idx_properties_city ON properties(city);

CREATE INDEX idx_enquiries_status ON enquiries(status);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
