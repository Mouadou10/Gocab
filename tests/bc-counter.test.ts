import test from "node:test";
import assert from "node:assert/strict";
import { formatBcRef, parseBcRef, getNextBcRef, advanceBcCounter, BC_SETTING_KEY } from "@/lib/bc-counter";
import { prisma } from "@/lib/prisma";

test("Bon de Commande Sequential Auto-Increment Suite", async (t) => {
  await t.test("formats and parses Bon de Commande references correctly", () => {
    assert.equal(formatBcRef(97, 2026), "2026/97");
    assert.equal(formatBcRef(98, 2026), "2026/98");
    assert.equal(formatBcRef(5, 2026), "2026/05");

    const parsed = parseBcRef("2026/97");
    assert.deepEqual(parsed, { year: 2026, counter: 97 });
    assert.equal(parseBcRef("invalid"), null);
  });

  await t.test("guarantees starting reference at 2026/97 or higher", async () => {
    await prisma.setting.upsert({
      where: { key: BC_SETTING_KEY },
      create: { key: BC_SETTING_KEY, value: JSON.stringify({ counter: 97, year: 2026 }) },
      update: { value: JSON.stringify({ counter: 97, year: 2026 }) },
    });

    const res = await getNextBcRef();
    assert.equal(res.nextRef, "2026/97");
    assert.equal(res.counter, 97);
    assert.equal(res.year, 2026);
  });

  await t.test("increments sequentially: 2026/97 -> 2026/98 -> 2026/99", async () => {
    const next1 = await advanceBcCounter("2026/97");
    assert.equal(next1.nextRef, "2026/98");
    assert.equal(next1.counter, 98);

    const next2 = await advanceBcCounter("2026/98");
    assert.equal(next2.nextRef, "2026/99");
    assert.equal(next2.counter, 99);

    // Reset back to 97 for production runtime
    await prisma.setting.upsert({
      where: { key: BC_SETTING_KEY },
      create: { key: BC_SETTING_KEY, value: JSON.stringify({ counter: 97, year: 2026 }) },
      update: { value: JSON.stringify({ counter: 97, year: 2026 }) },
    });

    const resetCheck = await getNextBcRef();
    assert.equal(resetCheck.nextRef, "2026/97");
  });
});
