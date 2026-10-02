-- NaikiApp 0011 - the privileges RLS does not cover
--
-- Every policy in this schema is written to be correct. This file is about the
-- table privileges underneath them, and it exists because of one specific fact:
--
--   Row-level security applies to SELECT, INSERT, UPDATE and DELETE.
--   It does NOT apply to TRUNCATE.
--
-- TRUNCATE is checked against the table's ACL and nothing else. A role with the
-- TRUNCATE privilege empties the table outright, and no policy in this schema -
-- not a USING clause, not a WITH CHECK, not an enabled-RLS table - can stop it.
--
-- The table is RLS-enabled, which is exactly what makes this easy to miss: every
-- other role in the system is answered by a policy, so the schema reads as though
-- nothing gets through. 0001 revoked INSERT, DELETE and UPDATE on profiles and
-- then granted back four columns, which is careful work about precisely this
-- kind of hole. TRUNCATE was never named, and it is a table privilege like any
-- other.
--
-- Supabase grants ALL on every table in the public schema to anon and
-- authenticated by default. ALL includes TRUNCATE. So on a real database:
--
--   anon               can truncate any of these four tables, with no account
--   authenticated      can truncate any of these four tables, with any account
--
-- and on this schema neither role needs CASCADE to cause serious damage:
--
--   truncate public.status_log
--       Nothing references status_log, so this needs no CASCADE and no
--       arguments. It empties the append-only history behind every donor's
--       timeline - the one table 0004 goes to real trouble to make unforgeable.
--       The triggers still exist and would still fire on the next transition;
--       they simply have no prior to append to.
--
--   truncate public.profiles cascade
--       profiles is the root of the foreign key graph - ngo_details, donations
--       and status_log all hang off it or off donations - so one statement
--       empties all four tables. Every listing, every NGO registration and every
--       profile goes, and the anon role reaches it without signing in.
--
-- Neither statement is stopped by donations_select_own, guard_donation_removal,
-- guard_donation_claim, or any of the fifteen policies in this schema.
--
-- Also revoked: REFERENCES, which is the other table privilege RLS says nothing
-- about. It is not exploitable while anon and authenticated lack CREATE on the
-- public schema, but it costs nothing to close and it belongs to the same
-- category - an ACL privilege whose reach has nothing to do with who is asking.
--
-- NOT revoked from public, and this matters. PUBLIC is the pseudo-role every
-- other role inherits, service_role among them, and the expire-listings sweep
-- needs its UPDATE. Revoking from public would take the service role's
-- privileges away along with the attacker's. So both revokes name anon and
-- authenticated explicitly, and nothing else.

-- ================================================================== profiles
--
-- 0001 already revoked insert, delete and update here and granted back four
-- columns. TRUNCATE is the remaining table privilege, and on the root table it
-- is the one that reaches everything else.

revoke truncate on public.profiles from anon, authenticated;
revoke references on public.profiles from anon, authenticated;

-- ============================================================== ngo_details
--
-- 0002 revoked update and delete; 0006 re-granted update on two columns for an
-- admin decision. Insert stays, deliberately - registering a charity is open to
-- any signed-in account, and 0002's WITH CHECK is what pins the result to
-- 'pending'.

revoke truncate on public.ngo_details from anon, authenticated;
revoke references on public.ngo_details from anon, authenticated;

-- ================================================================= donations
--
-- The broadest table in the schema and the one this whole project is about. Its
-- INSERT, UPDATE and DELETE surface is entirely policy-driven and correct as of
-- 0003, 0006, 0008 and 0009. DELETE needs no revoke either: RLS denies a command
-- that has no applicable policy, and there is deliberately no DELETE policy,
-- because a listing is cancelled rather than removed so its history survives.

revoke truncate on public.donations from anon, authenticated;
revoke references on public.donations from anon, authenticated;

-- =============================================================== status_log
--
-- 0004 gives this table a SELECT policy and no INSERT, UPDATE or DELETE policy,
-- so all three are already denied - the triggers write through SECURITY DEFINER
-- and a client cannot forge or rewrite history. TRUNCATE was the one way around
-- that, and it needed no arguments.

revoke truncate on public.status_log from anon, authenticated;
revoke references on public.status_log from anon, authenticated;

-- ------------------------------------------------------------------- notes
--
-- Still open, and NOT fixable here, because it is not a policy:
--
--   There is no way to make an admin. Nine policies in this schema test
--   profiles.role = 'admin' - the verification queue in 0006, the moderation
--   queue, donations_select_admin, status_log_select_involved and the rest - and
--   nothing can set that value. 0001 revoked UPDATE on profiles and granted it
--   back for full_name, organisation, phone and is_anonymous only, and no
--   trigger or function promotes the way 0010 promotes to 'ngo'. So on a real
--   database the entire admin surface is unreachable: no admin can exist, so
--   every admin policy is inert. The mock hides this because authApi.js writes
--   role: 'admin' onto its fixture accounts.
--
--   That is an operations question rather than a schema one, and it has two
--   defensible answers: a SECURITY DEFINER function gated on
--   auth.role() = 'service_role', so a seed script can call it, or a single
--   documented statement run in the Supabase SQL editor:
--
--     update public.profiles
--     set role = 'admin'
--     where id = (select id from auth.users where email = '<admin address>');
--
--   Either way the promotion must not be reachable by authenticated, because
--   that would be self-promotion to the most privileged role in the system, and
--   0001's column grant is what currently prevents it.
--
--   expire-listings is a 0-byte tracked file, so 'expired' has no producer
--   either. Like the claim transition before 0009, that status cannot be reached
--   by anything. It is an Edge Function rather than a migration, so it is out of
--   scope for this file - but 0009's donation_transition_allowed deliberately
--   excludes available -> expired, so nothing here should be read as a claim that
--   the expiry path exists.