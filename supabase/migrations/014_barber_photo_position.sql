-- Add photo_position column to barbers table
-- Stores the vertical crop offset (0 = top, 100 = bottom, default 50 = center)
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS photo_position INTEGER NOT NULL DEFAULT 50;
