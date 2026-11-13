import app from "./src/app.js";
import http from "node:http";

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`[Test Suite] Running API tests on ${baseUrl}`);
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

  // 1. Health check
  await test("GET /api/health returns status and database info", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    if (!data.status || !data.database) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
    // Expected to be degraded (503) if DB is not authenticated, or ok (200) if authenticated
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

  // 3. Validation: Invalid ObjectId for GET
  await test("GET /api/studios/invalid-object-id returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/studios/123-bad-id`);
    const data = await res.json();
    if (res.status !== 400 || data.message !== "Invalid studio ID format") {
      throw new Error(`Expected 400 with invalid ID format, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 4. Validation: Invalid ObjectId for PATCH
  await test("PATCH /api/studios/invalid-object-id returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/studios/invalid-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });
    const data = await res.json();
    if (res.status !== 400 || data.message !== "Invalid studio ID format") {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // 5. Validation: Invalid ObjectId for DELETE
  await test("DELETE /api/studios/invalid-object-id returns 400 Bad Request", async () => {
    const res = await fetch(`${baseUrl}/api/studios/invalid-id`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.status !== 400 || data.message !== "Invalid studio ID format") {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // 6. Validation: POST /api/studios with missing required fields
  await test("POST /api/studios with empty body returns 400 and validation errors", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || !Array.isArray(data.errors) || data.errors.length < 5) {
      throw new Error(`Expected 400 with multiple validation errors, got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 7. Validation: POST /api/studios with negative hourlyRate & invalid email
  await test("POST /api/studios with negative hourlyRate and invalid email returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Studio",
        category: "Photo Studio",
        hourlyRate: -50,
        maxCapacity: 10,
        location: "Downtown",
        address: "123 Main St",
        overview: "A great studio",
        hostName: "John Doe",
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

  // 8. Validation: PATCH /api/studios/:validId with empty update body returns 400
  await test("PATCH /api/studios/:validId with empty object returns 400", async () => {
    const validObjectId = "507f1f77bcf86cd799439011";
    const res = await fetch(`${baseUrl}/api/studios/${validObjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.status !== 400 || !data.errors || !data.errors[0].includes("At least one field")) {
      throw new Error(`Expected 400 with 'At least one field', got ${res.status} ${JSON.stringify(data)}`);
    }
  });

  // 9. Validation: Query parameter parsing (minPrice > maxPrice, limit clamping)
  await test("Query parameters parse safely without crashing", async () => {
    const res = await fetch(`${baseUrl}/api/studios?minPrice=50&maxPrice=200&page=1&limit=100&category=Photo%20Studio&sort=rating`);
    // Should either return 200 (if DB connected) or 500/503 (if DB offline), but NEVER crash the process
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
