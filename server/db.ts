import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize the database client");
}

export const queryClient = postgres(databaseUrl, {
  max: 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export { schema };
