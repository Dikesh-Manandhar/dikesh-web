const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Please configure an environment variable.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Please configure your PostgreSQL connection string.');
  process.exit(1);
}

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:8000'];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const SAFE_ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
const isProduction = process.env.NODE_ENV === 'production';
const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true';

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (SAFE_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: cookieSecure
  });
};

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    res.json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { sameSite: 'lax', secure: cookieSecure });
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/habits', authenticateToken, async (req, res) => {
  try {
    const habitsResult = await pool.query(
      'SELECT id, name, created_at FROM habits WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const habits = habitsResult.rows;

    const habitsWithCompletions = await Promise.all(
      habits.map(async (habit) => {
        const completionsResult = await pool.query(
          'SELECT date FROM completions WHERE habit_id = $1 ORDER BY date DESC',
          [habit.id]
        );

        return {
          id: habit.id,
          name: habit.name,
          created_at: habit.created_at,
          completedDates: completionsResult.rows.map(c => c.date.toISOString().split('T')[0])
        };
      })
    );

    res.json({ habits: habitsWithCompletions });
  } catch (error) {
    console.error('Get habits error:', error.message);
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Habit name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO habits (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [req.userId, name.trim()]
    );

    const habit = result.rows[0];
    res.json({
      message: 'Habit created',
      habit: {
        id: habit.id,
        name: habit.name,
        created_at: habit.created_at,
        completedDates: []
      }
    });
  } catch (error) {
    console.error('Create habit error:', error.message);
    res.status(500).json({ error: 'Failed to create habit' });
  }
});

app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  try {
    const verifyResult = await pool.query(
      'SELECT user_id FROM habits WHERE id = $1',
      [habitId]
    );

    if (verifyResult.rows.length === 0 || verifyResult.rows[0].user_id !== req.userId) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    await pool.query('DELETE FROM habits WHERE id = $1', [habitId]);
    res.json({ message: 'Habit deleted' });
  } catch (error) {
    console.error('Delete habit error:', error.message);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
});

app.post('/api/habits/:id/toggle', authenticateToken, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.body;

  try {
    const verifyResult = await pool.query(
      'SELECT user_id FROM habits WHERE id = $1',
      [habitId]
    );

    if (verifyResult.rows.length === 0 || verifyResult.rows[0].user_id !== req.userId) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const completionResult = await pool.query(
      'SELECT id FROM completions WHERE habit_id = $1 AND date = $2',
      [habitId, date]
    );

    if (completionResult.rows.length > 0) {
      await pool.query(
        'DELETE FROM completions WHERE habit_id = $1 AND date = $2',
        [habitId, date]
      );
      return res.json({ message: 'Completion removed', completed: false });
    }

    await pool.query(
      'INSERT INTO completions (habit_id, date) VALUES ($1, $2)',
      [habitId, date]
    );
    res.json({ message: 'Completion added', completed: true });
  } catch (error) {
    console.error('Toggle completion error:', error.message);
    res.status(500).json({ error: 'Failed to toggle completion' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Habit Tracker server running on http://localhost:${PORT}`);
  console.log(`📝 Login page: http://localhost:${PORT}/login.html`);
  console.log(`🗄️  Connected to PostgreSQL database`);
});
