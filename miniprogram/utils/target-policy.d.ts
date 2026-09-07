export const RULE_ZH: string;
export const RULE_EN: string;
export function targetPolicy(profile: { target_change_count?: number; target_locked_until?: string } | null, now?: number): {configured: boolean; used: number; remaining: number; canChange: boolean; nextAt: string};
export function targetError(message: string, en?: boolean): string;
