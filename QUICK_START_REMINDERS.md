# Quick Start Guide - Reminder System

## ⚡ 5-Minute Setup

### 1. Set Environment Variables
Add to your `.env.local`:
```env
PORTAL_URL=https://your-portal-url.com
CRON_SECRET_KEY=your-random-secret-key-here
```

### 2. Create Sample Proposal
The system will automatically send an email notification to the PIC when you create a proposal:
```javascript
POST /api/bd/proposals
{
  "refNo": "PROP-001",
  "titleProjectName": "My Project",
  "personInCharge": "SR",      // Must match PIC_EMAIL_MAP
  "deadline": "2024-12-31",
  "maturityOnDate": "2025-01-15"
}
```

✅ PIC (SR) will receive an email notification about the proposal!

### 3. Test the System
```bash
node scripts/test-reminders.js
```

This will verify:
- Days calculation
- Reminder schedule logic
- PIC email mapping
- Everything is working correctly

## 🎯 What Happens Next

### Automatic Notifications
1. **When proposal is created** → Email sent to PIC ✉️
2. **5 days before deadline** → Reminder email sent 🔔
3. **2 days before deadline** → Another reminder 📢
4. **On deadline day** → Final reminder ⏰

### Automatic Maturation Reminders
1. **14 days before maturation** → First reminder
2. **7 days before** → Second reminder
3. **3 days before** → Third reminder
4. **1 day before** → Fourth reminder
5. **On maturation day** → Final reminder

## 📧 Email Integration (Choose One)

### Option A: SendGrid (Recommended)
```bash
npm install @sendgrid/mail
```

Update `lib/emailService.js` - uncomment SendGrid code and add:
```javascript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// ... rest of code
```

Add to `.env.local`:
```env
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@kemuncaklanai.com
```

### Option B: Console Logging (Testing)
Just leave it as-is! Emails will be logged to console.
```
[EMAIL SENT] To: email@domain.com
Subject: 📋 New Proposal Created - PROP-001
```

## 🤖 Set Up Cron Job

### For Google Cloud Scheduler
1. Go to Cloud Scheduler
2. Create new job:
   - Name: `klsb-process-reminders`
   - Frequency: `0 9 * * *` (daily at 9 AM)
   - Timezone: Your timezone
   - HTTP POST to: `https://your-portal.com/api/bd/process-reminders`
   - Add header: `x-cron-secret: your-random-secret-key-here`

### For Vercel
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/bd/process-reminders",
    "schedule": "0 9 * * *"
  }]
}
```

## 🧪 Test It Works

### 1. Manual Reminder Test
```bash
curl -X POST http://localhost:3000/api/bd/send-reminder \
  -H "Authorization: Bearer your-id-token" \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "test-123",
    "proposalRefNo": "TEST-001",
    "proposalTitle": "Test Project",
    "personInCharge": "SR",
    "reminderType": "deadline",
    "dueDate": "2024-07-30",
    "daysLeft": 5
  }'
```

### 2. Process All Reminders
```bash
curl -X POST http://localhost:3000/api/bd/process-reminders \
  -H "x-cron-secret: your-random-secret-key-here"
```

### 3. Check Health
```bash
curl https://your-portal.com/api/bd/process-reminders
```

## 📊 Monitor in Firestore

View all emails sent in Firestore collections:

**Collections:**
- `email_notifications_log` - Proposal creation notifications
- `email_reminders_log` - Deadline/maturation reminders

Each entry contains:
- Proposal ID & Reference
- PIC name & email
- Reminder type & date
- Send timestamp & status

## 🔧 Common Tasks

### Add a New PIC
Edit `lib/picEmailMap.js`:
```javascript
export const PIC_EMAIL_MAP = {
  "SR": "shazli@email.com",
  "NEW": "newpic@email.com",  // ← Add here
};
```

### Change Reminder Timing
Edit `lib/reminderScheduler.js`:
```javascript
// Send reminders on these days before deadline
const deadlineIntervals = [0, 1, 2, 5, 10];  // Adjust here

// Send reminders on these days before maturation
const maturationIntervals = [0, 1, 3, 7, 14];  // Or here
```

### View Reminders for a Proposal
```bash
curl "http://localhost:3000/api/bd/send-reminder?proposalId=YOUR_PROPOSAL_ID" \
  -H "Authorization: Bearer your-id-token"
```

## 📝 Using in UI

Show urgency badge on proposal cards:
```javascript
import { getUrgencyBadge, calculateDaysUntil } from '@/lib/reminderUtils';

const daysLeft = calculateDaysUntil(proposal.deadline);
const badge = getUrgencyBadge(daysLeft, 'deadline');

// Use: badge.emoji, badge.label, badge.className
```

Show reminder notification:
```javascript
import { generateReminderNotification } from '@/lib/reminderUtils';

const msg = generateReminderNotification(proposal);
// Returns: "📌 Deadline: 5 days" or "⚠️ Deadline overdue"
```

## 🎓 How It Works (Simple Explanation)

```
1. Create Proposal
   ↓
2. System auto-sends "Proposal Created" email to PIC
   ↓
3. Every day at 9 AM, cron job runs
   ↓
4. System checks all proposals:
   - "Is deadline 5 days away?" → Send reminder
   - "Is deadline 1 day away?" → Send reminder
   - "Is maturation 3 days away?" → Send reminder
   ↓
5. PICs receive emails on key dates
   ↓
6. All emails logged in Firestore for tracking
```

## ✅ Checklist

- [ ] Set `PORTAL_URL` in `.env.local`
- [ ] Set `CRON_SECRET_KEY` in `.env.local`
- [ ] Run `node scripts/test-reminders.js` - all tests pass
- [ ] Create test proposal - PIC receives notification email
- [ ] Choose email service (SendGrid/Mailgun) or use console logging
- [ ] Set up cron job (Google Cloud Scheduler or Vercel)
- [ ] Test cron job manually
- [ ] Verify Firestore logging working
- [ ] Add/update PIC email mappings as needed

## 🚀 You're Done!

The reminder system is now active. PICs will automatically receive:
- ✉️ Notification when proposal is assigned
- 📢 Reminders as deadlines approach
- ⏰ Final reminders on important dates

## 📞 Need Help?

1. Check `REMINDER_SYSTEM_SETUP.md` for detailed documentation
2. Run `node scripts/test-reminders.js` to diagnose issues
3. Check Firestore logs for email delivery status
4. Review cron job logs in your scheduler

## 🎉 Next Steps

1. Customize email templates in `lib/emailService.js`
2. Add more PICs to `PIC_EMAIL_MAP`
3. Integrate real email service (SendGrid/Mailgun)
4. Set up monitoring/alerts for email failures
5. Train team on the new notification system

