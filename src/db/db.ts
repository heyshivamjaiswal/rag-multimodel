// ─────────────────────────────────────────────────────────────────────────────
// db.ts  —  The Prisma database client
// ─────────────────────────────────────────────────────────────────────────────
// Why a singleton?
// If every file created a new PrismaClient(), you'd open hundreds of database
// connections and crash the server. The singleton pattern ensures there is
// exactly ONE connection shared across the whole app.

import { PrismaClient } from '@prisma/client';

// This creates the client once and exports it
const db = new PrismaClient();

export default db;

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE THIS IN OTHER FILES:
//
// import db from "./db"
//
// const user = await db.user.findUnique({ where: { id: "abc" } })
// const resources = await db.resource.findMany({ where: { userId: "abc" } })
// await db.resource.delete({ where: { id: "xyz" } })
// ─────────────────────────────────────────────────────────────────────────────
