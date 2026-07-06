import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import {
  zones,
  units,
  cities,
  centers,
  cityPricing,
  appUsers,
  pocCenters,
} from "@/lib/db/schema";

neonConfig.webSocketConstructor = ws;
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
  schema: {},
});

// Real Neon Auth identities, created once via sign-up + (for the admin) a
// one-time `neonctl neon-auth user set-role <id> --roles admin` grant. See
// CLAUDE.md. This script only inserts the app-level rows on top of them.
const ADMIN = {
  id: "306c8cf6-ad7a-47a6-8e97-e0a3b4c2575b",
  name: "Disha",
  email: "dishadashboard0012@gmail.com",
};
const DEMO_POC = {
  id: "95fdb17f-3375-432e-9e5f-6b12fc62da76",
  name: "Demo POC",
  email: "demo-poc@example.com",
};

async function main() {
  await db
    .insert(appUsers)
    .values([
      { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "admin" },
      { id: DEMO_POC.id, name: DEMO_POC.name, email: DEMO_POC.email, role: "au_poc" },
    ])
    .onConflictDoNothing();

  const existingZones = await db.select().from(zones);
  if (existingZones.length > 0) {
    console.log("Hierarchy already seeded, skipping.");
    return;
  }

  const [north] = await db.insert(zones).values({ name: "North Zone" }).returning();
  const [delhiNcr] = await db
    .insert(units)
    .values({ zoneId: north.id, name: "Delhi NCR" })
    .returning();
  const [delhi] = await db
    .insert(cities)
    .values({ unitId: delhiNcr.id, name: "Delhi" })
    .returning();
  const [gurugram] = await db
    .insert(cities)
    .values({ unitId: delhiNcr.id, name: "Gurugram" })
    .returning();

  const [connaughtPlace] = await db
    .insert(centers)
    .values({ cityId: delhi.id, name: "Connaught Place", address: "CP, New Delhi" })
    .returning();
  const [karolBagh] = await db
    .insert(centers)
    .values({ cityId: delhi.id, name: "Karol Bagh", address: "Karol Bagh, New Delhi" })
    .returning();
  const [sector29] = await db
    .insert(centers)
    .values({ cityId: gurugram.id, name: "Sector 29", address: "Sector 29, Gurugram" })
    .returning();

  await db.insert(cityPricing).values([
    { cityId: delhi.id, price: "300.00", effectiveFrom: "2026-01-01" },
    { cityId: delhi.id, price: "320.00", effectiveFrom: "2026-06-01" }, // mid-history price change
    { cityId: gurugram.id, price: "320.00", effectiveFrom: "2026-01-01" },
  ]);

  // Demo POC is scoped to Delhi centers only, not Gurugram — used to verify
  // AU POC center-scoping once lib/data/* is built.
  await db.insert(pocCenters).values([
    { pocUserId: DEMO_POC.id, centerId: connaughtPlace.id },
    { pocUserId: DEMO_POC.id, centerId: karolBagh.id },
  ]);

  console.log("Seeded:", {
    zone: north.name,
    unit: delhiNcr.name,
    cities: [delhi.name, gurugram.name],
    centers: [connaughtPlace.name, karolBagh.name, sector29.name],
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
