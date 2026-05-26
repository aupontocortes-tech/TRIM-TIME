-- Produtos de venda (gel, modelador, etc.) + linhas no agendamento
CREATE TABLE IF NOT EXISTS retail_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retail_products_barbershop ON retail_products(barbershop_id);

CREATE TABLE IF NOT EXISTS appointment_retail_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  retail_product_id UUID NOT NULL REFERENCES retail_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointment_retail_lines_appointment ON appointment_retail_lines(appointment_id);

COMMENT ON TABLE retail_products IS 'Itens de venda na loja (ex.: cosméticos), distintos de serviços agendáveis';
COMMENT ON TABLE appointment_retail_lines IS 'Produtos incluídos no mesmo pedido do cliente (ligado ao 1º horário do agendamento)';
