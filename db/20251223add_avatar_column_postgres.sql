-- Migration script to add Avatar column to KhachHang table (PostgreSQL)
-- Date: December 23, 2025

-- Add Avatar column to KhachHang table (with capital A to match database schema)
ALTER TABLE khachhang
ADD COLUMN IF NOT EXISTS "Avatar" VARCHAR(500) NULL;

-- Update existing records with default avatar if needed (optional)
-- UPDATE khachhang SET "Avatar" = 'default-avatar.png' WHERE "Avatar" IS NULL;

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'khachhang' AND column_name = 'Avatar';

