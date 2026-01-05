


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."audit_action" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'OVERRIDE',
    'SYSTEM'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."employee_role" AS ENUM (
    'staff',
    'line_manager',
    'general_manager',
    'contract_admin'
);


ALTER TYPE "public"."employee_role" OWNER TO "postgres";


CREATE TYPE "public"."leave_pay_category" AS ENUM (
    'FULL',
    'HALF',
    'UNPAID'
);


ALTER TYPE "public"."leave_pay_category" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_leave_balance_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_year int;
  v_contract uuid;
  v_type text;
begin
  v_year := extract(year from new.start_date)::int;
  v_contract := new.contract_id;
  v_type := new.leave_type;

  if v_contract is null then
    -- leave_requests_autofill should set contract_id, but fail safe:
    select contract_id into v_contract from public.profiles where id = new.requester_id;
  end if;

  -- Only act on UPDATE
  if (tg_op = 'UPDATE') then

    -- approved transition
    if old.status <> 'approved' and new.status = 'approved' then
      perform public.ensure_leave_balance_typed(new.requester_id, v_contract, v_year, v_type);

      update public.leave_balances lb
      set
        used = lb.used + new.used_current_year,
        carried_forward_used =
          case when v_type = 'ANNUAL'
               then lb.carried_forward_used + new.used_carry_forward
               else lb.carried_forward_used
          end
      where lb.user_id = new.requester_id
        and lb.contract_id = v_contract
        and lb.policy_year = v_year
        and lb.leave_type = v_type;
    end if;

    -- cancellation of an approved leave
    if old.status = 'approved' and new.status = 'cancelled' then
      update public.leave_balances lb
      set
        used = greatest(lb.used - old.used_current_year, 0),
        carried_forward_used =
          case when lb.leave_type = 'ANNUAL'
               then greatest(lb.carried_forward_used - old.used_carry_forward, 0)
               else lb.carried_forward_used
          end
      where lb.user_id = old.requester_id
        and lb.contract_id = old.contract_id
        and lb.policy_year = extract(year from old.start_date)::int
        and lb.leave_type = old.leave_type;
    end if;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."apply_leave_balance_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_contract"("p_contract_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.is_super_admin = true
        or (p.contract_id = p_contract_id and p.role in ('admin','general_manager'))
      )
  );
$$;


ALTER FUNCTION "public"."can_manage_contract"("p_contract_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_contract"("p_contract_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.is_super_admin = true
        or p.contract_id = p_contract_id
      )
  );
$$;


ALTER FUNCTION "public"."can_read_contract"("p_contract_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_contract uuid;
  v_year int := extract(year from now())::int;
  v_ent int;
begin
  select contract_id into v_contract
  from public.profiles
  where id = p_user_id;

  if v_contract is null then
    return 0;
  end if;

  select public.compute_annual_entitlement(p_user_id, v_contract, v_year) into v_ent;
  return coalesce(v_ent, 0);
end;
$$;


ALTER FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with u as (
    select grade_level
    from public.profiles
    where id = p_user_id
  ),
  rule as (
    select r.annual_entitlement as entitlement
    from public.leave_entitlement_rules r
    cross join u
    where r.active = true
      and r.contract_id = p_contract_id
      and (r.policy_year is null or r.policy_year = p_year)
      and coalesce(r.leave_type, 'ANNUAL') = 'ANNUAL'
      and u.grade_level is not null
      and u.grade_level >= r.grade_min
      and (r.grade_max is null or u.grade_level <= r.grade_max)
    order by r.grade_min desc
    limit 1
  ),
  policy as (
    select lp.annual_entitlement as entitlement
    from public.leave_policies lp
    where lp.contract_id = p_contract_id
      and lp.policy_year = p_year
    limit 1
  )
  select coalesce(
    (select entitlement from rule),
    (select entitlement from policy),
    0
  );
$$;


ALTER FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_leave_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with u as (
    select p.grade_level
    from public.profiles p
    where p.id = p_user_id
  ),
  rule as (
    select r.annual_entitlement as entitlement
    from public.leave_entitlement_rules r
    cross join u
    where r.active = true
      and r.contract_id = p_contract_id
      and (r.policy_year is null or r.policy_year = p_year)
      and coalesce(r.leave_type, 'ANNUAL') = coalesce(p_leave_type, 'ANNUAL')
      and u.grade_level is not null
      and u.grade_level >= r.grade_min
      and (r.grade_max is null or u.grade_level <= r.grade_max)
    order by r.grade_min desc
    limit 1
  ),
  policy as (
    select lp.annual_entitlement as entitlement
    from public.leave_policies lp
    where lp.contract_id = p_contract_id
      and lp.policy_year = p_year
    limit 1
  )
  select coalesce(
    (select entitlement from rule),
    case when p_leave_type = 'ANNUAL' then (select entitlement from policy) else null end,
    0
  );
$$;


ALTER FUNCTION "public"."compute_leave_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_initial_leave_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_year int := extract(year from now())::int;
begin
  perform public.ensure_leave_balances_for_user_year(new.id, v_year);
  return new;
end;
$$;


ALTER FUNCTION "public"."create_initial_leave_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_profile_contract_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  dept_contract uuid;
begin
  if new.department_id is not null then
    select contract_id into dept_contract
    from public.departments
    where id = new.department_id;

    if dept_contract is null then
      raise exception 'Department % has no contract_id', new.department_id;
    end if;

    if new.contract_id is null then
      new.contract_id := dept_contract;
    elsif new.contract_id <> dept_contract then
      raise exception 'Profile contract_id (%) does not match department contract_id (%)',
        new.contract_id, dept_contract;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_profile_contract_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_leave_balance"("p_user_id" "uuid", "p_year" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_contract uuid;
begin
  select contract_id into v_contract
  from public.profiles
  where id = p_user_id;

  if v_contract is null then
    raise exception 'User % has no contract_id in profiles', p_user_id;
  end if;

  -- ANNUAL_CODE
  perform public.ensure_leave_balance_typed(p_user_id, v_contract, p_year, 'ANNUAL');
end;
$$;


ALTER FUNCTION "public"."ensure_leave_balance"("p_user_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_leave_balance_typed"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entitlement int;
begin
  v_entitlement := public.compute_leave_entitlement(p_user_id, p_contract_id, p_year, p_leave_type);

  insert into public.leave_balances (
    user_id, contract_id, policy_year, leave_type,
    entitlement, used, carried_forward, carried_forward_used
  )
  values (
    p_user_id, p_contract_id, p_year, p_leave_type,
    v_entitlement, 0, 0, 0
  )
  on conflict (user_id, contract_id, policy_year, leave_type)
  do update set entitlement = excluded.entitlement;
end;
$$;


ALTER FUNCTION "public"."ensure_leave_balance_typed"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_leave_balances_for_user_year"("p_user_id" "uuid", "p_year" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_contract uuid;
  v_type text;
begin
  select contract_id into v_contract
  from public.profiles
  where id = p_user_id;

  if v_contract is null then
    raise exception 'User % has no contract_id in profiles', p_user_id;
  end if;

  for v_type in
    select code from public.leave_types where active = true
  loop
    perform public.ensure_leave_balance_typed(p_user_id, v_contract, p_year, v_type);
  end loop;
end;
$$;


ALTER FUNCTION "public"."ensure_leave_balances_for_user_year"("p_user_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."escalate_overdue_leave_requests"("p_cutoff" interval DEFAULT '7 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
declare
  v_now timestamptz := now();
  v_count int := 0;
begin
  -- 9.1 Escalate pending LM -> GM
  with upd as (
    update public.leave_requests lr
    set
      status = 'pending_gm',
      current_approver_id = lr.general_manager_id,
      assigned_at = v_now
    where lr.status = 'pending_lm'
      and lr.assigned_at is not null
      and lr.general_manager_id is not null
      and lr.assigned_at <= (v_now - p_cutoff)
    returning 1
  )
  select count(*) into v_count from upd;

  -- 9.2 If requester is LM and GM overdue -> backup approver
  with upd2 as (
    update public.leave_requests lr
    set
      current_approver_id = p.backup_approver_id,
      assigned_at = v_now
    from public.profiles p
    where lr.requester_id = p.id
      and lr.status = 'pending_gm'
      and lr.assigned_at is not null
      and lr.assigned_at <= (v_now - p_cutoff)
      and p.role = 'line_manager'
      and p.backup_approver_id is not null
    returning 1
  )
  select v_count + count(*) into v_count from upd2;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."escalate_overdue_leave_requests"("p_cutoff" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','staff')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select (select role from public.profiles where id = auth.uid()) = 'admin'
     or public.is_super_admin();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_delegate_for"("delegator" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.approver_delegations d
    where d.delegator_id = delegator
      and d.delegate_id = auth.uid()
      and now() between d.starts_at and d.ends_at
  );
$$;


ALTER FUNCTION "public"."is_delegate_for"("delegator" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gm"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select (select role from public.profiles where id = auth.uid()) in ('general_manager','admin');
$$;


ALTER FUNCTION "public"."is_gm"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gm_of"("requester" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = requester
      and p.general_manager_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_gm_of"("requester" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_line_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select (select role from public.profiles where id = auth.uid()) in ('line_manager','general_manager','admin');
$$;


ALTER FUNCTION "public"."is_line_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_line_manager_of"("requester" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = requester
      and p.line_manager_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_line_manager_of"("requester" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_my_department"("dept" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select dept is not null and dept = public.my_department_id();
$$;


ALTER FUNCTION "public"."is_my_department"("dept" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_requests_autofill"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
declare
  v_dept uuid;
  v_lm uuid;
  v_gm uuid;
  v_contract uuid;
begin
  select department_id, line_manager_id, general_manager_id, contract_id
    into v_dept, v_lm, v_gm, v_contract
  from public.profiles
  where id = new.requester_id;

  if new.contract_id is null then
    new.contract_id := v_contract;
  end if;

  if new.department_id is null then
    new.department_id := v_dept;
  end if;

  if new.line_manager_id is null then
    new.line_manager_id := v_lm;
  end if;

  if new.general_manager_id is null then
    new.general_manager_id := v_gm;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."leave_requests_autofill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid;
  v_action text;
  v_entity text;
  v_entity_id uuid;
  v_details jsonb;
begin
  -- actor_id will be auth.uid() when called under normal session; null under service role if not set
  v_actor := auth.uid();

  v_entity := tg_table_name;
  v_entity_id := coalesce(new.id, old.id);

  if (tg_op = 'INSERT') then
    v_action := 'insert';
    v_details := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_details := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_action := 'delete';
    v_details := to_jsonb(old);
  end if;

  insert into public.audit_log(actor_id, entity, entity_id, action, details)
  values (v_actor, v_entity, v_entity_id, v_action, v_details);

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."log_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_contract_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select contract_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."my_contract_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_department_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select department_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."my_department_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollover_leave_balances"("p_from_year" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_to_year int := p_from_year + 1;
begin
  /*
    For each active profile and each active leave type:
      - entitlement for next year comes from rules/policy
      - used resets to 0
      - carried_forward only for ANNUAL (min(limit, remaining annual))
  */

  insert into public.leave_balances (
    user_id, contract_id, policy_year, leave_type,
    entitlement, used, carried_forward, carried_forward_used
  )
  select
    p.id as user_id,
    p.contract_id,
    v_to_year as policy_year,
    lt.code as leave_type,
    public.compute_leave_entitlement(p.id, p.contract_id, v_to_year, lt.code) as entitlement,
    0::numeric as used,
    case
      when lt.code = 'ANNUAL' then
        least(
          coalesce(lp.carry_forward_limit, 5)::numeric,
          greatest(
            (
              coalesce(lb_prev.entitlement,0)::numeric
              - coalesce(lb_prev.used,0)::numeric
            ),
            0
          )
        )
      else 0::numeric
    end as carried_forward,
    0::numeric as carried_forward_used
  from public.profiles p
  join public.leave_types lt
    on lt.active = true
  left join public.leave_policies lp
    on lp.contract_id = p.contract_id
   and lp.policy_year = p_from_year
  left join public.leave_balances lb_prev
    on lb_prev.user_id = p.id
   and lb_prev.contract_id = p.contract_id
   and lb_prev.policy_year = p_from_year
   and lb_prev.leave_type = 'ANNUAL'
  where p.is_active = true
    and p.contract_id is not null
  on conflict (user_id, contract_id, policy_year, leave_type)
  do update set
    entitlement = excluded.entitlement,
    carried_forward = excluded.carried_forward;
end;
$$;


ALTER FUNCTION "public"."rollover_leave_balances"("p_from_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."approver_delegations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delegator_id" "uuid" NOT NULL,
    "delegate_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_delegation_window" CHECK (("ends_at" > "starts_at"))
);


ALTER TABLE "public"."approver_delegations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "entity" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contract_id" "uuid"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contract_admin_policies" (
    "contract_id" "uuid" NOT NULL,
    "carry_forward_max_days" integer DEFAULT 5 NOT NULL,
    "carry_forward_usable_until_month" integer DEFAULT 3 NOT NULL,
    "carry_forward_usable_until_day" integer DEFAULT 31 NOT NULL,
    "general_manager_id" "uuid",
    "default_backup_approver_id" "uuid",
    "escalation_days" integer DEFAULT 7 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cap_cf_day_chk" CHECK ((("carry_forward_usable_until_day" >= 1) AND ("carry_forward_usable_until_day" <= 31))),
    CONSTRAINT "cap_cf_max_days_chk" CHECK (("carry_forward_max_days" >= 0)),
    CONSTRAINT "cap_cf_month_chk" CHECK ((("carry_forward_usable_until_month" >= 1) AND ("carry_forward_usable_until_month" <= 12))),
    CONSTRAINT "cap_escalation_days_chk" CHECK (("escalation_days" >= 0))
);


ALTER TABLE "public"."contract_admin_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "line_manager_id" "uuid",
    "backup_approver_id" "uuid"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leave_request_id" "uuid" NOT NULL,
    "approver_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leave_approvals_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'skipped'::"text", 'delegated'::"text"])))
);


ALTER TABLE "public"."leave_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "policy_year" integer NOT NULL,
    "entitlement" integer DEFAULT 0 NOT NULL,
    "used" numeric(6,2) DEFAULT 0 NOT NULL,
    "carried_forward" numeric(6,2) DEFAULT 0 NOT NULL,
    "carried_forward_used" numeric(6,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "leave_type" "text" NOT NULL,
    CONSTRAINT "chk_leave_balances_carry_forward_annual_only" CHECK ((("leave_type" = 'ANNUAL'::"text") OR ((COALESCE("carried_forward", (0)::numeric) = (0)::numeric) AND (COALESCE("carried_forward_used", (0)::numeric) = (0)::numeric))))
);


ALTER TABLE "public"."leave_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_entitlement_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grade_min" integer NOT NULL,
    "grade_max" integer,
    "annual_entitlement" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "policy_year" integer,
    "leave_type" "text",
    CONSTRAINT "chk_entitlement_nonneg" CHECK (("annual_entitlement" >= 0)),
    CONSTRAINT "chk_grade_range" CHECK ((("grade_max" IS NULL) OR ("grade_max" >= "grade_min")))
);


ALTER TABLE "public"."leave_entitlement_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_year" integer NOT NULL,
    "year_end_date" "date" NOT NULL,
    "carry_forward_limit" integer DEFAULT 5 NOT NULL,
    "carry_forward_expiry" "date" NOT NULL,
    "annual_entitlement" integer DEFAULT 30 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contract_id" "uuid" NOT NULL
);


ALTER TABLE "public"."leave_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "department_id" "uuid",
    "leave_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" numeric(6,2) DEFAULT 0 NOT NULL,
    "reason" "text",
    "attachment_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "line_manager_id" "uuid",
    "general_manager_id" "uuid",
    "current_approver_id" "uuid",
    "submitted_at" timestamp with time zone,
    "decided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_at" timestamp with time zone,
    "decided_by" "uuid",
    "used_current_year" numeric(6,2) DEFAULT 0 NOT NULL,
    "used_carry_forward" numeric(6,2) DEFAULT 0 NOT NULL,
    "contract_id" "uuid",
    CONSTRAINT "chk_dates" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "chk_days_nonneg" CHECK (("days" >= (0)::numeric)),
    CONSTRAINT "chk_leave_requests_carry_forward_annual_only" CHECK ((("leave_type" = 'ANNUAL'::"text") OR (COALESCE("used_carry_forward", (0)::numeric) = (0)::numeric))),
    CONSTRAINT "leave_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'pending_lm'::"text", 'pending_gm'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_types" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "requires_attachment" boolean DEFAULT false NOT NULL,
    "is_paid" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_days" integer,
    "pay_category" "text" DEFAULT 'FULL'::"text" NOT NULL,
    "requires_reason" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "contract_id" "uuid",
    "id" "uuid" NOT NULL,
    CONSTRAINT "leave_types_pay_category_check" CHECK (("pay_category" = ANY (ARRAY['FULL'::"text", 'HALF'::"text", 'UNPAID'::"text"])))
);


ALTER TABLE "public"."leave_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "department_id" "uuid",
    "line_manager_id" "uuid",
    "general_manager_id" "uuid",
    "backup_approver_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "grade_level" integer,
    "contract_id" "uuid",
    "is_super_admin" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['staff'::"text", 'line_manager'::"text", 'general_manager'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_audit_logs" WITH ("security_invoker"='true') AS
 SELECT "a"."id",
    "a"."contract_id",
    "to_char"(("a"."created_at" AT TIME ZONE 'Asia/Dubai'::"text"), 'YYYY-MM-DD HH24:MI'::"text") AS "time",
    COALESCE("p"."email", 'System'::"text") AS "actor",
    "a"."action",
        CASE
            WHEN ("a"."entity_id" IS NULL) THEN "a"."entity"
            ELSE (("a"."entity" || ':'::"text") || ("a"."entity_id")::"text")
        END AS "target",
    ("a"."details")::"text" AS "details"
   FROM ("public"."audit_log" "a"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "a"."actor_id")))
  ORDER BY "a"."created_at" DESC;


ALTER VIEW "public"."v_admin_audit_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_carry_forward" WITH ("security_invoker"='true') AS
 SELECT "contract_id",
    "carry_forward_max_days" AS "maxDays",
    "carry_forward_usable_until_month" AS "usableUntilMonth",
    "carry_forward_usable_until_day" AS "usableUntilDay"
   FROM "public"."contract_admin_policies" "cap";


ALTER VIEW "public"."v_admin_carry_forward" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_contracts" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."name",
    "c"."code",
    "c"."active",
    "cap"."general_manager_id" AS "generalManagerEmployeeId",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "d"."id", 'name', "d"."name", 'lineManagerEmployeeId', "d"."line_manager_id", 'backupApproverEmployeeId', "d"."backup_approver_id") ORDER BY "d"."name") AS "jsonb_agg"
           FROM "public"."departments" "d"
          WHERE ("d"."contract_id" = "c"."id")), '[]'::"jsonb") AS "departments"
   FROM ("public"."contracts" "c"
     LEFT JOIN "public"."contract_admin_policies" "cap" ON (("cap"."contract_id" = "c"."id")));


ALTER VIEW "public"."v_admin_contracts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_employees" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."full_name" AS "name",
    "p"."email",
    COALESCE("d"."name", ''::"text") AS "department",
    COALESCE("p"."grade_level", 0) AS "grade",
    "p"."role",
    "p"."is_active" AS "active",
    "p"."contract_id"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."departments" "d" ON (("d"."id" = "p"."department_id")));


ALTER VIEW "public"."v_admin_employees" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_entitlements" WITH ("security_invoker"='true') AS
 SELECT "id",
    "contract_id",
    "grade_min" AS "gradeMin",
    "grade_max" AS "gradeMax",
    "annual_entitlement" AS "annualDays"
   FROM "public"."leave_entitlement_rules" "r";


ALTER VIEW "public"."v_admin_entitlements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_leave_types" WITH ("security_invoker"='true') AS
 SELECT "id",
    "contract_id",
    "code",
    "name",
    "default_days" AS "defaultDays",
    "pay_category" AS "payCategory",
    "requires_reason" AS "requiresReason",
    "requires_attachment" AS "requiresAttachment",
    "active"
   FROM "public"."leave_types" "lt";


ALTER VIEW "public"."v_admin_leave_types" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_admin_routing" WITH ("security_invoker"='true') AS
 SELECT "cap"."contract_id",
    COALESCE("gm"."full_name", "gm"."email", 'Not set'::"text") AS "generalManager",
    COALESCE("ba"."full_name", "ba"."email", 'None'::"text") AS "backupApprover",
    "cap"."escalation_days" AS "escalationDays"
   FROM (("public"."contract_admin_policies" "cap"
     LEFT JOIN "public"."profiles" "gm" ON (("gm"."id" = "cap"."general_manager_id")))
     LEFT JOIN "public"."profiles" "ba" ON (("ba"."id" = "cap"."default_backup_approver_id")));


ALTER VIEW "public"."v_admin_routing" OWNER TO "postgres";


ALTER TABLE ONLY "public"."approver_delegations"
    ADD CONSTRAINT "approver_delegations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_admin_policies"
    ADD CONSTRAINT "contract_admin_policies_pkey" PRIMARY KEY ("contract_id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_contract_name_key" UNIQUE ("contract_id", "name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_approvals"
    ADD CONSTRAINT "leave_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_user_contract_year_type_key" UNIQUE ("user_id", "contract_id", "policy_year", "leave_type");



ALTER TABLE ONLY "public"."leave_entitlement_rules"
    ADD CONSTRAINT "leave_entitlement_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_entitlement_rules"
    ADD CONSTRAINT "leave_entitlement_rules_unique_band" UNIQUE ("contract_id", "policy_year", "leave_type", "grade_min", "grade_max");



ALTER TABLE ONLY "public"."leave_policies"
    ADD CONSTRAINT "leave_policies_contract_year_key" UNIQUE ("contract_id", "policy_year");



ALTER TABLE ONLY "public"."leave_policies"
    ADD CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "contracts_code_ux" ON "public"."contracts" USING "btree" ("code");



CREATE UNIQUE INDEX "departments_contract_name_ux" ON "public"."departments" USING "btree" ("contract_id", "name");



CREATE INDEX "idx_audit_entity" ON "public"."audit_log" USING "btree" ("entity", "entity_id", "created_at" DESC);



CREATE INDEX "idx_audit_log_contract_id" ON "public"."audit_log" USING "btree" ("contract_id");



CREATE INDEX "idx_cap_backup" ON "public"."contract_admin_policies" USING "btree" ("default_backup_approver_id");



CREATE INDEX "idx_cap_gm" ON "public"."contract_admin_policies" USING "btree" ("general_manager_id");



CREATE INDEX "idx_delegations_delegator" ON "public"."approver_delegations" USING "btree" ("delegator_id", "starts_at", "ends_at");



CREATE INDEX "idx_departments_backup" ON "public"."departments" USING "btree" ("backup_approver_id");



CREATE INDEX "idx_departments_contract" ON "public"."departments" USING "btree" ("contract_id");



CREATE INDEX "idx_departments_contract_id" ON "public"."departments" USING "btree" ("contract_id");



CREATE INDEX "idx_departments_lm" ON "public"."departments" USING "btree" ("line_manager_id");



CREATE INDEX "idx_leave_approvals_approver" ON "public"."leave_approvals" USING "btree" ("approver_id", "created_at" DESC);



CREATE INDEX "idx_leave_approvals_leave" ON "public"."leave_approvals" USING "btree" ("leave_request_id", "created_at" DESC);



CREATE INDEX "idx_leave_balances_contract_year" ON "public"."leave_balances" USING "btree" ("contract_id", "policy_year");



CREATE INDEX "idx_leave_balances_user_year" ON "public"."leave_balances" USING "btree" ("user_id", "policy_year");



CREATE INDEX "idx_leave_requests_contract" ON "public"."leave_requests" USING "btree" ("contract_id");



CREATE INDEX "idx_leave_requests_dept" ON "public"."leave_requests" USING "btree" ("department_id", "start_date", "end_date");



CREATE INDEX "idx_leave_requests_requester" ON "public"."leave_requests" USING "btree" ("requester_id", "created_at" DESC);



CREATE INDEX "idx_leave_requests_status_approver" ON "public"."leave_requests" USING "btree" ("status", "current_approver_id");



CREATE INDEX "idx_leave_types_contract_id" ON "public"."leave_types" USING "btree" ("contract_id");



CREATE INDEX "idx_profiles_contract" ON "public"."profiles" USING "btree" ("contract_id");



CREATE INDEX "idx_profiles_department" ON "public"."profiles" USING "btree" ("department_id");



CREATE INDEX "idx_profiles_grade_level" ON "public"."profiles" USING "btree" ("grade_level");



CREATE INDEX "idx_profiles_line_manager" ON "public"."profiles" USING "btree" ("line_manager_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_super_admin" ON "public"."profiles" USING "btree" ("is_super_admin");



CREATE UNIQUE INDEX "leave_types_id_ux" ON "public"."leave_types" USING "btree" ("id");



CREATE OR REPLACE TRIGGER "trg_audit_leave_approvals" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_leave_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit"();



CREATE OR REPLACE TRIGGER "trg_contract_admin_policies_updated_at" BEFORE UPDATE ON "public"."contract_admin_policies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leave_balances_updated_at" BEFORE UPDATE ON "public"."leave_balances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leave_policies_updated_at" BEFORE UPDATE ON "public"."leave_policies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leave_requests_autofill" BEFORE INSERT ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."leave_requests_autofill"();



CREATE OR REPLACE TRIGGER "trg_leave_requests_balance_delta" AFTER UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."apply_leave_balance_delta"();



CREATE OR REPLACE TRIGGER "trg_leave_requests_updated_at" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_contract_consistency" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_contract_consistency"();



CREATE OR REPLACE TRIGGER "trg_profiles_create_balance" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_initial_leave_balance"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."approver_delegations"
    ADD CONSTRAINT "approver_delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approver_delegations"
    ADD CONSTRAINT "approver_delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."contract_admin_policies"
    ADD CONSTRAINT "contract_admin_policies_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_admin_policies"
    ADD CONSTRAINT "contract_admin_policies_default_backup_approver_id_fkey" FOREIGN KEY ("default_backup_approver_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contract_admin_policies"
    ADD CONSTRAINT "contract_admin_policies_general_manager_id_fkey" FOREIGN KEY ("general_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_backup_approver_id_fkey" FOREIGN KEY ("backup_approver_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_line_manager_id_fkey" FOREIGN KEY ("line_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_approvals"
    ADD CONSTRAINT "leave_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_approvals"
    ADD CONSTRAINT "leave_approvals_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_entitlement_rules"
    ADD CONSTRAINT "leave_entitlement_rules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_entitlement_rules"
    ADD CONSTRAINT "leave_entitlement_rules_leave_type_fkey" FOREIGN KEY ("leave_type") REFERENCES "public"."leave_types"("code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leave_policies"
    ADD CONSTRAINT "leave_policies_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_general_manager_id_fkey" FOREIGN KEY ("general_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_leave_type_fkey" FOREIGN KEY ("leave_type") REFERENCES "public"."leave_types"("code");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_line_manager_id_fkey" FOREIGN KEY ("line_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_backup_approver_id_fkey" FOREIGN KEY ("backup_approver_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_general_manager_id_fkey" FOREIGN KEY ("general_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_line_manager_id_fkey" FOREIGN KEY ("line_manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE "public"."approver_delegations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_no_delete" ON "public"."audit_log" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "audit_no_insert" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "audit_no_update" ON "public"."audit_log" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "audit_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("actor_id" = "auth"."uid"()) OR (("entity" = 'leave_requests'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "audit_log"."entity_id") AND ("lr"."contract_id" = "public"."my_contract_id"()) AND (("lr"."requester_id" = "auth"."uid"()) OR "public"."is_gm"() OR ("public"."is_line_manager"() AND ("lr"."department_id" IS NOT NULL) AND ("lr"."department_id" = "public"."my_department_id"())) OR ("lr"."current_approver_id" = "auth"."uid"()))))))));



CREATE POLICY "cap_read" ON "public"."contract_admin_policies" FOR SELECT TO "authenticated" USING ("public"."can_read_contract"("contract_id"));



CREATE POLICY "cap_rw" ON "public"."contract_admin_policies" TO "authenticated" USING ("public"."can_manage_contract"("contract_id")) WITH CHECK ("public"."can_manage_contract"("contract_id"));



ALTER TABLE "public"."contract_admin_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contracts_admin_write" ON "public"."contracts" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "contracts_read" ON "public"."contracts" FOR SELECT TO "authenticated" USING ("public"."can_read_contract"("id"));



CREATE POLICY "contracts_select" ON "public"."contracts" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("id" = "public"."my_contract_id"())));



CREATE POLICY "contracts_write" ON "public"."contracts" TO "authenticated" USING ("public"."can_manage_contract"("id")) WITH CHECK ("public"."can_manage_contract"("id"));



CREATE POLICY "delegations_delete" ON "public"."approver_delegations" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR ("delegator_id" = "auth"."uid"())));



CREATE POLICY "delegations_insert" ON "public"."approver_delegations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR ("delegator_id" = "auth"."uid"())));



CREATE POLICY "delegations_select" ON "public"."approver_delegations" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("delegator_id" = "auth"."uid"()) OR ("delegate_id" = "auth"."uid"())));



CREATE POLICY "delegations_update" ON "public"."approver_delegations" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR ("delegator_id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR ("delegator_id" = "auth"."uid"())));



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_admin_write" ON "public"."departments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "departments_read" ON "public"."departments" FOR SELECT TO "authenticated" USING ("public"."can_read_contract"("contract_id"));



CREATE POLICY "departments_rw" ON "public"."departments" TO "authenticated" USING ("public"."can_manage_contract"("contract_id")) WITH CHECK ("public"."can_manage_contract"("contract_id"));



CREATE POLICY "departments_select_authenticated" ON "public"."departments" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("contract_id" = "public"."my_contract_id"())));



CREATE POLICY "entitlement_read" ON "public"."leave_entitlement_rules" FOR SELECT TO "authenticated" USING ("public"."can_read_contract"("contract_id"));



CREATE POLICY "entitlement_rw" ON "public"."leave_entitlement_rules" TO "authenticated" USING ("public"."can_manage_contract"("contract_id")) WITH CHECK ("public"."can_manage_contract"("contract_id"));



ALTER TABLE "public"."leave_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_approvals_admin_delete" ON "public"."leave_approvals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "leave_approvals_admin_mutate" ON "public"."leave_approvals" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_approvals_insert_approver" ON "public"."leave_approvals" FOR INSERT TO "authenticated" WITH CHECK ((("approver_id" = "auth"."uid"()) OR "public"."is_delegate_for"("approver_id") OR "public"."is_admin"()));



CREATE POLICY "leave_approvals_select_via_request" ON "public"."leave_approvals" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_approvals"."leave_request_id") AND ("public"."is_super_admin"() OR (("lr"."contract_id" = "public"."my_contract_id"()) AND (("lr"."requester_id" = "auth"."uid"()) OR "public"."is_gm"() OR ("public"."is_line_manager"() AND ("lr"."department_id" IS NOT NULL) AND ("lr"."department_id" = "public"."my_department_id"())) OR ("lr"."current_approver_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."leave_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_balances_admin_update" ON "public"."leave_balances" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_balances_admin_write" ON "public"."leave_balances" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_balances_select_access" ON "public"."leave_balances" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (("contract_id" = "public"."my_contract_id"()) AND (("user_id" = "auth"."uid"()) OR "public"."is_gm"() OR ("public"."is_line_manager"() AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "leave_balances"."user_id") AND ("p"."department_id" = "public"."my_department_id"()) AND ("p"."contract_id" = "public"."my_contract_id"())))))))));



ALTER TABLE "public"."leave_entitlement_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_policies_admin_write" ON "public"."leave_policies" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_policies_select_authenticated" ON "public"."leave_policies" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("contract_id" = "public"."my_contract_id"())));



ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_requests_admin_delete" ON "public"."leave_requests" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "leave_requests_insert_self" ON "public"."leave_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = "auth"."uid"()) AND (("department_id" IS NULL) OR ("department_id" = "public"."my_department_id"()))));



CREATE POLICY "leave_requests_select_access" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (("contract_id" = "public"."my_contract_id"()) AND (("requester_id" = "auth"."uid"()) OR "public"."is_gm"() OR ("public"."is_line_manager"() AND ("department_id" IS NOT NULL) AND ("department_id" = "public"."my_department_id"()))))));



CREATE POLICY "leave_requests_update" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR ("requester_id" = "auth"."uid"()) OR ("current_approver_id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR ("requester_id" = "auth"."uid"()) OR ("current_approver_id" = "auth"."uid"()) OR ("decided_by" = "auth"."uid"())));



ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_types_admin_write" ON "public"."leave_types" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_types_read" ON "public"."leave_types" FOR SELECT TO "authenticated" USING ("public"."can_read_contract"("contract_id"));



CREATE POLICY "leave_types_rw" ON "public"."leave_types" TO "authenticated" USING ("public"."can_manage_contract"("contract_id")) WITH CHECK ("public"."can_manage_contract"("contract_id"));



CREATE POLICY "leave_types_select_authenticated" ON "public"."leave_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ler_delete" ON "public"."leave_entitlement_rules" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"() OR ("public"."is_admin"() AND ("contract_id" = "public"."my_contract_id"()))));



CREATE POLICY "ler_insert" ON "public"."leave_entitlement_rules" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"() OR ("public"."is_admin"() AND ("contract_id" = "public"."my_contract_id"()))));



CREATE POLICY "ler_select" ON "public"."leave_entitlement_rules" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("contract_id" = "public"."my_contract_id"())));



CREATE POLICY "ler_update" ON "public"."leave_entitlement_rules" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"() OR ("public"."is_admin"() AND ("contract_id" = "public"."my_contract_id"())))) WITH CHECK (("public"."is_super_admin"() OR ("public"."is_admin"() AND ("contract_id" = "public"."my_contract_id"()))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles_manager_select_department" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (("contract_id" = "public"."my_contract_id"()) AND ("public"."is_gm"() OR ("public"."is_line_manager"() AND ("department_id" IS NOT NULL) AND ("department_id" = "public"."my_department_id"()))))));



CREATE POLICY "profiles_read_same_contract" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "me"
  WHERE (("me"."id" = "auth"."uid"()) AND (("me"."is_super_admin" = true) OR ("me"."contract_id" = "profiles"."contract_id"))))));



CREATE POLICY "profiles_self_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_update_limited" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."apply_leave_balance_delta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_leave_balance_delta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_contract"("p_contract_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_contract"("p_contract_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_contract"("p_contract_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_contract"("p_contract_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_annual_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_leave_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_leave_entitlement"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_initial_leave_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_initial_leave_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_profile_contract_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_contract_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_leave_balance"("p_user_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_leave_balance"("p_user_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_leave_balance_typed"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_leave_balance_typed"("p_user_id" "uuid", "p_contract_id" "uuid", "p_year" integer, "p_leave_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_leave_balances_for_user_year"("p_user_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_leave_balances_for_user_year"("p_user_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."escalate_overdue_leave_requests"("p_cutoff" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."escalate_overdue_leave_requests"("p_cutoff" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_delegate_for"("delegator" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_delegate_for"("delegator" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_delegate_for"("delegator" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_gm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gm"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_gm_of"("requester" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_gm_of"("requester" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gm_of"("requester" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_line_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_line_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_line_manager_of"("requester" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_line_manager_of"("requester" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_line_manager_of"("requester" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_my_department"("dept" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_my_department"("dept" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_my_department"("dept" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_requests_autofill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_requests_autofill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_contract_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_contract_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_department_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_department_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rollover_leave_balances"("p_from_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollover_leave_balances"("p_from_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."approver_delegations" TO "authenticated";
GRANT ALL ON TABLE "public"."approver_delegations" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."contract_admin_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_admin_policies" TO "service_role";



GRANT ALL ON TABLE "public"."contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."leave_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."leave_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_balances" TO "service_role";



GRANT ALL ON TABLE "public"."leave_entitlement_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_entitlement_rules" TO "service_role";



GRANT ALL ON TABLE "public"."leave_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_policies" TO "service_role";



GRANT ALL ON TABLE "public"."leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."leave_types" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_types" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_carry_forward" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_carry_forward" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_employees" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_leave_types" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_leave_types" TO "service_role";



GRANT ALL ON TABLE "public"."v_admin_routing" TO "authenticated";
GRANT ALL ON TABLE "public"."v_admin_routing" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































