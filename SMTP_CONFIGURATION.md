# SMTP Configuration for Reminder & Notification System

## Your SMTP Settings

Add the following to your `.env.local` file:

```env
# SMTP Configuration (via Kemuncak Lanai mail server)
SMTP_HOST=mail.kemuncaklanai.com.my
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=webnotify@kemuncaklanai.com.my
SMTP_PASS=Web@notifykls8
SMTP_FROM=KLSB Helpdesk <webnotify@kemuncaklanai.com.my>

# Portal URL for email links
PORTAL_URL=https://your-portal-url.com

# Cron job secret (for scheduled reminders)
CRON_SECRET_KEY=your-random-secret-key

# Admin notification emails (for proposal reminders)
ADMIN_NOTIFICATION_EMAILS=
```

## Environment Variable Explanation

| Variable | Value | Purpose |
|----------|-------|---------|
| `SMTP_HOST` | `mail.kemuncaklanai.com.my` | Mail server address |
| `SMTP_PORT` | `465` | SMTP port (465 = SSL/TLS) |
| `SMTP_SECURE` | `true` | Use SSL/TLS encryption |
| `SMTP_USER` | `webnotify@kemuncaklanai.com.my` | Sender email account |
| `SMTP_PASS` | `Web@notifykls8` | Email account password |
| `SMTP_FROM` | Email display format | How emails appear in recipient's inbox |
| `PORTAL_URL` | Your portal domain | Used in email links |
| `CRON_SECRET_KEY` | Random key | Authenticates scheduled tasks |
| `ADMIN_NOTIFICATION_EMAILS` | Comma-separated emails | Who receives admin notifications |

## Installation

### 1. Install Dependencies

```bash
npm install nodemailer
```

### 2. Update `.env.local`

Copy the SMTP settings above into your `.env.local` file in the project root.

### 3. Install & Build

```bash
npm install
npm run build
```

## How It Works

### Email Flow

```
User Action (create proposal)
    ↓
App calls emailService.js
    ↓
nodemailer connects to SMTP (mail.kemuncaklanai.com.my)
    ↓
Email authenticated via SMTP_USER & SMTP_PASS
    ↓
Email sent through mail.kemuncaklanai.com.my
    ↓
Recipient receives email from KLSB Helpdesk
```

### Proposal Creation → PIC Notification
1. **Trigger**: User creates proposal with PIC assigned
2. **Action**: System sends notification email via SMTP
3. **Recipient**: PIC receives email from `webnotify@kemuncaklanai.com.my`
4. **Template**: Professional HTML email with proposal details

### Daily Reminders → Admin & PICs
1. **Schedule**: Cron job runs daily at 9 AM
2. **Check**: System checks all active proposals
3. **Send**: Emails sent to PICs via SMTP on reminder dates
4. **Log**: All emails logged to Firestore

## Testing

### Test Email Service

```bash
node scripts/send-test-email.js
```

This will send test emails to verify SMTP is working.

### Manual Proposal Notification

Create a test proposal:
```bash
curl -X POST http://localhost:3000/api/bd/proposals \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refNo": "TEST-001",
    "titleProjectName": "Test Project",
    "personInCharge": "SR",
    "deadline": "2026-12-31",
    "maturityOnDate": "2027-01-15"
  }'
```

PIC will receive notification email from `KLSB Helpdesk <webnotify@kemuncaklanai.com.my>`

## Troubleshooting

### SMTP Connection Error
**Error**: `connect ECONNREFUSED`
- Check SMTP_HOST is correct: `mail.kemuncaklanai.com.my`
- Verify SMTP_PORT is correct: `465`
- Ensure network connection to mail server

### Authentication Error
**Error**: `Invalid login credentials`
- Double-check SMTP_USER: `webnotify@kemuncaklanai.com.my`
- Verify SMTP_PASS: `Web@notifykls8`
- Check for escaped characters (if password has special chars)

### Email Not Sent
**Check**:
1. Verify all SMTP variables in `.env.local`
2. Run test script: `node scripts/send-test-email.js`
3. Check Firestore `email_reminders_log` for errors
4. Look at console output for error messages

### Password with Special Characters

If your password contains `$`, escape it:
```env
SMTP_PASS=Web@notifykls8\$123
```

The system will automatically convert `\$` to `$` when connecting.

## Email Templates

The system sends professional HTML emails with:
- **Proposal Creation**: Introduces new proposal with key details
- **Maturation Reminder**: Warns about approaching maturation date (0, 1, 3, 7, 14 days)
- **Deadline Reminder**: Alerts to approaching deadline (0, 1, 2, 5, 10 days)

All emails include:
- Proposal reference and title
- Client information
- Deadline/Maturity date
- Direct link to portal
- Professional styling with KLSB branding

## Email Recipients

### Proposal Notifications
- **To**: Person In Charge (PIC) from proposal
- **From**: KLSB Helpdesk <webnotify@kemuncaklanai.com.my>

### Reminder Emails
- **To**: PIC assigned to proposal
- **From**: KLSB Helpdesk <webnotify@kemuncaklanai.com.my>

### Admin Notifications (optional)
- **To**: Admins in `ADMIN_NOTIFICATION_EMAILS`
- **Purpose**: Track all proposals and reminders

## Security Notes

✅ **Secure**: SMTP uses TLS/SSL encryption (port 465)
✅ **Authenticated**: All emails require SMTP_USER & SMTP_PASS
✅ **Authorized**: Only BD role users can create proposals that trigger emails
✅ **Logged**: All email activity tracked in Firestore
✅ **No Spam**: One reminder per proposal per day

## Next Steps

1. ✅ Add environment variables to `.env.local`
2. ✅ Run `npm install` to install nodemailer
3. ✅ Test with `node scripts/send-test-email.js`
4. ✅ Create test proposal to verify notifications
5. ✅ Set up cron job for scheduled reminders
6. ✅ Monitor email delivery in Firestore logs

## Support

For issues:
1. Check console output for error messages
2. Verify SMTP settings are correct
3. Test with `node scripts/send-test-email.js`
4. Review Firestore `email_reminders_log` collection
5. Check mail server logs if available

