-- Update handle_new_user trigger to use whozin.io domain

create or replace function handle_new_user()
returns trigger as $$
declare
  v_phone text;
  v_first_name text;
  v_last_name text;
  v_email text;
begin
  if new.email like '%@whozin.io' then
    v_phone := replace(new.email, '@whozin.io', '');
    v_email := null;
  else
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_email := new.email;
  end if;

  v_first_name := coalesce(new.raw_user_meta_data->>'first_name', '');
  v_last_name := coalesce(new.raw_user_meta_data->>'last_name', '');

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

  return new;
end;
$$ language plpgsql security definer;
