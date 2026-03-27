# MMA_BE API

Backend server for the football booking app.

## Base URL

- Local: http://localhost:9999
- Health check: GET /health → `{ status: "ok" }`

## Auth endpoints

- POST /api/auth/register
- POST /api/auth/login

### Request example

POST /api/auth/register

Body (JSON):

```
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "phone": "0987654321"
}
```

## CORS

Configure allowed frontend origins via environment variable `CORS_ORIGINS` (comma-separated):

```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

If not set, defaults include 3000, 5173, and 4200.

## Environment

Create a `.env` file in the project root:

```
PORT=9999
MONGO_URI=mongodb://127.0.0.1:27017/football_booking_app
JWT_SECRET=change_me
# Optional: configure FE origins
# CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# VNPay sandbox
VNP_TMNCODE=YOUR_SANDBOX_TMN_CODE
VNP_HASH_SECRET=YOUR_SANDBOX_HASH_SECRET
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_API=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
# Leave blank for local dev; backend will infer the current host.
VNP_RETURN_URL=
# Optional fallback deep-link base for mobile
FE_BASE=
```

## VNPay local testing

For Expo/mobile local testing, VNPay sandbox should redirect to a public HTTPS URL,
not a private LAN IP. Recommended flow:

1. Start backend on port `9999`.
2. Expose backend with a public tunnel such as `ngrok http 9999`.
3. Put the public callback URL into `VNP_RETURN_URL`, for example:

```
VNP_RETURN_URL=https://your-public-domain/api/vnpay/return
```

4. Restart backend after changing `.env`.

The mobile frontend already sends the active Expo deep-link target to the backend,
so after payment VNPay can return to the current Expo Go session automatically.

## Run locally

- Install deps: `npm install`
- Development (auto-reload): `npm run dev`
- Production: `npm start`
