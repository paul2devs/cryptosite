import "../src/config/env";
import "../src/models";
import { sequelize } from "../src/config/database";
import { User } from "../src/models/User";
import { purgeNonAdminUsers } from "../src/services/userAccountService";

async function main(): Promise<void> {
  try {
    await sequelize.authenticate();
    const before = await User.count();
    const deleted = await purgeNonAdminUsers();
    const admins = await User.findAll({ where: { is_admin: true }, attributes: ["user_id", "email"] });

    // eslint-disable-next-line no-console
    console.log(`Users before purge: ${before}`);
    // eslint-disable-next-line no-console
    console.log(`Non-admin users deleted: ${deleted}`);
    // eslint-disable-next-line no-console
    console.log(`Admin accounts retained: ${admins.length}`);
    for (const admin of admins) {
      // eslint-disable-next-line no-console
      console.log(`  - ${admin.email} (${admin.user_id})`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("User purge failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

void main();
