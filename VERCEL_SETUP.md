# Vercel Deployment Setup Guide

## Prerequisites
- Vercel account (create at https://vercel.com)
- GitHub account with this repository
- Node.js 18+ installed locally

## Step 1: Connect to Vercel

### Option A: Via GitHub (Recommended)
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Select "Import Git Repository"
4. Connect your GitHub account
5. Select this repository
6. Click "Import"

### Option B: Via Vercel CLI
```bash
npm i -g vercel
vercel
```
Follow the prompts to link your project.

## Step 2: Configure Environment Variables

In the Vercel Dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables (values from your `.env` file):

| Name | Value |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |

## Step 3: Deploy

### First Deployment
If using GitHub import, Vercel automatically deploys on push.

### Manual Deployment with CLI
```bash
vercel --prod
```

## Step 4: Configure Production Domain

1. In Vercel Dashboard → Project Settings
2. Go to "Domains"
3. Add your custom domain (optional)
4. Update DNS records if using custom domain

## Step 5: Verify Deployment

1. Visit your Vercel URL
2. Test the web app functionality
3. Check browser console for any errors
4. Test audio features (microphone access)

## Troubleshooting

### Build Fails
- Check logs: Vercel Dashboard → Deployments → Build Logs
- Ensure all environment variables are set
- Run `npm run build:web` locally to test

### Features Not Working
- Clear browser cache (Ctrl+Shift+Delete)
- Check browser console for errors
- Verify Supabase credentials are correct
- Ensure CORS is configured if calling external APIs

### Audio Not Working
- Grant microphone permission in browser
- Check browser console for permission errors
- Test in a different browser

## Continuous Deployment

After initial setup:
- Push changes to main branch → Automatic deployment
- Vercel creates preview URLs for pull requests
- Production deploys when PR is merged

## Local Testing Before Deploy

```bash
npm run build:web
npx serve -s dist
```
Visit http://localhost:3000 to test locally.
