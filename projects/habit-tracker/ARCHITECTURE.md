# Architecture & Network Flow Diagrams

## Problem: Before Fix ❌

```
Device 1 (Your Machine)
│
├─ localhost:8000 ✅
│  └─ App tries to connect to: http://localhost:3000
│     └─ Works! (both on same machine)
│
Device 2 (Another Device on WiFi)
│
├─ 192.168.1.100:8000 ❌
│  └─ App tries to connect to: http://localhost:3000
│     └─ FAILS! (localhost points to Device 2, not Device 1)
│        └─ "Network error. Please make sure the server is running."
```

**Why it failed:** `localhost` is a special address that points to the **current device**. Device 2's localhost is different from Device 1's localhost!

---

## Solution: After Fix ✅

```
Device 1 (Your Machine) - IP: 192.168.1.100
│
├─ localhost:8000 
│  └─ Browser hostname: "localhost"
│  └─ App detects: This is localhost!
│  └─ Uses API: http://localhost:3000 ✅
│     └─ Works! (connects to Device 1's backend)
│
Device 2 (Another Device) - IP: 192.168.1.50
│
├─ 192.168.1.100:8000
│  └─ Browser hostname: "192.168.1.100"
│  └─ App detects: This is NOT localhost
│  └─ Uses API: http://192.168.1.100:3000 ✅
│     └─ Works! (connects to Device 1's backend via its IP)
│
Device 3 (Production) - Domain: dikeshmanandhar.com.np
│
├─ https://dikeshmanandhar.com.np
│  └─ Browser hostname: "dikeshmanandhar.com.np"
│  └─ App detects: This is a domain, HTTPS
│  └─ Uses API: https://dikeshmanandhar.com.np/api ✅
│     └─ Works! (connects to production backend)
```

**Why it works:** App detects the **actual hostname** being used and constructs the API URL accordingly!

---

## API URL Detection Flow

```
┌─────────────────────────────────────────┐
│   Browser loads: http://HOST:PORT       │
│   (HOST could be localhost, 192.168.x.x, or yourdomain.com)
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   Frontend JavaScript Runs              │
│   const hostname = window.location.hostname
│   const protocol = window.location.protocol
│   const port = window.location.port
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Is it localhost?    │
        └────────┬──────────┬──┘
                 │          │
            YES ▼          ▼ NO
                │      ┌─────────────────┐
                │      │ Use this domain │
                │      │ as API host:    │
                │      │ protocol://host │
                │      └────────┬────────┘
                │               │
        ┌───────┴───────┐       │
        │               │       │
        ▼               ▼       │
┌──────────────┐ ┌──────────────────────┐
│ localhost:3000 │ │192.168.1.100:3000   │
│ Works locally│ │ Works on network    │
│ on YOUR     │ │ Works on domain     │
│ machine     │ │ Works in prod       │
└──────────────┘ └──────────────────────┘
        │               │
        │               │
        └───────┬───────┘
                ▼
        ┌──────────────────────┐
        │   API_URL ready!     │
        │ Use for all fetch()  │
        │ calls throughout app │
        └──────────────────────┘
```

---

## Network Communication Comparison

### Before Fix (Hardcoded localhost)

```
┌──────────────────────────────────────────────────────┐
│ DEVICE 1: Your Machine (192.168.1.100)               │
├──────────────────────────────────────────────────────┤
│ Frontend: http://localhost:8000                      │
│ Backend:  http://localhost:3000 ← Hardcoded         │
│                                                      │
│ ✅ localhost → localhost (same machine)             │
│    Works perfectly                                   │
└──────────────────────────────────────────────────────┘
           │
           │ (hardcoded localhost won't work)
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ DEVICE 2: Another Machine (192.168.1.50)             │
├──────────────────────────────────────────────────────┤
│ Frontend: http://192.168.1.100:8000                  │
│ Backend tries: http://localhost:3000 ← WRONG!       │
│                                                      │
│ ❌ localhost → DEVICE 2's localhost (wrong machine) │
│    Network error! Device 2 has no backend running   │
└──────────────────────────────────────────────────────┘
```

### After Fix (Dynamic Detection)

```
┌──────────────────────────────────────────────────────┐
│ DEVICE 1: Your Machine (192.168.1.100)               │
├──────────────────────────────────────────────────────┤
│ Frontend: http://localhost:8000                      │
│ Detects: localhost → Uses http://localhost:3000    │
│                                                      │
│ ✅ localhost → localhost (correct)                  │
│    Works perfectly                                   │
└──────────────────────────────────────────────────────┘
           ✅ SAME CODE
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ DEVICE 2: Another Machine (192.168.1.50)             │
├──────────────────────────────────────────────────────┤
│ Frontend: http://192.168.1.100:8000                  │
│ Detects: 192.168.1.100 → Uses http://192.168.1.100 │
│                                                      │
│ ✅ 192.168.1.100 → 192.168.1.100 (CORRECT!)        │
│    Works perfectly!                                  │
└──────────────────────────────────────────────────────┘
           ✅ SAME CODE
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ DEVICE 3: Production (yourdomain.com)                │
├──────────────────────────────────────────────────────┤
│ Frontend: https://yourdomain.com                     │
│ Detects: yourdomain.com → Uses https://yourdomain.  │
│                          com/api                    │
│                                                      │
│ ✅ yourdomain.com → yourdomain.com/api (CORRECT!)  │
│    Works perfectly!                                  │
└──────────────────────────────────────────────────────┘
```

---

## Configuration Flow

```
┌─────────────────────────────────────┐
│ Development Environment             │
│                                     │
│ .env:                              │
│ ALLOWED_ORIGINS=                   │
│   http://localhost:3000,           │
│   http://localhost:8000,           │
│   http://192.168.1.100:8000       │
│                                     │
│ Frontend auto-detects one of ↓     │
│ localhost → uses localhost:3000    │
│ 192.168.1.100 → uses 192.168.1.100 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Production Environment              │
│                                     │
│ .env:                              │
│ ALLOWED_ORIGINS=                   │
│   https://yourdomain.com           │
│                                     │
│ Frontend auto-detects:             │
│ yourdomain.com → uses yourdomain   │
│                   .com/api          │
└─────────────────────────────────────┘
```

---

## Code Execution Timeline

```
1. User opens app in browser
   └─ Any device: localhost, 192.168.1.100, yourdomain.com
      └─ Browser loads HTML files

2. Login page loads (login.html)
   └─ JavaScript executes: getApiUrl()
      └─ Reads window.location.hostname
      └─ Reads window.location.protocol
      └─ Reads window.location.port

3. getApiUrl() returns correct API URL
   └─ localhost → 'http://localhost:3000/api'
   └─ 192.168.1.100 → 'http://192.168.1.100:3000/api'
   └─ yourdomain.com → 'https://yourdomain.com/api'

4. User submits login form
   └─ JavaScript calls: fetch(`${API_URL}/login`, {...})
   └─ Uses the correct API_URL from step 3

5. Backend processes request
   └─ Checks CORS (must be in ALLOWED_ORIGINS)
   └─ If allowed, responds with token
   └─ If not allowed, blocks request (CORS error)

6. Frontend receives response
   └─ Stores token in localStorage
   └─ Redirects to tracker.html

7. App works! ✅
```

---

## CORS Flow Diagram

```
┌─────────────────────────────────────────┐
│ Device 2: 192.168.1.100:8000            │
│ Sends request to http://192.168.1.100:  │
│ 3000/api/login                          │
└────────────────────┬────────────────────┘
                     │
                     │ Browser adds:
                     │ Origin: http://192.168.1.100:8000
                     │
                     ▼
┌─────────────────────────────────────────┐
│ Backend Server: http://192.168.1.100:   │
│ 3000                                    │
│                                         │
│ Receives request with Origin header:   │
│ Origin: http://192.168.1.100:8000      │
│                                         │
│ Checks .env ALLOWED_ORIGINS:           │
│ Does it contain http://192.168.1.100:  │
│ 8000?                                   │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
      YES ▼                       ▼ NO
         │                    ❌ CORS Error
         │              (browser blocks response)
    ✅ Allowed
    Send response with:
    Access-Control-Allow-Origin:
      http://192.168.1.100:8000
```

---

## File Structure

```
habit-tracker/
│
├── 📄 Server Files
│   ├── server.js              (Backend server)
│   ├── app-backend.js         (Backend app logic)
│   ├── .env                   (Configuration with CORS)
│   └── .env.example           (Example config)
│
├── 🌐 Frontend Files (HTTP files)
│   ├── login.html             (Login page - auto-detects API URL)
│   ├── signup.html            (Signup page - auto-detects API URL)
│   ├── tracker.html           (Main app)
│   ├── app.js                 (Local version - no backend)
│   └── styles.css             (Styling)
│
├── ⚙️ Configuration Files
│   ├── config.js              (Helper for API URL config)
│   └── package.json           (Dependencies)
│
└── 📚 Documentation
    ├── README_FIX.md          ⭐ START HERE
    ├── QUICK_START.md         Quick reference
    ├── FIX_CHECKLIST.md       Testing guide
    ├── DEPLOYMENT.md          Production guide
    ├── FIX_SUMMARY.md         Changes explained
    └── ARCHITECTURE.md        This file!
```

---

## Deployment Architecture Examples

### Local Network Testing
```
┌──────────────────────┐
│ Your Machine         │
│ 192.168.1.100        │
│                      │
│ ┌──────────────────┐ │
│ │ Port 3000        │ │
│ │ Backend Server   │ │
│ │ (express)        │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Port 8000        │ │
│ │ Frontend Server  │ │
│ │ (serve files)    │ │
│ └──────────────────┘ │
└──────────────────────┘
       ▲
       │
       │ WiFi Network
       │
┌──────────────────────┐
│ Other Device         │
│ 192.168.1.50         │
│ (Phone/Laptop)       │
│                      │
│ Browser opens:       │
│ http://192.168.1.100 │
│ :8000                │
│                      │
│ App detects:         │
│ 192.168.1.100        │
│                      │
│ Uses API:            │
│ http://192.168.1.100 │
│ :3000/api            │
│                      │
│ ✅ Works!            │
└──────────────────────┘
```

### Production Deployment
```
┌─────────────────────────────────┐
│ Web Server (Nginx/Apache)       │
│ yourdomain.com:443              │
│ (HTTPS)                         │
│                                 │
│ ┌──────────────────────────────┐│
│ │ Frontend Files               ││
│ │ (login.html, signup.html)    ││
│ └──────────────────────────────┘│
└────────────┬────────────────────┘
             │
             │ https://yourdomain.com
             │
             ▼
┌─────────────────────────────────┐
│ Backend Server                  │
│ Backend URL: /api               │
│ (Node.js + Express)             │
│                                 │
│ Listens on:                     │
│ https://yourdomain.com/api      │
│                                 │
│ CORS allows:                    │
│ https://yourdomain.com          │
└─────────────────────────────────┘
```

---

## Summary

**Before:** Hardcoded `localhost` → Only works on 1 device  
**After:** Dynamic detection → Works on all devices  

Same code, different URLs based on where it's accessed from! 🎉
