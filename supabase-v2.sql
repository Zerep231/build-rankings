-- EQUAL SURVIVAL v2: player accounts, gallery, feedback, announcements, plugin view.
-- Run AFTER supabase.sql, as one script, in the Supabase SQL Editor. Safe to re-run.

-- ============ Helpers ============
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.build_admins where user_id = (select auth.uid()));
$$;

-- ============ Player profiles (name = Minecraft name, self-declared) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create or replace function public.is_active_player()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and not is_banned);
$$;

-- A profile is created automatically when someone signs up with { data: { username } }.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare name text := new.raw_user_meta_data ->> 'username';
begin
  if name is not null then
    insert into public.profiles (id, username) values (new.id, name);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: accounts created before this script ran (no profile yet).
insert into public.profiles (id, username)
select u.id, u.raw_user_meta_data ->> 'username'
  from auth.users u
 where (u.raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,16}$'
on conflict do nothing;

alter table public.profiles enable row level security;
drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ Announcements and events (admin only) ============
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'news' check (kind in ('news', 'event')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 5000),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  starts_at timestamptz,
  ends_at timestamptz,
  pinned boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
alter table public.announcements enable row level security;
drop policy if exists "Announcements are public" on public.announcements;
create policy "Announcements are public" on public.announcements for select to anon, authenticated using (true);
drop policy if exists "Admins write announcements" on public.announcements;
create policy "Admins write announcements" on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ Gallery ============
create table if not exists public.gallery_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 80),
  caption text not null default '' check (length(caption) <= 500),
  image_path text not null,
  hidden boolean not null default false,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_posts_created on public.gallery_posts (created_at desc);

create table if not exists public.gallery_reports (
  post_id uuid not null references public.gallery_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null default '' check (length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

-- Players cannot set moderation fields themselves; at most 5 posts per day.
create or replace function public.gallery_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.hidden := false;
    new.report_count := 0;
    if (select count(*) from public.gallery_posts
        where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Bạn đã đăng đủ 5 ảnh trong 24 giờ, hãy quay lại sau nhé.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists gallery_before_insert on public.gallery_posts;
create trigger gallery_before_insert before insert on public.gallery_posts
  for each row execute function public.gallery_before_insert();

-- 3 reports from different players hide a post until an admin reviews it.
create or replace function public.gallery_after_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.gallery_posts
     set report_count = report_count + 1,
         hidden = hidden or report_count + 1 >= 3
   where id = new.post_id;
  return new;
end $$;
drop trigger if exists gallery_after_report on public.gallery_reports;
create trigger gallery_after_report after insert on public.gallery_reports
  for each row execute function public.gallery_after_report();

alter table public.gallery_posts enable row level security;
alter table public.gallery_reports enable row level security;
drop policy if exists "Visible posts are public" on public.gallery_posts;
create policy "Visible posts are public" on public.gallery_posts for select to anon, authenticated
  using (not hidden or user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Players post images" on public.gallery_posts;
create policy "Players post images" on public.gallery_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_player());
drop policy if exists "Owner or admin deletes post" on public.gallery_posts;
create policy "Owner or admin deletes post" on public.gallery_posts for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Admins moderate posts" on public.gallery_posts;
create policy "Admins moderate posts" on public.gallery_posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Players report posts" on public.gallery_reports;
create policy "Players report posts" on public.gallery_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_active_player());
drop policy if exists "Admins read reports" on public.gallery_reports;
create policy "Admins read reports" on public.gallery_reports for select to authenticated
  using (public.is_admin() or reporter_id = (select auth.uid()));

-- Storage bucket: public read, 2 MB WebP/JPEG/PNG, players write only in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];
drop policy if exists "Gallery images are public" on storage.objects;
create policy "Gallery images are public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'gallery');
drop policy if exists "Players upload to own folder" on storage.objects;
create policy "Players upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.is_active_player());
drop policy if exists "Owner or admin deletes image" on storage.objects;
create policy "Owner or admin deletes image" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ============ Bug reports and suggestions ============
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('bug', 'suggestion')),
  title text not null check (length(trim(title)) between 3 and 120),
  body text not null check (length(trim(body)) between 5 and 3000),
  is_private boolean not null default false, -- exploits: only author and admins can read
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  admin_reply text check (admin_reply is null or length(admin_reply) <= 2000),
  vote_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_created on public.tickets (created_at desc);

create table if not exists public.ticket_votes (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (ticket_id, user_id)
);

create or replace function public.tickets_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and not public.is_admin() then
    new.status := 'new';
    new.admin_reply := null;
    new.vote_count := 0;
    if (select count(*) from public.tickets
        where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'Bạn đã gửi đủ 10 góp ý trong 24 giờ, hãy quay lại sau nhé.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tickets_before_write on public.tickets;
create trigger tickets_before_write before insert or update on public.tickets
  for each row execute function public.tickets_before_write();

create or replace function public.ticket_votes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets set vote_count = vote_count + (case when tg_op = 'INSERT' then 1 else -1 end)
   where id = coalesce(new.ticket_id, old.ticket_id);
  return null;
end $$;
drop trigger if exists ticket_votes_count on public.ticket_votes;
create trigger ticket_votes_count after insert or delete on public.ticket_votes
  for each row execute function public.ticket_votes_count();

alter table public.tickets enable row level security;
alter table public.ticket_votes enable row level security;
drop policy if exists "Public tickets are readable" on public.tickets;
create policy "Public tickets are readable" on public.tickets for select to anon, authenticated
  using (not is_private or user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Players open tickets" on public.tickets;
create policy "Players open tickets" on public.tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_player());
drop policy if exists "Admins update tickets" on public.tickets;
create policy "Admins update tickets" on public.tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Owner or admin deletes ticket" on public.tickets;
create policy "Owner or admin deletes ticket" on public.tickets for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Votes are public" on public.ticket_votes;
create policy "Votes are public" on public.ticket_votes for select to anon, authenticated using (true);
drop policy if exists "Players vote" on public.ticket_votes;
create policy "Players vote" on public.ticket_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_player());
drop policy if exists "Players unvote" on public.ticket_votes;
create policy "Players unvote" on public.ticket_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============ View for the DirtyLeaderboards plugin ============
-- Total BP per player and category, summed inside the database. The plugin reads this
-- with the public key (read-only), so no secret key is needed for BP -> in-game sync.
create or replace view public.build_leaderboard with (security_invoker = true) as
  select lower(player_name) as player_key,
         min(player_name) as player_name,
         category,
         sum(points)::numeric(10,1) as total_points,
         count(*)::int as reviews
    from public.build_scores
   group by lower(player_name), category;
grant select on public.build_leaderboard to anon, authenticated;
