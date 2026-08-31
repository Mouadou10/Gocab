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
import { matchHeaders, getField, resolveLeadStatus } from "@/lib/csv-header-matcher";
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

    // Fuzzy-match CSV headers to canonical fields (name & phone required, city & status optional)
    const { mapping, unmapped } = matchHeaders(meta.fields || []);

    if (!mapping.name || !mapping.phone) {
      return NextResponse.json(
        {
          error: `Required columns missing. Found headers: [${(meta.fields || []).join(", ")}]. A 'Lead Name' column and a 'Phone Number' column are required. 'City' and 'Status' are optional.`,
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
      .map((row) => {
        const rawCity = getField(row, mapping, "city");
        const rawStatus = getField(row, mapping, "status");
        const { board_column, brand_status, training_status } = resolveLeadStatus(rawStatus);

        return {
          raw_name: getField(row, mapping, "name")!,
          sanitized_phone: sanitizePhone(getField(row, mapping, "phone")!),
          city: rawCity ? rawCity.trim() : null, // Preserve exact city tag as in CSV
          campaign_source: campaignSource,
          board_column,
          brand_status,
          training_status,
        };
      });

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

    // Deduplicate within the CSV batch itself (keep first occurrence)
    const seenInBatch = new Set<string>();
    const uniqueCandidates = candidates.filter((lead) => {
      if (seenInBatch.has(lead.sanitized_phone)) return false;
      seenInBatch.add(lead.sanitized_phone);
      return true;
    });

    // Separate non-blacklisted candidates into new leads and leads to update
    const nonBlacklisted = uniqueCandidates.filter(
      (c) => !blacklistPhoneSet.has(c.sanitized_phone)
    );

    const newLeads = nonBlacklisted.filter(
      (c) => !existingPhoneSet.has(c.sanitized_phone)
    );

    const leadsToUpdate = nonBlacklisted.filter(
      (c) => existingPhoneSet.has(c.sanitized_phone)
    );

    // Bulk insert new leads with appropriate columns and statuses
    let insertedCount = 0;
    if (newLeads.length > 0) {
      const result = await prisma.lead.createMany({
        data: newLeads.map((lead) => ({
          raw_name: lead.raw_name,
          sanitized_phone: lead.sanitized_phone,
          city: lead.city,
          campaign_source: lead.campaign_source,
          board_column: lead.board_column,
          brand_status: lead.brand_status,
          training_status: lead.training_status,
        })),
      });
      insertedCount = result.count;
    }

    // Update existing leads if their status, column, or city was supplied in CSV
    let updatedCount = 0;
    if (leadsToUpdate.length > 0) {
      for (const lead of leadsToUpdate) {
        await prisma.lead.update({
          where: { sanitized_phone: lead.sanitized_phone },
          data: {
            raw_name: lead.raw_name,
            ...(lead.city ? { city: lead.city } : {}),
            board_column: lead.board_column,
            brand_status: lead.brand_status,
            training_status: lead.training_status,
          },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows: data.length,
        inserted: insertedCount,
        updated: updatedCount,
        duplicates: leadsToUpdate.length,
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
