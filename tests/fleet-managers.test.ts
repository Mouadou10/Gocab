import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MEHDI_VEHICLE_PLATES,
  isMehdiPlate,
  resolveVehicleFleetManager,
  resolveDriverFleetManager,
} from "../src/lib/fleet-managers";

describe("Mehdi Elyattouti Portfolio Locking Engine", () => {
  it("should contain exactly 26 dedicated vehicle plates for Mehdi", () => {
    assert.equal(MEHDI_VEHICLE_PLATES.length, 26);
    const uniquePlates = new Set(MEHDI_VEHICLE_PLATES);
    assert.equal(uniquePlates.size, 26);
  });

  it("should recognize all 26 plates regardless of dashes, spaces, and casing", () => {
    for (const plate of MEHDI_VEHICLE_PLATES) {
      assert.equal(isMehdiPlate(plate), true, `Expected ${plate} to be recognized`);
      // Lowercase test
      assert.equal(isMehdiPlate(plate.toLowerCase()), true, `Expected lowercase of ${plate} to match`);
      // Without hyphens test
      assert.equal(isMehdiPlate(plate.replace(/-/g, "")), true, `Expected unhyphenated ${plate} to match`);
    }
  });

  it("should reject unrelated plates and empty values", () => {
    assert.equal(isMehdiPlate("12345-A-1"), false);
    assert.equal(isMehdiPlate("99999-B-7"), false);
    assert.equal(isMehdiPlate("WW999999"), false);
    assert.equal(isMehdiPlate(null), false);
    assert.equal(isMehdiPlate(undefined), false);
    assert.equal(isMehdiPlate(""), false);
  });

  it("should resolve vehicle fleet manager to Mehdi for any of his 26 plates, even if DB says another manager", () => {
    for (const plate of MEHDI_VEHICLE_PLATES) {
      const resolved = resolveVehicleFleetManager({
        plate_number: plate,
        assigned_collector: "Mohamed Aziz",
        assigned_supervisor: "Mohamed Aziz",
      });
      assert.equal(resolved, "mehdi elyattouti");
    }
  });

  it("should default unassigned vehicles to Mohamed Aziz", () => {
    const resolved = resolveVehicleFleetManager({
      plate_number: "99999-B-7",
      assigned_collector: null,
      assigned_supervisor: null,
    });
    assert.equal(resolved, "mohamed aziz");
  });

  it("should resolve driver to Mehdi if driving one of Mehdi's 26 vehicles, even if driver manager was unset or Aziz", () => {
    const resolved = resolveDriverFleetManager({
      manager: "Mohamed Aziz",
      vehicle: { plate_number: "26517-Y-6" },
    });
    assert.equal(resolved, "mehdi elyattouti");
  });

  it("should resolve driver without vehicle to Mohamed Aziz by default", () => {
    const resolved = resolveDriverFleetManager({
      manager: null,
      vehicle: null,
    });
    assert.equal(resolved, "mohamed aziz");
  });
});
