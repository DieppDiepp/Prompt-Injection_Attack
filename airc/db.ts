import { SQLDatabase } from "encore.dev/storage/sqldb";

export const AIRCDB = new SQLDatabase("airc", {
  migrations: "./migrations",
});
