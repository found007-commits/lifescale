export type PhotoSize = { width: number; height: number };
export type CardPlan = {
  width: number; scale: number; fontSize: number; lineHeight: number; overlay: boolean; backgroundIndex: number;
  pages: Array<{ lines: string[]; top: number; height: number; photoRows: Array<{ indices: number[]; imageHeight: number; height: number; y: number }> }>;
};
export function planCard(ctx: Pick<CanvasRenderingContext2D, "measureText" | "font">, content: string, photos: PhotoSize | PhotoSize[] | null, layout: "separate" | "overlay", options?: { width?: number; backgroundIndex?: number; showDate?: boolean }): CardPlan;
export function drawCard(canvas: HTMLCanvasElement, photos: HTMLImageElement | HTMLImageElement[] | null, entry: { entry_date: string; moodLabel?: string; categoryLabel?: string; signature?: string }, plan: CardPlan, pageIndex: number, locale?: string): void;
export function formatDate(value?: string, locale?: string): string;
export function wrapText(ctx: Pick<CanvasRenderingContext2D, "measureText">, content: string, width: number): string[];
export const MAX_HEIGHT: number;
