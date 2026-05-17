-- Ejecuta este script en Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  access_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  company_name TEXT,
  sector TEXT,
  scores JSONB,
  score INTEGER,
  alerts TEXT,
  documents JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_sector ON cases(sector);
CREATE INDEX IF NOT EXISTS idx_cases_score ON cases(score);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access" ON users FOR ALL USING (true);
CREATE POLICY "Service role access" ON conversations FOR ALL USING (true);
CREATE POLICY "Service role access" ON cases FOR ALL USING (true);