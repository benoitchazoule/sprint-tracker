#!/usr/bin/env node

/**
 * Migration script: data.json → Supabase
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js <user-email>
 *
 * Environment variables (from .env.local or exported):
 *   VITE_SUPABASE_URL       — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data.json');

// Load .env.local if it exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set them in .env.local or as environment variables.');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/migrate-to-supabase.js <user-email>');
  console.error('The email must belong to an existing Supabase auth user.');
  process.exit(1);
}

// Service role client bypasses RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Read data.json
  if (!fs.existsSync(DATA_PATH)) {
    console.error('data.json not found at', DATA_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`Found ${data.projects?.length || 0} projects, ${data.developers?.length || 0} developers, ${data.dayEntries?.length || 0} day entries`);

  // 2. Look up user by email
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error('Error listing users:', userErr.message);
    process.exit(1);
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    console.error(`No user found with email: ${email}`);
    console.error('Available users:', users.map((u) => u.email).join(', ') || '(none)');
    console.error('Create the user first by signing up in the app.');
    process.exit(1);
  }
  console.log(`Migrating data to user: ${user.email} (${user.id})`);

  // 3. Insert projects
  if (data.projects?.length) {
    const rows = data.projects.map((p) => ({
      id: p.id,
      user_id: user.id,
      name: p.name,
      client_name: p.clientName || null,
      days_per_sprint: p.daysPerSprint || 18,
      start_date: p.startDate,
      sprint_count: p.sprintCount || 1,
      created_at: p.createdAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from('projects').upsert(rows);
    if (error) {
      console.error('Error inserting projects:', error.message);
      process.exit(1);
    }
    console.log(`Inserted ${rows.length} projects`);
  }

  // 4. Insert developers
  if (data.developers?.length) {
    const rows = data.developers.map((d) => ({
      id: d.id,
      project_id: d.projectId,
      name: d.name,
      start_date: d.startDate || null,
      end_date: d.endDate || null,
      order: d.order ?? 0,
      created_at: d.createdAt || new Date().toISOString(),
    }));

    const { error } = await supabase.from('developers').upsert(rows);
    if (error) {
      console.error('Error inserting developers:', error.message);
      process.exit(1);
    }
    console.log(`Inserted ${rows.length} developers`);
  }

  // 5. Insert day entries in batches
  if (data.dayEntries?.length) {
    const rows = data.dayEntries.map((e) => ({
      id: e.id,
      project_id: e.projectId,
      developer_id: e.developerId,
      date: e.date,
      worked: e.worked ?? 1,
      comment: e.comment || '',
    }));

    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('day_entries').upsert(chunk);
      if (error) {
        console.error(`Error inserting day entries batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        process.exit(1);
      }
      inserted += chunk.length;
      console.log(`Inserted ${inserted}/${rows.length} day entries...`);
    }
  }

  console.log('Migration complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
