import fs from 'fs';

import { type AppPaths, getAppPaths } from './app-paths.js';
import { ensurePrivateDir, writePrivateFile } from './filesystem.js';

export type AppConfig = {
    OPENAI_API_KEY?: string;
};

function parseConfigFile(filePath: string): AppConfig {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parsed && typeof parsed === 'object' ? parsed as AppConfig : {};
    } catch {
        return {};
    }
}

function migrateLegacyConfigIfNeeded(paths: AppPaths) {
    if (fs.existsSync(paths.configFile) || !fs.existsSync(paths.legacyConfigFile)) {
        return;
    }

    const legacyConfig = parseConfigFile(paths.legacyConfigFile);
    if (!legacyConfig.OPENAI_API_KEY?.trim()) {
        return;
    }

    saveConfig(legacyConfig, paths);

    try {
        fs.unlinkSync(paths.legacyConfigFile);
    } catch {
        // Best-effort cleanup; keeping the migrated config available is more important.
    }
}

export function loadConfig(paths: AppPaths = getAppPaths()): AppConfig {
    migrateLegacyConfigIfNeeded(paths);
    return parseConfigFile(paths.configFile);
}

export function saveConfig(config: AppConfig, paths: AppPaths = getAppPaths()) {
    ensurePrivateDir(paths.appDir);
    writePrivateFile(paths.configFile, JSON.stringify(config, null, 2));
}

export function getStoredApiKey(paths: AppPaths = getAppPaths()) {
    return loadConfig(paths).OPENAI_API_KEY?.trim() || undefined;
}

export function resolveApiKey(paths: AppPaths = getAppPaths(), env: NodeJS.ProcessEnv = process.env) {
    const envKey = env.OPENAI_API_KEY?.trim();
    if (envKey) {
        return envKey;
    }

    return getStoredApiKey(paths);
}
