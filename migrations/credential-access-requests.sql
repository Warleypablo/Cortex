CREATE TABLE IF NOT EXISTS cortex_core.credential_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  credential_id UUID NOT NULL,
  platform VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  approved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_car_token ON cortex_core.credential_access_requests(token);
CREATE INDEX IF NOT EXISTS idx_car_user_status ON cortex_core.credential_access_requests(user_email, status);
CREATE INDEX IF NOT EXISTS idx_car_credential ON cortex_core.credential_access_requests(credential_id, status);
