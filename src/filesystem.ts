import fs from 'fs';
import path from 'path';

export const PRIVATE_DIR_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;

function applyMode(targetPath: string, mode: number) {
    try {
        fs.chmodSync(targetPath, mode);
    } catch {
        // Permission changes are best-effort on platforms that do not fully support POSIX modes.
    }
}

export function ensurePrivateDir(dirPath: string) {
    fs.mkdirSync(dirPath, { recursive: true, mode: PRIVATE_DIR_MODE });
    applyMode(dirPath, PRIVATE_DIR_MODE);
}

export function writePrivateFile(filePath: string, content: string) {
    ensurePrivateDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: PRIVATE_FILE_MODE });
    applyMode(filePath, PRIVATE_FILE_MODE);
}
