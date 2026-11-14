-- Run this entire file in Supabase SQL Editor, then create an Admin user in Authentication.
create table if not exists public.build_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.build_scores (
 id uuid primary key default gen_random_uuid(),
 player_name text not null check (length(trim(player_name)) between 1 and 32),
 project_name text not null check (length(trim(project_name)) between 1 and 120),
 category text not null check (category in ('self','litematica','assist','plan')),
 criteria_scores jsonb not null,
 points numeric(6,1) not null check (points >= 0 and points <= 100),
 note text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint score_limit check (
  (category in ('self','litematica') and points <= 10)
  or (category = 'assist' and points <= 6)
  or (category = 'plan' and points <= 100)
 )
);
create or replace function public.valid_build_score(cat text, vals jsonb, total numeric)
returns boolean language plpgsql immutable set search_path = '' as $$
declare caps numeric[]; n numeric; i int; score numeric:=0;
begin
 caps := case cat
  when 'self' then array[2,2.5,2,2,1.5]::numeric[]
  when 'litematica' then array[3,3,2,2]::numeric[]
  when 'assist' then array[2,1.5,1.5,1]::numeric[]
  when 'plan' then array[20,20,15,15,15,10,5]::numeric[]
  else null end;
 if caps is null or jsonb_typeof(vals) <> 'array' or jsonb_array_length(vals) <> array_length(caps,1) then return false; end if;
 for i in 1..array_length(caps,1) loop
  if jsonb_typeof(vals->(i-1)) <> 'number' then return false; end if;
  n := (vals->>(i-1))::numeric;
  if n < 0 or n > caps[i] or n*2 <> trunc(n*2) then return false; end if;
  score := score+n;
 end loop;
 return score=total;
exception when others then return false;
end $$;
alter table public.build_scores drop constraint if exists valid_criteria;
alter table public.build_scores add constraint valid_criteria check (public.valid_build_score(category,criteria_scores,points));
alter table public.build_scores enable row level security;
alter table public.build_admins enable row level security;
drop policy if exists "Admins can read own role" on public.build_admins;
create policy "Admins can read own role" on public.build_admins for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Public can view scores" on public.build_scores;
create policy "Public can view scores" on public.build_scores for select to anon,authenticated using (true);
drop policy if exists "Admins can insert scores" on public.build_scores;
create policy "Admins can insert scores" on public.build_scores for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.build_admins where user_id=(select auth.uid()))
);
drop policy if exists "Admins can delete scores" on public.build_scores;
create policy "Admins can delete scores" on public.build_scores for delete to authenticated using (
 exists(select 1 from public.build_admins where user_id=(select auth.uid()))
);
-- After creating the admin email user, run separately (replace UUID):
-- insert into public.build_admins(user_id) values ('UUID-CUA-ADMIN');
