/**
 * Reminder Utilities for Client-Side Display
 * Provides helper functions for displaying reminder information in the UI
 */

/**
 * Calculate days remaining until a date
 * @param {string} targetDate - Date in YYYY-MM-DD format
 * @returns {number} Days remaining (0 = today, negative = overdue)
 */
export function calculateDaysUntil(targetDate) {
  if (!targetDate) return null;

  const target = new Date(`${targetDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get urgency badge style based on days remaining
 * @param {number} daysRemaining - Days until deadline/maturity
 * @param {string} type - "deadline" or "maturation"
 * @returns {Object} Badge configuration {color, emoji, label}
 */
export function getUrgencyBadge(daysRemaining, type = "deadline") {
  if (daysRemaining === null || daysRemaining === undefined) {
    return { color: "gray", emoji: "📋", label: "Pending", className: "bg-gray-100 text-gray-700" };
  }

  if (type === "deadline") {
    if (daysRemaining <= 0) {
      return { color: "red", emoji: "🚨", label: "OVERDUE", className: "bg-red-100 text-red-700 animate-pulse" };
    } else if (daysRemaining === 1) {
      return { color: "red", emoji: "🔴", label: "CRITICAL", className: "bg-red-100 text-red-700 font-bold" };
    } else if (daysRemaining <= 2) {
      return { color: "red", emoji: "🔴", label: "CRITICAL", className: "bg-red-100 text-red-700" };
      } else if (daysRemaining <= 3) {
      return { color: "orange", emoji: "🟡", label: "IMPORTANT", className: "bg-orange-100 text-orange-700" };
      } else if (daysRemaining <= 4) {
      return { color: "orange", emoji: "🟡", label: "IMPORTANT", className: "bg-orange-100 text-orange-700" };
    } else if (daysRemaining <= 5) {
      return { color: "orange", emoji: "🟡", label: "IMPORTANT", className: "bg-orange-100 text-orange-700" };
      } else if (daysRemaining <= 6) {
      return { color: "orange", emoji: "🟡", label: "UPCOMING", className: "bg-orange-100 text-orange-700" };
    } else if (daysRemaining <= 7) {
      return { color: "yellow", emoji: "🟡", label: "UPCOMING", className: "bg-yellow-100 text-yellow-700" };
    } else {
      return { color: "blue", emoji: "🔵", label: "SCHEDULED", className: "bg-blue-100 text-blue-700" };
    }
  }

  // For maturation reminders
  if (daysRemaining <= 0) {
    return { color: "red", emoji: "⚠️", label: "TODAY", className: "bg-red-100 text-red-700 animate-pulse" };
  } else if (daysRemaining === 1) {
    return { color: "orange", emoji: "🔴", label: "TOMORROW", className: "bg-orange-100 text-orange-700 font-bold" };
  } else if (daysRemaining <= 3) {
    return { color: "orange", emoji: "🟡", label: "SOON", className: "bg-orange-100 text-orange-700" };
  } else if (daysRemaining <= 7) {
    return { color: "yellow", emoji: "🟡", label: "UPCOMING", className: "bg-yellow-100 text-yellow-700" };
  } else {
    return { color: "blue", emoji: "🔵", label: "REMINDER", className: "bg-blue-100 text-blue-700" };
  }
}

/**
 * Format days remaining for display
 * @param {number} daysRemaining
 * @returns {string} Formatted text like "5 days", "Tomorrow", "Today", "Overdue by 2 days"
 */
export function formatDaysRemaining(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) {
    return "-";
  }

  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `Overdue by ${days} day${days !== 1 ? "s" : ""}`;
  }

  if (daysRemaining === 0) {
    return "Today";
  }

  if (daysRemaining === 1) {
    return "Tomorrow";
  }

  return `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
}

/**
 * Get next reminder dates for a proposal
 * @param {number} daysRemaining
 * @param {string} type - "deadline" or "maturation"
 * @returns {Array<number>} Days on which reminders will be sent
 */
export function getNextReminderDays(daysRemaining, type = "deadline") {
  const maturationIntervals = [0, 1, 3, 7, 14];
  const deadlineIntervals = [0, 1, 2, 5, 10];

  const intervals = type === "maturation" ? maturationIntervals : deadlineIntervals;

  if (daysRemaining === null || daysRemaining === undefined) {
    return intervals;
  }

  // Filter to only future reminders
  return intervals.filter((day) => day <= daysRemaining);
}

/**
 * Get formatted reminder schedule
 * @param {number} daysRemaining
 * @param {string} type - "deadline" or "maturation"
 * @returns {string} Human-readable reminder schedule
 */
export function formatReminderSchedule(daysRemaining, type = "deadline") {
  const nextReminders = getNextReminderDays(daysRemaining, type);

  if (nextReminders.length === 0) {
    return "No reminders scheduled";
  }

  const formatted = nextReminders.map((day) => {
    if (day === 0) return "Today";
    if (day === 1) return "Tomorrow";
    return `${day} days from now`;
  });

  return `Reminders: ${formatted.join(", ")}`;
}

/**
 * Check if a reminder should be sent today
 * @param {number} daysRemaining
 * @param {string} type - "deadline" or "maturation"
 * @returns {boolean}
 */
export function isReminderDueToday(daysRemaining, type = "deadline") {
  const maturationIntervals = [0, 1, 3, 7, 14];
  const deadlineIntervals = [0, 1, 2, 5, 10];

  const intervals = type === "maturation" ? maturationIntervals : deadlineIntervals;
  return daysRemaining >= 0 && intervals.includes(daysRemaining);
}

/**
 * Get reminder frequency information
 * @param {string} type - "deadline" or "maturation"
 * @returns {Object} Reminder configuration info
 */
export function getReminderInfo(type = "deadline") {
  if (type === "maturation") {
    return {
      intervals: [0, 1, 3, 7, 14],
      description: "Reminders will be sent 0, 1, 3, 7, and 14 days before maturation",
      count: 5,
    };
  }

  return {
    intervals: [0, 1, 2, 5, 10],
    description: "Reminders will be sent 0, 1, 2, 5, and 10 days before deadline",
    count: 5,
  };
}

/**
 * Get status color class for different situations
 * @param {Object} proposal - Proposal object
 * @returns {string} Tailwind CSS class for status
 */
export function getProposalStatusClass(proposal) {
  if (!proposal.deadline && !proposal.maturityOnDate) {
    return "bg-gray-50";
  }

  const deadlineRemaining = calculateDaysUntil(proposal.deadline);
  const maturityRemaining = calculateDaysUntil(proposal.maturityOnDate);

  // Check if either is overdue or critical
  if ((deadlineRemaining !== null && deadlineRemaining < 0) || 
      (maturityRemaining !== null && maturityRemaining < 0)) {
    return "bg-red-50";
  }

  if ((deadlineRemaining !== null && deadlineRemaining <= 2) || 
      (maturityRemaining !== null && maturityRemaining <= 2)) {
    return "bg-orange-50";
  }

  if ((deadlineRemaining !== null && deadlineRemaining <= 5) || 
      (maturityRemaining !== null && maturityRemaining <= 5)) {
    return "bg-yellow-50";
  }

  return "bg-white";
}

/**
 * Generate reminder notification text
 * @param {Object} proposal - Proposal object
 * @returns {string|null} Notification text or null if no urgent reminders
 */
export function generateReminderNotification(proposal) {
  const deadlineRemaining = calculateDaysUntil(proposal.deadline);
  const maturityRemaining = calculateDaysUntil(proposal.maturityOnDate);

  if (deadlineRemaining !== null && deadlineRemaining <= 5) {
    if (deadlineRemaining < 0) {
      return `⚠️ Deadline overdue by ${Math.abs(deadlineRemaining)} day${Math.abs(deadlineRemaining) !== 1 ? "s" : ""}`;
    }
    return `📌 Deadline: ${formatDaysRemaining(deadlineRemaining)}`;
  }

  if (maturityRemaining !== null && maturityRemaining <= 7) {
    if (maturityRemaining < 0) {
      return `⚠️ Maturation overdue by ${Math.abs(maturityRemaining)} day${Math.abs(maturityRemaining) !== 1 ? "s" : ""}`;
    }
    return `📌 Maturation: ${formatDaysRemaining(maturityRemaining)}`;
  }

  return null;
}

/**
 * Export all utilities as an object for convenience
 */
export const ReminderUtils = {
  calculateDaysUntil,
  getUrgencyBadge,
  formatDaysRemaining,
  getNextReminderDays,
  formatReminderSchedule,
  isReminderDueToday,
  getReminderInfo,
  getProposalStatusClass,
  generateReminderNotification,
};

export default ReminderUtils;
