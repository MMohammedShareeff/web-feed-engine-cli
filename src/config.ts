import fs from "fs";
import os from "os"
import path from "path";

export type Config = {
    dbUrl: string;
    currentUserName?: string;
}

const CONFIG_FILE_NAME = ".gatorconfig.json"

function getConfigFilePath() {
    return path.join(os.homedir(), CONFIG_FILE_NAME)
}

function writeConfig(config: Config): void {
    const obj = {
        db_url: config.dbUrl,
        current_user_name: config.currentUserName
    }
    const converted = JSON.stringify(obj)
    fs.writeFileSync(getConfigFilePath(), converted)
}

function validateConfig(rawConfig: any): Config {
    if (typeof rawConfig.db_url !== "string") {
        throw new Error("can not parse this config, expected to have a string db_url")
    }
    const obj: Config = {
        dbUrl: rawConfig.db_url,
        currentUserName: rawConfig.current_user_name ?? "",
    }
    return obj;
}

export function readConfig() {
    const file = fs.readFileSync(getConfigFilePath(), { encoding: "utf-8" });
    const parsed = JSON.parse(file)
    return validateConfig(parsed)
}

export function setUser(userName: string) {
    let config = readConfig();
    config.currentUserName = userName;
    writeConfig(config)
}

