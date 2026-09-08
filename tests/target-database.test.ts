import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('actual PostgreSQL migration preserves legacy rows and enforces first-year/annual quotas', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.profiles (
      id text primary key, birth_date date not null, target_age integer,
      target_date date not null, created_at timestamptz not null default now(),
      target_locked_until timestamptz not null default now(), actual_death_date date,
      display_name text
    );
    create function public.enforce_profile_target_lock() returns trigger language plpgsql as $$ begin return new; end; $$;
    create trigger profiles_enforce_target_lock before insert or update on public.profiles for each row execute function public.enforce_profile_target_lock();`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20260907150000_annual_target_adjustments.sql', import.meta.url),'utf8'));
    await db.exec("insert into profiles(id,birth_date,target_age,target_date) values ('legacy','1980-02-29',80,'2060-02-29')");
    const snapshot = (await db.query('select * from profiles')).rows;
    await db.exec(readFileSync(new URL('../supabase/migrations/20260908210000_flexible_target_adjustments.sql', import.meta.url),'utf8'));
    assert.deepEqual((await db.query('select * from profiles')).rows,snapshot);
    const age = async (value:number) => db.query("update profiles set target_age=$1,target_date=('1980-02-29'::date+make_interval(years=>$1))::date where id='legacy'",[value]);
    const used = async () => (await db.query<{target_change_count:number}>('select target_change_count from profiles')).rows[0].target_change_count;
    await db.exec("update profiles set display_name='Synthetic only'");
    await age(80); assert.equal(await used(),0); // preference save / no-op are free
    await age(81); await age(82); await age(83); assert.equal(await used(),3);
    await assert.rejects(age(84),/TARGET_CHANGE_LOCKED/);
    for (const assignment of ["birth_date='1981-01-01'", "target_change_count=0", "created_at=now()-interval '2 years'", "target_locked_until=now()", "actual_death_date=current_date"])
      await assert.rejects(db.exec('update profiles set '+assignment));
    // Synthetic fixtures only: at the exact first anniversary, the fourth is allowed.
    await db.exec(`begin; alter table profiles disable trigger profiles_enforce_target_lock;
      update profiles set created_at=now()-interval '1 year',target_locked_until=now();
      alter table profiles enable trigger profiles_enforce_target_lock;`);
    await age(84); assert.equal(await used(),4);
    await assert.rejects(age(85),/TARGET_CHANGE_LOCKED/);
    await db.exec('rollback'); // restores first-year fixture with 3 changes
    for (let i=4;i<=7;i++) {
      await db.exec(`alter table profiles disable trigger profiles_enforce_target_lock;
        update profiles set created_at=now()-interval '10 years',target_locked_until=now()-interval '1 second';
        alter table profiles enable trigger profiles_enforce_target_lock;`);
      await age(80+i); assert.equal(await used(),i);
    }
    await assert.rejects(age(88),/TARGET_CHANGE_LIMIT/);
    // New insert cannot inject an old creation date or a modified quota.
    await db.exec("insert into profiles(id,birth_date,target_age,target_date,created_at,target_change_count) values ('new','1980-01-01',80,'2060-01-01','2000-01-01',7)");
    const fresh = (await db.query<{target_change_count:number; recent:boolean}>("select target_change_count,created_at>now()-interval '1 minute' as recent from profiles where id='new'")).rows[0];
    assert.deepEqual(fresh,{target_change_count:0,recent:true});
  } finally { await db.close(); }
});
