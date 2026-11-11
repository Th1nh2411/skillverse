import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { gotoScreen } from "./helpers/nav";

test.describe("Đăng nhập và chặn truy cập", () => {
  test("chưa đăng nhập vào /profile bị chuyển tới /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page, "A1.3: middleware chưa chuyển hướng về /login").toHaveURL(/\/login/);
  });

  test("màn đăng nhập có Google và email", async ({ page }) => {
    await gotoScreen(page, "/login", "Đăng nhập");
    await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expectBasicA11y(page, "Đăng nhập");
  });

  test("người đã onboarding đăng nhập dev vào được hồ sơ", async ({ page }) => {
    await loginAs(page, "minhhoang");
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
  });

  test("người chưa onboarding bị chuyển tới /onboarding", async ({ page }) => {
    await loginAs(page, "bientap");
    await page.goto("/home");
    await expect(page).not.toHaveURL(/\/onboarding/);

    await page.context().clearCookies();
    await loginAs(page, "nguoimoi");
    await page.goto("/profile");
    await expect(page, "A1.3: middleware chưa chuyển người chưa onboarding về /onboarding").toHaveURL(/\/onboarding/);
  });
});
