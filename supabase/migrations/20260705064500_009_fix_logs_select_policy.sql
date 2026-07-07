-- Fix RLS policy on logs table for Database node inserts (SELECT policy).
--
-- Problem:
--   When the Database node inserts a log without an execution_id, it executes:
--   supabase.from('logs').insert(record).select().single()
--   
--   Because of the trailing .select(), PostgreSQL evaluates BOTH the INSERT policy
--   AND the SELECT policy. While we previously fixed the INSERT policy, the 
--   "select_own_logs" policy still blocked reading rows with execution_id IS NULL.
--   Postgres responds by failing the entire transaction with an RLS violation.
--
-- Solution:
--   Update the SELECT policy to mirror the INSERT policy, allowing authenticated
--   users to select logs that have a NULL execution_id.

DROP POLICY IF EXISTS "select_own_logs" ON logs;

CREATE POLICY "select_own_logs" ON logs FOR SELECT
    TO authenticated USING (
        execution_id IS NULL
        OR EXISTS (
            SELECT 1 FROM executions
            WHERE executions.id = logs.execution_id
              AND executions.user_id = auth.uid()
        )
    );
