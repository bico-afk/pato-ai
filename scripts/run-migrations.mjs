/**
 * run-migrations.mjs
 * Executa todas as migrations do Bikco no Supabase via DATABASE_URL.
 *
 * Uso:
 *   1. Adicione ao .env.local:
 *      DATABASE_URL=postgresql://postgres:[SUA_SENHA]@db.hbiifqlyynddfvgabkjf.supabase.co:5432/postgres
 *
 *   2. Execute:
 *      node scripts/run-migrations.mjs
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually
const envPath = join(__dirname, '..', '.env.local')
try {
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL não encontrada no .env.local')
  console.error('    Adicione: DATABASE_URL=postgresql://postgres:[senha]@db.hbiifqlyynddfvgabkjf.supabase.co:5432/postgres')
  process.exit(1)
}

// Dynamically import pg (install if needed: npm i pg)
let pg
try {
  pg = require('pg')
} catch {
  console.error('❌  Módulo "pg" não encontrado. Instale com: npm i pg')
  process.exit(1)
}

const { Client } = pg
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

async function run() {
  await client.connect()
  console.log('✅  Conectado ao banco de dados\n')

  // Read migration files in order, skip _all.sql
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`▶  Executando ${file}...`)
    try {
      await client.query(sql)
      console.log(`   ✓ ok\n`)
    } catch (err) {
      console.error(`   ✗ Erro: ${err.message}\n`)
      // Continue — idempotente com IF NOT EXISTS
    }
  }

  await client.end()
  console.log('🎉  Migrations concluídas.')
}

run().catch(err => {
  console.error('Erro fatal:', err)
  client.end()
  process.exit(1)
})
