import { expect, type Page } from "@playwright/test";

export type A11yIssue = { rule: string; target: string };

/**
 * Kiểm tra a11y cơ bản không cần axe (QUY TẮC BẮT BUỘC + SKILL.md "Mức chất lượng tối thiểu"):
 * - <html lang="vi">
 * - nút/liên kết phải có tên truy cập được (nút chỉ có icon cần aria-label)
 * - vùng chạm ≥ 44px cho nút/liên kết/điều khiển form (bỏ qua liên kết nằm trong đoạn văn)
 * - ảnh có alt, ô nhập có nhãn
 * - không emoji trong chữ hiển thị
 */
export async function collectA11yIssues(page: Page): Promise<A11yIssue[]> {
  return page.evaluate(() => {
    const issues: { rule: string; target: string }[] = [];
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const text = (el.textContent ?? "").trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${text ? ` "${text}"` : ""}`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const accName = (el: Element) => {
      const aria = el.getAttribute("aria-label")?.trim();
      if (aria) return aria;
      const by = el.getAttribute("aria-labelledby");
      if (by) return by.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? "").join(" ").trim();
      if (el instanceof HTMLInputElement && el.labels?.length) return el.labels[0]!.textContent?.trim() ?? "";
      const alt = Array.from(el.querySelectorAll("img[alt]")).map((i) => i.getAttribute("alt")).join(" ");
      return `${(el as HTMLElement).innerText ?? ""} ${alt} ${el.getAttribute("title") ?? ""}`.trim();
    };

    if (document.documentElement.lang !== "vi") issues.push({ rule: "html-lang-vi", target: `lang="${document.documentElement.lang}"` });

    const interactive = Array.from(
      document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="switch"], input:not([type="hidden"]), select, textarea'),
    ).filter(visible);
    for (const el of interactive) {
      if (!accName(el)) issues.push({ rule: "ten-truy-cap (aria-label cho nút chỉ có icon)", target: el.outerHTML.slice(0, 120) });
      const inText = el.tagName === "A" && el.closest("p, li > span, span") !== null && !el.closest("nav");
      if (inText) continue;
      // Ô checkbox/radio ẩn bên trong label lớn: đo label
      const target = (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type) && el.closest("label")) || el;
      const r = target.getBoundingClientRect();
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
        issues.push({ rule: "vung-cham-44px", target: `${describe(el)} (${Math.round(r.width)}x${Math.round(r.height)})` });
      }
    }
    for (const img of Array.from(document.querySelectorAll("img")).filter(visible)) {
      if (!img.hasAttribute("alt")) issues.push({ rule: "img-alt", target: img.outerHTML.slice(0, 120) });
    }
    for (const input of Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea")).filter(visible)) {
      const el = input as HTMLInputElement;
      if (!el.labels?.length && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        issues.push({ rule: "o-nhap-thieu-nhan", target: el.outerHTML.slice(0, 120) });
      }
    }
    const emoji = /\p{Extended_Pictographic}/u;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? "";
      // ⓘ (U+24D8) là ký hiệu chữ, không phải emoji; © ® ™ được \p{Extended_Pictographic} khớp nên loại trừ.
      if (emoji.test(t.replace(/[©®™]/g, ""))) issues.push({ rule: "khong-emoji", target: t.trim().slice(0, 40) });
    }
    return issues;
  });
}

/** Assert không có vấn đề a11y; in danh sách để dễ chuyển cho ui. */
export async function expectBasicA11y(page: Page, screen: string): Promise<void> {
  const issues = await collectA11yIssues(page);
  const lines = issues.map((i) => `  - [${i.rule}] ${i.target}`).join("\n");
  expect(issues, `A11y cơ bản màn "${screen}":\n${lines}`).toEqual([]);
}

/** Không đưa dữ liệu cá nhân lên URL (email, id người dùng dạng uuid trong query). */
export function expectNoPersonalDataInUrl(url: string): void {
  const u = new URL(url);
  const full = decodeURIComponent(u.pathname + u.search);
  expect(full, "URL chứa email").not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  for (const [k, v] of u.searchParams) {
    expect(`${k}=${v}`, "URL query chứa id dạng uuid").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  }
}
