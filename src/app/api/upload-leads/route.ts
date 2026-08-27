/**
 * CSV Upload API Route — POST /api/upload-leads
 *
 * Accepts a CSV file via multipart/form-data, parses it, sanitizes
 * Moroccan phone numbers, deduplicates against existing leads,
 * filters out blacklisted numbers, and bulk-inserts valid leads.
 *
 * Uses fuzzy header matching — accepts any reasonable variation of
 * "Name", "Phone", "City" headers regardless of language or formatting.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchHeaders, getField } from "@/lib/csv-header-matcher";
import Papa from "papaparse";

/** Strip spaces, dashes, and leading zeros, then prepend +212. */
function sanitizePhone(raw: string): string {
  // Remove all whitespace, dashes, dots, and parentheses
  let cleaned = raw.replace(/[\s\-\.\(\)]/g, "");

  // Remove leading "+" if present (we'll re-add the prefix)
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // If it already starts with "212", keep the rest
  if (cleaned.startsWith("212")) {
    cleaned = cleaned.slice(3);
  }

  // Strip any remaining leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  return `+212${cleaned}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Read the file content as text
    const csvText = await file.text();

    // Parse CSV with PapaParse
    const { data, errors, meta } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (errors.length > 0) {
      console.error("CSV parse errors:", errors);
    }

    // Fuzzy-match CSV headers to canonical fields
    const { mapping, unmapped } = matchHeaders(meta.fields || []);

    if (!mapping.name || !mapping.phone) {
      return NextResponse.json(
        {
          error: `Could not detect required columns. Found headers: [${(meta.fields || []).join(", ")}]. Need a 'Name' column and a 'Phone' column.`,
          detected: mapping,
          unmapped,
        },
        { status: 400 }
      );
    }

    // Extract campaign source from the filename
    const campaignSource = file.name.replace(/\.csv$/i, "") || "unknown";

    // Build candidates using fuzzy-matched headers
    const candidates = data
      .filter((row) => getField(row, mapping, "name") && getField(row, mapping, "phone"))
      .map((row) => ({
        raw_name: getField(row, mapping, "name")!,
        sanitized_phone: sanitizePhone(getField(row, mapping, "phone")!),
        city: getField(row, mapping, "city") || null,
        campaign_source: campaignSource,
      }));

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV. Every row needs at least a name and phone number." },
        { status: 400 }
      );
    }

    // Collect all sanitized phones for batch lookup
    const allPhones = candidates.map((c) => c.sanitized_phone);

    // Batch deduplication: find phones already in Lead table
    const existingLeads = await prisma.lead.findMany({
      where: { sanitized_phone: { in: allPhones } },
      select: { sanitized_phone: true },
    });
    const existingPhoneSet = new Set(existingLeads.map((l) => l.sanitized_phone));

    // Batch blacklist check
    const blacklisted = await prisma.blacklist.findMany({
      where: { sanitized_phone: { in: allPhones } },
      select: { sanitized_phone: true },
    });
    const blacklistPhoneSet = new Set(blacklisted.map((b) => b.sanitized_phone));

    // Filter to only valid, new, non-blacklisted leads
    const validLeads = candidates.filter(
      (c) =>
        !existingPhoneSet.has(c.sanitized_phone) &&
        !blacklistPhoneSet.has(c.sanitized_phone)
    );

    // Also deduplicate within the CSV itself (keep first occurrence)
    const seenInBatch = new Set<string>();
    const uniqueLeads = validLeads.filter((lead) => {
      if (seenInBatch.has(lead.sanitized_phone)) return false;
      seenInBatch.add(lead.sanitized_phone);
      return true;
    });

    // Bulk insert
    let insertedCount = 0;
    if (uniqueLeads.length > 0) {
       const result = await prisma.lead.createMany({
        data: uniqueLeads.map((lead) => ({
          raw_name: lead.raw_name,
          sanitized_phone: lead.sanitized_phone,
          city: lead.city,
          campaign_source: lead.campaign_source,
          board_column: "NEW_LEADS" as const,
        })),
      });
      insertedCount = result.count;
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows: data.length,
        inserted: insertedCount,
        duplicates: existingPhoneSet.size,
        blacklisted: blacklistPhoneSet.size,
        skipped_invalid: data.length - candidates.length,
      },
      headerMapping: mapping,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process CSV upload" },
      { status: 500 }
    );
  }
}
