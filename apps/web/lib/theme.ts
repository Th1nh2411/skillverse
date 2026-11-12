/** Giao diện: tối (mặc định, rừng đêm) hoặc sáng (giấy sổ tay). Lưu trong cookie để server render đúng, không nháy. */
export type Theme = "dark" | "light";
export const THEME_COOKIE = "sv-theme";
export const THEME_COLOR: Record<Theme, string> = { dark: "#0e1611", light: "#eceadf" };
export const themeFrom = (v: string | undefined): Theme => (v === "light" ? "light" : "dark");
