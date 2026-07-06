import { z } from "zod";

// Single source of truth for what makes a valid reader — reused by the
// single-add form and (task 5) the bulk Excel upload.
export const readerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits"),
  email: z.email().optional().or(z.literal("")).transform((v) => v || undefined),
  address: z.string().trim().min(1, "Address is required"),
  landmark: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
  centerId: z.coerce.number().int().positive(),
  assignedPocId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  subscriptionStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  remarks: z.string().trim().optional().or(z.literal("")).transform((v) => v || undefined),
});

export type ReaderInput = z.infer<typeof readerInputSchema>;
