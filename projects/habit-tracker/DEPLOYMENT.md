# Habit Tracker - Deployment Guide

## Problem: Network Error on Other Devices

Your app worked on your local device but fails on other devices because it was using hardcoded `http://localhost:3000` URLs. This URL only works on your local machine - other devices can't reach it.

### What We Fixed

✅ Removed hardcoded `localhost` URLs  
✅ Added dynamic API URL detection  
✅ Added environment variable support  
✅ Frontend auto-detects the correct API endpoint  

---

## How API URL Resolution Works Now

### 1. **Development (Local)**
```
Your machine:
  Login page → http://localhost:3000/api/login
  Other machine on same network → http://192.168.x.x:3000/api/login
```

The app now **automatically detects the current domain and port**, so:
- On `localhost` → Uses `http://localhost:3000/api`
- On `192.168.1.100` → Uses `http://192.168.1.100:3000/api`

### 2. **Production (with Domain)**
```
When deployed to: https://dikeshmanandhar.com.np
  Login page → https://dikeshmanandhar.com.np/api/login
```

The app **auto-detects your production domain** without any changes needed!

---

## Setup Instructions

### Step 1: Verify Backend Configuration

Ensure your `.env` file has the correct settings:

```bash
# For local development with network access
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://192.168.1.0/24
```

### Step 2: Start Backend Server

```bash
# Install dependencies
npm install

# Run server
npm start
# or for development with auto-reload
npm run dev
```

Server will run on `http://localhost:3000`

### Step 3: Access Frontend

**Option A: From Same Machine (localhost)**
```
http://localhost:8000
or
http://localhost:3000 (if serving frontend from same port)
```

**Option B: From Other Device on Same Network**
```
http://192.168.1.100:8000
```
(Replace with your machine's actual local IP)

The frontend will automatically detect and use the correct API URL!

---

## For Production Deployment

### Using a Domain (e.g., dikeshmanandhar.com.np)

#### Option 1: Backend and Frontend on Same Domain
```
Frontend:  https://dikeshmanandhar.com.np
Backend:   https://dikeshmanandhar.com.np/api

ALLOWED_ORIGINS=https://dikeshmanandhar.com.np
```

#### Option 2: Separate API Domain
```
Frontend:  https://dikeshmanandhar.com.np
Backend:   https://api.dikeshmanandhar.com.np

ALLOWED_ORIGINS=https://dikeshmanandhar.com.np
```

The frontend will **automatically** use the correct API URL!

---

## CORS Configuration (Important!)

Make sure your backend allows your frontend domain. Update `.env`:

```bash
# For local development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000

# For production
ALLOWED_ORIGINS=https://dikeshmanandhar.com.np,https://yourdomain.com

# For multiple environments
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://dikeshmanandhar.com.np,https://api.yourdomain.com
```

---

## Testing from Another Device

### 1. Find Your Machine's Local IP
```bash
# On Windows
ipconfig

# On Mac/Linux
ifconfig
# or
hostname -I
```

Look for something like `192.168.x.x` or `10.0.x.x`

### 2. Update Backend CORS
```bash
# In .env, add your local IP:
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.100:8000
```

### 3. Start Backend
```bash
npm start
```

### 4. Access from Another Device
```
http://192.168.1.100:8000
```

The frontend will automatically use `http://192.168.1.100:3000/api`!

---

## Security Settings for Production

```bash
# Production .env
NODE_ENV=production
COOKIE_SECURE=true           # Only send cookies over HTTPS
ALLOWED_ORIGINS=https://yourdomain.com
JWT_SECRET=your-strong-secret-key-here
```

---

## Troubleshooting

### "Network error. Please make sure the server is running."

**Cause:** Browser can't reach the API endpoint

**Fix:**
1. Verify backend is running: `npm start`
2. Check CORS in `.env` includes your domain
3. Check firewall isn't blocking port 3000
4. Open browser console (F12) → Network tab → Check API call URL

### API Working on One Device but Not Another

**Cause:** Devices have different IPs

**Fix:**
1. Verify both devices are on same network
2. Add your device's IP to CORS: `ALLOWED_ORIGINS=http://192.168.x.x:3000`
3. Use IP address instead of `localhost` in browser

### "CORS Error" or "Access-Control-Allow-Origin"

**Fix:** Update `ALLOWED_ORIGINS` in `.env`:
```bash
ALLOWED_ORIGINS=http://192.168.1.100:8000,https://yourdomain.com
```

---

## File Structure

```
habit-tracker/
├── server.js              # Backend server (Node.js)
├── login.html             # Login page (auto-detects API URL)
├── signup.html            # Signup page (auto-detects API URL)
├── tracker.html           # Main app
├── app-backend.js         # App with API integration
├── config.js              # API URL configuration helper
├── .env                   # Environment variables
├── .env.example           # Template for .env
├── DEPLOYMENT.md          # This file
└── package.json           # Dependencies
```

---

## API URL Logic (Technical Details)

The frontend uses this priority order to determine API URL:

1. **Browser's current domain** (auto-detection)
   - If on `localhost` → Use `http://localhost:3000/api`
   - If on `192.168.x.x` → Use `http://192.168.x.x:3000/api`
   - If on `yourdomain.com` → Use `https://yourdomain.com/api`

2. **Environment variables** (if using build tools)
   - `VITE_API_URL` for Vite projects

3. **LocalStorage/SessionStorage** (manual override)
   ```javascript
   localStorage.setItem('API_URL', 'https://custom-api.com/api');
   ```

4. **Default fallback**
   - Constructs from protocol, hostname, and port

---

## Summary

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| Local device | ✅ Works | ✅ Works |
| Other device on network | ❌ Network error | ✅ Works auto-magically |
| Production domain | ❌ Hardcoded wrong URL | ✅ Works auto-magically |

Your app now **"just works"** on any device! 🎉

---

## Questions?

If you encounter issues:
1. Check browser console (F12) for error messages
2. Verify backend is running (`npm start`)
3. Verify CORS settings in `.env`
4. Check your network connection
