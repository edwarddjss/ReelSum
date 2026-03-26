import figures from 'figures';

export const icons = {
    accent: figures.star,
    brand: figures.play,
    error: figures.cross,
    info: figures.info,
    prompt: figures.pointer,
    selected: figures.pointerSmall,
    success: figures.tick,
    warning: '▲'
} as const;

export function iconLabel(icon: string, label: string) {
    return `${icon} ${label}`;
}
