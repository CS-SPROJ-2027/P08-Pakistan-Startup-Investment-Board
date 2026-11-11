/**
 * Database connection.
 * Creates one PostgreSQL connection pool that the whole app shares.
 * Uses DATABASE_URL if it is set (hosted databases), otherwise the
 * separate DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME values.
 */
const { Pool } = require('pg');
const logger = require('./logger');

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

const settings = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'psib',
      ssl,
    };

const pool = new Pool(settings);

pool.on('error', (err) => {
  logger.error(`Unexpected database error: ${err.message}`);
});

module.exports = pool;
