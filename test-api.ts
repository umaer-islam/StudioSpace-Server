import app from "./src/app.js";
import http from "node:http";
import * as jose from "jose";
import { env } from "./src/config/env.js";

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`[Test Suite] Running API & Auth tests on ${baseUrl}`);
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // Generate test JWT tokens
  const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
  const hostToken = await new jose.SignJWT({
    id: "host_test_user_id_123",
    name: "Test Host",
    email: "host@example.com",
    role: "Host",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);

  const creatorToken = await new jose.SignJWT({
    id: "creator_test_user_id_456",
    name: "Test Creator",
    email: "creator@example.com",
    role: "Creator",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);

  // 1. Health check
  await test("GET /api/health returns status and database info", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    if (!data.status || !data.database) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`Unexpected status code: ${res.status}`);
    }
  });

  // 2. 404 handler
  await test("GET /api/nonexistent returns 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    const data = await res.json();
    if (res.status !== 404 || data.success !== false) {
      throw new Error(`Expected 404 with success:false, got ${res.status}`);
    }
  });

  // 3. Validation: Invalid ObjectId for public GET
  await test("GET /api/studios/invalid-object-id returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/studios/123-bad-id`);
    const data = await res.json();
    if (res.status !== 400 || data.message !== "Invalid studio ID format") {
      throw new Error(`Expected 400 with invalid ID format, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 4. Auth: Unauthenticated POST /api/studios returns 401
  await test("POST /api/studios without auth returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Studio" }),
    });
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 5. Auth: Unauthenticated PATCH /api/studios/:id returns 401
  await test("PATCH /api/studios/:id without auth returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/studios/507f1f77bcf86cd799439011`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 6. Auth: Unauthenticated DELETE /api/studios/:id returns 401
  await test("DELETE /api/studios/:id without auth returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/studios/507f1f77bcf86cd799439011`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 7. Auth: Invalid Bearer token returns 401
  await test("POST /api/studios with invalid Bearer token returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.fake.token",
      },
      body: JSON.stringify({ title: "New Studio" }),
    });
    const data = await res.json();
    if (res.status !== 401 || data.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    }
  });

  // 8. Auth: Creator role trying to create a studio returns 403 Forbidden
  await test("POST /api/studios with Creator role returns 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({ title: "Creator Studio" }),
    });
    const data = await res.json();
    if (res.status !== 403 || data.success !== false) {
      throw new Error(`Expected 403 Forbidden, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 9. Auth + Validation: Host role with empty body returns 400 with validation errors
  await test("POST /api/studios with Host token and empty body returns 400 and validation errors", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || !Array.isArray(data.errors) || data.errors.length < 5) {
      throw new Error(`Expected 400 with validation errors, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 10. Auth + Validation: Host role with negative hourlyRate & invalid email returns 400
  await test("POST /api/studios with Host token, negative hourlyRate and invalid email returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: "Test Studio",
        category: "Photo Studio",
        hourlyRate: -50,
        maxCapacity: 10,
        location: "Downtown",
        address: "123 Main St",
        overview: "A great studio",
        hostEmail: "not-an-email",
      }),
    });
    const data = await res.json();
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
    const errorString = JSON.stringify(data.errors);
    if (!errorString.includes("hourlyRate") || !errorString.includes("hostEmail")) {
      throw new Error(`Expected hourlyRate and hostEmail errors, got ${errorString}`);
    }
  });

  // 11. Query parameters safely parse
  await test("Query parameters parse safely without crashing", async () => {
    const res = await fetch(`${baseUrl}/api/studios?minPrice=50&maxPrice=200&page=1&limit=100&category=Photo%20Studio&sort=rating`);
    if (![200, 500, 503].includes(res.status)) {
      throw new Error(`Unexpected response code: ${res.status}`);
    }
  });

  server.close();
  console.log(`\n[Test Summary] ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
