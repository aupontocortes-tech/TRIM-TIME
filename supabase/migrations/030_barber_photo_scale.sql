-- Zoom do recorte circular da foto do profissional (100 = padrão).
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS photo_scale INTEGER NOT NULL DEFAULT 100;

ALTER TABLE barbers
  DROP CONSTRAINT IF EXISTS barbers_photo_scale_range;

ALTER TABLE barbers
  ADD CONSTRAINT barbers_photo_scale_range
  CHECK (photo_scale >= 75 AND photo_scale <= 125);
