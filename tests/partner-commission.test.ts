import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  evaluateLeadCommission,
  getPartnerSummary,
  PARTNER_COMMISSION_RATE_MAD,
} from "../src/lib/services/partnerCommissionService";
import { prisma } from "../src/lib/prisma";
import { POST as submitPartnerLead, DELETE as deletePartnerLead } from "../src/app/api/partners/[slug]/leads/route";

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

  it("should evaluate lead with presence confirmed as showed up with purple badge", () => {
    const lead = {
      id: "test-presence",
      raw_name: "Youssef Present",
      sanitized_phone: "+212611223344",
      board_column: "NEW_LEADS",
      presence_confirmed: true,
      presence_confirmed_at: new Date(),
      training_status: null,
      preorder_amount: null,
      created_at: new Date(),
    };

    const evalResult = evaluateLeadCommission(lead);
    assert.strictEqual(evalResult.presenceConfirmed, true);
    assert.strictEqual(evalResult.stageBadgeColor, "purple");
    assert.strictEqual(evalResult.status, "PENDING");
    assert.match(evalResult.statusLabel, /Présent au siège/i);
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

  it("should allow Zakaria to submit any name and any number, updating existing leads without 409 duplicate errors", async () => {
    const existingPhone = "+212645398999";
    // Clean up if existed
    await prisma.lead.deleteMany({ where: { sanitized_phone: existingPhone } });

    // Step 1: Simulate an old lead already in GoCab from a past marketing campaign
    const oldLead = await prisma.lead.create({
      data: {
        raw_name: "Mouad Old Lead",
        sanitized_phone: existingPhone,
        campaign_source: "CSV1",
        board_column: "BRAND_PRE_FILTER",
        brand_status: "Not interested",
        city: "Casablanca",
      },
    });

    try {
      // Step 2: Zakaria submits the same number with a new name and intention
      const req = new NextRequest("http://localhost:3000/api/partners/zakaria/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Mouad Koudia",
          phone: "0645398999", // raw moroccan input
          city: "Casablanca",
          intention: "Prendre voiture direct",
          notes: "Permis B depuis 5 ans",
        }),
      });

      const res = await submitPartnerLead(req, {
        params: Promise.resolve({ slug: "zakaria" }),
      });

      // Must succeed with 200 OK (NEVER 409 error)
      assert.strictEqual(res.status, 200, "Must return HTTP 200 without blocking duplicate check");
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.lead.name, "Mouad Koudia");
      assert.strictEqual(json.lead.phone, existingPhone);

      // Step 3: Verify lead in DB is now under Zakaria's portfolio and reset to NEW_LEADS
      const updatedInDb = await prisma.lead.findUnique({
        where: { sanitized_phone: existingPhone },
      });
      assert.strictEqual(updatedInDb?.raw_name, "Mouad Koudia");
      assert.strictEqual(updatedInDb?.referrer_name, "Zakaria");
      assert.strictEqual(updatedInDb?.campaign_source, "Apporteur - Zakaria");
      assert.strictEqual(updatedInDb?.board_column, "NEW_LEADS");
      assert.strictEqual(updatedInDb?.brand_status, null);
      assert.match(updatedInDb?.notes || "", /Vérif Onboarding: Ce numéro existait déjà en base GoCab/);

      // Step 4: Verify evaluation flags wasExistingInDb for Onboarding Agent review
      const evaluated = evaluateLeadCommission(updatedInDb!);
      assert.strictEqual(evaluated.wasExistingInDb, true, "Onboarding agent must see wasExistingInDb badge");
      assert.strictEqual(evaluated.status, "PENDING");
    } finally {
      await prisma.lead.deleteMany({ where: { sanitized_phone: existingPhone } });
    }
  });

  it("should allow deleting a partner lead via DELETE /api/partners/[slug]/leads", async () => {
    const testDeletePhone = "+212688887777";
    await prisma.lead.deleteMany({ where: { sanitized_phone: testDeletePhone } });

    // 1. Create a lead
    const leadToDelete = await prisma.lead.create({
      data: {
        raw_name: "Chauffeur To Delete",
        sanitized_phone: testDeletePhone,
        campaign_source: "Apporteur - Zakaria",
        referrer_name: "Zakaria",
        board_column: "NEW_LEADS",
      },
    });

    try {
      // 2. Call DELETE endpoint with leadId in query param
      const req = new NextRequest(
        `http://localhost:3000/api/partners/zakaria/leads?id=${leadToDelete.id}`,
        { method: "DELETE" }
      );

      const res = await deletePartnerLead(req, {
        params: Promise.resolve({ slug: "zakaria" }),
      });

      assert.strictEqual(res.status, 200, "DELETE must return HTTP 200");
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.deletedLeadId, leadToDelete.id);

      // 3. Verify lead is gone from DB
      const checkInDb = await prisma.lead.findUnique({
        where: { id: leadToDelete.id },
      });
      assert.strictEqual(checkInDb, null, "Lead must be deleted from DB");

      // 4. Verify partner summary no longer contains this lead
      const summary = await getPartnerSummary("zakaria");
      assert.strictEqual(
        summary.leads.some((l) => l.id === leadToDelete.id),
        false,
        "Deleted lead must not appear in partner summary"
      );
    } finally {
      await prisma.lead.deleteMany({ where: { sanitized_phone: testDeletePhone } });
    }
  });

  it("should include only non-archived Available vehicles in partner summary", async () => {
    const testPlate = "TEST-AVAIL-999";
    await prisma.vehicle.deleteMany({ where: { plate_number: testPlate } });

    const createdVehicle = await prisma.vehicle.create({
      data: {
        plate_number: testPlate,
        make_model: "DACIA SANDERO",
        year: 2026,
        hub_city: "Casablanca",
        status: "Available",
        is_archived: false,
      },
    });

    try {
      const summary = await getPartnerSummary("zakaria");
      assert.ok(summary.availableCarsCount >= 1, "Should count available vehicle");
      const found = summary.availableCars.find((c) => c.id === createdVehicle.id);
      assert.ok(found, "Available vehicle must be listed for Zakaria");
      assert.strictEqual(found?.plateNumber, testPlate);
      assert.strictEqual(found?.makeModel, "DACIA SANDERO");
      assert.strictEqual(found?.hubCity, "Casablanca");
    } finally {
      await prisma.vehicle.deleteMany({ where: { plate_number: testPlate } });
    }
  });

  after(async () => {
    await prisma.$disconnect();
  });
});
