-- Add INSERT policy for users table (for trigger and ensureUserRecords)
CREATE POLICY "insert_own_user" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also allow service role to insert (for triggers)
CREATE POLICY "service_insert_users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
