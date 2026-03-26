import fs from 'fs';
import { spawnSync } from 'node:child_process';

import { type AppPaths, getAppPaths } from './app-paths.js';
import { getErrorMessage } from './errors.js';
import { writePrivateFile } from './filesystem.js';
import { getPackageName, getPackageVersion } from './package-info.js';
import { promptForUpdateAction, type UpdateAction } from './prompts.js';
import { formatNotice, palette } from './ui.js';

const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_REPROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_REGISTRY_BASE_URL = 'https://registry.npmjs.org';

type UpdateState = {
    lastCheckedAt?: string;
    lastSeenVersion?: string;
    lastPromptedAt?: string;
    lastPromptedVersion?: string;
};

type PersistedUpdateState = UpdateState & {
    latestVersion?: string;
};

type UpdateInstallResult = {
    success: boolean;
    error?: string;
};

type MaybeHandleCliUpdateOptions = {
    currentVersion?: string;
    packageName?: string;
    env?: NodeJS.ProcessEnv;
    now?: Date;
    log?: (message: string) => void;
    stdinIsTTY?: boolean;
    stdoutIsTTY?: boolean;
    fetchLatestVersion?: (packageName: string) => Promise<string | undefined>;
    promptForUpdate?: (currentVersion: string, latestVersion: string) => Promise<UpdateAction>;
    installLatest?: (packageName: string) => UpdateInstallResult;
};

function parseState(paths: AppPaths): UpdateState {
    if (!fs.existsSync(paths.stateFile)) {
        return {};
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(paths.stateFile, 'utf-8'));
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }

        const persistedState = parsed as PersistedUpdateState;

        return {
            lastCheckedAt: typeof persistedState.lastCheckedAt === 'string' ? persistedState.lastCheckedAt : undefined,
            lastSeenVersion: typeof persistedState.lastSeenVersion === 'string'
                ? persistedState.lastSeenVersion.trim() || undefined
                : typeof persistedState.latestVersion === 'string'
                    ? persistedState.latestVersion.trim() || undefined
                    : undefined,
            lastPromptedAt: typeof persistedState.lastPromptedAt === 'string' ? persistedState.lastPromptedAt : undefined,
            lastPromptedVersion: typeof persistedState.lastPromptedVersion === 'string'
                ? persistedState.lastPromptedVersion.trim() || undefined
                : undefined
        };
    } catch {
        return {};
    }
}

function saveState(state: UpdateState, paths: AppPaths) {
    writePrivateFile(paths.stateFile, JSON.stringify(state, null, 2));
}

function parseTime(value?: string) {
    if (!value) {
        return undefined;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function hasElapsed(since: string | undefined, now: Date, intervalMs: number) {
    const parsed = parseTime(since);
    if (parsed === undefined) {
        return true;
    }

    return now.getTime() - parsed >= intervalMs;
}

function parseVersion(version: string) {
    const normalized = version.trim().replace(/^v/i, '');
    const [core, prerelease = ''] = normalized.split('-', 2);
    const numericParts = core.split('.').map((part) => {
        const parsed = Number.parseInt(part, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    });

    return {
        numericParts,
        prerelease
    };
}

export function compareVersions(left: string, right: string) {
    const leftVersion = parseVersion(left);
    const rightVersion = parseVersion(right);
    const length = Math.max(leftVersion.numericParts.length, rightVersion.numericParts.length);

    for (let index = 0; index < length; index += 1) {
        const leftPart = leftVersion.numericParts[index] ?? 0;
        const rightPart = rightVersion.numericParts[index] ?? 0;

        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    if (!leftVersion.prerelease && rightVersion.prerelease) {
        return 1;
    }

    if (leftVersion.prerelease && !rightVersion.prerelease) {
        return -1;
    }

    return leftVersion.prerelease.localeCompare(rightVersion.prerelease);
}

function shouldCheckForUpdates(env: NodeJS.ProcessEnv, stdinIsTTY: boolean, stdoutIsTTY: boolean) {
    if (!stdinIsTTY || !stdoutIsTTY) {
        return false;
    }

    if (env.CI) {
        return false;
    }

    return env.REELSUM_DISABLE_UPDATE_CHECK !== '1';
}

export async function fetchLatestPackageVersion(packageName: string, registryBaseUrl: string = DEFAULT_REGISTRY_BASE_URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${registryBaseUrl}/${encodeURIComponent(packageName)}/latest`, {
            signal: controller.signal,
            headers: {
                accept: 'application/json'
            }
        });

        if (!response.ok) {
            return undefined;
        }

        const parsed = await response.json() as { version?: string };
        return parsed.version?.trim() || undefined;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
}

function installLatestPackage(packageName: string): UpdateInstallResult {
    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmExecutable, ['install', '-g', `${packageName}@latest`], {
        stdio: 'inherit'
    });

    if (result.error) {
        return {
            success: false,
            error: getErrorMessage(result.error)
        };
    }

    if (result.status !== 0) {
        return {
            success: false,
            error: `npm exited with code ${result.status ?? 'unknown'}`
        };
    }

    return { success: true };
}

function shouldPromptForVersion(state: UpdateState, latestVersion: string, now: Date) {
    if (state.lastPromptedVersion !== latestVersion) {
        return true;
    }

    return hasElapsed(state.lastPromptedAt, now, UPDATE_REPROMPT_INTERVAL_MS);
}

function normalizeState(state: UpdateState, currentVersion: string): UpdateState {
    if (!state.lastSeenVersion) {
        return state;
    }

    if (compareVersions(state.lastSeenVersion, currentVersion) > 0) {
        return state;
    }

    return {
        ...state,
        lastSeenVersion: currentVersion,
        lastPromptedAt: undefined,
        lastPromptedVersion: undefined
    };
}

function hasKnownUpdate(state: UpdateState, currentVersion: string) {
    if (!state.lastSeenVersion) {
        return false;
    }

    return compareVersions(state.lastSeenVersion, currentVersion) > 0;
}

function shouldRefreshSeenVersion(state: UpdateState, currentVersion: string, now: Date) {
    return !hasKnownUpdate(state, currentVersion) || hasElapsed(state.lastCheckedAt, now, UPDATE_CHECK_INTERVAL_MS);
}

function recordVersionCheck(state: UpdateState, now: Date, fetchedVersion?: string): UpdateState {
    return {
        ...state,
        lastCheckedAt: now.toISOString(),
        lastSeenVersion: fetchedVersion?.trim() || state.lastSeenVersion
    };
}

function markPrompted(state: UpdateState, latestVersion: string, now: Date): UpdateState {
    return {
        ...state,
        lastPromptedAt: now.toISOString(),
        lastPromptedVersion: latestVersion
    };
}

export async function maybeHandleCliUpdate(
    paths: AppPaths = getAppPaths(),
    options: MaybeHandleCliUpdateOptions = {}
) {
    const env = options.env ?? process.env;
    const stdinIsTTY = options.stdinIsTTY ?? Boolean(process.stdin.isTTY);
    const stdoutIsTTY = options.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

    if (!shouldCheckForUpdates(env, stdinIsTTY, stdoutIsTTY)) {
        return false;
    }

    const currentVersion = options.currentVersion ?? getPackageVersion();
    const packageName = options.packageName ?? getPackageName();
    const now = options.now ?? new Date();
    const log = options.log ?? console.log;
    let state = normalizeState(parseState(paths), currentVersion);

    if (shouldRefreshSeenVersion(state, currentVersion, now)) {
        const fetchLatestVersion = options.fetchLatestVersion ?? fetchLatestPackageVersion;
        const fetchedLatestVersion = await fetchLatestVersion(packageName);
        state = recordVersionCheck(state, now, fetchedLatestVersion);
    }

    const latestVersion = state.lastSeenVersion?.trim();

    if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
        saveState(state, paths);
        return false;
    }

    if (!shouldPromptForVersion(state, latestVersion, now)) {
        saveState(state, paths);
        return false;
    }

    const promptForUpdate = options.promptForUpdate ?? promptForUpdateAction;
    const choice = await promptForUpdate(currentVersion, latestVersion);

    state = markPrompted(state, latestVersion, now);
    saveState(state, paths);

    if (choice !== 'update') {
        log(`${formatNotice('info', 'Update skipped for now.')}\n`);
        return false;
    }

    log(`\n${formatNotice('info', `Updating ${packageName} to ${latestVersion}...`)}\n`);

    const installLatest = options.installLatest ?? installLatestPackage;
    const installResult = installLatest(packageName);

    if (!installResult.success) {
        log(`\n${formatNotice('warning', 'Update failed. Please try again later.')}\n`);
        return false;
    }

    log(`\n${formatNotice('success', `Updated ${packageName} to ${latestVersion}.`)}`);
    log(`${palette.muted(`Restart ${packageName} to use the new version.\n`)}`);
    return true;
}
