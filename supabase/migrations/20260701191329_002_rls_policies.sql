-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "select_own_user" ON users FOR SELECT
    TO authenticated USING (auth.uid() = id);
CREATE POLICY "update_own_user" ON users FOR UPDATE
    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Profiles policies
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agents policies
CREATE POLICY "select_own_agents" ON agents FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_agents" ON agents FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_agents" ON agents FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_agents" ON agents FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- Workflows policies
CREATE POLICY "select_own_workflows" ON workflows FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_workflows" ON workflows FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_workflows" ON workflows FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_workflows" ON workflows FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- Workflow Steps policies
CREATE POLICY "select_workflow_steps" ON workflow_steps FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM workflows WHERE workflows.id = workflow_steps.workflow_id AND workflows.user_id = auth.uid())
    );
CREATE POLICY "insert_workflow_steps" ON workflow_steps FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM workflows WHERE workflows.id = workflow_steps.workflow_id AND workflows.user_id = auth.uid())
    );
CREATE POLICY "update_workflow_steps" ON workflow_steps FOR UPDATE
    TO authenticated USING (
        EXISTS (SELECT 1 FROM workflows WHERE workflows.id = workflow_steps.workflow_id AND workflows.user_id = auth.uid())
    );
CREATE POLICY "delete_workflow_steps" ON workflow_steps FOR DELETE
    TO authenticated USING (
        EXISTS (SELECT 1 FROM workflows WHERE workflows.id = workflow_steps.workflow_id AND workflows.user_id = auth.uid())
    );

-- Executions policies
CREATE POLICY "select_own_executions" ON executions FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_executions" ON executions FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_executions" ON executions FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks policies - access via assigned_to or workflow owner
CREATE POLICY "select_assigned_tasks" ON tasks FOR SELECT
    TO authenticated USING (
        auth.uid() = assigned_to 
        OR EXISTS (
            SELECT 1 FROM workflows WHERE workflows.id = tasks.workflow_id AND workflows.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM executions WHERE executions.id = tasks.execution_id AND executions.user_id = auth.uid()
        )
    );
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
    TO authenticated WITH CHECK (
        auth.uid() = assigned_to
        OR EXISTS (
            SELECT 1 FROM workflows WHERE workflows.id = tasks.workflow_id AND workflows.user_id = auth.uid()
        )
    );
CREATE POLICY "update_assigned_tasks" ON tasks FOR UPDATE
    TO authenticated USING (
        auth.uid() = assigned_to 
        OR EXISTS (
            SELECT 1 FROM workflows WHERE workflows.id = tasks.workflow_id AND workflows.user_id = auth.uid()
        )
    );
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
    TO authenticated USING (
        auth.uid() = assigned_to
        OR EXISTS (
            SELECT 1 FROM workflows WHERE workflows.id = tasks.workflow_id AND workflows.user_id = auth.uid()
        )
    );

-- Logs policies
CREATE POLICY "select_own_logs" ON logs FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM executions WHERE executions.id = logs.execution_id AND executions.user_id = auth.uid())
    );
CREATE POLICY "insert_logs" ON logs FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM executions WHERE executions.id = logs.execution_id AND executions.user_id = auth.uid())
    );

-- Notifications policies
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "select_own_reports" ON reports FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY "select_own_settings" ON settings FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Files policies
CREATE POLICY "select_own_files" ON files FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_files" ON files FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_files" ON files FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- API Keys policies
CREATE POLICY "select_own_api_keys" ON api_keys FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_api_keys" ON api_keys FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_api_keys" ON api_keys FOR DELETE
    TO authenticated USING (auth.uid() = user_id);