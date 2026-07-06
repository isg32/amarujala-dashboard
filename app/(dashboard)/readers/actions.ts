"use server";

import { redirect } from "next/navigation";
import { readerInputSchema } from "@/lib/validation/reader";
import { createReader } from "@/lib/data/readers";

export async function createReaderAction(formData: FormData) {
  const input = readerInputSchema.parse({
    name: formData.get("name") ?? "",
    mobile: formData.get("mobile") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    landmark: formData.get("landmark") ?? "",
    centerId: formData.get("centerId") ?? "",
    assignedPocId: formData.get("assignedPocId") ?? "",
    subscriptionStartDate: formData.get("subscriptionStartDate") ?? "",
    remarks: formData.get("remarks") ?? "",
  });

  const { id } = await createReader(input);
  redirect(`/readers/${id}`);
}
