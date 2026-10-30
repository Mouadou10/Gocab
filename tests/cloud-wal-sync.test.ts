import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  serializeForWal,
  deserializeFromWal,
  prepareDeterministicWriteArgs,
  compactWalEntries,
  recordWalEntry,
  type WalEntry,
} from "../src/lib/sqliteCloudSync";

describe("Cloud WAL Sync Engine Unit Tests", () => {
  test("serializeForWal and deserializeFromWal preserve Date, BigInt, null, and omit undefined", () => {
    const sampleDate = new Date("2026-10-30T18:00:00.000Z");
    const input = {
      id: "abc-123",
      created_at: sampleDate,
      optionalNull: null,
      optionalUndefined: undefined,
      nested: {
        reminder_date: sampleDate,
        skipMe: undefined,
        arr: [sampleDate, "ok"],
      },
    };

    const serialized = serializeForWal(input);
    const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
    const revived = deserializeFromWal(jsonRoundTrip);

    assert.equal(revived.id, "abc-123");
    assert.equal(revived.optionalNull, null);
    assert.equal("optionalUndefined" in revived, false);
    assert.equal("skipMe" in revived.nested, false);
    assert.ok(revived.created_at instanceof Date);
    assert.equal(revived.created_at.toISOString(), sampleDate.toISOString());
    assert.ok(revived.nested.reminder_date instanceof Date);
    assert.ok(revived.nested.arr[0] instanceof Date);
  });

  test("prepareDeterministicWriteArgs assigns deterministic UUIDs to create, upsert, and createMany", () => {
    const createArgs = prepareDeterministicWriteArgs("accidentClaim", "create", [
      {
        data: { vehicle_id: "veh-1", timeline_step: "NEW_ACCIDENT" },
        include: { vehicle: true },
      },
    ]);
    assert.equal(typeof createArgs[0].data.id, "string");
    assert.ok(createArgs[0].data.id.length >= 32);
    // Preserves include for local caller
    assert.deepEqual(createArgs[0].include, { vehicle: true });

    const upsertArgs = prepareDeterministicWriteArgs("whatsAppConversation", "upsert", [
      {
        where: { phone_number: "212666563066" },
        update: { unread_count: 1 },
        create: { phone_number: "212666563066", contact_name: "Mohamed Aziz" },
      },
    ]);
    assert.equal(typeof upsertArgs[0].create.id, "string");

    const createManyArgs = prepareDeterministicWriteArgs("leadActivityLog", "createMany", [
      {
        data: [
          { lead_id: "l1", agent: "Nour", action: "CALL" },
          { id: "fixed-id", lead_id: "l2", agent: "Kaoutar", action: "CALL" },
        ],
      },
    ]);
    assert.equal(typeof createManyArgs[0].data[0].id, "string");
    assert.equal(createManyArgs[0].data[1].id, "fixed-id");

    // Setting uses `key` primary key, never `id`
    const settingArgs = prepareDeterministicWriteArgs("setting", "upsert", [
      {
        where: { key: "data_sync_state" },
        update: { value: "{}" },
        create: { key: "data_sync_state", value: "{}" },
      },
    ]);
    assert.equal(settingArgs[0].create.id, undefined);
  });

  test("compactWalEntries deduplicates IDs and compacts superseded Setting upserts", () => {
    const entries: WalEntry[] = [
      {
        id: "e1",
        seq: 1,
        ts: 1000,
        model: "setting",
        method: "upsert",
        args: [{ where: { key: "data_sync_state" }, update: { value: "v1" }, create: { key: "data_sync_state", value: "v1" } }],
      },
      {
        id: "e2",
        seq: 2,
        ts: 1010,
        model: "accidentClaim",
        method: "create",
        args: [{ data: { id: "claim-1", vehicle_id: "v1" } }],
      },
      {
        id: "e2", // Duplicate ID
        seq: 2,
        ts: 1010,
        model: "accidentClaim",
        method: "create",
        args: [{ data: { id: "claim-1", vehicle_id: "v1" } }],
      },
      {
        id: "e3",
        seq: 3,
        ts: 1020,
        model: "setting",
        method: "upsert",
        args: [{ where: { key: "data_sync_state" }, update: { value: "v2" }, create: { key: "data_sync_state", value: "v2" } }],
      },
    ];

    const compacted = compactWalEntries(entries);
    assert.equal(compacted.length, 2);
    assert.equal(compacted[0].id, "e2");
    assert.equal(compacted[1].id, "e3");
  });

  test("recordWalEntry strips include/select and resolves generated Dates and atomic increments", () => {
    const prevEnv = process.env.FORCE_CLOUD_WAL;
    process.env.FORCE_CLOUD_WAL = "true";
    try {
      const now = new Date("2026-10-30T18:10:00.000Z");
      const entry = recordWalEntry(
        "whatsAppConversation",
        "update",
        [
          {
            where: { id: "conv-1" },
            data: { unread_count: { increment: 1 } },
            include: { messages: true },
          },
        ],
        {
          id: "conv-1",
          unread_count: 5,
          updated_at: now,
        }
      );

      assert.ok(entry);
      assert.equal(entry!.args[0].include, undefined);
      assert.equal(entry!.args[0].data.unread_count, 5);
      const revived = deserializeFromWal(entry!.args);
      assert.ok(revived[0].data.updated_at instanceof Date);
      assert.equal(revived[0].data.updated_at.toISOString(), now.toISOString());

      // Clear pending entry created during unit test
      const g = (globalThis as any).__gocabSqliteSync;
      if (g?.pendingEntries) {
        g.pendingEntries = g.pendingEntries.filter((x: WalEntry) => x.id !== entry!.id);
      }
    } finally {
      if (prevEnv === undefined) delete process.env.FORCE_CLOUD_WAL;
      else process.env.FORCE_CLOUD_WAL = prevEnv;
    }
  });
});
