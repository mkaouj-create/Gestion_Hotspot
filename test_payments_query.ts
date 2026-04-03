import { db } from './services/db';

async function testQuery() {
  console.log("Testing connection...");
  
  const { data: users, error: usersError } = await db.from('users').select('*').limit(2);
  if (usersError) console.error("Users Error:", usersError.message);
  else console.log("Users:", JSON.stringify(users, null, 2));

  const { data: tenants, error: tenantsError } = await db.from('tenants').select('*').limit(2);
  if (tenantsError) console.error("Tenants Error:", tenantsError.message);
  else console.log("Tenants:", JSON.stringify(tenants, null, 2));
}

testQuery();
