# StudioSpace — Backend API Server

High-performance Express REST API for the StudioSpace creative workspace marketplace, powered by TypeScript, MongoDB Atlas, and Better Auth.

**Production API Endpoint:** [https://studiospace-server-afsq.onrender.com](https://studiospace-server-afsq.onrender.com)  
**Public Health Check:** [https://studiospace-server-afsq.onrender.com/api/health](https://studiospace-server-afsq.onrender.com/api/health)  
**Frontend Client:** [https://studiospace23.vercel.app](https://studiospace23.vercel.app)

---

## 🔒 Security & Concurrency Highlights

1. **MongoDB Transaction-Based Mutex Locking:**
   All availability-altering mutations (`createBooking`, `cancelBooking`, `confirmBooking`, `completeBooking`) run within MongoDB multi-document transactions using atomic document locking (`$inc: { bookingLockVersion: 1 }`, `snapshot` read concern, `majority` write concern). Prevents concurrent double-booking race conditions.
2. **24-Hour Reservation Expiration Policy:**
   Pending reservations stop blocking availability after 24 hours. A transaction invariant in `confirmBooking` enforces that hosts cannot confirm expired requests.
3. **Role-Based Authorization & Anti-Escalation:**
   - Registration strictly accepts `Creator` or `Host`.
   - `databaseHooks.user.update.before` strips `role` from update payloads to block post-registration privilege escalation.
   - Studio mutations require host ownership verification (`hostId === req.user.id`).
4. **Dual Authentication Pathways:**
   - First-party HTTP-only session cookies via Next.js `/api/*` reverse proxy rewrite.
   - Bearer token fallback verified with asymmetric EdDSA JWKS public key cryptography.

---

## 📡 REST API Reference

### Health & Diagnostics
- `GET /api/health` — Public database connectivity ping and server status.

### Authentication (`/api/auth/*`)
- Handled by Better Auth node handler (Sign Up, Sign In, Social OAuth, Session management, JWKS public keys).

### Studios (`/api/studios`)
- `GET /api/studios` — Public studio directory with full-text search, category filter, price ranges, and sorting.
- `GET /api/studios/:id` — Public studio details by ID.
- `GET /api/studios/:id/availability` — Occupied time slots (PII stripped).
- `GET /api/studios/host/my-listings` — Host's owned listings *(Protected, Host role)*.
- `POST /api/studios` — Create a studio listing *(Protected, Host role)*.
- `PATCH /api/studios/:id` — Update studio listing *(Protected, Host ownership verified)*.
- `DELETE /api/studios/:id` — Delete studio listing *(Protected, Host ownership verified)*.

### Bookings (`/api/bookings`)
- `POST /api/bookings` — Create reservation with conflict verification *(Protected)*.
- `GET /api/bookings/my-bookings` — Creator's reservation history *(Protected)*.
- `GET /api/bookings/host-reservations` — Host's incoming booking requests *(Protected, Host role)*.
- `PATCH /api/bookings/:id/confirm` — Host confirms booking *(Protected, Host role)*.
- `PATCH /api/bookings/:id/cancel` — Cancel booking with reason *(Protected, Creator or Host)*.
- `PATCH /api/bookings/:id/complete` — Mark reservation completed *(Protected, Host role)*.

---

## 🛠 Tech Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Express 4
- **Language**: TypeScript (ES2022, NodeNext resolution)
- **Database**: MongoDB Atlas Replica Set (MongoDB Node Driver 6)
- **Authentication**: Better Auth (`better-auth`) + MongoDB Adapter + JWT Plugin (EdDSA JWKS)
- **Deployment**: Render Web Service

---

## 🚀 Local Development Setup

1. Clone and install:
   ```bash
   git clone https://github.com/umaer-islam/StudioSpace-Server.git
   cd StudioSpace-Server
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Fill in `MONGODB_URI`, `BETTER_AUTH_SECRET`, and optional Google OAuth credentials.

3. Run migrations / seed data:
   ```bash
   npm run seed
   ```

4. Run tests:
   ```bash
   npm run test         # Unit & integration tests
   npm run test:live    # Live MongoDB Atlas auth suite
   npm run test:booking # Concurrency race condition suite
   ```

5. Start dev server:
   ```bash
   npm run dev
   ```
