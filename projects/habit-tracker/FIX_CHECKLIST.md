# Habit Tracker - Network Error Fix Checklist

## ✅ Changes Made

- [x] **Removed hardcoded `http://localhost:3000` URLs** from login.html
- [x] **Removed hardcoded `http://localhost:3000` URLs** from signup.html  
- [x] **Updated app-backend.js** to use dynamic API URL
- [x] **Created config.js** for API URL configuration helper
- [x] **Updated .env and .env.example** with proper configuration
- [x] **Created DEPLOYMENT.md** with full deployment guide
- [x] **Created QUICK_START.md** with quick reference

## 🚀 Steps to Test

### Step 1: Update Backend Configuration
```bash
cd projects/habit-tracker
```

Edit `.env` and verify CORS includes your local IP:
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://YOUR_LOCAL_IP:8000
```

Find your local IP:
```bash
# On Windows
ipconfig

# On Mac/Linux
ifconfig
# or
hostname -I
```

### Step 2: Start Backend Server
```bash
npm install  # If not already done
npm start
```

You should see:
```
Server running on http://localhost:3000
```

### Step 3: Test on Your Machine
Open browser and go to:
```
http://localhost:8000
```

Try to **login** or **signup** → Should work without "Network error"

### Step 4: Test from Another Device
On another computer/phone on the same network:
```
http://YOUR_MACHINE_IP:8000
```

Example: `http://192.168.1.100:8000`

**This should now work!** If it doesn't, see troubleshooting below.

---

## ❌ Troubleshooting

### "Network error. Please make sure the server is running."

**Check 1:** Is backend running?
```bash
# Terminal should show:
# Server running on http://localhost:3000
```

**Check 2:** Is port 3000 available?
```bash
# On Mac/Linux
lsof -i :3000

# On Windows
netstat -ano | findstr :3000
```

**Check 3:** Check CORS in `.env`
Make sure ALLOWED_ORIGINS includes your device's IP/domain

**Check 4:** Check browser console (F12)
- Go to Network tab
- Try login
- Look at the failed API call
- Check the error message

### "CORS error" or "Access-Control-Allow-Origin"

**Solution:** Update `.env` CORS:
```
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:8000,http://10.0.0.50:8000
```

Then restart server:
```bash
npm start
```

### API works from one device but not another

**Solution:** Make sure the other device is using the correct IP:
```bash
# Device 2's browser should use:
http://YOUR_MACHINE_IP:8000

# NOT:
http://localhost:8000  # This only works on YOUR machine
http://127.0.0.1:8000 # This only works on YOUR machine
```

### Still not working?

1. **Check firewall** - Is port 3000 & 8000 open?
   - Windows Defender
   - macOS Firewall
   - Linux firewall (iptables/ufw)

2. **Check network** - Are devices on same network?
   - Ping your machine from other device
   - WiFi same network?

3. **Check backend** - Is backend actually accepting requests?
   ```bash
   curl http://localhost:3000/api/login
   ```
   Should get a response (error is fine, but not "connection refused")

---

## 📝 Environment Variables Explained

### For Local Development

```bash
NODE_ENV=development
PORT=3000

# Must include both localhost and your network IP
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://192.168.1.100:8000
```

### For Production

```bash
NODE_ENV=production
PORT=3000

# Your production domain
ALLOWED_ORIGINS=https://dikeshmanandhar.com.np

# Security settings for HTTPS
COOKIE_SECURE=true
```

---

## 📚 Documentation Files

- **[QUICK_START.md](./QUICK_START.md)** - Quick reference guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[config.js](./config.js)** - API URL configuration helper
- **[.env.example](./.env.example)** - Example environment variables

---

## ✨ Features of the Fix

✅ **Auto-detection** - Automatically detects API URL from device domain  
✅ **Multi-device** - Works on localhost, network IPs, and production domains  
✅ **No hardcoding** - No more hardcoded localhost URLs  
✅ **Easy deployment** - Same code works for dev, testing, and production  
✅ **Backward compatible** - Works with existing database and users  

---

## Summary

Your app now **automatically detects and uses the correct API URL** based on:
- Device's hostname (localhost, IP address, domain name)
- Protocol (http:// or https://)
- Port (3000, 8000, etc.)

**This means:**
- Same code works on your machine, other machines, and production! 🎉
- No more "Network error" on other devices
- No more code changes for different environments

---

## Questions?

Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed information about:
- How API URL resolution works
- Deploying to production
- CORS configuration
- Security settings
- Troubleshooting
