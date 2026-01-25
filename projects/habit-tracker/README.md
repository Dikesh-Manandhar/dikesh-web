# Habit Tracker - Multi-User Application

A full-stack habit tracking application with user authentication and PostgreSQL database.

## Features

- ✅ User registration and login
- ✅ Secure authentication with JWT tokens
- ✅ Personal habit tracking for each user
- ✅ Daily tracking with GitHub-style calendar
- ✅ Streak counting and statistics
- ✅ Data persistence across sessions
- ✅ Multi-user support with isolated data
- ✅ Production-ready PostgreSQL integration

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Authentication**: JWT, bcryptjs
- **Database**: PostgreSQL with connection pooling
- **Security**: Rate limiting, CORS, secure cookies

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+ (local or cloud-hosted)
- A `.env` file with your configuration (copy from `.env.example`)

### Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE habit_tracker;
   ```

2. Copy `.env.example` to `.env` and update your database connection:
   ```bash
   cp .env.example .env
   # Edit .env and update DATABASE_URL with your PostgreSQL credentials
   ```

3. Initialize the database schema:
   ```bash
   node scripts/init-db.js
   ```

### Installation

1. Navigate to the habit tracker directory:
   ```bash
   cd /workspaces/dikesh-web/projects/habit-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

**Development (with .env file):**
```bash
node server-postgres.js
```

**Production:**
```bash
NODE_ENV=production \
JWT_SECRET="your-strong-secret-key-here" \
DATABASE_URL="postgresql://user:password@prod-host:5432/habit_tracker" \
ALLOWED_ORIGINS="https://yourdomain.com" \
COOKIE_SECURE=true \
node server-postgres.js
```

Or with nodemon for development:
```bash
npm run dev
```

Access the app:
- Local: http://localhost:3000/login.html
- Portfolio: http://localhost:8000/projects/habit-tracker/login.html

### Usage

1. **Sign Up**: Create a new account with username, email, and password
2. **Login**: Access your personal habit dashboard
3. **Add Habits**: Create habits you want to track
4. **Track Progress**: Mark habits as complete each day
5. **View Statistics**: See your streaks and completion rates

## API Endpoints

### Authentication
- `POST /api/register` - Create new user account
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/user` - Get current user info

### Habits
- `GET /api/habits` - Get all habits for logged-in user
- `POST /api/habits` - Create a new habit
- `DELETE /api/habits/:id` - Delete a habit
- `POST /api/habits/:id/toggle` - Toggle habit completion for a date

## Database

All data is stored in PostgreSQL with connection pooling:
- **Users table**: username, email, hashed password
- **Habits table**: habit name, user reference, creation date
- **Completions table**: tracks daily habit completions by date

Foreign keys ensure referential integrity; cascading deletes remove habits when a user is deleted.

## Security & Deployment Notes

**Required environment variables** (set before running):
- `JWT_SECRET` (required, use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate)
- `DATABASE_URL` (PostgreSQL connection string)
- `NODE_ENV` (development or production)
- `ALLOWED_ORIGINS` (comma-separated list, e.g., `https://yourdomain.com`)
- `COOKIE_SECURE` (set to `true` when using HTTPS in production)

**Security features**:
- Passwords are hashed with bcryptjs (10 salt rounds)
- JWT sessions stored in HTTP-only, SameSite-protected cookies
- Auth endpoints rate-limited (20 requests / 15 minutes)
- CORS restricted to allowed origins
- Prepared statements prevent SQL injection
- Referential integrity enforced via foreign keys

**Production checklist**:
- ✅ Use a managed PostgreSQL service (Heroku Postgres, AWS RDS, Render, etc.)
- ✅ Generate a strong JWT_SECRET and keep it in your hosting environment
- ✅ Set `NODE_ENV=production` and `COOKIE_SECURE=true` when serving over HTTPS
- ✅ Configure `ALLOWED_ORIGINS` to your production domain
- ✅ Run `node scripts/init-db.js` once to initialize the schema
- ✅ Enable automatic backups on your PostgreSQL database
- ✅ Keep logs (excluding passwords/tokens) for auditing
- ✅ Use HTTPS for all traffic

## Files Structure

```
habit-tracker/
├── server-postgres.js      # PostgreSQL-based production server
├── server.js               # Legacy JSON server (for reference)
├── package.json            # Dependencies
├── .env.example            # Example environment variables
├── login.html              # Login page
├── signup.html             # Registration page
├── tracker.html            # Main habit tracker interface
├── app-backend.js          # Frontend logic with API integration
├── styles.css              # Styling
├── scripts/
│   └── init-db.js         # Database initialization script
└── README.md              # This file
```
