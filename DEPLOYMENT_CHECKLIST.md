# 🚀 SENTINEL Deployment Checklist

## Files Created/Modified for Deployment

✅ **Created:**
- `backend/.env.example` - Environment variable template
- `frontend/.env.example` - Frontend env template
- `backend/.gitignore` - Python gitignore rules
- `Dockerfile` - Container configuration for Railway
- `Procfile` - Process file for Railway
- `railway.json` - Railway service configuration

✅ **Modified:**
- `backend/server.py` - Added CORS middleware + production startup
- `frontend/package.json` - Removed gh-pages configuration

---

## Step-by-Step Deployment

### 1️⃣ Commit Changes to GitHub
```bash
cd /path/to/SENTINELV1
git add .
git commit -m "Deploy: Configure for Railway.app - Add CORS, env vars, Docker, Procfile"
git push origin main
```

### 2️⃣ Go to Railway.app
- Visit https://railway.app
- Sign in with GitHub
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose `SENTINELV1`

### 3️⃣ Configure Railway Backend Service
Once Railway connects your repo:

**Set Root Directory:**
- Leave as root (not `./backend`)

**Set Environment Variables** (Railway → Variables tab):
```
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=sentinel_db
JWT_SECRET=generate-random-secret-here
PORT=8000
ENVIRONMENT=production
PYTHONUNBUFFERED=1
```

**For JWT_SECRET**, run this to generate a secure key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4️⃣ Add MongoDB to Railway (CRITICAL!)
- In your Railway project, click "+ Create"
- Select "Database" → "MongoDB"
- Railway auto-generates MONGO_URL
- Copy it and paste into your backend Variables
- Make sure `DB_NAME=sentinel_db` matches your code

### 5️⃣ Deploy Frontend (Choose ONE):

**Option A: Deploy to Vercel (RECOMMENDED)**
1. Go to https://vercel.com
2. Import your GitHub repo
3. Set Root Directory: `./frontend`
4. Add environment variable:
   ```
   REACT_APP_BACKEND_URL=https://your-railway-backend-url
   ```
5. Deploy!

**Option B: Deploy Frontend on Railway Too**
1. Create another service in the same Railway project
2. Set Root Directory: `./frontend`
3. Build command: `npm run build`
4. Start command: `npx serve -s build -l 3000`
5. Environment: `REACT_APP_BACKEND_URL=https://backend-railway-url`

---

## 🔍 Testing After Deployment

### Test Backend API
```bash
curl https://your-railway-backend.railway.app/api/
```
Should return:
```json
{"service": "SENTINEL OSINT", "version": "1.0", "status": "operational"}
```

### Test Frontend
1. Visit your deployed frontend URL
2. Open DevTools (F12)
3. Check Console for CORS or network errors
4. Try logging in

### Common Issues & Fixes

**"MONGO_URL not found"**
→ Add `MONGO_URL` to Railway Variables

**"Connection refused" from frontend**
→ Check `REACT_APP_BACKEND_URL` matches actual backend URL

**"CORS error in console"**
→ Backend CORS is configured, but double-check domains

**"Build failed: Module not found"**
→ Check that pip installed all requirements from `backend/requirements.txt`

**"Port already in use"**
→ Don't worry, Railway handles this. Make sure PORT is in environment variables

---

## 📝 What Changed?

### Why Your Previous Attempts Failed:

1. ❌ Frontend was set up for GitHub Pages (gh-pages), not a real server
2. ❌ Backend had no CORS configuration - frontend couldn't talk to it
3. ❌ No environment variables defined - MongoDB URL, JWT secret missing
4. ❌ Backend startup wasn't configured for production PORT
5. ❌ No `.env` examples - Railway couldn't know what variables needed to be set

### What We Fixed:

1. ✅ Removed gh-pages from frontend
2. ✅ Added CORS middleware to backend
3. ✅ Created `.env.example` files so you know what variables to set
4. ✅ Added production startup configuration
5. ✅ Created Dockerfile + Procfile for proper deployment
6. ✅ Set up railway.json for automatic configuration

---

## 🎯 Success Indicators

When everything works:
- ✅ Backend API responds at `/api/`
- ✅ Frontend loads without 404 errors
- ✅ No CORS errors in browser console
- ✅ Login page appears
- ✅ Can create account / log in
- ✅ Dashboard loads with data

---

## 🆘 Need Help?

If deployment still fails:

1. **Check Railway Logs** (Backend service → Deployments → Logs)
2. **Check Browser Console** (Frontend → F12 → Console)
3. **Check Network Tab** (Frontend → F12 → Network → look at failed requests)
4. **Verify Environment Variables** (Railway → Variables tab)
5. **Verify MongoDB is Connected** (Railway → MongoDB plugin → should show connection)

Good luck! 🚀
