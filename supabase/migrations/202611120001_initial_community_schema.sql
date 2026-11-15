create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  rider_profile jsonb not null default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  ai_history_consent boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source_url text not null check (source_url ~ '^https?://'),
  description text not null default '',
  type text not null default 'bikepark'
    check (type in ('bikepark', 'pumptrack', 'enduro', 'dirt', 'street')),
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Нова розмова',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists spots_status_idx on public.spots (status);
create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.spots enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update all profiles"
  on public.profiles for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Anyone can read verified spots"
  on public.spots for select to anon, authenticated
  using (
    status = 'verified'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can add spots"
  on public.spots for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and created_by = (select auth.uid())
  );

create policy "Admins can update spots"
  on public.spots for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete spots"
  on public.spots for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can read their own conversations"
  on public.ai_conversations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own conversations"
  on public.ai_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own conversations"
  on public.ai_conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own conversations"
  on public.ai_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read messages in their own conversations"
  on public.ai_messages for select to authenticated
  using (
    exists (
      select 1
      from public.ai_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

create policy "Users can add messages to their own conversations"
  on public.ai_messages for insert to authenticated
  with check (
    exists (
      select 1
      from public.ai_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.profiles to authenticated;
grant select on public.spots to anon, authenticated;
grant insert, update, delete on public.spots to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
