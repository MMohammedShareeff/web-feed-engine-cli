import { db } from "../index.js"
import { eq } from "drizzle-orm";
import { feeds, users } from "../schema.js";

export type Feed = typeof feeds.$inferSelect
export type User = typeof users.$inferSelect

export async function createUser(name: string) {
    const [result] = await db.insert(users).values({ name: name }).returning();
    return result;
}

export async function getUserByName(name: string) {
    const [user] = await db.select().from(users).where(eq(users.name, name))
    return user ?? undefined
}

export async function getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user ?? undefined
}

export async function deleteAllUsers() {
    const result = await db.delete(users).returning()
    return result
}

export async function getAllUsers() {
    return await db.select({ name: users.name }).from(users)
}

export async function getUserFeeds(user: User) {
    return await db.select().from(feeds).where(eq(feeds.userId, user.id))
}