import "dotenv/config";
import { upsertLocalAdmin } from "../server/db";
import { createPasswordHash } from "../server/local-auth";

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) throw new Error("ADMIN_SEED_PASSWORD is required");
  const admin = await upsertLocalAdmin(await createPasswordHash(password));
  console.log(`Local admin seeded for username admin (user ${admin.id}).`);
}

main().catch((error) => {
  console.error("Unable to seed local administrator", error);
  process.exit(1);
});
