import { defineConfig } from "drizzle-kit";
import { readConfig } from "./src/config.js"

const config = readConfig()
const db_url = config.dbUrl

export default defineConfig({
    schema: "src/lib/db/schema.ts",
    out: "src/lib/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: db_url,
    },
});