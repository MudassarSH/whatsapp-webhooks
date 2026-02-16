import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL!
})

const makeClient = () => {
    return new PrismaClient({
        adapter: new PrismaPg(pool),
        log: ["error", "warn"]
    })
}

type ExtendClient = ReturnType<typeof makeClient>;
const globalForPrisma = global as unknown as { prisma?: ExtendClient };

export const prismaDb = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaDb
}
