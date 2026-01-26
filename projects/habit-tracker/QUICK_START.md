# Quick Start - Multi-Device Access

## Problem Summary
Your app used `http://localhost:3000` which only works on your local machine. Other devices can't reach "localhost" on your computer.

## Solution Summary
The frontend now **auto-detects** the correct API URL based on the device's current domain/IP.

---

## How to Use

### 1. Run Backend Server
```bash
cd projects/habit-tracker
npm install
npm start
```

### 2. Access from Your Machine
```
http://localhost:8000
```

### 3. Access from Another Device on Same Network
```
http://192.168.1.100:8000
```
(Replace with your actual local IP from `ipconfig` or `ifconfig`)

### 4. Update Backend CORS
In `.env`, make sure to allow your network IP:
```
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.100:8000
```

---

## What Changed

| File | Change |
|------|--------|
| `login.html` | Auto-detect API URL instead of hardcoded localhost |
| `signup.html` | Auto-detect API URL instead of hardcoded localhost |
| `app-backend.js` | Use dynamic API URL detection |
| `.env` | Added more CORS origins |
| `config.js` | **New file** - Helper for API URL configuration |
| `DEPLOYMENT.md` | **New file** - Complete deployment guide |

---

## That's It! 🎉

Your app will now work on:
- ✅ Your local machine (`localhost:8000`)
- ✅ Other devices on same network (`192.168.1.x:8000`)
- ✅ Production domain (`https://yourdomain.com`)

No more hardcoded URLs!
