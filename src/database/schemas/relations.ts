import { defineRelations } from "drizzle-orm";
import { users } from "./auth.schema";

export const schemaRelations = defineRelations(
  {
    users,
  },
  () => ({}),
);
