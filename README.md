# StudioSpace Server

Backend REST API for the StudioSpace creative workspace marketplace.

## Tech Stack
- Node.js & Express.js
- TypeScript
- MongoDB Atlas (Official Node.js driver)
- tsx (Development execution & hot reload)

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your MongoDB Atlas connection string in `MONGODB_URI`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

## Scripts
- `npm run dev`: Start development server with live reload.
- `npm run build`: Compile TypeScript to `dist/`.
- `npm start`: Run compiled production server.
- `npm run typecheck`: Run TypeScript static type analysis.

