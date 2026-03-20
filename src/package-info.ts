import fs from 'fs';

export function getPackageVersion() {
    const packageJsonUrl = new URL('../package.json', import.meta.url);

    try {
        const content = fs.readFileSync(packageJsonUrl, 'utf-8');
        const parsed = JSON.parse(content) as { version?: string };
        return parsed.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}
