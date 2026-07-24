import { db } from "../index.js";
import { posts, feedFollows, feeds } from "../schema.js";
import { eq, desc, inArray } from "drizzle-orm";

export async function createPost(postData: {
    title: string;
    url: string;
    description?: string;
    publishedAt?: Date | null;
    feedId: string;
}) {
    const [newPost] = await db
        .insert(posts)
        .values({
            title: postData.title,
            url: postData.url,
            description: postData.description,
            publishedAt: postData.publishedAt,
            feedId: postData.feedId,
        })
        .onConflictDoNothing({ target: posts.url })
        .returning();

    return newPost;
}

export async function getPostsForUser(userId: string, limit: number = 2) {
    const follows = await db
        .select({ feedId: feedFollows.feedId })
        .from(feedFollows)
        .where(eq(feedFollows.userId, userId));

    const feedIds = follows.map((f) => f.feedId);

    if (feedIds.length === 0) {
        return [];
    }

    return await db
        .select({
            id: posts.id,
            title: posts.title,
            url: posts.url,
            description: posts.description,
            publishedAt: posts.publishedAt,
            feedName: feeds.name,
        })
        .from(posts)
        .innerJoin(feeds, eq(posts.feedId, feeds.id))
        .where(inArray(posts.feedId, feedIds))
        .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
        .limit(limit);
}