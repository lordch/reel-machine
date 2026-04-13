import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !to) return;

  try {
    await resend.emails.send({
      from: "Reel Machine <onboarding@resend.dev>",
      to,
      subject,
      html: body,
    });
    console.log(`  Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.warn(`  ⚠ Email failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function notifyReelComplete(
  title: string,
  reelUrl: string,
  cost: number,
  alertEmail: string,
): Promise<void> {
  await sendEmail(
    alertEmail,
    `✅ Reel ready: ${title}`,
    `<h2>Reel generated: ${title}</h2>
    <p><a href="${reelUrl}">Watch video</a></p>
    <p>Pipeline cost: $${cost.toFixed(2)}</p>
    <p>Status in Google Sheet updated to <strong>ready_for_review</strong>.</p>`,
  );
}

export async function notifyReelFailed(
  title: string,
  error: string,
  alertEmail: string,
): Promise<void> {
  await sendEmail(
    alertEmail,
    `❌ Reel failed: ${title}`,
    `<h2>Pipeline failed: ${title}</h2>
    <p>Error: ${error}</p>
    <p>Status reverted to <strong>approved</strong> for retry.</p>`,
  );
}
