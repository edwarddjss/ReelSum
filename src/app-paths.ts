import os from 'os';
import path from 'path';

export const APP_DIR_NAME = '.reelsum';
export const CONFIG_FILE_NAME = 'config.json';
export const LEGACY_CONFIG_FILE_NAME = '.reelsumrc';
export const OUTPUT_DIR_NAME = 'outputs';
export const DEFAULT_HISTORY_LIMIT = 25;

export type AppPaths = {
    appDir: string;
    configFile: string;
    legacyConfigFile: string;
    outputDir: string;
    stateFile: string;
};

export function getAppPaths(homeDir: string = os.homedir()): AppPaths {
    const appDir = path.join(homeDir, APP_DIR_NAME);

    return {
        appDir,
        configFile: path.join(appDir, CONFIG_FILE_NAME),
        legacyConfigFile: path.join(homeDir, LEGACY_CONFIG_FILE_NAME),
        outputDir: path.join(appDir, OUTPUT_DIR_NAME),
        stateFile: path.join(appDir, 'state.json')
    };
}
