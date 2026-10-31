import { formatToman } from '../format';

/** Stable pastel index for a name, so avatars keep their colour between screens. */
export const PALETTE = (name: string) => [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;

/** Toman with Persian digits and 3-digit comma separators */
export const money = (n: number | undefined) => formatToman(n);
