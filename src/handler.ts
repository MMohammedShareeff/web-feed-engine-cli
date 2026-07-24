import { exit } from "node:process"
import { readConfig, setUser } from "./config"
import {
    createUser, getUserByName, deleteAllUsers,
    getAllUsers, getUserFeeds, User, getUserById
} from "src/lib/db/repository/users"
import { XMLParser } from "fast-xml-parser"
import {
    createFeed, createFeedFollow, deleteFeedFollow,
    getAllFeeds, getFeedByUrl, getFeedFollowsForUser,
    getNextFeedToFetch, markFeedFetched
} from "./lib/db/repository/feed"
import { createPost, getPostsForUser } from "./lib/db/repository/post"

type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>
export type CommandRegistry = {
    [commandName: string]: CommandHandler
}

const xmlParser = new XMLParser({
    processEntities: false,
    isArray: (name) => name === "item",
});

type UserCommandHandler = (
    cmdName: string,
    user: User,
    ...args: string[]
) => Promise<void>

export type RSSItem = {
    title: string;
    link: string;
    description: string;
    pubDate?: string;
};

export type RSSFeed = {
    channel: {
        title: string;
        link: string;
        description: string;
        item: RSSItem[];
    };
};

type middlewareLoggedIn = (handler: UserCommandHandler) => CommandHandler

export async function handlerFollow(cmdName: string, user: User, ...args: string[]) {
    const url = args[0];

    if (!url) {
        throw new Error("Usage: follow <url>");
    }

    const feed = await getFeedByUrl(url);
    if (!feed) {
        throw new Error(`Feed not found for URL: ${url}`);
    }

    const followRecord = await createFeedFollow(user.id, feed.id);
    console.log(`Successfully followed '${followRecord.feedName}' as user '${followRecord.userName}'!`);
}

export async function handlerFollowing(cmdName: string, user: User, ...args: string[]) {
    const follows = await getFeedFollowsForUser(user.id);

    if (follows.length === 0) {
        console.log(`User '${user.name}' is not following any feeds.`);
        exit(0)
    }

    console.log(`Feeds followed by ${user.name}:`);
    for (const follow of follows) {
        console.log(`* ${follow.feedName}`);
    }
}

export async function handlerUnfollow(cmdName: string, user: User, ...args: string[]) {
    const url = args[0];

    if (!url) {
        throw new Error("Usage: unfollow <url>");
    }

    const deleted = await deleteFeedFollow(user.id, url);

    if (!deleted) {
        console.log(`User '${user.name}' is not following feed with URL: ${url}`);
        return;
    }

    console.log(`Successfully unfollowed feed at '${url}' for user '${user.name}'!`);
}

export async function handlerAgg(cmdName: string, ...args: string[]) {
    const durationStr = args[0];

    if (!durationStr) {
        throw new Error("Usage: agg <time_between_reqs> (e.g. 1s, 1m, 1h)");
    }

    const timeBetweenRequests = parseDuration(durationStr);

    console.log(`Collecting feeds every ${durationStr}`);

    const handleError = (err: unknown) => {
        console.error("Error scraping feed:", err);
    };

    scrapeFeeds().catch(handleError);

    const interval = setInterval(() => {
        scrapeFeeds().catch(handleError);
    }, timeBetweenRequests);

    await new Promise<void>((resolve) => {
        process.on("SIGINT", () => {
            console.log("\nShutting down feed aggregator...");
            clearInterval(interval);
            resolve();
        });
    });
}


export function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
    return async (cmdName: string, ...args: string[]): Promise<void> => {
        const config = readConfig();
        const userName = config.currentUserName;

        if (!userName) {
            throw new Error("No user is currently logged in");
        }

        const user = await getUserByName(userName);
        if (!user) {
            throw new Error(`User ${userName} not found`);
        }

        await handler(cmdName, user, ...args);
    };
}


export function parsePublishedAt(dateStr?: string): Date | null {
    if (!dateStr) return null;

    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

async function getCurrentUser() {
    const currentUserName = readConfig().currentUserName
    if (!currentUserName) {
        throw new Error("no current logged user or such user does not exist")
    }
    const current: User = await getUserByName(currentUserName)
    return current;
}

export async function getCurrentUserFeeds() {
    console.log(await getUserFeeds(await getCurrentUser()))
}

export function parseDuration(durationStr: string): number {
    const regex = /^(\d+)(ms|s|m|h)$/;
    const match = durationStr.match(regex);

    if (!match) {
        throw new Error(`Invalid duration format: ${durationStr}. Use 100ms, 1s, 1m, 1h, etc.`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case "ms":
            return value;
        case "s":
            return value * 1000;
        case "m":
            return value * 60 * 1000;
        case "h":
            return value * 60 * 60 * 1000;
        default:
            throw new Error(`Unsupported duration unit: ${unit}`);
    }
}

export async function scrapeFeeds() {
    const feed = await getNextFeedToFetch();

    if (!feed) {
        console.log("No feeds found to scrape.");
        return;
    }

    console.log(`\nFetching '${feed.name}' from ${feed.url}...`);

    await markFeedFetched(feed.id);

    try {
        const rssData = await fetchFeed(feed.url);
        const rawItems = rssData.channel.item ?? rssData.channel.items ?? [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        let savedCount = 0;
        for (const item of items) {
            if (!item?.link || !item?.title) continue;

            const pubDateRaw = item.pubDate ?? item.published ?? item.updated;
            const publishedAt = parsePublishedAt(pubDateRaw);

            const saved = await createPost({
                title: item.title,
                url: item.link,
                description: item.description ?? null,
                publishedAt: publishedAt,
                feedId: feed.id,
            });

            if (saved) savedCount++;
        }

        console.log(`Saved ${savedCount} new posts from '${feed.name}'`);
    } catch (err) {
        console.error(`Error scraping '${feed.name}':`, err);
    }
}

export async function handlerBrowse(cmdName: string, user: User, ...args: string[]) {
    let limit = 2;

    if (args[0]) {
        const parsedLimit = parseInt(args[0], 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
        } else {
            throw new Error("Limit must be a valid positive number.");
        }
    }

    const userPosts = await getPostsForUser(user.id, limit);

    if (userPosts.length === 0) {
        console.log(`No posts found for user '${user.name}'. Make sure you are following feeds!`);
        return;
    }

    console.log(`\nShowing top ${userPosts.length} post(s) for ${user.name}:\n`);
    for (const post of userPosts) {
        console.log(`--- ${post.title} ---`);
        console.log(`Feed: ${post.feedName}`);
        console.log(`URL: ${post.url}`);
        if (post.publishedAt) {
            console.log(`Published: ${post.publishedAt.toLocaleString()}`);
        }
        if (post.description) {
            const cleanDesc = post.description.replace(/<[^>]*>?/gm, "").slice(0, 200);
            console.log(`Summary: ${cleanDesc}...`);
        }
        console.log("");
    }
}

export async function handlerLogin(cmdName: string, ...args: string[]) {
    if (args.length == 0) {
        throw new Error("expected a usernaem argument to be provided, found nothing")
    }
    const name: string = args[0]
    const check = await getUserByName(name)
    if (!check) {
        throw new Error("user with such name already exist")
    }
    await setUser(name)
    console.log(`you are now logged in as: ${name}`)
}

export async function handlerRegister(cmdNmae: string, ...args: string[]) {
    if (args.length == 0) {
        throw new Error("you must provide a name when registering")
    }
    const name: string = args[0]
    const check = await getUserByName(name)
    if (!check) {
        const user = await createUser(name)
        setUser(user.name)
        console.log(`user created successfully, you are now logged in as ${user.name}`)
        console.log(user)
    }
    else {
        throw new Error("user with such name already exists")
    }
}

export async function handlerDeleteAll(cmdName: string, ...args: string[]) {
    const result = await deleteAllUsers()
    if (result.length === 0) {
        console.log("nothing to delete")
        exit(1)
    }
    else {
        console.log("users deleted successfully")
        exit(0)
    }
}

export async function handlerGetAllUsers(cmdName: string, ...args: string[]) {
    const result = await getAllUsers()
    if (result.length === 0) {
        console.log("you do not have any users")
    }
    else {
        for (let i = 0; i < result.length; i++) {
            let extra = ""
            if (result[i].name === readConfig().currentUserName) {
                extra = "(current)"
            }
            console.log(`* ${result[i].name} ${extra}`)
        }
    }
}

export async function fetchFeed(cmdName: string, ...args: string[]) {
    try {
        const feedURL: string = "https://www.wagslane.dev/index.xml"
        if (!feedURL) {
            throw new Error("you did not provide a url")
        }
        const response = await fetch(feedURL, {
            method: "GET",
            headers: {
                "User-Agent": "gator",
            }
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.text()
        const parsed = xmlParser.parse(result)

        const channel = parsed?.rss?.channel ?? null;
        let title = "", link = "", description = ""
        if (channel) {
            title = channel.title ?? ""
            link = channel.link ?? ""
            description = channel.description ?? ""
        }

        let rawItems: any[] = []
        if (channel?.item) {
            rawItems = channel.item
        }

        const items: Array<{
            title: string,
            link: string,
            description: string,
            pubDate: string,
        }> = [];

        for (const rawItem of rawItems) {
            const itemTitle = rawItem.title
            const itemLink = rawItem.link
            const itemDescription = rawItem.description
            const itemPubDate = rawItem.pubDate

            if (!itemTitle || !itemLink || !itemDescription || !itemPubDate) {
                continue;
            }

            items.push({
                title: itemTitle,
                link: itemLink,
                description: itemDescription,
                pubDate: itemPubDate
            });
        }

        return {
            channel: {
                title,
                link,
                description,
            },
            items,
        }

    } catch (error) {
        console.log(error)
        exit(1)
    }
}

export async function handlerAddFeed(cmdName: string, user: User, ...args: string[]) {
    const name = args[0]
    const url = args[1]

    if (!name || !url) {
        console.log("you should provide a name and url for your feed")
        exit(1)
    }

    const existingFeed = await getFeedByUrl(url);
    if (existingFeed) {
        console.log("feed already exist")
        return;
    }

    const feed = await createFeed(name, url, user.id)
    const followRecord = await createFeedFollow(user.id, feed.id)

    console.log("Feed created successfully!");
    console.log(`Feed: ${followRecord.feedName}`);
    console.log(`User: ${followRecord.userName}`);
}

export async function handlerGetAllFeeds(cmdName: string, ...args: string[]) {
    const allFeeds = await getAllFeeds()
    for (let i = 0; i < allFeeds.length; i++) {
        const feed = allFeeds[i];
        const creator = await getUserById(feed.creatorId)
        console.log(`${feed.name}`)
        console.log(`${feed.url}`)
        console.log(`${creator.name}`)
    }
}

export async function registerCommand(registry: CommandRegistry, cmdName: string, handler: CommandHandler) {
    registry[cmdName] = handler
}

export async function runCommand(registry: CommandRegistry, cmdName: string, ...args: string[]) {
    const handler = registry[cmdName]
    if (handler === undefined) {
        throw new Error("a handler of such a command name does not exist")
    }
    await handler(cmdName, ...args)
}

export const registry: CommandRegistry = {

}
