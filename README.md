# AI Utils

A full-stack AI chat application with LangGraph, Socket.io, and MCP (Model Context Protocol) integration.

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API key

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-utils
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | Required for chat AI |
| `OPENAI_MODEL` | Model name (default: gpt-3.5-turbo) |
| `OPENAI_TEMPERATURE` | 0–1 (default: 0) |
| `CORS_ORIGIN` | Allowed frontend origin(s) in production |

### 3. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## Running

### Development

**Terminal 1 – server**

```bash
cd server
npm run dev
```

**Terminal 2 – client**

```bash
cd client
npm run dev
```

Client: http://localhost:5173  
Server: http://localhost:3000

### Production

```bash
cd server && npm run build
cd ../client && npm run build
cd ../server && npm start
```

The server serves the built client from `client/dist` when `NODE_ENV=production`.

## Project structure

```
ai-utils/
├── client/          # Vite + React frontend
├── server/          # Express + Socket.io backend
├── .env.example
└── README.md
```

## Features

- AI chat with **streaming** responses and conversation history
- MCP tool integration (connect via URL or command)
- Skills and prompt context
- Chat persistence: localStorage + **MongoDB** (chats sync to server when available)
- Rate limiting, Zod validation, structured logging
