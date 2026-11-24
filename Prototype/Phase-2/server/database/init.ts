/**
 * Database setup script.
 * Runs schema.sql to create the tables, then creates the admin account
 * from ADMIN_EMAIL and ADMIN_PASSWORD in .env if it does not exist yet.
 * Usage: npm run db:init
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db';
import logger from '../src/config/logger';

// Turns a connection error into a message that says what to fix
function describeError(err: any): string {
  const code = err.code || (err.errors && err.errors[0] && err.errors[0].code);
  if (code === 'ECONNREFUSED') {
    return 'Cannot connect to PostgreSQL. Make sure the PostgreSQL service is running.';
  }
  if (code === '28P01') {
    return 'Wrong PostgreSQL username or password. Check DB_USER and DB_PASSWORD in .env.';
  }
  if (code === '3D000') {
    return 'Database does not exist. Create a database called psib first.';
  }
  if (err.message && err.message.includes('Invalid URL')) {
    return 'DATABASE_URL is not valid. Leave it empty and use DB_USER, DB_PASSWORD etc. instead.';
  }
  return err.message || String(err);
}

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set in .env, so no admin account was created');
    return;
  }
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ('Platform Administrator', $1, $2, 'admin', 'approved')`,
    [email.toLowerCase(), passwordHash]
  );
  logger.info(`Admin account created: ${email}`);
}

async function init() {
  try {
    // read schema.sql from the database folder (run from the server folder)
    const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8');
    await pool.query(sql);
    logger.info('Tables created');
    await createAdmin();
    logger.info('Database is ready');
  } catch (err) {
    logger.error(`Database setup failed: ${describeError(err)}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
