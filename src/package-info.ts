import fs from 'fs';

type PackageInfo = {
    name: string;
    version: string;
};

let cachedPackageInfo: PackageInfo | undefined;

function loadPackageInfo(): PackageInfo {
    const packageJsonUrl = new URL('../package.json', import.meta.url);

    try {
        const content = fs.readFileSync(packageJsonUrl, 'utf-8');
        const parsed = JSON.parse(content) as { name?: string; version?: string };

        return {
            name: parsed.name || 'reelsum',
            version: parsed.version || '0.0.0'
        };
    } catch {
        return {
            name: 'reelsum',
            version: '0.0.0'
        };
    }
}

export function getPackageInfo() {
    cachedPackageInfo ??= loadPackageInfo();
    return cachedPackageInfo;
}

export function getPackageName() {
    return getPackageInfo().name;
}

export function getPackageVersion() {
    return getPackageInfo().version;
}
