/**
 * Gửi email đăng nhập (magic link). EMAIL_SERVER trống → in link ra console server (dev local).
 */
import { createTransport } from "nodemailer";

export async function sendMagicLink(params: { identifier: string; url: string; server?: string; from?: string }) {
  const { identifier, url } = params;
  const server = params.server ?? process.env.EMAIL_SERVER;
  if (!server) {
    console.info(`\n[auth] Link đăng nhập cho ${identifier}:\n${url}\n`);
    return;
  }
  const { host } = new URL(url);
  const transport = createTransport(server);
  const result = await transport.sendMail({
    to: identifier,
    from: params.from ?? process.env.EMAIL_FROM,
    subject: `Đăng nhập SkillVerse`,
    text: `Đăng nhập vào ${host}\n\nMở link sau để đăng nhập (hiệu lực 24 giờ):\n${url}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1a2b22">
<p>Đăng nhập vào <strong>SkillVerse</strong>.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#1f4d36;color:#fff;border-radius:8px;text-decoration:none">Đăng nhập</a></p>
<p style="color:#5b6b62;font-size:14px">Link có hiệu lực 24 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
</div>`,
  });
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length) throw new Error("Không gửi được email đăng nhập");
}
