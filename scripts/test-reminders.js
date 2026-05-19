#!/usr/bin/env node

/**
 * Test Reminder System
 * 
 * Usage:
 *   node scripts/test-reminders.js
 *   
 * This script tests the reminder and notification system
 */

import { calculateDaysRemaining, shouldSendReminder } from '../lib/reminderScheduler.js';
import { getPicEmails, getPicEmail } from '../lib/picEmailMap.js';

console.log('🧪 KLSB Reminder System Test Suite\n');
console.log('='.repeat(50));

// Test 1: Calculate Days Remaining
console.log('\n✓ Test 1: Calculate Days Remaining');
console.log('-'.repeat(50));

const testCases = [
  {
    date: new Date().toISOString().split('T')[0],
    label: 'Today',
  },
  {
    date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    label: '1 day from now',
  },
  {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    label: '7 days from now',
  },
  {
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    label: '1 day ago',
  },
];

testCases.forEach((testCase) => {
  const daysRemaining = calculateDaysRemaining(testCase.date);
  console.log(`  ${testCase.label}: ${daysRemaining} days`);
});

// Test 2: Reminder Schedule Logic
console.log('\n✓ Test 2: Reminder Schedule Logic');
console.log('-'.repeat(50));

const scheduleTests = [
  { days: 0, type: 'maturation', shouldSend: true, label: 'Maturation on day 0' },
  { days: 1, type: 'maturation', shouldSend: true, label: 'Maturation on day 1' },
  { days: 2, type: 'maturation', shouldSend: false, label: 'Maturation on day 2 (skipped)' },
  { days: 3, type: 'maturation', shouldSend: true, label: 'Maturation on day 3' },
  { days: 7, type: 'maturation', shouldSend: true, label: 'Maturation on day 7' },
  { days: 10, type: 'maturation', shouldSend: false, label: 'Maturation on day 10 (skipped)' },
  { days: 0, type: 'deadline', shouldSend: true, label: 'Deadline on day 0' },
  { days: 1, type: 'deadline', shouldSend: true, label: 'Deadline on day 1' },
  { days: 2, type: 'deadline', shouldSend: true, label: 'Deadline on day 2' },
  { days: 5, type: 'deadline', shouldSend: true, label: 'Deadline on day 5' },
  { days: 7, type: 'deadline', shouldSend: false, label: 'Deadline on day 7 (skipped)' },
];

scheduleTests.forEach((test) => {
  const result = shouldSendReminder(test.days, test.type);
  const status = result === test.shouldSend ? '✓' : '✗';
  const expected = `(expected: ${test.shouldSend})`;
  console.log(`  ${status} ${test.label} → ${result} ${expected}`);
});

// Test 3: PIC Email Mapping
console.log('\n✓ Test 3: PIC Email Mapping');
console.log('-'.repeat(50));

const picTests = [
  { code: 'SR', label: 'Single PIC' },
  { code: 'SR, ASMS', label: 'Multiple PICs' },
  { code: 'sr, asms, FAS', label: 'Mixed case' },
  { code: 'SR; ASMS', label: 'Semicolon separator' },
  { code: 'INVALID', label: 'Invalid PIC' },
  { code: null, label: 'Null value' },
];

picTests.forEach((test) => {
  const emails = getPicEmails(test.code);
  const status = emails.length > 0 ? '✓' : '⚠';
  console.log(`  ${status} ${test.label}: ${emails.length} email(s) found`);
  if (emails.length > 0) {
    emails.forEach((email) => console.log(`      → ${email}`));
  }
});

// Test 4: PIC Code Normalization
console.log('\n✓ Test 4: PIC Code Normalization');
console.log('-'.repeat(50));

const normalizationTests = [
  { code: 'sr', expected: 'SR', label: 'Lowercase' },
  { code: 'SR', expected: 'SR', label: 'Uppercase' },
  { code: 'Sr', expected: 'SR', label: 'Mixed case' },
  { code: '  SR  ', expected: 'SR', label: 'With spaces' },
];

normalizationTests.forEach((test) => {
  const email = getPicEmail(test.code);
  const status = email ? '✓' : '✗';
  console.log(`  ${status} ${test.label}: ${email || 'Not found'}`);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ All tests completed!\n');

console.log('📋 System Configuration:');
console.log('  • Maturation reminder intervals: [0, 1, 3, 7, 14]');
console.log('  • Deadline reminder intervals: [0, 1, 2, 5, 10]');
console.log('  • Max reminders per proposal per day: 1');
console.log('  • Email logging: Firestore collections\n');

console.log('🔧 Next Steps:');
console.log('  1. Set up email service integration (SendGrid/Mailgun)');
console.log('  2. Configure environment variables');
console.log('  3. Set up cron job for /api/bd/process-reminders');
console.log('  4. Test with a sample proposal\n');
