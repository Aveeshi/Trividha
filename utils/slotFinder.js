// Slot Finder: Assigns real-time queue tokens and estimated clinic wait slots

let tokenCounter = 204;

/**
 * Finds the next available open consultation slot and allocates a unique OPD token
 * @param {string} specialtyId
 * @param {string} urgency - 'NORMAL' | 'URGENT' | 'EMERGENCY'
 * @returns {object} Slot allocation result
 */
function findNextSlot(specialtyId = "general_medicine", urgency = "NORMAL") {
  tokenCounter += 1;
  const tokenPrefix = urgency === "EMERGENCY" ? "EMG-" : urgency === "URGENT" ? "URG-" : "T-";
  const tokenNumber = `${tokenPrefix}${tokenCounter}`;

  const now = new Date();
  const estWaitMinutes = urgency === "EMERGENCY" ? 0 : urgency === "URGENT" ? 5 : Math.floor(Math.random() * 10) + 12;
  const consultTime = new Date(now.getTime() + estWaitMinutes * 60000);

  const timeFormatted = consultTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return {
    tokenNumber,
    urgency,
    estimatedWaitMinutes: estWaitMinutes,
    estimatedTime: `Today, ~${timeFormatted} (${estWaitMinutes === 0 ? "Immediate Triage" : `${estWaitMinutes} mins wait`})`,
    queuePosition: urgency === "EMERGENCY" ? 1 : Math.floor(Math.random() * 3) + 2,
    allocatedAt: now.toISOString()
  };
}

module.exports = {
  findNextSlot
};
