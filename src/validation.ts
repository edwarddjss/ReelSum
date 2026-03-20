import { getErrorMessage } from './errors.js';

export function isInstagramHostname(hostname: string) {
    const normalized = hostname.toLowerCase();
    return normalized === 'instagram.com' || normalized.endsWith('.instagram.com');
}

export function assertInstagramUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
        throw new Error('Please enter a URL.');
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('Please enter a valid URL format (e.g., https://...).');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Please enter a valid http(s) Instagram URL.');
    }

    if (!isInstagramHostname(parsed.hostname)) {
        throw new Error('Please enter a valid Instagram URL.');
    }

    return trimmed;
}

export function validateInstagramUrlInput(value: string) {
    try {
        assertInstagramUrl(value);
        return true;
    } catch (error) {
        return getErrorMessage(error);
    }
}
