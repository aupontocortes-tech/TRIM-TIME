-- Feedback estruturado de melhorias / roadmap (barbearia → equipe Trim Time)
CREATE TABLE IF NOT EXISTS product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  category varchar(24) NOT NULL,
  area varchar(24),
  title varchar(200) NOT NULL,
  description text NOT NULL,
  impact varchar(16) NOT NULL DEFAULT 'medium',
  status varchar(24) NOT NULL DEFAULT 'new',
  admin_notes text,
  read_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_feedback_barbershop_created_idx
  ON product_feedback (barbershop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_feedback_status_created_idx
  ON product_feedback (status, created_at DESC);
