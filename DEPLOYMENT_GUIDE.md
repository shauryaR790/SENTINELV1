# 🚀 SENTINEL Deployment Guide (Railway.app)

## Why Your Previous 10 Attempts Failed

Looking at your code, here are the **critical issues**:

1. **Frontend is hardcoded for GitHub Pages** - Your `package.json` has `"homepage": "https://shauryar790.github.io/SENTINEL"` and uses `gh-pages` deploy. This doesn't work for a full-stack app.

2. **No `.env` files in repo** - Your backend expects `MONGO_URL`, `DB_NAME`, `JWT_SECRET` but there's no `.env` file for Railway to see.

3. **Missing environment variable in frontend** - Your frontend needs `REACT_APP_BACKEND_URL` but it's not defined anywhere.

4. **Python backend not configured for production** - The `server.py` needs to know what PORT to run on.

5. **CORS might block requests** - Need to verify CORS setup in FastAPI.

---

## ✅ Step-by-Step Deployment to Railway.app

### **Phase 1: Prepare Your GitHub Repo (5 mins)**

#### 1.1 Fix the Frontend Root Files

Your frontend should NOT have a `homepage` pointing to GitHub Pages. Edit:

**`frontend/package.json`** - Remove or comment out this line:
```json
"homepage": "https://shauryar790.github.io/SENTINEL",
```

Also remove the deploy scripts (we won't use gh-pages):
```json
"predeploy": "npm run build",
"deploy": "gh-pages -d build"
```

#### 1.2 Create `.env.example` Files (Don't commit actual `.env`!)

Create `backend/.env.example`:
```
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=sentinel_db
JWT_SECRET=your_super_secret_key_change_this_in_production
PORT=8000
ENVIRONMENT=production
```

Create `frontend/.env.example`:
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

#### 1.3 Add a `.gitignore` to Backend

Create `backend/.gitignore`:
```
.env
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
node_modules/
```

#### 1.4 Create a Root `.gitignore` if Needed

Root `.gitignore`:
```
.env
*.pyc
__pycache__/
node_modules/
.DS_Store
```

#### 1.5 **Commit and Push** to GitHub

```bash
git add .
git commit -m "Fix: Prepare for Railway deployment - remove gh-pages, add env examples"
git push origin main
```

---

### **Phase 2: Set Up Railway.app (10 mins)**

#### 2.1 Create a Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub (easiest option)
- Create a new project

#### 2.2 Add MongoDB Database to Railway

1. In Railway dashboard, click **"+ Create"** → **"Database"** → **"MongoDB"**
2. Railway will auto-generate a `MONGO_URL` for you
3. Copy the connection string (Railway shows it in the Variables tab)

#### 2.3 Connect Your GitHub Repo

1. Click **"+ Create"** → **"GitHub Repo"**
2. Select your `SENTINELV1` repo
3. Select the root directory (not frontend or backend yet)
4. Railway will auto-detect it's a monorepo

#### 2.4 Create Backend Service

1. Go to **Settings** → **Root Directory**
2. Set to `./backend`
3. Railway should detect it's a Python/FastAPI app

#### 2.5 Set Backend Environment Variables

In the Railway **Variables** tab, add:

```
MONGO_URL=[copy from MongoDB plugin above]
DB_NAME=sentinel_db
JWT_SECRET=your_randomly_generated_secret_key_here
PORT=8000
ENVIRONMENT=production
PYTHONUNBUFFERED=1
```

> **For JWT_SECRET**, generate a random string:
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

#### 2.6 Create Frontend Service

This is tricky because you have a monorepo. Here's the fix:

**Option A (Easier): Deploy Frontend to Vercel Instead**
- Frontend on Vercel (React is optimized for it)
- Backend on Railway (Python)
- They talk via API

**Option B (If you want everything on Railway):**
1. In Railway, create a NEW service from the same repo
2. Set root directory to `./frontend`
3. Set build command: `npm run build`
4. Set start command: `npx serve -s build -l 3000`
5. Expose port 3000

---

### **Phase 3: Fix Backend for Production (10 mins)**

Your `backend/server.py` needs to:
1. Read PORT from environment
2. Have CORS properly configured

Edit `backend/server.py` - find this section (around line 40):

```python
app = FastAPI(title="SENTINEL OSINT API")
api = APIRouter(prefix="/api")
```

**Add CORS configuration right after:**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Then at the very end of the file, add this:**

```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

Commit this:
```bash
git add backend/server.py
git commit -m "Add: CORS middleware and production port configuration"
git push origin main
```

---

### **Phase 4: Fix Frontend for Production (10 mins)**

Your frontend needs to point to the backend API. Create `frontend/.env.production`:

```
REACT_APP_BACKEND_URL=https://your-railway-backend-url
```

**But how do you get the backend URL?** Railway gives it to you in the **Deployments** tab.

For now, you can also set it as an environment variable in Railway's frontend service:

In Railway **Variables** for frontend service:
```
REACT_APP_BACKEND_URL=https://backend-service-name.railway.app
```

(Replace `backend-service-name` with whatever Railway names your backend)

---

### **Phase 5: Deploy & Test (5 mins)**

1. **Push your changes** (if not already done):
   ```bash
   git push origin main
   ```

2. **Railway auto-deploys** - Watch the Deployments tab

3. **Check logs** for errors:
   - Backend service → Deployments → Click latest → View Logs
   - Look for: `Sentinel OSINT startup complete.`

4. **Test the backend API:**
   ```bash
   curl https://your-backend-url.railway.app/api/
   ```
   Should return:
   ```json
   {"service": "SENTINEL OSINT", "version": "1.0", "status": "operational"}
   ```

5. **Test frontend** by visiting your Railway frontend URL
   - Should load without errors
   - Try logging in

---

### **Phase 6: Secure CORS in Production (IMPORTANT!)**

Once you have your frontend domain, update the CORS in `backend/server.py`:

```python
allow_origins=[
    "https://your-frontend-domain.railway.app",
    "https://yourdomain.com",  # if you have a custom domain
],
```

---

## 🚨 Common Errors & Fixes

### **Error: "MONGO_URL not found in environment"**
- **Fix**: Make sure `MONGO_URL` is added in Railway Variables tab for backend service

### **Error: "Connection refused" from frontend**
- **Fix**: Frontend `REACT_APP_BACKEND_URL` doesn't match actual backend URL
- **Debug**: Open browser DevTools → Network tab → check request URLs

### **Error: "CORS error"**
- **Fix**: Add frontend domain to CORS `allow_origins` in `server.py`

### **Error: "Cannot find module" in Python**
- **Fix**: Railway might not have run `pip install -r requirements.txt`
- **Solution**: Add a `Procfile` to backend:
  ```
  web: uvicorn server:app --host 0.0.0.0 --port $PORT
  ```

---

## 📋 Quick Checklist Before Deploying

- [ ] Frontend `package.json` doesn't have `homepage` or gh-pages scripts
- [ ] `.env.example` files exist in frontend and backend
- [ ] `.gitignore` exists and excludes `.env`
- [ ] `backend/server.py` has CORS middleware
- [ ] `backend/server.py` has `if __name__ == "__main__"` block with port from env
- [ ] MongoDB service is created in Railway
- [ ] Backend service environment variables are set (MONGO_URL, JWT_SECRET, etc.)
- [ ] Frontend service environment variable is set (REACT_APP_BACKEND_URL)
- [ ] Both services are exposed/connected
- [ ] Changes are committed and pushed to GitHub

---

## 🆘 Still Not Working?

If deployment fails, check these in order:

1. **Backend logs**: Railway Deployments → Logs tab
2. **Frontend logs**: Browser DevTools → Console
3. **Network requests**: DevTools → Network tab → check API requests
4. **CORS issues**: Check browser console for CORS errors
5. **Environment variables**: Railway Variables tab - print them in logs

---

## 🎉 Success Indicators

✅ Backend at `https://backend-xxx.railway.app/api/` returns JSON
✅ Frontend loads without 404s
✅ Login page appears
✅ No CORS errors in console
✅ Can submit login form
✅ Dashboard loads after login

