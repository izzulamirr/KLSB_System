/**
 * Reminder Scheduler
 * Checks for proposals with upcoming deadlines and maturation dates
 * Sends reminders at configurable intervals
 */

import { getPicEmails } from "./picEmailMap";
import {
  sendMaturationReminder,
  sendDeadlineReminder,
} from "./emailService";
import { filterEmailNotificationRecipients } from "./notificationPreferences";
import initAdmin from "./firebaseAdmin";

/**
 * Calculate days remaining until a date
 * @param {string|Date} targetDate - Date in YYYY-MM-DD format or Date object
 * @returns {number} Days remaining (negative if date is in the past)
 */
export function calculateDaysRemaining(targetDate) {
  if (!targetDate) return null;

  const target = typeof targetDate === "string" 
    ? new Date(`${targetDate}T00:00:00`) 
    : new Date(targetDate);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if reminder should be sent based on days remaining
 * @param {number} daysRemaining - Days remaining
 * @param {string} reminderType - "maturation" or "deadline"
 * @returns {boolean} Whether to send reminder
 */
export function shouldSendReminder(daysRemaining, reminderType) {
  if (daysRemaining === null || daysRemaining === undefined) return false;
  
  // Send reminders for these specific days
  // Adjust these intervals based on your requirements
  const maturationIntervals = [0, 1, 3, 7, 14]; // On day 0, 1, 3, 7, 14 before maturation
  const deadlineIntervals = [0, 1, 2, 5, 10]; // On day 0, 1, 2, 5, 10 before deadline
  
  const intervals = reminderType === "maturation" ? maturationIntervals : deadlineIntervals;
  
  // Only send if days is positive and in our intervals, or if it's overdue (negative)
  return daysRemaining >= 0 && intervals.includes(daysRemaining);
}

/**
 * Check if reminder was already sent today for a proposal
 * @param {Object} admin - Firebase admin instance
 * @param {string} proposalId - Proposal ID
 * @param {string} reminderType - "maturation" or "deadline"
 * @returns {Promise<boolean>}
 */
export async function wasReminderSentToday(admin, proposalId, reminderType) {
  const db = admin.firestore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const snapshot = await db
    .collection("email_reminders_log")
    .where("proposalId", "==", proposalId)
    .where("reminderType", "==", reminderType)
    .where("sentAt", ">=", today)
    .where("sentAt", "<", tomorrow)
    .get();

  return !snapshot.empty;
}

/**
 * Process all proposals and send reminders
 * @param {Object} admin - Firebase admin instance
 * @returns {Promise<Object>} Summary of reminders sent
 */
export async function processReminders(admin) {
  const db = admin.firestore();
  const collectionName = process.env.BD_PROPOSALS_COLLECTION || "bd_proposals";

  const snapshot = await db
    .collection(collectionName)
    .where("status", "in", ["PENDING", "ON-GOING"])
    .get();

  const summary = {
    processed: 0,
    maturationReminders: 0,
    deadlineReminders: 0,
    errors: [],
  };

  for (const doc of snapshot.docs) {
    const proposal = { id: doc.id, ...doc.data() };
    summary.processed++;

    try {
      // Process maturation reminders
      if (proposal.maturityOnDate) {
        const daysUntilMaturity = calculateDaysRemaining(proposal.maturityOnDate);
        const alreadySent = await wasReminderSentToday(admin, doc.id, "maturation");

        if (shouldSendReminder(daysUntilMaturity, "maturation") && !alreadySent) {
          const picEmails = await filterEmailNotificationRecipients(getPicEmails(proposal.personInCharge));
          if (picEmails.length > 0) {
            await sendMaturationReminder(proposal, picEmails, daysUntilMaturity);
            
            // Log the reminder
            await db.collection("email_reminders_log").add({
              proposalId: doc.id,
              proposalRefNo: proposal.refNo,
              personInCharge: proposal.personInCharge,
              reminderType: "maturation",
              maturityOnDate: proposal.maturityOnDate,
              daysRemaining: daysUntilMaturity,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              status: "sent",
              recipients: picEmails,
            });

            summary.maturationReminders++;
          }
        }
      }

      // Process deadline reminders
      if (proposal.deadline) {
        const daysUntilDeadline = calculateDaysRemaining(proposal.deadline);
        const alreadySent = await wasReminderSentToday(admin, doc.id, "deadline");

        if (shouldSendReminder(daysUntilDeadline, "deadline") && !alreadySent) {
          const picEmails = await filterEmailNotificationRecipients(getPicEmails(proposal.personInCharge));
          if (picEmails.length > 0) {
            await sendDeadlineReminder(proposal, picEmails, daysUntilDeadline);
            
            // Log the reminder
            await db.collection("email_reminders_log").add({
              proposalId: doc.id,
              proposalRefNo: proposal.refNo,
              personInCharge: proposal.personInCharge,
              reminderType: "deadline",
              deadline: proposal.deadline,
              daysRemaining: daysUntilDeadline,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              status: "sent",
              recipients: picEmails,
            });

            summary.deadlineReminders++;
          }
        }
      }
    } catch (error) {
      summary.errors.push({
        proposalId: doc.id,
        proposalRefNo: proposal.refNo,
        error: error.message,
      });
      console.error(`Error processing reminders for proposal ${doc.id}:`, error);
    }
  }

  return summary;
}
