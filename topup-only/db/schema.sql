create table if not exists projects (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id bigserial primary key,
  discord_user_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  id bigserial primary key,
  user_id bigint not null references users(id),
  project_id text not null references projects(id),
  currency text not null default 'THB',
  balance numeric(14,2) not null default 0,
  total_accumulated_topup numeric(14,2) not null default 0,
  truemoney_topup numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create table if not exists topup_transactions (
  id bigserial primary key,
  wallet_id bigint not null references wallets(id) on delete cascade,
  amount numeric(14,2) not null,
  method text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (wallet_id, occurred_at, amount, method)
);

create index if not exists topup_transactions_wallet_time_idx
  on topup_transactions (wallet_id, occurred_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_wallets_updated_at on wallets;
create trigger set_wallets_updated_at
before update on wallets
for each row
execute function set_updated_at();
