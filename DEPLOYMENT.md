# VPS Deployment

## What changed

- The frontend now connects to the same host in production by default.
- The backend now reads `PORT` and optional `ALLOWED_ORIGINS` from environment variables.
- The Express server now serves the built Vite frontend from `dist` for VPS hosting.

## Environment variables

Use `.env.example` as a reference for the values you need.

```env
PORT=3001
ALLOWED_ORIGINS=
VITE_SERVER_URL=
```

- `PORT`: backend listening port on the VPS.
- `ALLOWED_ORIGINS`: comma-separated list of allowed frontend origins only if you host frontend and backend on different origins.
- `VITE_SERVER_URL`: optional frontend socket server URL. Leave empty when the built frontend is served by the same Express app and domain.

For production, provide `PORT` and `ALLOWED_ORIGINS` through your shell, PM2, or hosting environment. Vite reads `VITE_SERVER_URL` during `npm run build`.

## Recommended same-domain setup

Use one Node process behind Nginx:

1. Clone the repository on the VPS.
2. Install dependencies with `npm install`.
3. Build the frontend with `npm run build`.
4. Start the server with `NODE_ENV=production npm start`.
5. Put Nginx in front of the Node app and proxy both HTTP and WebSocket traffic to the app port.

## Nginx example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## PM2 example

```bash
pm2 start "npm start" --name live-chat
pm2 save
pm2 startup
```

## GitHub to VPS flow

```bash
git clone <your-repo-url>
cd <your-project-folder>
npm install
npm run build
NODE_ENV=production npm start
```

## Notes

- In local development, the frontend still uses `http://localhost:3001`.
- If you deploy the frontend and backend on different domains, set both `VITE_SERVER_URL` and `ALLOWED_ORIGINS`.
- Rebuild the frontend after changing `VITE_SERVER_URL` because Vite injects that value at build time.
