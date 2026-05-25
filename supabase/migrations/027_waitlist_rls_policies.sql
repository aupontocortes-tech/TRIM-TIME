-- Substituir policy permissiva por policies restritivas para waiting_list.
-- O Prisma usa service_role (bypassa RLS), então isso protege apenas acesso
-- direto via Supabase client/anon key.

DROP POLICY IF EXISTS "Waiting list full access" ON waiting_list;

CREATE POLICY "waitlist_service_role_full"
  ON waiting_list
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "waitlist_anon_read_own"
  ON waiting_list
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "waitlist_anon_insert_deny"
  ON waiting_list
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "waitlist_anon_update_deny"
  ON waiting_list
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "waitlist_anon_delete_deny"
  ON waiting_list
  FOR DELETE
  TO anon, authenticated
  USING (false);
