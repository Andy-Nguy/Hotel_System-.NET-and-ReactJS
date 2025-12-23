-- Migration script to add Avatar column to KhachHang table
-- Date: December 23, 2025

USE HotelSystem;

-- Add Avatar column to KhachHang table
ALTER TABLE KhachHang
ADD Avatar NVARCHAR(500) NULL;

-- Update existing records with default avatar if needed
-- UPDATE KhachHang SET Avatar = 'default-avatar.png' WHERE Avatar IS NULL;

PRINT 'Avatar column added to KhachHang table successfully';