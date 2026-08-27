import { prisma } from "../prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE";

interface AuditLogPayload {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes: any;
}

export async function logAudit(payload: AuditLogPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: payload.userId,
        action: payload.action,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        changes: JSON.stringify(payload.changes),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Don't throw — audit logging failure shouldn't break the main transaction
  }
}
