create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.advertisement_slots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null check (image_url ~ '^https?://'),
  image_path text,
  target_url text not null check (target_url ~ '^https?://'),
  placement text not null check (placement in ('dashboard', 'spots')),
  enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-assets', 'partner-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists support_conversations_rider_updated_idx
  on public.support_conversations (rider_id, updated_at desc);
create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at);
create index if not exists advertisement_slots_placement_enabled_idx
  on public.advertisement_slots (placement, enabled);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.advertisement_slots enable row level security;

create policy "Riders and admins can read support conversations"
  on public.support_conversations for select to authenticated
  using (
    rider_id = (select auth.uid())
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Riders can open their own support conversations"
  on public.support_conversations for insert to authenticated
  with check (
    rider_id = (select auth.uid())
    and status = 'open'
  );

create policy "Admins can update support conversations"
  on public.support_conversations for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Riders can update their own open support conversations"
  on public.support_conversations for update to authenticated
  using (
    rider_id = (select auth.uid())
    and status = 'open'
  )
  with check (
    rider_id = (select auth.uid())
    and status = 'open'
  );

create policy "Riders and admins can read messages in their support conversations"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1
      from public.support_conversations conversation
      where conversation.id = conversation_id
        and (
          conversation.rider_id = (select auth.uid())
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        )
    )
  );

create policy "Riders and admins can send messages to their support conversations"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.support_conversations conversation
      where conversation.id = conversation_id
        and conversation.status = 'open'
        and (
          conversation.rider_id = (select auth.uid())
          or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        )
    )
  );

create policy "Anyone can read enabled advertisement slots"
  on public.advertisement_slots for select to anon, authenticated
  using (
    enabled
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can add advertisements"
  on public.advertisement_slots for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and created_by = (select auth.uid())
  );

create policy "Admins can update advertisements"
  on public.advertisement_slots for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete advertisements"
  on public.advertisement_slots for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Anyone can read public partner images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'partner-assets');

create policy "Admins can upload partner images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'partner-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can update partner images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'partner-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'partner-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can delete partner images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'partner-assets'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select on public.advertisement_slots to anon, authenticated;
grant insert, update, delete on public.advertisement_slots to authenticated;
