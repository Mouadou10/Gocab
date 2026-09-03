import { z } from "zod";

/**
 * Validates Moroccan phone format (+212... or 06/07...)
 */
export const MoroccanPhoneSchema = z
  .string()
  .min(8, "Le numéro de téléphone est trop court")
  .transform((phone) => {
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
    if (cleaned.startsWith("212")) cleaned = cleaned.slice(3);
    cleaned = cleaned.replace(/^0+/, "");
    return `+212${cleaned}`;
  });

export const LeadCreateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit comporter au moins 2 caractères"),
  phone: MoroccanPhoneSchema,
  city: z.string().optional().nullable(),
  campaign_source: z.string().default("Manual Entry"),
  board_column: z.string().default("NEW_LEADS"),
  brand_status: z.string().optional().nullable(),
  training_status: z.string().optional().nullable(),
  reminder_date: z.string().or(z.date()).optional().nullable(),
  preorder_amount: z.number().optional().nullable(),
  age: z.number().min(18).max(75).optional().nullable(),
  permis_seniority_years: z.number().min(0).max(50).optional().nullable(),
  is_resident: z.boolean().default(true),
  has_cin: z.boolean().default(false),
  has_permis: z.boolean().default(false),
  has_fiche_anthropometrique: z.boolean().default(false),
  has_confirmation_adresse: z.boolean().default(false),
  handled_by: z.string().optional().nullable(),
});

export const LeadUpdateSchema = z.object({
  board_column: z.string().optional(),
  brand_status: z.string().optional().nullable(),
  training_status: z.string().optional().nullable(),
  reminder_date: z.string().or(z.date()).optional().nullable(),
  preorder_amount: z.number().optional().nullable(),
  city: z.string().optional().nullable(),
  has_cin: z.boolean().optional(),
  has_fiche_anthropometrique: z.boolean().optional(),
  has_confirmation_adresse: z.boolean().optional(),
  has_permis: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  handled_by: z.string().optional().nullable(),
  assigned_vehicle_id: z.string().optional().nullable(),
  is_recalled: z.boolean().optional(),
  mark_as_called: z.boolean().optional(),
});

export const VehicleCreateSchema = z.object({
  plate_number: z.string().min(3, "Numéro d'immatriculation requis"),
  make_model: z.string().min(2, "Modèle requis"),
  year: z.number().min(2010).max(2030),
  hub_city: z.string().default("Casablanca"),
  status: z.string().default("Available"),
  vin: z.string().optional().nullable(),
  current_mileage: z.number().nonnegative().default(0),
  assigned_supervisor: z.string().optional().nullable(),
  assigned_collector: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const ExpenseCreateSchema = z.object({
  vehicle_id: z.string().uuid("ID de véhicule invalide"),
  category: z.enum([
    "POLICE",
    "REPAIR",
    "MAINTENANCE",
    "ACCIDENT",
    "TOWING",
    "PARKING",
    "TIRES",
    "ADMINISTRATIVE",
    "OTHER",
  ]),
  amount_mad: z.number().min(0, "Le montant ne peut pas être négatif"),
  description: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  paid_by: z.enum(["COMPANY", "DRIVER", "INSURANCE"]).default("COMPANY"),
  is_rechargeable: z.boolean().default(false),
});
