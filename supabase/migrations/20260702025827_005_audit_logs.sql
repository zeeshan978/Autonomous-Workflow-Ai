-- Audit Logs table for tracking user actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS policies for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
    TO authenticated USING (auth.uid() = user_id);

-- Admin can see all audit logs
CREATE POLICY "admin_select_all_audit_logs" ON audit_logs FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );