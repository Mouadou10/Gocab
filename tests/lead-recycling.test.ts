import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { v4 as uuidv4 } from "uuid";
import { prisma } from "../src/lib/prisma";
import { autoRecycleDueLeads } from "../src/lib/services/leadRecyclingService";

async function testRecycling() {
  console.log("🧪 Testing Automated Lead Recycling Service...");

  const testId1 = uuidv4();
  const testId2 = uuidv4();
  const testId3 = uuidv4();
  const testId4 = uuidv4();

  const now = new Date();
  const past25h = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // 1. Create Test Leads
    // Lead 1: No response 1 from 25h ago (SHOULD RECYCLE)
    await prisma.lead.create({
      data: {
        id: testId1,
        raw_name: "Test NoResp 1",
        sanitized_phone: `+212999${Math.floor(100000 + Math.random() * 900000)}`,
        campaign_source: "TEST",
        board_column: "BRAND_PRE_FILTER",
        brand_status: "No response 1",
        status_changed_at: past25h,
      },
    });

    // Lead 2: No response 2 from 25h ago (SHOULD RECYCLE)
    await prisma.lead.create({
      data: {
        id: testId2,
        raw_name: "Test NoResp 2",
        sanitized_phone: `+212999${Math.floor(100000 + Math.random() * 900000)}`,
        campaign_source: "TEST",
        board_column: "BRAND_PRE_FILTER",
        brand_status: "No response 2",
        status_changed_at: past25h,
      },
    });

    // Lead 3: To Recall set for today (SHOULD RECYCLE)
    await prisma.lead.create({
      data: {
        id: testId3,
        raw_name: "Test Recall Today",
        sanitized_phone: `+212999${Math.floor(100000 + Math.random() * 900000)}`,
        campaign_source: "TEST",
        board_column: "BRAND_PRE_FILTER",
        brand_status: "To Recall",
        reminder_date: now,
        status_changed_at: now,
      },
    });

    // Lead 4: To Recall set for tomorrow (SHOULD NOT RECYCLE)
    await prisma.lead.create({
      data: {
        id: testId4,
        raw_name: "Test Recall Tomorrow",
        sanitized_phone: `+212999${Math.floor(100000 + Math.random() * 900000)}`,
        campaign_source: "TEST",
        board_column: "BRAND_PRE_FILTER",
        brand_status: "To Recall",
        reminder_date: tomorrow,
        status_changed_at: now,
      },
    });

    console.log("Created 4 test leads. Running autoRecycleDueLeads(true)...");
    const result = await autoRecycleDueLeads(true);

    console.log("Recycle execution result:", result);

    // Verify Lead 1
    const l1 = await prisma.lead.findUnique({ where: { id: testId1 } });
    console.log("Lead 1 (No response 1):", l1?.board_column, l1?.brand_status);
    if (l1?.board_column !== "NEW_LEADS" || l1?.brand_status !== null) {
      throw new Error("Lead 1 was not recycled!");
    }

    // Verify Lead 2
    const l2 = await prisma.lead.findUnique({ where: { id: testId2 } });
    console.log("Lead 2 (No response 2):", l2?.board_column, l2?.brand_status);
    if (l2?.board_column !== "NEW_LEADS" || l2?.brand_status !== null) {
      throw new Error("Lead 2 was not recycled!");
    }

    // Verify Lead 3
    const l3 = await prisma.lead.findUnique({ where: { id: testId3 } });
    console.log("Lead 3 (Recall Today):", l3?.board_column, l3?.brand_status);
    if (l3?.board_column !== "NEW_LEADS" || l3?.brand_status !== null) {
      throw new Error("Lead 3 was not recycled!");
    }

    // Verify Lead 4
    const l4 = await prisma.lead.findUnique({ where: { id: testId4 } });
    console.log("Lead 4 (Recall Tomorrow):", l4?.board_column, l4?.brand_status);
    if (l4?.board_column !== "BRAND_PRE_FILTER" || l4?.brand_status !== "To Recall") {
      throw new Error("Lead 4 was incorrectly recycled!");
    }

    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } finally {
    // Cleanup test leads
    await prisma.lead.deleteMany({
      where: { id: { in: [testId1, testId2, testId3, testId4] } },
    });
    console.log("Cleaned up test leads.");
  }
}

testRecycling()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
