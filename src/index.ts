import { exit } from "node:process"
import {
    runCommand, CommandRegistry, registerCommand,
    handlerLogin, handlerRegister, handlerDeleteAll,
    handlerGetAllUsers, getCurrentUserFeeds, handlerAddFeed,
    handlerGetAllFeeds, handlerFollow, handlerFollowing,
    middlewareLoggedIn, handlerUnfollow,
    handlerAgg,
    handlerBrowse
} from "./handler.js"

async function main() {
    const args = process.argv.slice(2)
    let registry: CommandRegistry = {

    }

    await registerCommand(registry, "login", handlerLogin)
    await registerCommand(registry, "register", handlerRegister)
    await registerCommand(registry, "reset", handlerDeleteAll)
    await registerCommand(registry, "users", handlerGetAllUsers)
    await registerCommand(registry, "agg", handlerAgg)
    await registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed))
    await registerCommand(registry, "feeds", handlerGetAllFeeds)
    await registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow))
    await registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
    await registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
    await registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));

    if (args.length < 1) {
        console.log("an error occured, wrong argument list")
        exit(1)
    }

    const cmdName = args[0];
    const cmdArgs = args.slice(1);

    try {
        await runCommand(registry, cmdName, ...cmdArgs)
    } catch (err) {
        console.log(err)
        exit(1)
    }
    process.exit(0)
}

main();