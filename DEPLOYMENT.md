# Community Wealth Hub Deployment Guide

## Architecture Overview

The Community Wealth Hub consists of two main components:

1. **Frontend** (community-wealth-hub): React/Vite application - deployed to Netlify
2. **Backend API** (api-server): Express.js API server - needs separate deployment

## Pre-configured Credentials

The application has been pre-configured with the following admin credentials:

- **SUPER_ADMIN_EMAIL**: admin@comhub.co.za
- **SUPER_ADMIN_PASSWORD**: Kamphata@2023
- **Database**: Neon PostgreSQL

## Frontend Deployment (Netlify)

The frontend is configured for Netlify deployment and is already set up with:
- PWA functionality for mobile installation
- Mobile-first responsive design
- Progressive Web App features

### Environment Variables

The frontend requires the following environment variable:

- `VITE_API_URL`: URL of your deployed API server (e.g., "https://api.yourdomain.com")

### Deployment Steps

1. **Set API URL in Netlify:**
   - Go to your Netlify site settings
   - Navigate to Site configuration → Environment variables
   - Add `VITE_API_URL` with your API server URL
   - Redeploy the site

2. **Local Development:**
   - Create a `.env` file in `artifacts/community-wealth-hub/`
   - Add: `VITE_API_URL=http://localhost:3000`
   - Or leave empty for local API testing

## Backend API Deployment

The API server needs to be deployed separately. Here are the deployment options:

### Option 1: Railway (Recommended for Neon Database)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize Railway in the api-server directory
cd artifacts/api-server
railway init

# Add Neon PostgreSQL database
railway add postgresql

# Set environment variables
railway variables set SUPER_ADMIN_EMAIL=admin@comhub.co.za
railway variables set SUPER_ADMIN_PASSWORD=Kamphata@2023

# Deploy
railway up
```

### Option 2: Render
```bash
# Create a Render account and connect your GitHub repo
# Deploy the api-server as a web service
# Configure environment variables:
# - PORT: 3000
# - SUPER_ADMIN_EMAIL: admin@comhub.co.za
# - SUPER_ADMIN_PASSWORD: Kamphata@2023
# - DATABASE_URL: postgresql://neondb_owner:npg_tbuc8Hdk4TpO@ep-fancy-term-b5rglr6z-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
# - NEON_AUTH_URL: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
# - NEON_JWKS_URL: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/
```

### Option 3: Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create community-hub-api

# Set environment variables
heroku config:set PORT=3000
heroku config:set SUPER_ADMIN_EMAIL=admin@comhub.co.za
heroku config:set SUPER_ADMIN_PASSWORD=Kamphata@2023
heroku config:set DATABASE_URL=postgresql://neondb_owner:npg_tbuc8Hdk4TpO@ep-fancy-term-b5rglr6z-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
heroku config:set NEON_AUTH_URL=https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
heroku config:set NEON_JWKS_URL=https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/

# Deploy
git push heroku main
```

### Option 4: DigitalOcean App Platform
1. Create a DigitalOcean account
2. Connect your GitHub repository
3. Select the api-server directory
4. Configure environment variables:
   - PORT: 3000
   - SUPER_ADMIN_EMAIL: admin@comhub.co.za
   - SUPER_ADMIN_PASSWORD: Kamphata@2023
   - DATABASE_URL: postgresql://neondb_owner:npg_tbuc8Hdk4TpO@ep-fancy-term-b5rglr6z-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   - NEON_AUTH_URL: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
   - NEON_JWKS_URL: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/
5. Deploy

## Required Environment Variables for API Server

The API server requires these environment variables:

- `PORT`: Server port (default: 3000)
- `SUPER_ADMIN_EMAIL`: admin@comhub.co.za
- `SUPER_ADMIN_PASSWORD`: Kamphata@2023
- `DATABASE_URL`: Your Neon PostgreSQL connection string

## Neon Database Setup

The application uses Neon PostgreSQL with the following connection details:

### Production Branch Connection String
```
postgresql://neondb_owner:npg_tbuc8Hdk4TpO@ep-fancy-term-b5rglr6z-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Authentication Details
- **Branch**: production
- **Auth URL**: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
- **JWKS URL**: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/

### Environment Variable
- `DATABASE_URL`: The connection string above
- `NEON_AUTH_URL`: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth
- `NEON_JWKS_URL`: https://ep-fancy-term-b5rglr6z.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth/.well-known/

## Quick Deployment Steps

1. **Get Neon Database URL**: Copy your Neon database connection string
2. **Deploy API Server**: Choose one of the deployment options above
3. **Set Environment Variables**: Configure the API server with your credentials and database URL
4. **Get API URL**: Copy the deployed API server URL
5. **Configure Netlify**: Set VITE_API_URL in Netlify environment variables
6. **Test Authentication**: Try logging in with admin@comhub.co.za / Kamphata@2023

## Testing the Setup

1. **Deploy the API server** using one of the methods above
2. **Get the API URL** from your deployment platform
3. **Set VITE_API_URL** in Netlify environment variables
4. **Redeploy the frontend** on Netlify
5. **Test authentication** using the pre-configured admin credentials

## Troubleshooting

### Frontend Issues
- **Blank page**: Check browser console for JavaScript errors
- **CSS not loading**: Check Netlify redirects configuration
- **API calls failing**: Verify VITE_API_URL is set correctly

### Backend Issues
- **Database connection errors**: Verify DATABASE_URL is correct
- **Port conflicts**: Ensure PORT environment variable is set
- **Build failures**: Check API server logs for specific errors

### CORS Issues
If you encounter CORS errors, you may need to configure CORS in your API server. The API server should allow requests from your Netlify domain.

## Security Considerations

1. **HTTPS**: Always use HTTPS for production deployments
2. **Environment Variables**: Never commit sensitive data to git
3. **Database Security**: Use strong passwords and restrict database access
4. **API Security**: Implement rate limiting and authentication validation

## Support

For deployment issues, check:
- Netlify deployment logs
- API server logs
- Database connection status
- Browser console for client-side errors
