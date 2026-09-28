# API Server Deployment Guide

## Deploy to Render

### Prerequisites
- A Render account (free tier available)
- Your Neon database connection string
- Neon Auth credentials

### Steps to Deploy

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push
   ```

2. **Create a new Web Service on Render**
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the `artifacts/api-server` directory as the root directory
   - Or use the "render.yaml" file for automatic configuration

3. **Configure Environment Variables**
   In the Render dashboard, add these environment variables:
   
   ```
   PORT=3002
   DATABASE_URL=postgresql://neondb_owner:npg_tbuc8Hdk4TpO@ep-fancy-term-b5rglr6z-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
   SUPER_ADMIN_EMAIL=admin@comhub.co.za
   SUPER_ADMIN_PASSWORD=Kamphata@2023
   NEON_AUTH_URL=https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
   NEON_JWKS_URL=https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your API server
   - Once deployed, you'll get a URL like: `https://community-wealth-hub-api.onrender.com`

5. **Update Netlify Configuration**
   - Go to your Netlify dashboard
   - Update the `VITE_API_URL` environment variable to your Render URL:
     ```
     VITE_API_URL=https://community-wealth-hub-api.onrender.com
     ```
   - Redeploy your Netlify site

## Alternative: Manual Deployment

If you prefer manual configuration instead of using render.yaml:

1. **Build Settings**
   - Build Command: `pnpm install && pnpm run build`
   - Start Command: `pnpm run start`

2. **Runtime**
   - Runtime: Node
   - Node Version: 20

3. **Environment Variables**
   - Add the same environment variables as listed above

## Testing

After deployment, test your API:
```bash
curl https://your-api-url.onrender.com/api/health
```

You should get a health check response.