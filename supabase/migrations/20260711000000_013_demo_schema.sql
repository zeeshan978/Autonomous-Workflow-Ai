-- Demo Tables

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'unpaid',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    department VARCHAR(100),
    role VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema Discovery RPC

CREATE OR REPLACE FUNCTION get_database_schema()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'table_name', t.table_name,
      'columns', (
        SELECT json_agg(
          json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable
          )
        )
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.table_name
      )
    )
  ) INTO result
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';

  RETURN result;
END;
$$;

-- Seed Data

INSERT INTO customers (id, email, first_name, last_name, company, status) VALUES
('11111111-1111-1111-1111-111111111111', 'alice@acme.com', 'Alice', 'Smith', 'Acme Corp', 'active'),
('22222222-2222-2222-2222-222222222222', 'bob@globex.com', 'Bob', 'Jones', 'Globex', 'active'),
('33333333-3333-3333-3333-333333333333', 'charlie@initech.com', 'Charlie', 'Brown', 'Initech', 'inactive');

INSERT INTO products (id, name, description, price, stock_quantity) VALUES
('44444444-4444-4444-4444-444444444444', 'Widget Pro', 'Premium widget', 99.99, 100),
('55555555-5555-5555-5555-555555555555', 'Widget Basic', 'Standard widget', 29.99, 500);

INSERT INTO orders (id, customer_id, status, total_amount) VALUES
('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'completed', 199.98),
('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'pending', 29.99);

INSERT INTO invoices (id, order_id, customer_id, amount, status) VALUES
('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 199.98, 'paid'),
('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 29.99, 'unpaid');

INSERT INTO employees (id, email, full_name, department, role) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sarah@company.com', 'Sarah Connor', 'Support', 'Agent'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'john@company.com', 'John Doe', 'Sales', 'Manager');

INSERT INTO tickets (id, customer_id, assigned_to, subject, description, status, priority) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Login Issue', 'Cannot login to account', 'open', 'high'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', NULL, 'Billing Question', 'Question about recent invoice', 'open', 'medium');
