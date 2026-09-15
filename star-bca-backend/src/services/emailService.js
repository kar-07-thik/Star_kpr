const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

function isConfigured() {
  return Boolean(getTransporter());
}

async function sendMail({ to, subject, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] SMTP not configured — skipping email to ${to}`);
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || `STARS-BCA <${process.env.SMTP_USER || 'no-reply@star.local'}>`,
    to,
    subject,
    html,
  });
}

async function sendStatusEmail({ userId, subject, message, link = '' }) {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('email name');
    if (!user || !user.email) return;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e2e2; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a1a1a; color: #fff; padding: 16px 24px;">
          <strong>STARS-BCA</strong> · STAR Framework Management System
        </div>
        <div style="padding: 24px;">
          <p>Hi ${user.name},</p>
          <p style="font-size: 15px; line-height: 1.5;">${message}</p>
          ${link ? `<p><a href="${link}" style="color: #1a73e8;">View details</a></p>` : ''}
          <p style="color: #888; font-size: 12px; margin-top: 24px;">KPR College of Arts and Science, Coimbatore</p>
        </div>
      </div>
    `;
    await sendMail({ to: user.email, subject, html });
  } catch (error) {
    console.error('[email] sendStatusEmail failed:', error.message);
  }
}

module.exports = { sendMail, sendStatusEmail, isConfigured };