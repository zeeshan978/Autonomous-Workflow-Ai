-- Fix RLS policy on logs table for Database node inserts.
--
-- Problem:
--   The existing "insert_logs" policy requires every inserted row to have an
--   execution_id that references an execution owned by auth.uid().
--   When a Database node inserts a campaign log without an execution_id, or with
--   an execution_id that hasn't been linked yet, the INSERT is rejected.
--
-- Solution:
--   Allow authenticated users to insert log rows in two cases:
--     1) The row has an execution_id that belongs to one of their executions (existing behavior).
--     2) The row has a NULL execution_id (standalone / campaign logs).
--
-- This does NOT make the table publicly writable — only authenticated users can insert,
-- and only for their own executions or for standalone entries.

DROP POLICY IF EXISTS "insert_logs" ON logs;

CREATE POLICY "insert_logs" ON logs FOR INSERT
    TO authenticated WITH CHECK (
        execution_id IS NULL
        OR EXISTS (
            SELECT 1 FROM executions
            WHERE executions.id = logs.execution_id
              AND executions.user_id = auth.uid()
        )
    );
