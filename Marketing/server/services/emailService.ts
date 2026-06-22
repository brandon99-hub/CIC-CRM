import nodemailer from "nodemailer";

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

class EmailService {
  async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<void> {
    try {
        await mailer.sendMail({
          from: process.env.EMAIL_FROM || '"KASNEB CRM" <no-reply@kasneb.or.ke>',
          ...options
        });
        console.log(`[EmailService] Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${options.to}:`, error);
        throw error;
    }
  }

  async sendPasswordResetEmail(options: {
    to: string;
    userName: string;
    resetLink: string;
  }): Promise<void> {
     const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${options.userName},</p>
        <p>You requested a password reset. Click the button below to continue:</p>
        <a href="${options.resetLink}" style="display: inline-block; padding: 12px 24px; background: #004E98; color: #fff; text-decoration: none; border-radius: 8px;">Reset Password</a>
        <p>If you didn't request this, you can ignore this email.</p>
      </div>
    `;
    await this.sendEmail({ to: options.to, subject: "Password Reset Request", html });
  }

  async sendActivityNotification(options: {
    to: string;
    activity: any;
  }): Promise<void> {
    const { activity } = options;
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Activity Reminder</title>
      <style>
        body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background-color: #FAFAFA; color: #111111; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 24px; padding: 48px; box-shadow: 0 4px 24px rgba(0,0,0,0.02); border: 1px solid #f0f0f0; }
        .logo { width: 120px; margin-bottom: 40px; }
        .eyebrow { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #004E98; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 24px; color: #000; }
        .content { font-size: 14px; line-height: 1.6; color: #555; margin-bottom: 32px; }
        .details-grid { background: #F8F9FB; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
        .detail-item { margin-bottom: 16px; border-bottom: 1px solid #EDEDED; padding-bottom: 12px; }
        .detail-item:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #999; margin-bottom: 4px; display: block; }
        .value { font-size: 13px; font-weight: 700; color: #111; }
        .footer { font-size: 10px; color: #BBB; text-align: center; margin-top: 40px; text-transform: uppercase; letter-spacing: 1px; }
        .button { display: inline-block; padding: 14px 32px; background: #004E98; color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align: center;">
             <img src="${process.env.APP_URL || 'http://localhost:5173'}/logo.png" alt="KASNEB CRM" class="logo">
        </div>
        <div class="eyebrow">Marketing Automation</div>
        <h1 class="title">New Activity Scheduled: ${activity.subject}</h1>
        <p class="content">This is a formal notification regarding your upcoming marketing engagement. Please ensure all preparatory materials are finalized before the scheduled time.</p>
        
        <div class="details-grid">
          <div class="detail-item">
            <span class="label">Engagement Type</span>
            <div class="value">${(activity.type || 'N/A').toUpperCase()}</div>
          </div>
          <div class="detail-item">
            <span class="label">Scheduled Date</span>
            <div class="value">${activity.dueDate || 'TBD'}</div>
          </div>
           ${activity.startTime ? `
          <div class="detail-item">
            <span class="label">Time Window</span>
            <div class="value">${activity.startTime} - ${activity.endTime || ''}</div>
          </div>` : ''}
        </div>

        <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/marketing/activities" class="button">Access CRM Dashboard</a>
        </div>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} KASNEB CRM Marketing Intelligence Unit
        </div>
      </div>
    </body>
    </html>
    `;
    await this.sendEmail({ to: options.to, subject: `Activity Reminder: ${activity.subject}`, html });
  }

  async sendSatisfactionEmail(options: {
    to: string;
    stakeholderName: string;
    caseNumber: string;
    caseTitle: string;
    caseId: string;
    stakeholderId: string;
  }): Promise<void> {
    const googleFormLink = process.env.FEEDBACK_FORM_URL || "https://forms.gle/kasneb-feedback-placeholder";

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #004E98 0%, #003366 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">KASNEB CRM</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Service Feedback Request</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            Hello <strong>${options.stakeholderName}</strong>,
          </p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Your support case has been resolved. We'd love to hear how we did!
          </p>

          <!-- Case Info Card -->
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
            <p style="margin: 0 0 4px; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Case Reference</p>
            <p style="margin: 0 0 8px; font-size: 16px; color: #111827; font-weight: 700;">${options.caseNumber}</p>
            <p style="margin: 0; font-size: 13px; color: #6b7280;">${options.caseTitle}</p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${googleFormLink}" style="display: inline-block; background: linear-gradient(135deg, #004E98 0%, #003366 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">
              ⭐ Rate Our Service (Google Form)
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
            This link expires in 30 days. Your feedback helps us improve.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px 24px; text-align: center;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            © ${new Date().getFullYear()} Kenya Accountants and Secretaries National Examinations Board
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: options.to,
      subject: `How was your experience? — Case ${options.caseNumber}`,
      html,
    });
  }
}

export const emailService = new EmailService();
