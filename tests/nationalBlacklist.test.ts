import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchNationalBlacklist,
  cleanNameString,
  harmonizeToken,
} from "../src/lib/services/nationalBlacklistMatcher";

describe("National Blacklist Matching Engine (Moroccan Rental Blacklist)", () => {
  it("should match exact full names", () => {
    const res = matchNationalBlacklist("ABAZAOUIA JALAL");
    assert.strictEqual(res.isBlacklisted, true);
    assert.strictEqual(res.matchType, "EXACT");
    assert.strictEqual(res.score, 1.0);
    assert.strictEqual(res.matchedEntry?.fullName, "ABAZAOUIA JALAL");
    assert.strictEqual(res.matchedEntry?.reason, "DÉTOURNEMENT DE VÉHICULE");
  });

  it("should match when word order is inverted (First Name / Last Name swapped)", () => {
    const res = matchNationalBlacklist("Jalal Abazaouia");
    assert.strictEqual(res.isBlacklisted, true);
    assert.strictEqual(res.matchType, "EXACT");
    assert.strictEqual(res.matchedEntry?.fullName, "ABAZAOUIA JALAL");
  });

  it("should handle Moroccan transliterations and double letters (Amar vs Aamar, Abdelkoudous vs Abdelkouddous)", () => {
    const res = matchNationalBlacklist("Amar Abdelkoudous");
    assert.strictEqual(res.isBlacklisted, true);
    assert.strictEqual(res.matchedEntry?.fullName, "AAMAR ABDELKOUDDOUS");
    assert.strictEqual(res.matchedEntry?.reason, "MAUVAIS CLIENT");
  });

  it("should handle Moroccan particle prefix variations (El Amrani vs Amrani, Bencheikh vs Ben Cheikh)", () => {
    const res1 = matchNationalBlacklist("Khalid El Amrani");
    assert.strictEqual(res1.isBlacklisted, true);
    assert.strictEqual(res1.matchedEntry?.fullName, "EL AMRANI KHALID");

    const res2 = matchNationalBlacklist("Mohammed Bencheikh");
    assert.strictEqual(res2.isBlacklisted, true);
    assert.strictEqual(res2.matchedEntry?.fullName, "BENCHEIKH MOHAMED");
    assert.strictEqual(res2.matchedEntry?.reason, "IMPOSTEUR");
  });

  it("should match known active drivers with vehicle detournement infractions", () => {
    const res1 = matchNationalBlacklist("MOUSSAID ADIL");
    assert.strictEqual(res1.isBlacklisted, true);
    assert.strictEqual(res1.matchedEntry?.reason, "DÉTOURNEMENT DE VÉHICULE");

    const res2 = matchNationalBlacklist("LABKHOURE NABIL");
    assert.strictEqual(res2.isBlacklisted, true);
    assert.strictEqual(res2.matchedEntry?.fullName, "LABKHOUR NABIL");
    assert.strictEqual(res2.matchedEntry?.reason, "DÉTOURNEMENT DE VÉHICULE");

    const res3 = matchNationalBlacklist("Mohamed El Jaouhari");
    assert.strictEqual(res3.isBlacklisted, true);
    assert.strictEqual(res3.matchedEntry?.fullName, "EL JAOUHARI MOHAMED");
    assert.strictEqual(res3.matchedEntry?.reason, "DÉTOURNEMENT DE VÉHICULE");
  });

  it("should not match completely unrelated names", () => {
    const res = matchNationalBlacklist("Jean Dupont");
    assert.strictEqual(res.isBlacklisted, false);
    assert.strictEqual(res.matchedEntry, null);
  });

  it("should guard against single generic first names matching false positives", () => {
    const res = matchNationalBlacklist("Mohamed");
    assert.strictEqual(res.isBlacklisted, false);
    assert.strictEqual(res.matchedEntry, null);
  });

  it("should produce a complete formatted warning message", () => {
    const res = matchNationalBlacklist("Walid Moustatii");
    assert.strictEqual(res.isBlacklisted, true);
    assert.ok(res.warningDetailText.includes("LISTE NOIRE NATIONALE"));
    assert.ok(res.warningDetailText.includes("MOUSTATII WALID"));
    assert.ok(res.warningDetailText.includes("IMPOSTEUR"));
  });
});
