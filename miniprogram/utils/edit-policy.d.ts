export const EDIT_NOTICE: string;
export const EDIT_USED: string;
export function canEdit(entry: {edit_count?: number} | null | undefined): boolean;
export function editChanged(entry: {content: string; mood: string; category: string}, values: {content: string; mood: string; category: string}): boolean;
export function editError(error: {message?: string}): string;
