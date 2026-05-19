# Proposal Reminder & Notification System

## Overview

This system automatically sends email notifications and reminders to PICs (Persons In Charge) for proposals in the KLSB System. It includes:

1. **Proposal Creation Notifications** - Automatic email when a proposal is created and assigned to a PIC
2. **Maturation Date Reminders** - Automated reminders as the proposal maturation date approaches
3. **Deadline Reminders** - Automated reminders as the proposal deadline approaches

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Email Service Configuration
PORTAL_URL=https://your-portal-url.com
CRON_SECRET_KEY=your-secret-key-for-cron-jobs

# (Optional) Email Service Integration
# SENDGRID_API_KEY=your-sendgrid-key
# EMAIL_FROM=noreply@kemuncaklanai.com
```

### 2. Firestore Collections

The system automatically creates/uses these Firestore collections:

- **email_reminders_log** - Logs all reminder emails sent
- **email_notifications_log** - Logs all notification emails sent

These collections are created automatically when the system sends the first email.

### 3. Integrate Email Service (Optional)

Currently, the system logs emails to the console. To enable actual email sending:

#### Option A: SendGrid Integration

1. Install SendGrid SDK:
   ```bash
   npm install @sendgrid/mail
   ```

2. Update `lib/emailService.js` in the `sendEmail` function:

   ```javascript
   import sgMail from '@sendgrid/mail';

   export async function sendEmail(options) {
     const { to, subject, html, text } = options;

     if (!to || !subject || !html) {
       throw new Error("Missing required email fields: to, subject, html");
     }

     const recipients = Array.isArray(to) ? to : [to];

     sgMail.setApiKey(process.env.SENDGRID_API_KEY);
     await sgMail.send({
       to: recipients,
       from: process.env.EMAIL_FROM || 'noreply@kemuncaklanai.com',
       subject,
       html,
       text
     });

     return {
       success: true,
       recipients,
       subject,
       messageId: `msg-${Date.now()}`,
     };
   }
   ```

#### Option B: Mailgun Integration

1. Install Mailgun SDK:
   ```bash
   npm install mailgun.js
   ```

2. Update `lib/emailService.js`:

   ```javascript
   import Mailgun from 'mailgun.js';
   import FormData from 'form-data';

   const mailgun = new Mailgun(FormData);
   const mg = mailgun.client({
     username: 'api',
     key: process.env.MAILGUN_API_KEY,
   });

   export async function sendEmail(options) {
     const { to, subject, html, text } = options;
     const recipients = Array.isArray(to) ? to : [to];

     await mg.messages.create('kemuncaklanai.com', {
       from: process.env.EMAIL_FROM || 'noreply@kemuncaklanai.com',
       to: recipients,
       subject,
       html,
       text,
     });

     return { success: true, recipients, subject };
   }
   ```

## Features

### 1. Proposal Creation Notification

When a proposal is created with a PIC assigned:

- **Trigger**: POST to `/api/bd/proposals`
- **Recipients**: All PICs listed in the `personInCharge` field
- **Content**: Email with proposal details, deadline, and maturity date
- **Logging**: Logged to `email_notifications_log` collection

### 2. Maturation Date Reminders

Automatic reminders sent on these days before maturation:
- **Day 0** (Day of maturation)
- **Day 1** (1 day before)
- **Day 3** (3 days before)
- **Day 7** (7 days before)
- **Day 14** (14 days before)

Each day, only ONE reminder is sent per proposal (no duplicates).

### 3. Deadline Reminders

Automatic reminders sent on these days before deadline:
- **Day 0** (Deadline day)
- **Day 1** (1 day before)
- **Day 2** (2 days before)
- **Day 5** (5 days before)
- **Day 10** (10 days before)

Each day, only ONE reminder is sent per proposal (no duplicates).

## API Endpoints

### 1. Create/Update Proposals

**POST** `/api/bd/proposals`

Automatically sends notification email to PICs when a proposal is created.

```javascript
const response = await fetch('/api/bd/proposals', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    refNo: 'PROP-001',
    titleProjectName: 'Project A',
    personInCharge: 'SR, ASMS', // Comma-separated PIC codes
    deadline: '2024-06-30',
    maturityOnDate: '2024-07-15',
    // ... other fields
  })
});
```

### 2. Send Manual Reminder

**POST** `/api/bd/send-reminder`

Manually trigger a reminder email for a specific proposal.

```javascript
const response = await fetch('/api/bd/send-reminder', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    proposalId: 'proposal-123',
    proposalRefNo: 'PROP-001',
    proposalTitle: 'Project A',
    personInCharge: 'SR',
    reminderType: 'maturation', // or 'deadline'
    dueDate: '2024-07-15',
    daysLeft: 5,
    proposal: {
      // Optional: full proposal object
      refNo: 'PROP-001',
      titleProjectName: 'Project A',
      client: 'Client ABC',
      maturityOnDate: '2024-07-15',
      // ... other fields
    }
  })
});
```

### 3. Process All Reminders (Scheduled)

**POST** `/api/bd/process-reminders`

Processes all active proposals and sends due reminders. Should be called periodically via cron job.

```bash
# Call via cron job or Cloud Scheduler
curl -X POST https://your-portal.com/api/bd/process-reminders \
  -H "x-cron-secret: your-secret-key-for-cron-jobs"
```

Response:
```json
{
  "success": true,
  "message": "Reminders processed successfully",
  "summary": {
    "processed": 25,
    "maturationReminders": 3,
    "deadlineReminders": 2,
    "totalReminders": 5,
    "errors": []
  },
  "timestamp": "2024-06-20T10:30:00.000Z"
}
```

### 4. View Reminder Logs

**GET** `/api/bd/send-reminder`

Retrieve reminder logs for all proposals or a specific proposal.

```javascript
// Get reminders for specific proposal
const response = await fetch(
  '/api/bd/send-reminder?proposalId=proposal-123&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  }
);

const data = await response.json();
// Returns: { count: 5, reminders: [...] }
```

### 5. Health Check

**GET** `/api/bd/process-reminders`

Check if the reminder scheduler service is running.

```bash
curl https://your-portal.com/api/bd/process-reminders
```

## Setting Up Cron Jobs

### Google Cloud Scheduler

1. Create a new scheduled job
2. Set frequency: `0 9 * * *` (Daily at 9 AM)
3. Configure HTTP request:
   - **URL**: `https://your-portal.com/api/bd/process-reminders`
   - **HTTP method**: `POST`
   - **Auth header**:
     ```
     Headers:
     x-cron-secret: your-secret-key-for-cron-jobs
     ```

### Vercel Cron (if using Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/bd/process-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Add to `.env.local`:
```
CRON_SECRET_KEY=your-secret-key
```

## Testing

### Test Email Service

1. Create a test file `scripts/test-email-service.js`:

```javascript
import { sendProposalCreationEmail } from '../lib/emailService.js';

const testProposal = {
  refNo: 'TEST-001',
  titleProjectName: 'Test Project',
  client: 'Test Client',
  deadline: '2024-07-30',
  maturityOnDate: '2024-08-15',
  valueRM: 50000,
  personInCharge: 'SR',
};

const testEmails = ['Shazli.r@kemuncaklanai.com'];

await sendProposalCreationEmail(testProposal, testEmails);
console.log('Email sent successfully');
```

2. Run:
```bash
node --loader=tsx scripts/test-email-service.js
```

### Test Reminder Processing

Call the endpoint manually:

```bash
curl -X POST http://localhost:3000/api/bd/process-reminders \
  -H "x-cron-secret: your-secret-key-for-cron-jobs"
```

## PIC Email Mapping

Edit `lib/picEmailMap.js` to update PIC codes and email addresses:

```javascript
export const PIC_EMAIL_MAP = {
  "SR": "Shazli.r@kemuncaklanai.com",
  "ASMS": "syahmy.s@kemuncaklanai.com",
  // Add more as needed
};
```

## Troubleshooting

### Emails not sending

1. Check environment variables are set
2. Verify PIC codes in proposal match `PIC_EMAIL_MAP`
3. Check console logs for errors
4. Review `email_reminders_log` and `email_notifications_log` in Firestore

### Reminders not being sent on schedule

1. Verify cron job is configured correctly
2. Check cron logs (Cloud Scheduler or platform logs)
3. Ensure `CRON_SECRET_KEY` matches in both `.env` and cron job headers
4. Call GET endpoint to verify service is running

### Too many/few reminders

Adjust reminder intervals in `lib/reminderScheduler.js`:

```javascript
const maturationIntervals = [0, 1, 3, 7, 14];
const deadlineIntervals = [0, 1, 2, 5, 10];
```

## Email Templates

The system uses professional HTML email templates with:
- Clear visual hierarchy
- Urgency indicators (🔵 Reminder, 🟡 Soon, 🔴 Urgent, 🚨 Critical)
- Proposal details
- Direct links to portal
- Professional styling

Templates are customizable in:
- `lib/emailService.js` → `sendProposalCreationEmail()`
- `lib/emailService.js` → `sendMaturationReminder()`
- `lib/emailService.js` → `sendDeadlineReminder()`

## Email Notifications Log

View all email activity in Firestore:

**Collection: `email_reminders_log`**
```javascript
{
  proposalId: "doc-id",
  proposalRefNo: "PROP-001",
  personInCharge: "SR",
  reminderType: "maturation", // or "deadline"
  maturityOnDate: "2024-07-15",
  daysRemaining: 5,
  sentAt: Timestamp,
  status: "sent", // or "failed"
  recipients: ["email@domain.com"],
  error: "..." // if failed
}
```

**Collection: `email_notifications_log`**
```javascript
{
  proposalId: "doc-id",
  proposalRefNo: "PROP-001",
  notificationType: "proposal_created",
  personInCharge: "SR",
  picEmails: ["email@domain.com"],
  sentAt: Timestamp,
  status: "sent"
}
```

## Security

- All endpoints require BD role authorization
- Cron jobs use secret key validation (`x-cron-secret`)
- Email addresses are resolved from secure PIC mapping
- All activities are logged for audit trail
- No sensitive data in console logs (production)

## Next Steps

1. Set up email service integration (SendGrid/Mailgun)
2. Configure environment variables
3. Set up cron job for `process-reminders` endpoint
4. Test with a sample proposal
5. Monitor `email_reminders_log` and `email_notifications_log` collections

