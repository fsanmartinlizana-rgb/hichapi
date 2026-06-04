import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log("Connected to the database.");

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260410_020_usuario_comensal.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log("Applying 20260410_020_usuario_comensal.sql...");
    await client.query(sql);
    console.log("Migration applied successfully!");

    // Also apply the seed if the user wants it, or at least reload schema
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("PostgREST schema reloaded successfully.");

  } catch (e) {
    console.error("Error applying migration:", e);
  } finally {
    await client.end();
  }
}

run();
