# Personal website

## Run locally

Install Node.js 18 or newer, then run these commands in PowerShell:

```powershell
npm install
$env:SMTP_HOST = "your SMTP server"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your SMTP username"
$env:SMTP_PASS = "your SMTP password or app password"
npm start
```

Open `http://localhost:3000`. Do not open `index.html` directly; the form needs the Node server.

The recipient defaults to the email address shown on the profile. Set `ADMIN_EMAIL` to override it. `SMTP_FROM` can optionally set an approved sender address. Set `SMTP_SECURE` to `true` when your email provider requires implicit TLS (usually port 465); port 465 enables it automatically.

### Gmail SMTP setup

For a Gmail account, turn on 2-Step Verification and create an App Password in your Google Account security settings. Use that App Password as `SMTP_PASS` (not your regular Gmail password). In PowerShell, configure:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your Gmail address"
$env:SMTP_PASS = "your 16-character app password"
```

Keep the App Password private. For a hosted site, configure these values as private environment variables in the hosting dashboard instead of typing them into source files.

Keep SMTP credentials private in environment variables or your hosting provider's secret settings. Never commit real credentials. To publish the site, deploy this Node.js app on a host that supports Node.js and configure the same environment variables there. The form returns an error until SMTP is configured.

### Deploy on Render

1. Push `index.html`, `server.js`, and `package.json` to a GitHub repository.
2. In Render, create a **Web Service** from that repository (not a Static Site).
3. Use `npm install` as the build command and `npm start` as the start command.
4. Add these environment variables in the Render service settings:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: your Gmail address
   - `SMTP_PASS`: the Gmail App Password
   - `ADMIN_EMAIL`: your receiving address (optional; defaults to the profile email)
5. Deploy the service and test the contact form on its Render URL.

Render supplies `PORT` automatically. Do not put SMTP credentials in GitHub or in the website files.

The contact form emails the visitor's name, email, optional mobile number, and message to the site owner. This project does not store submissions in a database.
