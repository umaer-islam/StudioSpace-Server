import http from "node:http";
import { connectToDatabase, closeDatabaseConnection, getDatabase } from "./src/config/database.js";
import app from "./src/app.js";
import { ObjectId } from "mongodb";

async function runBookingConcurrencyTests() {
  console.log("\n========================================================");
  console.log(" STUDIO SPACE — BOOKING SYSTEM & CONCURRENCY TEST SUITE ");
  console.log("========================================================\n");

  await connectToDatabase();
  const db = getDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Running on ${baseUrl}\n`);

  const timestamp = Date.now();
  const hostEmail = `host.booking.${timestamp}@studiospace.local`;
  const creatorAEmail = `creator.a.${timestamp}@studiospace.local`;
  const creatorBEmail = `creator.b.${timestamp}@studiospace.local`;
  const password = "Password123!";

  function extractCookie(res: Response): string {
    const rawCookies = res.headers.get("set-cookie");
    if (!rawCookies) return "";
    return rawCookies
      .split(/,\s*(?=[a-zA-Z0-9_-]+=)/)
      .map((c) => c.split(";")[0].trim())
      .join("; ");
  }

  let hostCookie = "";
  let creatorACookie = "";
  let creatorBCookie = "";
  let hostId = "";
  let creatorAId = "";
  let creatorBId = "";
  let testStudioId = "";

  try {
    // 1. Register Host, Creator A, Creator B
    console.log("[1/5] Registering Test Users in Atlas...");
    const [resHost, resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ name: "Host Booking", email: hostEmail, password, role: "Host" }),
      }),
      fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ name: "Creator A", email: creatorAEmail, password, role: "Creator" }),
      }),
      fetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ name: "Creator B", email: creatorBEmail, password, role: "Creator" }),
      }),
    ]);

    const dataHost = await resHost.json();
    const dataA = await resA.json();
    const dataB = await resB.json();

    hostCookie = extractCookie(resHost);
    creatorACookie = extractCookie(resA);
    creatorBCookie = extractCookie(resB);

    hostId = dataHost.user.id;
    creatorAId = dataA.user.id;
    creatorBId = dataB.user.id;

    console.log(`      ✓ Host: ${hostId}, Creator A: ${creatorAId}, Creator B: ${creatorBId}`);

    // 2. Create a test studio listing owned by Host
    const studioRes = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: hostCookie },
      body: JSON.stringify({
        title: `Concurrency Test Studio ${timestamp}`,
        category: "Photo Studio",
        hourlyRate: 150,
        securityDeposit: 200,
        maxCapacity: 10,
        location: "Dhanmondi, Dhaka",
        address: "Road 27, House 42",
        overview: "A test studio for atomic concurrency verification.",
      }),
    });

    const studioData = await studioRes.json();
    testStudioId = studioData.data._id;
    console.log(`      ✓ Test Studio Created: ${testStudioId} ($150/hr, $200 deposit)\n`);

    // 3. Test Booking Validation & Edge Cases
    console.log("[2/5] Testing Booking Business Rules & Validation...");

    // Test 3A: Host cannot book their own studio
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
    futureDate.setUTCMinutes(0, 0, 0);
    const futureEnd = new Date(futureDate.getTime() + 2 * 3600 * 1000); // 2 hours

    const selfBookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: hostCookie },
      body: JSON.stringify({
        studioId: testStudioId,
        startTime: futureDate.toISOString(),
        endTime: futureEnd.toISOString(),
      }),
    });
    if (selfBookRes.status !== 400) {
      throw new Error(`Expected 400 for self-booking, got ${selfBookRes.status}`);
    }
    console.log("      ✓ [PASS] Self-booking prevented: Host received 400 Bad Request.");

    // Test 3B: Past date rejected
    const pastStart = new Date(Date.now() - 3600 * 1000).toISOString();
    const pastEnd = new Date(Date.now() + 3600 * 1000).toISOString();
    const pastRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: creatorACookie },
      body: JSON.stringify({
        studioId: testStudioId,
        startTime: pastStart,
        endTime: pastEnd,
      }),
    });
    if (pastRes.status !== 400) {
      throw new Error(`Expected 400 for past date booking, got ${pastRes.status}`);
    }
    console.log("      ✓ [PASS] Past date booking prevented: received 400 Bad Request.");

    // Test 3C: Duration < 1 hour rejected
    const shortEnd = new Date(futureDate.getTime() + 30 * 60 * 1000).toISOString(); // only 30 mins
    const shortRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: creatorACookie },
      body: JSON.stringify({
        studioId: testStudioId,
        startTime: futureDate.toISOString(),
        endTime: shortEnd,
      }),
    });
    if (shortRes.status !== 400) {
      throw new Error(`Expected 400 for < 1hr duration, got ${shortRes.status}`);
    }
    console.log("      ✓ [PASS] Under minimum duration (<1hr) prevented: received 400 Bad Request.");

    // 4. Test Concurrency Race Condition: SIMULTANEOUS DOUBLE BOOKING ATTEMPT
    console.log("\n[3/5] Testing Concurrency Race Condition (Simultaneous Competing Bookings)...");
    console.log("      Dispatching concurrent booking requests for Creator A and Creator B at identical time...");

    const slotStart = new Date(Date.now() + 48 * 3600 * 1000);
    slotStart.setUTCMinutes(0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 3 * 3600 * 1000); // 3 hours (150*3 = 450 + 200 deposit = 650 BDT)

    const [competeA, competeB] = await Promise.all([
      fetch(`${baseUrl}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorACookie },
        body: JSON.stringify({
          studioId: testStudioId,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          notes: "Creator A simultaneous reservation attempt",
        }),
      }),
      fetch(`${baseUrl}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: creatorBCookie },
        body: JSON.stringify({
          studioId: testStudioId,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          notes: "Creator B simultaneous reservation attempt",
        }),
      }),
    ]);

    const statusA = competeA.status;
    const statusB = competeB.status;
    console.log(`      Request A status: ${statusA}, Request B status: ${statusB}`);

    const has201 = statusA === 201 || statusB === 201;
    const has409 = statusA === 409 || statusB === 409;

    if (!has201 || !has409) {
      throw new Error(`Concurrency race condition failure! Expected one 201 and one 409, got: A=${statusA}, B=${statusB}`);
    }

    const successfulRes = statusA === 201 ? competeA : competeB;
    const successfulData = await successfulRes.json();
    const winningBookingId = successfulData.data._id;

    // Check pricing calculation
    // 3 hours @ 150/hr = 450 + 200 security deposit = 650 BDT
    if (successfulData.data.totalPrice !== 650 || successfulData.data.rentalFee !== 450) {
      throw new Error(`Server pricing calculation mismatch! Expected 650, got: ${successfulData.data.totalPrice}`);
    }
    console.log(`      ✓ Pricing calculated authoritatively: 3hrs * 150 + 200 = ${successfulData.data.totalPrice} BDT`);

    // Verify in MongoDB Atlas that exactly 1 booking was created
    const conflictingCount = await db.collection("bookings").countDocuments({
      studioId: new ObjectId(testStudioId),
      startTime: slotStart,
      endTime: slotEnd,
    });

    if (conflictingCount !== 1) {
      throw new Error(`Database double booking detected! Expected 1 record in Atlas, found ${conflictingCount}!`);
    }
    console.log(`      ✓ [PASS] Zero double bookings! Exactly 1 record inserted in Atlas. Mutex lock serialized execution.`);

    // 5. Test Lifecycle Transitions & Host Management
    console.log("\n[4/5] Testing Booking Lifecycle & Authorization...");

    // Test 5A: Host confirms pending booking
    const confirmRes = await fetch(`${baseUrl}/api/bookings/${winningBookingId}/confirm`, {
      method: "PATCH",
      headers: { Cookie: hostCookie },
    });
    const confirmData = await confirmRes.json();
    if (confirmRes.status !== 200 || confirmData.data?.status !== "confirmed") {
      throw new Error(`Host confirmation failed (${confirmRes.status}): ${JSON.stringify(confirmData)}`);
    }
    console.log("      ✓ [PASS] Host successfully confirmed booking (Status: confirmed).");

    // Test 5B: Creator cannot confirm booking -> 403
    const creatorConfirmRes = await fetch(`${baseUrl}/api/bookings/${winningBookingId}/confirm`, {
      method: "PATCH",
      headers: { Cookie: creatorACookie },
    });
    if (creatorConfirmRes.status !== 403) {
      throw new Error(`Expected 403 for Creator confirm attempt, got ${creatorConfirmRes.status}`);
    }
    console.log("      ✓ [PASS] Creator cannot confirm: received 403 Forbidden.");

    // Test 5C: Non-participant cannot view booking details -> 404 (Resource enumeration protected)
    const thirdPartyEmail = `stranger.${timestamp}@studiospace.local`;
    const strangerReg = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Stranger", email: thirdPartyEmail, password, role: "Creator" }),
    });
    const strangerCookie = extractCookie(strangerReg);
    const viewRes = await fetch(`${baseUrl}/api/bookings/${winningBookingId}`, {
      headers: { Cookie: strangerCookie },
    });
    if (viewRes.status !== 404) {
      throw new Error(`Expected 404 for non-participant view, got ${viewRes.status}`);
    }
    console.log("      ✓ [PASS] Non-participant received 404 Not Found (privacy protected).");

    // Test 5D: Public Studio Availability API (Zero PII leakage)
    const availRes = await fetch(`${baseUrl}/api/studios/${testStudioId}/availability`);
    const availData = await availRes.json();
    if (availRes.status !== 200 || !Array.isArray(availData.data) || availData.data.length === 0) {
      throw new Error(`Availability fetch failed: ${JSON.stringify(availData)}`);
    }
    const slot = availData.data[0];
    if (slot.creatorEmail || slot.creatorName || slot.notes || slot.totalPrice) {
      throw new Error(`CRITICAL: Availability endpoint leaked PII! Data: ${JSON.stringify(slot)}`);
    }
    console.log("      ✓ [PASS] Public availability endpoint returned occupied slots without any PII leakage.");

    // Test 5E: Cancellation releases slot and allows re-booking
    const cancelRes = await fetch(`${baseUrl}/api/bookings/${winningBookingId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: hostCookie },
      body: JSON.stringify({ reason: "Studio maintenance needed" }),
    });
    if (cancelRes.status !== 200) {
      throw new Error(`Cancellation failed (${cancelRes.status})`);
    }
    console.log("      ✓ [PASS] Host cancelled booking (Status: cancelled). Availability released.");

    // Now Creator B re-attempts the exact same slot -> Must succeed now!
    const rebookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: creatorBCookie },
      body: JSON.stringify({
        studioId: testStudioId,
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        notes: "Rebooking after cancellation",
      }),
    });
    if (rebookRes.status !== 201) {
      throw new Error(`Rebooking released slot failed (${rebookRes.status}): ${await rebookRes.text()}`);
    }
    console.log("      ✓ [PASS] Released time slot was successfully re-booked by Creator B (201 Created).");

    // 6. Cleanup
    console.log("\n[5/5] Cleaning up test records in MongoDB Atlas...");
    await Promise.all([
      db.collection("bookings").deleteMany({ studioId: new ObjectId(testStudioId) }),
      db.collection("studios").deleteOne({ _id: new ObjectId(testStudioId) }),
      db.collection("user").deleteMany({ email: { $in: [hostEmail, creatorAEmail, creatorBEmail, thirdPartyEmail] } }),
      db.collection("session").deleteMany({ userId: { $in: [hostId, creatorAId, creatorBId] } }),
      db.collection("account").deleteMany({ userId: { $in: [hostId, creatorAId, creatorBId] } }),
    ]);
    console.log("      ✓ All test records safely cleaned up from Atlas.");

    console.log("\n========================================================");
    console.log(" ALL BOOKING CONCURRENCY & LIFECYCLE TESTS PASSED! ");
    console.log("========================================================\n");
  } finally {
    server.close();
    await closeDatabaseConnection();
  }
}

runBookingConcurrencyTests().catch((err) => {
  console.error("\n❌ Booking Concurrency Test Failed:", err);
  process.exit(1);
});
