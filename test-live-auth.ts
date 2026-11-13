import http from "node:http";
import { connectToDatabase, closeDatabaseConnection, getDatabase } from "./src/config/database.js";
import app from "./src/app.js";

async function runLiveAuthTests() {
  console.log("\n========================================================");
  console.log(" STUDIO SPACE — LIVE DATABASE AUTHENTICATION VERIFICATION ");
  console.log("========================================================\n");

  // 1. Connect to live MongoDB Atlas
  console.log("[1/6] Connecting to live MongoDB Atlas...");
  await connectToDatabase();
  console.log("      Connected to database successfully.\n");

  // 2. Start server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[2/6] Test server running on ${baseUrl}\n`);

  const timestamp = Date.now();
  const hostEmail = `test.host.${timestamp}@studiospace.local`;
  const creatorEmail = `test.creator.${timestamp}@studiospace.local`;
  const password = "SecurePassword123!";

  let hostCookies = "";
  let creatorCookies = "";
  let hostUserId = "";
  let creatorUserId = "";
  let createdStudioId = "";

  function extractCookies(res: Response): string {
    const rawCookies = res.headers.get("set-cookie");
    if (!rawCookies) return "";
    // Extract name=value pairs
    return rawCookies
      .split(/,\s*(?=[a-zA-Z0-9_-]+=)/)
      .map((c) => c.split(";")[0].trim())
      .join("; ");
  }

  try {
    // 3. Register Host user
    console.log(`[3/6] Registering Host user: ${hostEmail}...`);
    const hostRegisterRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Test Host Live",
        email: hostEmail,
        password: password,
        role: "Host",
      }),
    });

    const hostData = await hostRegisterRes.json();
    hostCookies = extractCookies(hostRegisterRes);

    if (hostRegisterRes.status !== 200 || !hostData.user) {
      throw new Error(`Host registration failed (${hostRegisterRes.status}): ${JSON.stringify(hostData)}`);
    }

    hostUserId = hostData.user.id;
    console.log(`      ✓ Host registered. ID: ${hostUserId}, Role: ${hostData.user.role}`);
    console.log(`      ✓ Session cookie obtained: ${hostCookies.slice(0, 40)}...\n`);

    // 4. Register Creator user
    console.log(`[4/6] Registering Creator user: ${creatorEmail}...`);
    const creatorRegisterRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Test Creator Live",
        email: creatorEmail,
        password: password,
        role: "Creator",
      }),
    });

    const creatorData = await creatorRegisterRes.json();
    creatorCookies = extractCookies(creatorRegisterRes);

    if (creatorRegisterRes.status !== 200 || !creatorData.user) {
      throw new Error(`Creator registration failed (${creatorRegisterRes.status}): ${JSON.stringify(creatorData)}`);
    }

    creatorUserId = creatorData.user.id;
    console.log(`      ✓ Creator registered. ID: ${creatorUserId}, Role: ${creatorData.user.role}`);
    console.log(`      ✓ Session cookie obtained: ${creatorCookies.slice(0, 40)}...\n`);

    // 5. Test Role Authorization & Studio CRUD
    console.log("[5/6] Testing Role Authorization & Studio Ownership...");

    // Test 5A: Creator attempts to create a studio -> Expected 403 Forbidden
    const creatorCreateRes = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: creatorCookies,
      },
      body: JSON.stringify({
        title: "Unauthorized Creator Studio",
        category: "Photo Studio",
        hourlyRate: 100,
        maxCapacity: 10,
        location: "Downtown",
        address: "123 Main St",
        overview: "A test studio by creator",
      }),
    });

    if (creatorCreateRes.status !== 403) {
      throw new Error(`Expected 403 for Creator studio creation, got ${creatorCreateRes.status}`);
    }
    console.log("      ✓ [PASS] Creator received 403 Forbidden when creating a studio.");

    // Test 5B: Host creates a studio -> Expected 201 Created with hostId attached
    const hostCreateRes = await fetch(`${baseUrl}/api/studios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: hostCookies,
      },
      body: JSON.stringify({
        title: "Live Verified Penthouse Loft",
        category: "Photo Studio",
        hourlyRate: 175,
        securityDeposit: 250,
        maxCapacity: 15,
        location: "SoHo, Manhattan",
        address: "580 Broadway, New York, NY",
        imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
        amenities: ["Natural Daylight", "High Ceilings", "Freight Elevator", "Hair & Makeup Station"],
        overview: "Spectacular daylight loft with 14-foot windows and historic architectural charm.",
      }),
    });

    const createdStudioData = await hostCreateRes.json();
    if (hostCreateRes.status !== 201 || !createdStudioData.data?._id) {
      throw new Error(`Host studio creation failed (${hostCreateRes.status}): ${JSON.stringify(createdStudioData)}`);
    }

    createdStudioId = createdStudioData.data._id;
    if (createdStudioData.data.hostId !== hostUserId) {
      throw new Error(`hostId mismatch: expected ${hostUserId}, got ${createdStudioData.data.hostId}`);
    }
    console.log(`      ✓ [PASS] Host created studio (${createdStudioId}) with verified hostId: ${createdStudioData.data.hostId}`);

    // Test 5C: Creator attempts to modify the host's studio -> Expected 403 Forbidden
    const creatorPatchRes = await fetch(`${baseUrl}/api/studios/${createdStudioId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: creatorCookies,
      },
      body: JSON.stringify({ title: "Hacked Studio Title" }),
    });

    if (creatorPatchRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized studio update, got ${creatorPatchRes.status}`);
    }
    console.log("      ✓ [PASS] Creator received 403 Forbidden when modifying Host's studio.");

    // Test 5D: Host updates their own studio -> Expected 200 OK
    const hostPatchRes = await fetch(`${baseUrl}/api/studios/${createdStudioId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: hostCookies,
      },
      body: JSON.stringify({ hourlyRate: 195 }),
    });

    const patchedData = await hostPatchRes.json();
    if (hostPatchRes.status !== 200 || patchedData.data?.hourlyRate !== 195) {
      throw new Error(`Host studio update failed: ${JSON.stringify(patchedData)}`);
    }
    console.log("      ✓ [PASS] Host successfully updated their own studio rate to $195/hr.");

    // Test 5E: Host deletes their own studio -> Expected 200 OK
    const hostDeleteRes = await fetch(`${baseUrl}/api/studios/${createdStudioId}`, {
      method: "DELETE",
      headers: { Cookie: hostCookies },
    });

    if (hostDeleteRes.status !== 200) {
      throw new Error(`Host studio deletion failed (${hostDeleteRes.status})`);
    }
    console.log("      ✓ [PASS] Host successfully deleted their own studio.");

    // Test 5F: Protect system seeded studio
    const db = getDatabase();
    const seededStudio = await db.collection("studios").findOne({ hostId: { $exists: false } });
    if (seededStudio) {
      const seededDeleteRes = await fetch(`${baseUrl}/api/studios/${seededStudio._id.toString()}`, {
        method: "DELETE",
        headers: { Cookie: hostCookies },
      });
      if (seededDeleteRes.status !== 403) {
        throw new Error(`Expected 403 for seeded studio deletion, got ${seededDeleteRes.status}`);
      }
      console.log("      ✓ [PASS] System-seeded studio protected: deletion returned 403 Forbidden.");
    }

    // 6. Cleanup test records
    console.log("\n[6/6] Cleaning up test records in MongoDB Atlas...");
    const usersCol = db.collection("user");
    const sessionsCol = db.collection("session");
    const accountsCol = db.collection("account");

    await Promise.all([
      usersCol.deleteMany({ email: { $in: [hostEmail, creatorEmail] } }),
      sessionsCol.deleteMany({ userId: { $in: [hostUserId, creatorUserId] } }),
      accountsCol.deleteMany({ userId: { $in: [hostUserId, creatorUserId] } }),
    ]);
    console.log("      ✓ Test users and sessions safely removed.");

    console.log("\n========================================================");
    console.log(" ALL LIVE DATABASE AUTHENTICATION & ROLE TESTS PASSED! ");
    console.log("========================================================\n");
  } finally {
    server.close();
    await closeDatabaseConnection();
  }
}

runLiveAuthTests().catch((err) => {
  console.error("\n❌ Live Auth Verification Failed:", err);
  process.exit(1);
});
