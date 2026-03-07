-- OTP verification codes table
create table if not exists whozin_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_whozin_otp_codes_phone on whozin_otp_codes(phone);

-- Push token column for notification routing
alter table whozin_users add column if not exists push_token text;

-- Update the handle_new_user trigger to handle linking with existing invited users
create or replace function handle_new_user()
returns trigger as $$
declare
  v_phone text;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_existing_user uuid;
begin
  -- Extract phone from synthetic email (e.g., +16193019180@whozin.io)
  if new.email like '%@whozin.io' then
    v_phone := replace(new.email, '@whozin.io', '');
    v_email := null;
  elsif new.email like '%@whozin.app' then
    v_phone := replace(new.email, '@whozin.app', '');
    v_email := null;
  else
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_email := new.email;
  end if;

  v_first_name := coalesce(new.raw_user_meta_data->>'first_name', '');
  v_last_name := coalesce(new.raw_user_meta_data->>'last_name', '');

  -- Check if an invited user already exists with this phone
  select id into v_existing_user
    from public.whozin_users
    where phone = v_phone and auth_user_id is null
    limit 1;

  if v_existing_user is not null then
    -- Link existing invited user to this auth account
    update public.whozin_users
      set auth_user_id = new.id,
          status = 'active',
          first_name = case when v_first_name != '' then v_first_name else first_name end,
          last_name = case when v_last_name != '' then v_last_name else last_name end,
          email = coalesce(v_email, email),
          updated_at = now()
      where id = v_existing_user;
  else
    -- Create new whozin_users record
    insert into public.whozin_users (
      auth_user_id, phone, country_code, first_name, last_name, email
    ) values (
      new.id,
      v_phone,
      coalesce(new.raw_user_meta_data->>'country_code', '1'),
      v_first_name,
      v_last_name,
      v_email
    )
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;
