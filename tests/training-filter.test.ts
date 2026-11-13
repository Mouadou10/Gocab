import { describe, it } from "node:test";
import assert from "node:assert/strict";

function matchesDate(dateVal: any, targetFilter: string): boolean {
  if (!dateVal) return false;
  if (!targetFilter || targetFilter === "ALL") return true;

  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;

    const localYear = d.getFullYear();
    const localMonth = String(d.getMonth() + 1).padStart(2, "0");
    const localDay = String(d.getDate()).padStart(2, "0");
    const localYMD = `${localYear}-${localMonth}-${localDay}`;
    const utcYMD = d.toISOString().slice(0, 10);

    const now = new Date();
    const todayLocalYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayUtcYMD = now.toISOString().slice(0, 10);

    if (targetFilter === "TODAY") {
      return localYMD === todayLocalYMD || utcYMD === todayUtcYMD;
    }

    if (targetFilter === "TOMORROW") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowLocalYMD = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      const tomorrowUtcYMD = tomorrow.toISOString().slice(0, 10);
      return localYMD === tomorrowLocalYMD || utcYMD === tomorrowUtcYMD;
    }

    if (targetFilter === localYMD || targetFilter === utcYMD) {
      return true;
    }

    const dTag = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (targetFilter === dTag) return true;

    return false;
  } catch {
    return false;
  }
}

function isLeadTrainingDateMatch(lead: { reminder_date: string | null }, filter: string): boolean {
  if (!filter || filter === "ALL") return true;
  if (lead.reminder_date && matchesDate(lead.reminder_date, filter)) {
    return true;
  }
  return false;
}

describe("Training Fixed Date Filter", () => {
  it("Lead scheduled for 19/11 should NOT match TODAY filter", () => {
    const lead = { reminder_date: "2026-11-19T10:00:00.000Z" };
    assert.equal(isLeadTrainingDateMatch(lead, "TODAY"), false);
  });

  it("Lead scheduled for TODAY should match TODAY filter", () => {
    const lead = { reminder_date: new Date().toISOString() };
    assert.equal(isLeadTrainingDateMatch(lead, "TODAY"), true);
  });

  it("Lead scheduled for 19/11 should match exact 2026-11-19 filter", () => {
    const lead = { reminder_date: "2026-11-19T10:00:00.000Z" };
    assert.equal(isLeadTrainingDateMatch(lead, "2026-11-19"), true);
  });

  it("Lead scheduled for 19/11 should match ALL filter", () => {
    const lead = { reminder_date: "2026-11-19T10:00:00.000Z" };
    assert.equal(isLeadTrainingDateMatch(lead, "ALL"), true);
  });
});
