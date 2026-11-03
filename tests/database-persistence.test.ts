import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";

test("Database Persistence & Transactional Integrity Suite", async (t) => {
  const testId = `persist_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const testVal = `val_${Date.now()}`;

  await t.test("1. Atomic transactional write and commit", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.setting.create({
        data: {
          key: testId,
          value: testVal,
        },
      });
    });

    const read = await prisma.setting.findUnique({
      where: { key: testId },
    });
    assert.equal(read?.value, testVal, "Committed value must match written value");
  });

  await t.test("2. Cross-session verification from independent client instance", async () => {
    // Instantiate a separate, independent client simulating a cold-started session
    const dbPath = path.join(process.cwd(), "dev.db").replace(/\\/g, "/");
    const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
    const independentClient = new PrismaClient({ adapter });

    try {
      const readFromSessionB = await independentClient.setting.findUnique({
        where: { key: testId },
      });
      assert.equal(
        readFromSessionB?.value,
        testVal,
        "Record written in Session A must be immediately visible in Session B"
      );
    } finally {
      await independentClient.$disconnect();
    }
  });

  await t.test("3. Transaction rollback on error leaves zero dirty data", async () => {
    const rollbackKey = `rollback_test_${Date.now()}`;

    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.setting.create({
            data: {
              key: rollbackKey,
              value: "should_rollback",
            },
          });
          throw new Error("Simulated transactional failure");
        });
      },
      /Simulated transactional failure/
    );

    const check = await prisma.setting.findUnique({
      where: { key: rollbackKey },
    });
    assert.equal(check, null, "Aborted transaction must roll back cleanly without leaving rows");
  });

  await t.test("4. Safe upsert & idempotency under retries", async () => {
    const idempotentKey = `idempotent_${Date.now()}`;

    // First attempt
    await prisma.setting.upsert({
      where: { key: idempotentKey },
      create: { key: idempotentKey, value: "attempt_1" },
      update: { value: "attempt_1" },
    });

    // Simulated network retry (identical payload)
    await prisma.setting.upsert({
      where: { key: idempotentKey },
      create: { key: idempotentKey, value: "attempt_1" },
      update: { value: "attempt_1" },
    });

    const count = await prisma.setting.count({
      where: { key: idempotentKey },
    });
    assert.equal(count, 1, "Idempotent retry must maintain single row");

    // Clean up
    await prisma.setting.delete({ where: { key: idempotentKey } });
  });

  // Global cleanup
  await prisma.setting.delete({ where: { key: testId } }).catch(() => {});
});
