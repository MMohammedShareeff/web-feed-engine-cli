import { db } from "../index.js"
import { eq, and, sql } from "drizzle-orm";
import { feedFollows, users, feeds } from "../schema.js";

export async function createFeed(name: string, url: string, userId: string) {
    const [feed] = await db.insert(feeds)
        .values({
            name, url, userId,
        }).returning();
    return feed;
}

export async function getAllFeeds() {
    const result = await db.select({ name: feeds.name, url: feeds.url, creatorId: feeds.userId })
        .from(feeds)
    return result
}

export async function createFeedFollow(userId: string, feedId: string) {
    return await db.transaction(async (tx) => {
        const [insertedFollow] = await db
            .insert(feedFollows)
            .values({
                userId,
                feedId,
            })
            .returning();

        if (!insertedFollow) {
            throw new Error("Failed to insert feed follow record");
        }

        const [result] = await db
            .select({
                id: feedFollows.id,
                createdAt: feedFollows.createdAt,
                updatedAt: feedFollows.updatedAt,
                userId: feedFollows.userId,
                feedId: feedFollows.feedId,
                userName: users.name,
                feedName: feeds.name,
            })
            .from(feedFollows)
            .innerJoin(users, eq(feedFollows.userId, users.id))
            .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
            .where(eq(feedFollows.id, insertedFollow.id));
        return result;
    })
}

export async function getFeedFollowsForUser(userId: string) {
    const result = await db
        .select({
            id: feedFollows.id,
            createdAt: feedFollows.createdAt,
            updatedAt: feedFollows.updatedAt,
            userId: feedFollows.userId,
            feedId: feedFollows.feedId,
            feedName: feeds.name,
            userName: users.name,
        })
        .from(feedFollows)
        .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
        .innerJoin(users, eq(feedFollows.userId, users.id))
        .where(eq(feedFollows.userId, userId));

    return result;
}

export async function getFeedByUrl(url: string) {
    const [feed] = await db
        .select()
        .from(feeds)
        .where(eq(feeds.url, url));

    return feed;
}

export async function deleteFeedFollow(userId: string, url: string) {
    const feed = await getFeedByUrl(url);
    if (!feed) {
        throw new Error(`Feed not found for URL: ${url}`);
    }

    const [deletedRecord] = await db
        .delete(feedFollows)
        .where(
            and(
                eq(feedFollows.userId, userId),
                eq(feedFollows.feedId, feed.id)
            )
        )
        .returning();

    return deletedRecord;
}

export async function markFeedFetched(feedId: string) {
    const [updatedFeed] = await db
        .update(feeds)
        .set({
            lastFetchedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(feeds.id, feedId))
        .returning();

    return updatedFeed;
}

export async function getNextFeedToFetch() {
    const [nextFeed] = await db
        .select()
        .from(feeds)
        .orderBy(sql`${feeds.lastFetchedAt} ASC NULLS FIRST`)
        .limit(1);

    return nextFeed ?? null;
}