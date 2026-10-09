import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import {
  sendCarReadyTelegramAlert,
  sendInsuranceMissionTelegramAlert,
  sendVehicleBackTelegramAlert,
} from "@/lib/services/telegramService";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    const claim = await prisma.accidentClaim.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
      },
    });
    
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, claim });
  } catch (error: any) {
    console.error("Error fetching accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    const body = await req.json();
    
    const currentClaim = await prisma.accidentClaim.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
      },
    });
    if (!currentClaim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: DIRECT DISPATCH OF FIELD TASK & TELEGRAM MISSION
    // ─────────────────────────────────────────────────────────────
    if (body.action === "DISPATCH_TELEGRAM_MISSION") {
      const taskType = body.task_type || "GARAGE_PICKUP";
      const priority = body.priority || "Urgent";
      const plateNumber = currentClaim.vehicle?.plate_number || "Inconnu";
      const description =
        body.description?.trim() ||
        `[Sinistre ${plateNumber}] Mission terrain requise pour le véhicule accidenté.`;

      const fieldTask = await prisma.fieldTask.create({
        data: {
          task_type: taskType,
          vehicle_id: currentClaim.vehicle_id,
          plate_number: plateNumber,
          driver_name: currentClaim.driver_name,
          driver_phone: currentClaim.driver_phone,
          description: description,
          priority: priority === "Critical" ? "Critical" : priority === "Urgent" ? "Urgent" : "Normal",
          status: "PENDING",
          linked_ticket_id: currentClaim.id,
          assigned_to: body.assigned_to || null,
          scheduled_date: body.scheduled_date || null,
          scheduled_time: body.scheduled_time || null,
        },
      });

      // Send rich Telegram alert to Field Supervisor group
      if (body.send_telegram !== false) {
        const stepLabels: Record<string, string> = {
          NEW_ACCIDENT: "1. Déclaré",
          CAR_IN_GARAGE: "2. Entrée Garage",
          STARTING_REPAIR: "3. Travaux en Cours",
          INSURANCE_DOCS: "4. Expertise & Papiers",
          READY_FOR_PICKUP: "5. Prêt Récupération",
          VEHICLE_BACK: "6. Rétabli",
        };

        await sendInsuranceMissionTelegramAlert({
          task_type: taskType,
          plate_number: plateNumber,
          make_model: currentClaim.vehicle?.make_model,
          driver_name: currentClaim.driver_name,
          driver_phone: currentClaim.driver_phone,
          priority: priority,
          timeline_step_label: stepLabels[currentClaim.timeline_step] || currentClaim.timeline_step,
          description: description,
          author: body.author || "Agent Assurance",
          assigned_to: body.assigned_to || null,
          scheduled_date: body.scheduled_date,
          scheduled_time: body.scheduled_time,
        }).catch((err) => console.error("Failed to send insurance mission Telegram alert:", err));
      }

      // Append comment to history
      let existingComments: any[] = [];
      try {
        existingComments = currentClaim.comments ? JSON.parse(currentClaim.comments) : [];
      } catch {
        existingComments = [];
      }

      const typeLabels: Record<string, string> = {
        GARAGE_PICKUP: "Reprise au Garage",
        VEHICLE_RECOVERY: "Récupération Véhicule",
        FIELD_VISIT: "Visite / Constat Terrain",
      };

      existingComments.unshift({
        id: crypto.randomUUID(),
        timeline_step: currentClaim.timeline_step,
        comment: `📱 Mission terrain (${typeLabels[taskType] || taskType}) transmise au Superviseur Terrain et notifiée sur Telegram par ${body.author || "Agent"}.`,
        author: body.author || "Système",
        created_at: new Date().toISOString(),
      });

      const updatedClaim = await prisma.accidentClaim.update({
        where: { id },
        data: { comments: JSON.stringify(existingComments) },
        include: { vehicle: true, driver: true },
      });

      touchSyncState("tickets").catch(() => {});
      return NextResponse.json({ success: true, claim: updatedClaim, fieldTask });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: RESEND / RELANCER TELEGRAM FOR CAR READY (STAGE 5)
    // ─────────────────────────────────────────────────────────────
    if (body.action === "NOTIFY_READY_TELEGRAM") {
      const plateNumber = currentClaim.vehicle?.plate_number || "Inconnu";
      const totalDays = Math.floor(
        Math.abs(Date.now() - new Date(currentClaim.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Ensure FieldTask exists in PENDING state
      let fieldTask = await prisma.fieldTask.findFirst({
        where: { linked_ticket_id: currentClaim.id, task_type: "GARAGE_PICKUP", status: { not: "COMPLETED" } },
      });

      if (!fieldTask) {
        fieldTask = await prisma.fieldTask.create({
          data: {
            task_type: "GARAGE_PICKUP",
            vehicle_id: currentClaim.vehicle_id,
            plate_number: plateNumber,
            driver_name: currentClaim.driver_name,
            driver_phone: currentClaim.driver_phone,
            description: `Reprise au garage du véhicule réparé (Dossier Sinistre)`,
            linked_ticket_id: currentClaim.id,
            status: "PENDING",
            priority: "Urgent",
          },
        });
      }

      // Send car ready Telegram alert
      await sendCarReadyTelegramAlert({
        plate_number: plateNumber,
        make_model: currentClaim.vehicle?.make_model,
        driver_name: currentClaim.driver_name,
        driver_phone: currentClaim.driver_phone,
        downtime_days: totalDays,
        assigned_to: fieldTask.assigned_to || null,
        triggered_by: body.author || "Agent Assurance",
        notes: body.comment || "Rappel : Véhicule réparé au garage et prêt pour récupération & convoyage.",
      }).catch((err) => console.error("Failed to send car ready Telegram alert:", err));

      // Append comment
      let existingComments: any[] = [];
      try {
        existingComments = currentClaim.comments ? JSON.parse(currentClaim.comments) : [];
      } catch {
        existingComments = [];
      }

      existingComments.unshift({
        id: crypto.randomUUID(),
        timeline_step: "READY_FOR_PICKUP",
        comment: `📱 Relance Telegram : Alerte véhicule prêt pour récupération renvoyée au superviseur terrain par ${body.author || "Agent"}.`,
        author: body.author || "Système",
        created_at: new Date().toISOString(),
      });

      const updatedClaim = await prisma.accidentClaim.update({
        where: { id },
        data: { comments: JSON.stringify(existingComments) },
        include: { vehicle: true, driver: true },
      });

      touchSyncState("tickets").catch(() => {});
      return NextResponse.json({ success: true, claim: updatedClaim, fieldTask });
    }

    const updateData: any = {};
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.fault !== undefined) updateData.fault = body.fault;
    
    let isStatusChange = false;
    if (body.reopen && currentClaim.timeline_step === "VEHICLE_BACK") {
      updateData.timeline_step = body.timeline_step || "CAR_IN_GARAGE";
      updateData.step_updated_at = new Date();
      isStatusChange = true;
    } else if (body.timeline_step && body.timeline_step !== currentClaim.timeline_step) {
      updateData.timeline_step = body.timeline_step;
      updateData.step_updated_at = new Date();
      isStatusChange = true;
    }

    // Comment Handling: Append new comment with timeline_step & author
    if (body.comment && typeof body.comment === "string" && body.comment.trim().length > 0) {
      let existingComments: any[] = [];
      try {
        existingComments = currentClaim.comments ? JSON.parse(currentClaim.comments) : [];
      } catch {
        existingComments = [];
      }

      const commentStep = body.timeline_step || currentClaim.timeline_step;
      const newCommentEntry = {
        id: crypto.randomUUID(),
        comment: body.comment.trim(),
        timeline_step: commentStep,
        author: body.author || "Agent",
        created_at: new Date().toISOString(),
      };

      existingComments.unshift(newCommentEntry);
      updateData.comments = JSON.stringify(existingComments);
    } else if (body.comments !== undefined) {
      updateData.comments = typeof body.comments === "string" ? body.comments : JSON.stringify(body.comments);
    }

    const updatedClaim = await prisma.accidentClaim.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        driver: true,
      },
    });

    // Integration Logic: If it moved to READY_FOR_PICKUP, create FieldTask AND send Telegram alert!
    if (isStatusChange && updatedClaim.timeline_step === 'READY_FOR_PICKUP') {
      const plateNumber = updatedClaim.vehicle?.plate_number || currentClaim.vehicle?.plate_number || "Inconnu";
      const totalDays = Math.floor(
        Math.abs(Date.now() - new Date(updatedClaim.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if task already exists
      const existingTask = await prisma.fieldTask.findFirst({
        where: { linked_ticket_id: updatedClaim.id, task_type: "GARAGE_PICKUP", status: { not: "COMPLETED" } },
      });

      if (!existingTask) {
        await prisma.fieldTask.create({
          data: {
            task_type: "GARAGE_PICKUP",
            vehicle_id: updatedClaim.vehicle_id,
            plate_number: plateNumber,
            driver_name: updatedClaim.driver_name,
            driver_phone: updatedClaim.driver_phone,
            description: `Reprise au garage du véhicule réparé (Dossier Sinistre)`,
            linked_ticket_id: updatedClaim.id,
            status: "PENDING",
            priority: "Urgent",
          },
        });
      }

      // Automatically dispatch Telegram alert to the Field Supervisor group!
      await sendCarReadyTelegramAlert({
        plate_number: plateNumber,
        make_model: updatedClaim.vehicle?.make_model,
        driver_name: updatedClaim.driver_name,
        driver_phone: updatedClaim.driver_phone,
        downtime_days: totalDays,
        assigned_to: existingTask?.assigned_to || null,
        triggered_by: body.author || "Agent Assurance",
        notes: body.comment || "Véhicule réparé au garage. Prêt pour récupération et convoyage en flotte.",
      }).catch((err) => console.error("Auto Telegram car ready alert error:", err));

      // Append system comment documenting the telegram notification
      let existingComments: any[] = [];
      try {
        existingComments = updatedClaim.comments ? JSON.parse(updatedClaim.comments) : [];
      } catch {
        existingComments = [];
      }

      existingComments.unshift({
        id: crypto.randomUUID(),
        timeline_step: "READY_FOR_PICKUP",
        comment: "🚗 Véhicule réparé et prêt au garage. Alerte Telegram envoyée automatiquement au superviseur terrain.",
        author: "Système Telegram",
        created_at: new Date().toISOString(),
      });

      await prisma.accidentClaim.update({
        where: { id },
        data: { comments: JSON.stringify(existingComments) },
      });
    }

    // When vehicle is recovered and back in service (VEHICLE_BACK)
    if (isStatusChange && updatedClaim.timeline_step === 'VEHICLE_BACK') {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: updatedClaim.vehicle_id } });
      if (vehicle && (vehicle.status === "Accident" || vehicle.status === "In garage")) {
        const hasDriver = !!vehicle.assigned_driver_name;
        await prisma.vehicle.update({
          where: { id: updatedClaim.vehicle_id },
          data: { status: hasDriver ? "Actif" : "Available" },
        });
      }

      // Automatically sync and resolve any open Accident MaintenanceTicket for this vehicle
      await prisma.maintenanceTicket.updateMany({
        where: {
          vehicle_id: updatedClaim.vehicle_id,
          status: { not: "RESOLVED" },
        },
        data: {
          status: "RESOLVED",
          resolved_at: new Date(),
          field_status: "COMPLETED",
        },
      }).catch(() => {});

      // Automatically complete any linked FieldTask for this claim
      const linkedFieldTask = await prisma.fieldTask.findFirst({
        where: {
          OR: [
            { linked_ticket_id: updatedClaim.id },
            { vehicle_id: updatedClaim.vehicle_id, task_type: "GARAGE_PICKUP" },
          ],
          status: { not: "COMPLETED" },
        },
      });

      if (linkedFieldTask) {
        await prisma.fieldTask.update({
          where: { id: linkedFieldTask.id },
          data: { status: "COMPLETED", completed_at: new Date() },
        });
      }

      // Handler who handled or is handling the task
      const handlerName = linkedFieldTask?.assigned_to || body.author || "Équipe Flotte & Terrain";
      const totalDays = Math.floor(
        Math.abs(Date.now() - new Date(updatedClaim.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send Telegram notification: VÉHICULE RÉTABLI EN FLOTTE — MISSION COMPLETE
      await sendVehicleBackTelegramAlert({
        plate_number: updatedClaim.vehicle?.plate_number || "Inconnu",
        make_model: updatedClaim.vehicle?.make_model,
        driver_name: updatedClaim.driver_name,
        driver_phone: updatedClaim.driver_phone,
        handler_name: handlerName,
        validated_by: body.author || "Agent Assurance",
        downtime_days: totalDays,
        notes: body.comment || "Véhicule réparé et réintégré avec succès dans la flotte.",
      }).catch((err) => console.error("Auto Telegram vehicle back alert error:", err));

      // Append system comment documenting the vehicle back notification
      let backComments: any[] = [];
      try {
        backComments = updatedClaim.comments ? JSON.parse(updatedClaim.comments) : [];
      } catch {
        backComments = [];
      }

      backComments.unshift({
        id: crypto.randomUUID(),
        timeline_step: "VEHICLE_BACK",
        comment: `✅ Véhicule rétabli en flotte. Mission complète notifiée sur Telegram (Traité par : ${handlerName}).`,
        author: body.author || "Système Telegram",
        created_at: new Date().toISOString(),
      });

      await prisma.accidentClaim.update({
        where: { id },
        data: { comments: JSON.stringify(backComments) },
      });

      touchSyncState("tickets").catch(() => {});
    }

    // When ticket is REOPENED from VEHICLE_BACK
    if (
      (isStatusChange && currentClaim.timeline_step === 'VEHICLE_BACK' && updatedClaim.timeline_step !== 'VEHICLE_BACK') ||
      (body.reopen && currentClaim.timeline_step === 'VEHICLE_BACK')
    ) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: updatedClaim.vehicle_id } });
      if (vehicle && vehicle.status !== "Accident" && vehicle.status !== "In garage") {
        await prisma.vehicle.update({
          where: { id: updatedClaim.vehicle_id },
          data: { status: "In garage" },
        });
      }

      // Reopen linked resolved MaintenanceTicket
      await prisma.maintenanceTicket.updateMany({
        where: {
          vehicle_id: updatedClaim.vehicle_id,
          ticket_type: "Accident",
          status: "RESOLVED",
        },
        data: {
          status: "IN_PROGRESS",
          resolved_at: null,
          field_status: null,
        },
      }).catch(() => {});
      touchSyncState("tickets").catch(() => {});
    }

    return NextResponse.json({ success: true, claim: updatedClaim });
  } catch (error: any) {
    console.error("Error updating accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;
  
  try {
    const claim = await prisma.accidentClaim.findUnique({
      where: { id },
      include: { vehicle: true }
    });

    if (claim) {
      await prisma.accidentClaim.delete({
        where: { id },
      });

      // Revert the vehicle status so the auto-sync doesn't immediately recreate the claim
      if (claim.vehicle && (claim.vehicle.status === "Accident" || claim.vehicle.status === "In garage")) {
        const hasDriver = !!claim.vehicle.assigned_driver_name;
        await prisma.vehicle.update({
          where: { id: claim.vehicle_id },
          data: { status: hasDriver ? "Actif" : "Available" },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting accident claim:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
