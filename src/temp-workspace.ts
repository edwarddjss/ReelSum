import fs from 'fs';
import os from 'os';
import path from 'path';

export type TempWorkspace = {
    dirPath: string;
    cleanup: () => void;
};

export function createTempWorkspace(prefix: string = 'reelsum-'): TempWorkspace {
    const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

    return {
        dirPath,
        cleanup: () => {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    };
}
