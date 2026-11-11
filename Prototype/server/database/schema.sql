-- PSIB prototype database schema
-- Run with: npm run db:init
-- Tables are added here as each use case is built.

-- UC-001: Register and Verify Account
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('founder', 'investor', 'incubator', 'admin')),
  organisation VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason VARCHAR(300),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- UC-004: Submit Startup Profile
CREATE TABLE IF NOT EXISTS startup_profiles (
  id SERIAL PRIMARY KEY,
  founder_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  company_name VARCHAR(150),
  sector VARCHAR(50),
  stage VARCHAR(30),
  team JSONB NOT NULL DEFAULT '[]',
  active_customers INTEGER,
  traction_notes TEXT,
  revenue_period VARCHAR(7),
  monthly_revenue_pkr BIGINT,
  cap_table JSONB NOT NULL DEFAULT '[]',
  round_amount_pkr BIGINT,
  round_instrument VARCHAR(30),
  use_of_funds TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_for_review')),
  completeness INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP
);

-- every submission is kept as a version; investors will see the latest one
CREATE TABLE IF NOT EXISTS profile_versions (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES startup_profiles(id),
  version_number INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, version_number)
);
