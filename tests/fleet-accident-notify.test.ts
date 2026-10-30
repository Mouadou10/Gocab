import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveFleetManagerContactForVehicle,
  generateFleetConfirmToken,
  verifyFleetConfirmToken,
  extractFleetSyncFromComments,
  mergeFleetSyncIntoComments,
  buildFleetAccidentWhatsAppText,
} from "../src/lib/services/fleetAccidentNotifyService";

describe("Fleet Manager WhatsApp Accident Notification & GoCab Fleet Sync", () => {
  it("resolves Mehdi Elyattouti (+212667960025) for Mehdi's locked portfolio plates", () => {
    const contact = resolveFleetManagerContactForVehicle({
      plate_number: "26515-Y-6",
    });
    assert.equal(contact.key, "mehdi elyattouti");
    assert.equal(contact.name, "Mehdi Elyattouti");
    assert.equal(contact.phone, "212667960025");
  });

  it("resolves Mohamed Aziz (+212666563066) for non-Mehdi fleet plates", () => {
    const contact = resolveFleetManagerContactForVehicle({
      plate_number: "26594-Y-6",
    });
    assert.equal(contact.key, "mohamed aziz");
    assert.equal(contact.name, "Mohamed Aziz");
    assert.equal(contact.phone, "212666563066");
  });

  it("generates and verifies HMAC tokens securely for 1-click GoCab Fleet confirmation", () => {
    const claimId = "claim-test-uuid-1234";
    const token = generateFleetConfirmToken(claimId);
    assert.equal(token.length, 24);
    assert.equal(verifyFleetConfirmToken(claimId, token), true);
    assert.equal(verifyFleetConfirmToken("different-claim-id", token), false);
    assert.equal(verifyFleetConfirmToken(claimId, "000000000000000000000000"), false);
    assert.equal(verifyFleetConfirmToken(claimId, ""), false);
    assert.equal(verifyFleetConfirmToken(claimId, null), false);
  });

  it("merges WhatsApp notification and GoCab Fleet confirmation without losing insurance dossier fields", () => {
    const initialComments = JSON.stringify([
      {
        id: "INSURANCE_DOSSIER_META",
        type: "INSURANCE_INFO",
        claim_number: "SIN-2026-889",
        insurance_company: "Sanlam",
        garage_name: "Emergence",
        estimated_amount: 4500,
        insurance_notes: [{ id: "n1", note: "Expert passé", author: "Sanlam", created_at: "2026-10-30T10:00:00Z" }],
      },
    ]);

    // Step 1: Agent opens dossier -> Fleet Manager notified on WhatsApp
    const afterNotify = mergeFleetSyncIntoComments(
      initialComments,
      {
        fleet_manager_key: "mehdi elyattouti",
        fleet_manager_name: "Mehdi Elyattouti",
        fleet_manager_phone: "212667960025",
        fleet_whatsapp_notified: true,
        fleet_whatsapp_status: "SENT",
        fleet_created_on_gocab_fleet: false,
      },
      {
        timeline_step: "NEW_ACCIDENT",
        comment: "📲 Gestionnaire de flotte prévenu sur WhatsApp",
        author: "Agent Support",
      }
    );

    const syncAfterNotify = extractFleetSyncFromComments(afterNotify);
    assert.equal(syncAfterNotify.fleet_manager_name, "Mehdi Elyattouti");
    assert.equal(syncAfterNotify.fleet_whatsapp_notified, true);
    assert.equal(syncAfterNotify.fleet_created_on_gocab_fleet, false);

    // Step 2: Fleet Manager clicks "[✅ Créé sur Fleet]" button on WhatsApp
    const afterConfirm = mergeFleetSyncIntoComments(
      afterNotify,
      {
        fleet_created_on_gocab_fleet: true,
        fleet_created_at: "2026-10-30T17:10:00.000Z",
        fleet_created_by: "Mehdi Elyattouti",
        fleet_created_source: "WHATSAPP_BUTTON",
      },
      {
        timeline_step: "NEW_ACCIDENT",
        comment: "✅ Accident confirmé et créé sur GoCab Fleet par Mehdi Elyattouti",
        author: "Mehdi Elyattouti",
      }
    );

    const syncAfterConfirm = extractFleetSyncFromComments(afterConfirm);
    assert.equal(syncAfterConfirm.fleet_created_on_gocab_fleet, true);
    assert.equal(syncAfterConfirm.fleet_created_by, "Mehdi Elyattouti");
    assert.equal(syncAfterConfirm.fleet_created_source, "WHATSAPP_BUTTON");

    // Verify existing insurance fields and notes are 100% preserved
    const parsedAll = JSON.parse(afterConfirm);
    const meta = parsedAll.find((c: any) => c.id === "INSURANCE_DOSSIER_META");
    assert.equal(meta.claim_number, "SIN-2026-889");
    assert.equal(meta.insurance_company, "Sanlam");
    assert.equal(meta.garage_name, "Emergence");
    assert.equal(meta.estimated_amount, 4500);
    assert.equal(meta.insurance_notes.length, 1);
  });

  it("builds a clear French WhatsApp alert message with vehicle details and confirmation link", () => {
    const msg = buildFleetAccidentWhatsAppText({
      managerFirstName: "Mehdi",
      plateNumber: "26515-Y-6",
      makeModel: "Dacia Logan",
      driverName: "Youssef Test",
      driverPhone: "+212600000000",
      hubCity: "Casablanca",
      reportedBy: "Salma Abouri",
      confirmUrl: "https://gocab-iota.vercel.app/confirm-fleet-accident/abc?t=123",
    });

    assert.match(msg, /26515-Y-6/);
    assert.match(msg, /Dacia Logan/);
    assert.match(msg, /Mehdi/);
    assert.match(msg, /Salma Abouri/);
    assert.match(msg, /✅ Créé sur Fleet/);
    assert.match(msg, /confirm-fleet-accident\/abc\?t=123/);
  });
});
