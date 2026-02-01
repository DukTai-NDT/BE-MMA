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
```

## Run locally

- Install deps: `npm install`
- Development (auto-reload): `npm run dev`
- Production: `npm start`
