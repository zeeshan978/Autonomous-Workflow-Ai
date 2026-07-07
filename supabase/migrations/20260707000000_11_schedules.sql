-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    interval_type VARCHAR(50) NOT NULL CHECK (interval_type IN ('once', 'hourly', 'daily', 'weekly', 'monthly', 'custom')),
    cron_expression VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user and active status
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Alter Executions table to allow scheduler tracking
ALTER TABLE executions ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;
