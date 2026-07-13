import { z } from "zod";

// Shared field rules — single source of truth for what makes a valid reader,
// reused by the single-add form and the bulk Excel upload below.
export const name = z.string().trim().min(1, "Name is required");
export const mobile = z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits");
export const email = z.email().optional().or(z.literal("")).transform((v) => v || undefined);
export const address = z.string().trim().min(1, "Address is required");
export const landmark = z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined);
const subscriptionStartDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (expected YYYY-MM-DD)");
const remarks = z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined);

export const readerEditSchema = z.object({
  name,
  mobile,
  email,
  address,
  landmark,
  status: z.enum(["active", "inactive"]),
});
export type ReaderEditInput = z.infer<typeof readerEditSchema>;

export const readerInputSchema = z.object({
  name,
  mobile,
  email,
  address,
  landmark,
  centerId: z.coerce.number().int().positive(),
  assignedPocId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  subscriptionStartDate,
  remarks,
});

export type ReaderInput = z.infer<typeof readerInputSchema>;

// Bulk upload rows reference City/Center by name (spreadsheet columns), not
// ID — resolved to a centerId during import (lib/bulk-upload/parse-readers.ts).
export const readerBulkRowSchema = z.object({
  name,
  mobile,
  email,
  address,
  landmark,
  city: z.string().trim().min(1, "City is required"),
  center: z.string().trim().min(1, "Center is required"),
  subscriptionStartDate,
  remarks,
});

export type ReaderBulkRow = z.infer<typeof readerBulkRowSchema>;
