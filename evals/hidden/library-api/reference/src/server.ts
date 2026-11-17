import { createServer } from "node:http";
import { createHandler, openDb } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const db = openDb(process.env.DATABASE_PATH ?? "library.db");
createServer(createHandler(db)).listen(port, () => console.log(`library api listening on ${port}`));
