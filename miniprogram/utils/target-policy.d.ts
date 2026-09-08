export const RULE_ZH: string;
export const RULE_EN: string;
export type TargetPolicy = {configured: boolean; used: number; remaining: number; firstYear: boolean; firstYearRemaining: number; canChange: boolean; nextAt: string};
export function targetPolicy(profile: { target_change_count?: number; target_locked_until?: string; created_at?: string } | null, now?: number): TargetPolicy;
export function targetConfirmation(age: number, policy: TargetPolicy, en?: boolean, traditional?: boolean): string;
export function targetError(message: string, en?: boolean): string;
