const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Trust Railway proxy for rate limiting and IP detection
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Please configure an environment variable.');
  process.exit(1);
}

const mongoUrl = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
if (!mongoUrl) {
  console.error('❌ MONGO_URL is not set. Please configure your MongoDB connection string.');
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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const habitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    created_at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const completionSchema = new mongoose.Schema(
  {
    habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    date: { type: String, required: true }
  },
  { versionKey: false }
);

completionSchema.index({ habitId: 1, date: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Habit = mongoose.model('Habit', habitSchema);
const Completion = mongoose.model('Completion', completionSchema);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (userExists) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    res.json({
      message: 'User registered successfully',
      token,
      user: { id: user._id.toString(), username: user.username, email: user.email }
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
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id.toString(), username: user.username, email: user.email }
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
    const user = await User.findById(req.userId).select('username email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: user._id.toString(), username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/habits', authenticateToken, async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.userId }).sort({ created_at: -1 });

    const habitsWithCompletions = await Promise.all(
      habits.map(async (habit) => {
        const completions = await Completion.find({ habitId: habit._id }).select('date -_id');
        return {
          id: habit._id.toString(),
          name: habit.name,
          created_at: habit.created_at,
          completedDates: completions.map(c => c.date)
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
    const habit = await Habit.create({
      userId: req.userId,
      name: name.trim()
    });

    res.json({
      message: 'Habit created',
      habit: {
        id: habit._id.toString(),
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
  const habitId = req.params.id;

  if (!isValidObjectId(habitId)) {
    return res.status(400).json({ error: 'Invalid habit ID' });
  }

  try {
    const habit = await Habit.findOneAndDelete({ _id: habitId, userId: req.userId });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    await Completion.deleteMany({ habitId: habitId });
    res.json({ message: 'Habit deleted' });
  } catch (error) {
    console.error('Delete habit error:', error.message);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
});

app.post('/api/habits/:id/toggle', authenticateToken, async (req, res) => {
  const habitId = req.params.id;
  const { date } = req.body;

  if (!isValidObjectId(habitId)) {
    return res.status(400).json({ error: 'Invalid habit ID' });
  }

  try {
    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });

    if (!habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    const completion = await Completion.findOne({ habitId: habitId, date });

    if (completion) {
      await Completion.deleteOne({ _id: completion._id });
      return res.json({ message: 'Completion removed', completed: false });
    }

    await Completion.create({ habitId: habitId, date });
    return res.json({ message: 'Completion added', completed: true });
  } catch (error) {
    console.error('Toggle completion error:', error.message);
    res.status(500).json({ error: 'Failed to toggle completion' });
  }
});

mongoose
  .connect(mongoUrl, {
    dbName: process.env.MONGO_DB_NAME || 'habit_tracker',
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Habit Tracker server running on http://localhost:${PORT}`);
      console.log('🗄️  Connected to MongoDB');
    });
  })
  .catch((error) => {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });
