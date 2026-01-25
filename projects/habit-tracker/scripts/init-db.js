/**
 * Database initialization and migration script
 * Run this once when setting up a new database:
 * NODE_ENV=production node scripts/init-db.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    console.log('🗄️  Initializing database...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created/verified');

    // Create habits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Habits table created/verified');

    // Create completions table (tracks daily completions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS completions (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, date)
      );
    `);
    console.log('✅ Completions table created/verified');

    // Create indexes for common queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
      CREATE INDEX IF NOT EXISTS idx_completions_habit_id ON completions(habit_id);
      CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
    `);
    console.log('✅ Indexes created/verified');

    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
