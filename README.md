# FB Chat

Realtime customer support chat app built with React, Vite, Express, Socket.IO, and Zustand.

## Features

- Customer chat page at `/`
- Agent console at `/agent`
- Realtime messaging with multiple customer sessions
- Online and offline customer presence
- Image messages, reactions, and message deletion
- VPS-ready production setup with Express static serving

## Local development

```bash
npm install
npm run dev
```

## Production

```bash
npm install
npm run build
NODE_ENV=production npm start
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for VPS, Nginx, and PM2 setup.
