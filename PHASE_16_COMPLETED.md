# Phase 16 Completion Guide

## Status

- Authentication error messages are now sanitized in the client.
- Registration now works without requiring `walletAddress` in the request body.
- Live crypto market data now loads directly from the frontend using public API configuration.
- Portfolio and market widgets now use the frontend live market feed.

## Required Vercel Environment Variables

Set these in the Vercel project for the frontend deployment:

- `VITE_API_BASE_URL`
  - Example: `https://your-backend-domain.com/api`
- `VITE_MARKET_API_URL`
  - Example (CoinGecko Simple Price):
    `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,binancecoin,ripple&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`
- `VITE_MARKET_API_KEY`
  - Optional.
  - Required only if your market data provider needs an API key.

## Deployment Steps

1. Add or update the Vercel environment variables listed above.
2. Redeploy the frontend in Vercel.
3. Restart the backend service after pulling the backend auth route/controller updates.

## Verification Checklist

- Login page never displays raw backend/system token errors.
- Register page never displays raw backend/system token errors.
- Registration succeeds with valid input and creates an account.
- Duplicate email registration returns a clean message: `Email already in use.`
- Expired/invalid session states return a clean message: `Your session has expired. Please log in again.`
- Live market cards and portfolio live valuations populate from frontend market API calls.
- Market API failure shows a clean fallback message without technical leakage.

## Files Updated

- `client/src/utils/authErrors.ts`
- `client/src/store/authSlice.ts`
- `client/src/pages/LoginPage.tsx`
- `client/src/pages/RegisterPage.tsx`
- `client/src/utils/marketData.ts`
- `client/src/hooks/useLiveMarket.ts`
- `client/src/components/MarketWidget.tsx`
- `client/src/pages/PortfolioPage.tsx`
- `server/src/routes/authRoutes.ts`
- `server/src/controllers/authController.ts`
