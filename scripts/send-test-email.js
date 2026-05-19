#!/usr/bin/env node

/**
 * Test Email Sender
 * Sends a test reminder email to verify the email service is working
 * 
 * Usage:
 *   node scripts/send-test-email.js
 */

import { sendMaturationReminder, sendDeadlineReminder } from '../lib/emailService.js';

async function sendTestEmail() {
  console.log('📧 Test Email Sender\n');
  console.log('='.repeat(50));

  // Test proposal data
  const testProposal = {
    refNo: 'TEST-2026-001',
    titleProjectName: 'Test Proposal for Email Verification',
    client: 'KLSB System',
    maturityOnDate: '2026-05-22',
    deadline: '2026-05-30',
    personInCharge: 'Test User',
  };

  // Your email address (update before running tests)
  const testEmails = [];

  try {
    // Send maturation reminder (7 days away)
    console.log('\n✉️  Sending Maturation Reminder Email...');
    console.log('-'.repeat(50));
    
    const result1 = await sendMaturationReminder(testProposal, testEmails, 7);
    console.log('✓ Maturation reminder result:', result1);

    // Send deadline reminder (5 days away)
    console.log('\n✉️  Sending Deadline Reminder Email...');
    console.log('-'.repeat(50));
    
    const result2 = await sendDeadlineReminder(testProposal, testEmails, 5);
    console.log('✓ Deadline reminder result:', result2);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test emails sent successfully!\n');
    console.log('📋 Email Summary:');
    console.log(`  • Recipient: ${testEmails[0]}`);
    console.log(`  • Proposal Ref: ${testProposal.refNo}`);
    console.log(`  • Maturity Date: ${testProposal.maturityOnDate} (7 days remaining)`);
    console.log(`  • Deadline: ${testProposal.deadline} (5 days remaining)`);
    console.log('\n💡 Note: If email service is not configured (SendGrid/Mailgun),');
    console.log('   emails are logged to console. Configure in lib/emailService.js\n');

  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    process.exit(1);
  }
}

sendTestEmail();
