import type { Locator, Page } from "@playwright/test";

/** Phần tử bấm được theo tên (nút, liên kết, ô chọn, tab) — ui có thể dựng chip bằng bất kỳ role nào. */
export function clickable(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole("button", { name })
    .or(scope.getByRole("link", { name }))
    .or(scope.getByRole("checkbox", { name }))
    .or(scope.getByRole("tab", { name }))
    .or(scope.getByRole("option", { name }));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
