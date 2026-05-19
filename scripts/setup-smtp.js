#!/usr/bin/env node

/**
 * SMTP Configuration Setup Guide
 * Follow these steps to enable email notifications
 */

const fs = require('fs');
const path = require('path');

console.log('\n📧 KLSB Reminder System - SMTP Configuration Setup\n');
console.log('='.repeat(60));

const envPath = path.join(process.cwd(), '.env.local');
const envContent = `# SMTP Configuration (Kemuncak Lanai Mail Server)
SMTP_HOST=mail.kemuncaklanai.com.my
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=webnotify@kemuncaklanai.com.my
SMTP_PASS=Web@notifykls8
SMTP_FROM=KLSB Helpdesk <webnotify@kemuncaklanai.com.my>

# Portal URL for email links
PORTAL_URL=https://your-portal-url.com

# Cron job secret key
CRON_SECRET_KEY=generate-a-random-secret-key-here

# Admin notification emails
ADMIN_NOTIFICATION_EMAILS=''
`;

console.log('\n✓ Step 1: Add SMTP Configuration to .env.local\n');
console.log('The following environment variables are required:\n');
console.log(envContent);

console.log('\n' + '='.repeat(60));
console.log('\n📋 Setup Instructions:\n');
console.log('1. Open or create .env.local in your project root');
console.log('2. Copy and paste the configuration above');
console.log('3. Adjust PORTAL_URL to your actual portal URL');
console.log('4. Adjust CRON_SECRET_KEY to a random secret');
console.log('5. Save the file');
console.log('6. Run: npm install (if not already done)');
console.log('7. Test with: node scripts/send-test-email.js');

console.log('\n' + '='.repeat(60));
console.log('\n✓ SMTP Configuration Details:\n');
console.log('  Mail Server: mail.kemuncaklanai.com.my');
console.log('  Port: 465 (SSL/TLS)');
console.log('  Sender: webnotify@kemuncaklanai.com.my');
console.log('  Email Type: Corporate HTML + Plain Text');
console.log('  Email Delivery: Immediate + Scheduled');

console.log('\n' + '='.repeat(60));
console.log('\n✓ What Will Be Sent:\n');
console.log('  📬 Proposal Notifications');
console.log('     → Sent when proposal is created');
console.log('     → Recipients: PICs assigned to proposal');
console.log('     → Includes: Proposal details, deadlines, links');
console.log('\n  ⏰ Maturation Reminders');
console.log('     → Scheduled reminders: Days 0, 1, 3, 7, 14');
console.log('     → Recipients: PICs in charge');
console.log('     → Color coded: Blue → Yellow → Red');
console.log('\n  ⏲️  Deadline Reminders');
console.log('     → Scheduled reminders: Days 0, 1, 2, 5, 10');
console.log('     → Recipients: PICs in charge');
console.log('     → Color coded: Blue → Orange → Red');

console.log('\n' + '='.repeat(60));
console.log('\n✓ Environment Variables:\n');
console.log('Name                      Value');
console.log('-'.repeat(60));
console.log('SMTP_HOST                 mail.kemuncaklanai.com.my');
console.log('SMTP_PORT                 465');
console.log('SMTP_SECURE               true');
console.log('SMTP_USER                 webnotify@kemuncaklanai.com.my');
console.log('SMTP_PASS                 Web@notifykls8');
console.log('SMTP_FROM                 KLSB Helpdesk <webnotify@...>');
console.log('PORTAL_URL                https://your-portal.com');
console.log('CRON_SECRET_KEY           your-random-secret');
console.log('ADMIN_NOTIFICATION_EMAILS comma-separated-emails');

console.log('\n' + '='.repeat(60));
console.log('\n✓ Testing:\n');
console.log('After setting up .env.local, test with:');
console.log('  npm install');
console.log('  node scripts/send-test-email.js');
console.log('\nThen create a test proposal to verify notifications are sent.');

console.log('\n' + '='.repeat(60));
console.log('\n✓ Troubleshooting:\n');
console.log('❌ "Missing SMTP configuration"');
console.log('   → Check all SMTP_ variables are in .env.local');
console.log('   → Restart development server after adding env vars');
console.log('\n❌ "Invalid login credentials"');
console.log('   → Verify SMTP_USER and SMTP_PASS are correct');
console.log('   → Special characters in password? Use \\ to escape $ signs');
console.log('\n❌ "connect ECONNREFUSED"');
console.log('   → Check SMTP_HOST and SMTP_PORT');
console.log('   → Verify network connection to mail server');
console.log('\n✅ Success: Emails appear in Firestore email_reminders_log');

console.log('\n' + '='.repeat(60) + '\n');
