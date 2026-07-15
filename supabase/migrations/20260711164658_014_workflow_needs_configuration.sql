-- Add 'needs_configuration' to workflows status CHECK constraint
ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_status_check;
ALTER TABLE workflows ADD CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'archived', 'needs_configuration'));
