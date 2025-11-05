import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  console.log("🌱 Starting authentication seed...");

  const superAdminEmail = "admin@turbopartners.com.br";
  
  const existingAdmin = await db.query.authUsers.findFirst({
    where: (users, { eq }) => eq(users.email, superAdminEmail),
  });

  if (existingAdmin) {
    console.log("✓ Super admin already exists");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  const [superAdmin] = await db
    .insert(schema.authUsers)
    .values({
      email: superAdminEmail,
      name: "Super Admin",
      passwordHash,
      role: "super_admin",
    })
    .returning();

  console.log(`✓ Super admin created: ${superAdmin.email}`);

  const allPages = schema.availablePages;
  
  const permissions = allPages.map((pageName) => ({
    userId: superAdmin.id,
    pageName,
    canAccess: 1,
  }));

  await db.insert(schema.userPermissions).values(permissions);

  console.log(`✓ Granted all ${allPages.length} permissions to super admin`);
  console.log("✅ Authentication seed completed successfully!");
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
