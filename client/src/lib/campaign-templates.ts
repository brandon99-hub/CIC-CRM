export const CAMPAIGN_TEMPLATES = {
  promotional: (subject: string, content: string, trackingUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #F8FAFC; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding-bottom: 40px; }
        .main { background-color: #ffffff; width: 100%; max-width: 600px; margin: 0 auto; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #004E98 0%, #003B73 100%); padding: 60px 40px; text-align: center; }
        .content { padding: 48px 40px; color: #334155; line-height: 1.8; font-size: 16px; }
        .footer { background-color: #F1F5F9; padding: 40px; text-align: center; color: #64748B; font-size: 12px; }
        .button { display: inline-block; background: #01a64e; color: #ffffff; padding: 18px 36px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 32px; box-shadow: 0 8px 16px rgba(1, 166, 78, 0.2); transition: all 0.3s ease; }
        h1 { color: #ffffff; margin: 0; font-size: 32px; font-weight: 900; line-height: 1.2; text-transform: uppercase; letter-spacing: -0.02em; }
        p { margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <center>
          <div class="main">
            <div class="header">
              <img src="/logo.webp" alt="CIC Insurance" style="height: 50px; margin-bottom: 32px;">
              <h1>${subject}</h1>
            </div>
            <div class="content">
              <div style="font-weight: 500;">
                ${content.replace(/\n/g, '<br>')}
              </div>
              <div style="text-align: center;">
                <a href="${trackingUrl}" class="button">Apply / Get Started</a>
              </div>
            </div>
            <div class="footer">
              <strong style="color: #004E98;">KASNEB Towers</strong><br>
              Hospital Road, Upper Hill, Nairobi, Kenya<br>
              &copy; ${new Date().getFullYear()} Official Communication
            </div>
          </div>
        </center>
      </div>
    </body>
    </html>
  `,
  informational: (subject: string, content: string, trackingUrl: string) => `
     <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', serif; margin: 0; padding: 0; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 60px 40px; border-top: 6px solid #004E98; }
        .logo { margin-bottom: 60px; }
        .title { color: #000; font-size: 32px; font-weight: 900; margin-bottom: 40px; line-height: 1.1; }
        .body-text { color: #444; font-size: 17px; line-height: 1.8; margin-bottom: 40px; }
        .cta-link { color: #004E98; font-weight: 700; text-decoration: underline; }
        .seal { margin-top: 60px; padding-top: 40px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="/logo.webp" alt="CIC Insurance" style="height: 40px;">
        </div>
        <h1 class="title">${subject}</h1>
        <div class="body-text">
          ${content.replace(/\n/g, '<br>')}
        </div>
        <div style="text-align: left; margin-bottom: 40px;">
          <a href="${trackingUrl}" class="cta-link">Read full announcement on our portal &rarr;</a>
        </div>
        <div class="seal">
          Verified Official Communication<br>
          KASNEB Administration
        </div>
      </div>
    </body>
    </html>
  `,
  event: (subject: string, content: string, trackingUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F0F4F8; }
        .card { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.05); }
        .hero { background-color: #004E98; padding: 40px; color: #ffffff; }
        .badge { display: inline-block; padding: 6px 12px; background: rgba(255,255,255,0.15); border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
        .body { padding: 48px 40px; color: #334155; }
        .cta { display: block; background: linear-gradient(135deg, #004E98 0%, #01a64e 100%); color: #ffffff; text-align: center; padding: 20px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 18px; margin-top: 32px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="hero">
          <div class="badge">Official Event</div>
          <h1 style="margin: 0; font-size: 34px; font-weight: 900; line-height: 1.1;">${subject}</h1>
        </div>
        <div class="body">
          <div style="font-size: 16px; line-height: 1.8; margin-bottom: 24px;">
            ${content.replace(/\n/g, '<br>')}
          </div>
          <a href="${trackingUrl}" class="cta">Register & Add to Calendar</a>
        </div>
      </div>
    </body>
    </html>
  `,
  newsletter: (subject: string, content: string, trackingUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; }
        .masthead { padding: 32px; text-align: center; border-bottom: 2px solid #f3f4f6; }
        .inner { padding: 48px 40px; }
        .view-web { text-align: center; padding: 12px; font-size: 11px; color: #999; }
      </style>
    </head>
    <body>
      <div class="view-web">
        Email not displaying correctly? <a href="${trackingUrl}" style="color: #004E98;">View in Browser</a>
      </div>
      <div class="container">
        <div class="masthead">
          <img src="/logo.webp" alt="CIC Insurance" style="height: 35px;">
          <div style="color: #004E98; font-weight: 800; font-size: 12px; margin-top: 10px; text-transform: uppercase;">COMMUNITY NEWSLETTER</div>
        </div>
        <div class="inner">
          <h1 style="color: #111; font-size: 26px; font-weight: 800; margin-bottom: 24px;">${subject}</h1>
          <div style="color: #555; font-size: 16px; line-height: 1.8;">
            ${content.replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `
};
