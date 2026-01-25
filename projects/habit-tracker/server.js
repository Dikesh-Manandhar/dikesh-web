const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Please configure an environment variable.');
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

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
  habits: [],
  completions: []
};

async function loadData() {
  try {
    const fileData = await fs.readFile(DATA_FILE, 'utf8');
    data = JSON.parse(fileData);
  } catch (error) {
    await saveData();
  }
}

async function saveData() {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

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

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    if (data.users.find(u => u.email === email || u.username === username)) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: data.users.length + 1,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    data.users.push(user);
    await saveData();

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    res.json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = data.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { sameSite: 'lax', secure: cookieSecure });
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/user', authenticateToken, (req, res) => {
  const user = data.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: { id: user.id, username: user.username, email: user.email } });
});

app.get('/api/habits', authenticateToken, (req, res) => {
  const userHabits = data.habits.filter(h => h.userId === req.userId);

  const habitsWithCompletions = userHabits.map(habit => {
    const completions = data.completions
      .filter(c => c.habitId === habit.id)
      .map(c => c.date);

    return {
      ...habit,
      completedDates: completions
    };
  });

  res.json({ habits: habitsWithCompletions });
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Habit name is required' });
  }

  try {
    const habit = {
      id: data.habits.length + 1,
      userId: req.userId,
      name: name.trim(),
      created_at: new Date().toISOString()
    };

    data.habits.push(habit);
    await saveData();

    res.json({
      message: 'Habit created',
      habit: {
        ...habit,
        completedDates: []
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create habit' });
  }
});

app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  const habitIndex = data.habits.findIndex(h => h.id === habitId && h.userId === req.userId);

  if (habitIndex === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  data.habits.splice(habitIndex, 1);
  data.completions = data.completions.filter(c => c.habitId !== habitId);

  await saveData();
  res.json({ message: 'Habit deleted' });
});

app.post('/api/habits/:id/toggle', authenticateToken, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.body;

  const habit = data.habits.find(h => h.id === habitId && h.userId === req.userId);

  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const completionIndex = data.completions.findIndex(
    c => c.habitId === habitId && c.date === date
  );

  if (completionIndex > -1) {
    data.completions.splice(completionIndex, 1);
    await saveData();
    return res.json({ message: 'Completion removed', completed: false });
  }

  data.completions.push({
    id: data.completions.length + 1,
    habitId,
    date
  });
  await saveData();
  return res.json({ message: 'Completion added', completed: true });
});

loadData().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Habit Tracker server running on http://localhost:${PORT}`);
    console.log(`📝 Login page: http://localhost:${PORT}/login.html`);
  });
});
