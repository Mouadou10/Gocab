import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateLeadCommission,
  getPartnerSummary,
  PARTNER_COMMISSION_RATE_MAD,
} from "../src/lib/services/partnerCommissionService";
import { prisma } from "../src/lib/prisma";

describe("Partner Commission Service (Zakaria 150 DH)", () => {
  it("should verify commission constant is 150 MAD", () => {
    assert.strictEqual(PARTNER_COMMISSION_RATE_MAD, 150);
  });

  it("should evaluate fresh NEW lead as PENDING (0 DH)", () => {
    const lead = {
      id: "test-1",
      raw_name: "Amine Chraibi",
      sanitized_phone: "+212612345678",
      board_column: "NEW_LEADS",
      training_status: null,
      preorder_amount: null,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "PENDING");
    assert.strictEqual(evalResult.commissionMAD, 0);
    assert.strictEqual(evalResult.isConverted, false);
    assert.match(evalResult.statusLabel, /Nouveau dossier/i);
  });

  it("should evaluate lead with Preorder status as VALIDATED (150 DH)", () => {
    const lead = {
      id: "test-2",
      raw_name: "Youssef Berrada",
      sanitized_phone: "+212622334455",
      board_column: "TRAINING_FIXED",
      training_status: "Preorder",
      preorder_amount: 0,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "VALIDATED");
    assert.strictEqual(evalResult.commissionMAD, 150);
    assert.strictEqual(evalResult.isConverted, true);
    assert.strictEqual(evalResult.conversionReason, "PREORDER_DEPOSITED");
    assert.match(evalResult.statusLabel, /Précommande Versée/i);
  });

  it("should evaluate lead with positive preorder_amount as VALIDATED (150 DH)", () => {
    const lead = {
      id: "test-3",
      raw_name: "Omar Tahiri",
      sanitized_phone: "+212633445566",
      board_column: "QUALIFIED",
      training_status: "Done",
      preorder_amount: 500,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "VALIDATED");
    assert.strictEqual(evalResult.commissionMAD, 150);
    assert.strictEqual(evalResult.isConverted, true);
    assert.strictEqual(evalResult.conversionReason, "PREORDER_DEPOSITED");
    assert.match(evalResult.statusLabel, /500 DH/i);
  });

  it("should evaluate lead with VEHICLE_ASSIGNMENT column as VALIDATED (150 DH)", () => {
    const lead = {
      id: "test-4",
      raw_name: "Karim Mansouri",
      sanitized_phone: "+212644556677",
      board_column: "VEHICLE_ASSIGNMENT",
      training_status: null,
      preorder_amount: null,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "VALIDATED");
    assert.strictEqual(evalResult.commissionMAD, 150);
    assert.strictEqual(evalResult.isConverted, true);
    assert.strictEqual(evalResult.conversionReason, "VEHICLE_ASSIGNED");
    assert.match(evalResult.statusLabel, /Véhicule Assigné/i);
  });

  it("should evaluate lead with training_status='Assign vehicle' as VALIDATED (150 DH)", () => {
    const lead = {
      id: "test-5",
      raw_name: "Rachid Bennani",
      sanitized_phone: "+212655667788",
      board_column: "FORMES",
      training_status: "Assign vehicle",
      preorder_amount: null,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "VALIDATED");
    assert.strictEqual(evalResult.commissionMAD, 150);
    assert.strictEqual(evalResult.isConverted, true);
  });

  it("should strictly NOT double count commission when both vehicle is assigned and preorder was deposited (strictly 150 DH)", () => {
    const lead = {
      id: "test-6",
      raw_name: "Hamza El Alami",
      sanitized_phone: "+212666778899",
      board_column: "VEHICLE_ASSIGNMENT",
      training_status: "Preorder",
      preorder_amount: 1000,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "VALIDATED");
    assert.strictEqual(evalResult.commissionMAD, 150);
    assert.strictEqual(evalResult.isConverted, true);
  });

  it("should classify lost leads as LOST (0 DH)", () => {
    const lead = {
      id: "test-7",
      raw_name: "Mehdi Touimi",
      sanitized_phone: "+212677889900",
      board_column: "NEW_LEADS",
      brand_status: "Not interested",
      training_status: null,
      preorder_amount: 0,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.status, "LOST");
    assert.strictEqual(evalResult.commissionMAD, 0);
    assert.strictEqual(evalResult.isConverted, false);
  });

  it("should test live DB persistence and partner summary calculation for Zakaria", async () => {
    const testPhone = "+212699990001";
    // Clean up if existed
    await prisma.lead.deleteMany({ where: { sanitized_phone: testPhone } });

    // 1. Create a lead brought by Zakaria
    const created = await prisma.lead.create({
      data: {
        raw_name: "Test Driver Zakaria Integration",
        sanitized_phone: testPhone,
        city: "Casablanca",
        campaign_source: "Apporteur - Zakaria",
        referrer_name: "Zakaria",
        board_column: "NEW_LEADS",
      },
    });

    try {
      // 2. Fetch partner summary
      let summary = await getPartnerSummary("Zakaria");
      const foundLead = summary.leads.find((l) => l.id === created.id);
      assert.ok(foundLead, "Lead should be found in Zakaria's pipeline");
      assert.strictEqual(foundLead?.status, "PENDING");
      assert.strictEqual(foundLead?.commissionMAD, 0);

      // 3. Simulate Onboarding Agent confirming "Preorder"
      await prisma.lead.update({
        where: { id: created.id },
        data: {
          training_status: "Preorder",
          preorder_amount: 500,
        },
      });

      // 4. Verify partner summary immediately turns to VALIDATED (150 DH)
      summary = await getPartnerSummary("Zakaria");
      const updatedLead = summary.leads.find((l) => l.id === created.id);
      assert.strictEqual(updatedLead?.status, "VALIDATED");
      assert.strictEqual(updatedLead?.commissionMAD, 150);
      assert.ok(summary.totalCommissionEarnedMAD >= 150);
      assert.strictEqual(
        summary.totalCommissionEarnedMAD,
        summary.convertedLeads * 150,
        "Total earnings must equal converted leads * 150 MAD"
      );

      // 5. Simulate Onboarding Agent assigning Vehicle
      await prisma.lead.update({
        where: { id: created.id },
        data: {
          board_column: "VEHICLE_ASSIGNMENT",
        },
      });

      summary = await getPartnerSummary("zakaria"); // test case insensitivity
      const finalLead = summary.leads.find((l) => l.id === created.id);
      assert.strictEqual(finalLead?.status, "VALIDATED");
      assert.strictEqual(finalLead?.commissionMAD, 150);
    } finally {
      // Clean up test lead
      await prisma.lead.deleteMany({ where: { sanitized_phone: testPhone } });
    }
  });
});
