-- Migration: 004_auth_production_tokens.sql
-- Description: Add support for Refresh Tokens, Token Blacklisting, and Password Reset
-- Author: Antigravity (Consolidation Task)
-- Date: 2026-04-14

-- 1. Refresh Tokens Table (for session persistence)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- 2. Blacklisted Tokens Table (for logout/invalidated JWTs)
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_blacklisted_tokens_token ON blacklisted_tokens(token);
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);

-- 3. Enhance Users table with Password Reset fields
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_password_token') THEN
        ALTER TABLE users ADD COLUMN reset_password_token TEXT;
        ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMP;
    END IF;
END $$;
