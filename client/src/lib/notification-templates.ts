/**
 * Notification Templates for KASNEB CRM Marketing System
 * Elegance and minimalism are prioritized.
 */

export const NOTIFICATION_TEMPLATES = {
  email: (activity: any) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Activity Reminder</title>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; background-color: #FAFAFA; color: #111; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 24px; padding: 48px; box-shadow: 0 4px 24px rgba(0,0,0,0.02); }
        .logo { width: 140px; margin-bottom: 40px; }
        .eyebrow { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #004E98; margin-bottom: 12px; }
        .title { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 24px; }
        .content { font-size: 15px; line-height: 1.6; color: #444; margin-bottom: 32px; }
        .details-grid { background: #F8F9FB; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
        .detail-item { margin-bottom: 16px; border-bottom: 1px solid #EDEDED; padding-bottom: 12px; }
        .detail-item:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #999; margin-bottom: 4px; display: block; }
        .value { font-size: 14px; font-weight: 700; color: #111; }
        .footer { font-size: 11px; color: #BBB; text-align: center; margin-top: 40px; }
        .button { display: inline-block; padding: 14px 32px; background: #004E98; color: #FFF; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://localhost:5173/logo.webp" alt="CIC CRM" class="logo">
        <div class="eyebrow">Marketing Intelligence</div>
        <h1 class="title">Activity Notification: \${activity.subject}</h1>
        <p class="content">This is a reminder for your scheduled \${activity.type}. Please ensure all relevant stakeholders are briefed and prepared for the engagement.</p>
        
        <div class="details-grid">
          <div class="detail-item">
            <span class="label">Activity Type</span>
            <div class="value">\${activity.type.toUpperCase()}</div>
          </div>
          <div class="detail-item">
            <span class="label">Date & Time</span>
            <div class="value">\${activity.dueDate} @ \${activity.startTime || 'TBD'}</div>
          </div>
          <div class="detail-item">
            <span class="label">Stakeholder</span>
            <div class="value">\${activity.stakeholderName || 'All Stakeholders'}</div>
          </div>
        </div>

        <a href="https://localhost:5173/marketing/activities" class="button">View Activity Breakdown</a>
        
        <div class="footer">
          &copy; \${new Date().getFullYear()} KASNEB CRM Marketing System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `,

  sms: (activity: any) => 
    `[KASNEB CRM] REMINDER: \${activity.type.toUpperCase()} - \${activity.subject}. Scheduled for today at \${activity.startTime || 'specified time'}. View details on the dashboard.`,

  inApp: (activity: any) => ({
    title: `Activity Reminder: \${activity.subject}`,
    message: `Your \${activity.type} for stakeholder \${activity.stakeholderName || 'N/A'} is scheduled for \${activity.dueDate} at \${activity.startTime || 'TBD'}.`,
    action: `/marketing/activities`,
    priority: activity.type === 'meeting' ? 'high' : 'medium'
  })
};
