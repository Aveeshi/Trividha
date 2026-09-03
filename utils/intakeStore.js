const fs = require("fs");
const path = require("path");
const { query, pool, TRANSCRIPTS_DIR } = require("./kioskDb");

// In-memory cache for language code -> language_id mapping
let languageCache = null;

async function getLanguageMap() {
  if (languageCache) return languageCache;
  try {
    const res = await query("SELECT language_id, language_code FROM language WHERE is_active = true;");
    languageCache = {};
    res.rows.forEach((r) => {
      languageCache[r.language_code.toLowerCase()] = r.language_id;
    });
    return languageCache;
  } catch (err) {
    console.error("Failed to load language map from Supabase:", err);
    return { en: 23, hi: 6 };
  }
}

async function resolveLanguageId(langCode = "en") {
  const map = await getLanguageMap();
  const clean = String(langCode || "en").toLowerCase().trim();
  return map[clean] || map["en"] || 23;
}

// Fallback patient UUID from Supabase patient table
let defaultPatientIdCache = null;

async function getDefaultPatientId() {
  if (defaultPatientIdCache) return defaultPatientIdCache;
  try {
    const res = await query("SELECT patient_id FROM patient ORDER BY created_at ASC LIMIT 1;");
    if (res.rows.length > 0) {
      defaultPatientIdCache = res.rows[0].patient_id;
      return defaultPatientIdCache;
    }
  } catch (err) {
    console.error("Failed to query default patient from Supabase:", err);
  }
  return "3c4c13cb-559b-446e-9dae-c0ad2341b73a"; // Seeded Aveeshi Kaushik UUID
}

/**
 * 1. AI_SESSION: Create or retrieve session
 */
async function createOrGetAiSession({
  sessionId = null,
  patientId = null,
  appointmentId = null,
  sessionType = "GENERAL_SYMPTOM_INTERVIEW",
  languageCode = "en",
}) {
  const langId = await resolveLanguageId(languageCode);
  const finalPatientId = patientId || (await getDefaultPatientId());
  const validSessionType =
    sessionType === "AYUSH_INTERVIEW" ? "AYUSH_INTERVIEW" : "GENERAL_SYMPTOM_INTERVIEW";

  if (sessionId) {
    const existing = await query("SELECT * FROM ai_session WHERE ai_session_id = $1;", [sessionId]);
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  const insertSql = `
    INSERT INTO ai_session (
      ai_session_id, patient_id, appointment_id, session_type, language_id, status, started_at
    ) VALUES (
      COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, 'IN_PROGRESS', now()
    )
    RETURNING *;
  `;

  const res = await query(insertSql, [sessionId, finalPatientId, appointmentId, validSessionType, langId]);
  return res.rows[0];
}

/**
 * Update ai_session status to COMPLETED
 */
async function completeAiSession(sessionId) {
  if (!sessionId) return null;
  const sql = `
    UPDATE ai_session
    SET status = 'COMPLETED', completed_at = now()
    WHERE ai_session_id = $1
    RETURNING *;
  `;
  const res = await query(sql, [sessionId]);
  return res.rows[0] || null;
}

/**
 * 2. AI_CONVERSATION: Record a single turn
 */
async function saveConversationTurn({
  sessionId,
  sequenceNumber,
  speaker, // 'PATIENT' or 'AI'
  messageText,
  audioReference = null,
}) {
  if (!sessionId || !messageText) return null;

  const validSpeaker =
    String(speaker).toUpperCase() === "AI" || String(speaker).toLowerCase() === "assistant"
      ? "AI"
      : "PATIENT";

  const sql = `
    INSERT INTO ai_conversation (
      ai_session_id, sequence_number, speaker, message_text, audio_reference, timestamp
    ) VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT (ai_session_id, sequence_number)
    DO UPDATE SET
      speaker = EXCLUDED.speaker,
      message_text = EXCLUDED.message_text,
      audio_reference = EXCLUDED.audio_reference,
      timestamp = now()
    RETURNING *;
  `;

  const res = await query(sql, [sessionId, sequenceNumber, validSpeaker, messageText, audioReference]);
  return res.rows[0];
}

/**
 * 2. AI_CONVERSATION: Batch sync dialogue history for a session
 */
async function syncDialogueHistory(sessionId, messages = []) {
  if (!sessionId || !Array.isArray(messages) || messages.length === 0) return [];

  const saved = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const speaker = m.role === "assistant" || m.speaker === "AI" ? "AI" : "PATIENT";
    const content = m.content || m.message_text || "";
    if (content.trim()) {
      const turn = await saveConversationTurn({
        sessionId,
        sequenceNumber: i + 1,
        speaker,
        messageText: content,
      });
      if (turn) saved.push(turn);
    }
  }
  return saved;
}

/**
 * 2. AI_CONVERSATION: Fetch full verbatim transcript for a session
 */
async function getSessionConversation(sessionId) {
  if (!sessionId) return [];
  const sql = `
    SELECT
      conversation_id,
      ai_session_id,
      sequence_number,
      speaker,
      message_text,
      audio_reference,
      timestamp
    FROM ai_conversation
    WHERE ai_session_id = $1
    ORDER BY sequence_number ASC;
  `;
  const res = await query(sql, [sessionId]);
  return res.rows;
}

/**
 * 3. AI_SUMMARY: Save structured clinical summary
 */
async function saveAiSummary({
  sessionId,
  appointmentId = null,
  summaryText = "",
  structuredSummaryJson = {},
}) {
  if (!sessionId) return null;

  // Ensure session is marked completed
  await completeAiSession(sessionId);

  const fallbackNarrative =
    summaryText ||
    structuredSummaryJson.clinicalHistory?.chiefComplaint ||
    structuredSummaryJson.clinicalHistory?.historyOfPresentIllness?.narrative ||
    "Pre-consultation clinical intake completed.";

  const sql = `
    INSERT INTO ai_summary (
      ai_session_id, appointment_id, summary_text, structured_summary_json, generated_at, reviewed_by_doctor
    ) VALUES ($1, $2, $3, $4, now(), false)
    ON CONFLICT (ai_session_id)
    DO UPDATE SET
      summary_text = EXCLUDED.summary_text,
      structured_summary_json = EXCLUDED.structured_summary_json,
      generated_at = now()
    RETURNING *;
  `;

  const res = await query(sql, [
    sessionId,
    appointmentId,
    fallbackNarrative,
    JSON.stringify(structuredSummaryJson),
  ]);

  return res.rows[0];
}

/**
 * Fetch latest summary with full conversation from Supabase
 */
async function getLatestSummary() {
  const summarySql = `
    SELECT 
      s.summary_id,
      s.ai_session_id,
      s.appointment_id,
      s.summary_text,
      s.structured_summary_json,
      s.generated_at,
      s.reviewed_by_doctor,
      s.reviewed_at,
      sess.patient_id,
      sess.session_type,
      sess.status AS session_status,
      sess.started_at,
      sess.completed_at,
      p.first_name,
      p.last_name,
      p.abha_id,
      p.phone_number,
      p.gender,
      p.date_of_birth
    FROM ai_summary s
    JOIN ai_session sess ON s.ai_session_id = sess.ai_session_id
    LEFT JOIN patient p ON sess.patient_id = p.patient_id
    ORDER BY s.generated_at DESC
    LIMIT 1;
  `;

  const res = await query(summarySql);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const conversation = await getSessionConversation(row.ai_session_id);

  // Map to structured format expected by UI
  const structured =
    typeof row.structured_summary_json === "string"
      ? JSON.parse(row.structured_summary_json)
      : row.structured_summary_json || {};

  structured.intakeId = row.ai_session_id;
  structured.timestamp = row.generated_at;
  structured.patientSummary = structured.patientSummary || {
    name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Patient",
    gender: row.gender || "Unspecified",
    abhaId: row.abha_id || "N/A",
  };

  // Attach verbatim transcript from ai_conversation table
  structured.dialogueHistory = conversation.map((c) => ({
    role: c.speaker === "AI" ? "assistant" : "user",
    speaker: c.speaker,
    content: c.message_text,
    sequenceNumber: c.sequence_number,
    timestamp: c.timestamp,
  }));

  structured.rawTranscript = conversation
    .map((c) => `${c.speaker}: "${c.message_text}"`)
    .join("\n");

  return structured;
}

/**
 * Fetch summary by intakeId / sessionId
 */
async function getSummaryById(sessionId) {
  if (!sessionId) return null;
  const sql = `
    SELECT 
      s.summary_id,
      s.ai_session_id,
      s.appointment_id,
      s.summary_text,
      s.structured_summary_json,
      s.generated_at,
      s.reviewed_by_doctor
    FROM ai_summary s
    WHERE s.ai_session_id = $1;
  `;
  const res = await query(sql, [sessionId]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const conversation = await getSessionConversation(sessionId);
  const structured = row.structured_summary_json || {};
  structured.intakeId = row.ai_session_id;
  structured.dialogueHistory = conversation.map((c) => ({
    role: c.speaker === "AI" ? "assistant" : "user",
    speaker: c.speaker,
    content: c.message_text,
    sequenceNumber: c.sequence_number,
    timestamp: c.timestamp,
  }));
  return structured;
}

/**
 * Fetch latest transcript from ai_conversation
 */
async function getLatestTranscript() {
  const sessionRes = await query(`
    SELECT sess.ai_session_id, sess.started_at, sess.session_type, sess.status,
           p.first_name, p.last_name, l.language_code
    FROM ai_session sess
    LEFT JOIN patient p ON sess.patient_id = p.patient_id
    LEFT JOIN language l ON sess.language_id = l.language_id
    ORDER BY sess.started_at DESC
    LIMIT 1;
  `);

  if (sessionRes.rows.length === 0) return null;
  const sess = sessionRes.rows[0];
  const conversation = await getSessionConversation(sess.ai_session_id);

  const patientName = `${sess.first_name || ""} ${sess.last_name || ""}`.trim() || "Patient";

  const rawTranscript = conversation
    .map((c) => `${c.speaker}: "${c.message_text}"`)
    .join("\n");

  const dialogueHistory = conversation.map((c) => ({
    role: c.speaker === "AI" ? "assistant" : "user",
    speaker: c.speaker,
    content: c.message_text,
    sequenceNumber: c.sequence_number,
    timestamp: c.timestamp,
  }));

  // Also write text file backup
  const safeName = patientName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${sess.ai_session_id}_${safeName}.txt`;
  const filePath = path.join(TRANSCRIPTS_DIR, fileName);

  try {
    let fileContent = `================================================================================\n`;
    fileContent += `SUPABASE DATABASE TRANSCRIPT (ai_session & ai_conversation)\n`;
    fileContent += `================================================================================\n`;
    fileContent += `Session ID:   ${sess.ai_session_id}\n`;
    fileContent += `Patient:      ${patientName}\n`;
    fileContent += `Language:     ${sess.language_code || "en"}\n`;
    fileContent += `Started At:   ${sess.started_at}\n`;
    fileContent += `Total Turns:  ${conversation.length}\n`;
    fileContent += `================================================================================\n\n`;
    fileContent += rawTranscript;
    fileContent += `\n\n================================================================================\n`;
    fs.writeFileSync(filePath, fileContent, "utf8");
  } catch (e) {
    // Ignore file write errors
  }

  return {
    intakeId: sess.ai_session_id,
    patientName,
    language: sess.language_code || "en",
    createdAt: sess.started_at,
    rawTranscript,
    dialogueHistory,
    filePath,
  };
}

/**
 * Backward compatibility wrapper for saveSummary
 */
async function saveSummary(summary) {
  const sessionId = summary.sessionId || summary.intakeId || summary.patientSummary?.sessionId;
  const session = await createOrGetAiSession({
    sessionId: sessionId || null,
    patientId: summary.patient?.patient_id || summary.patientId || null,
    languageCode: summary.language?.code || summary.language || "en",
  });

  const finalSessionId = session.ai_session_id;

  // Sync dialogue history to ai_conversation table
  if (Array.isArray(summary.dialogueHistory) && summary.dialogueHistory.length > 0) {
    await syncDialogueHistory(finalSessionId, summary.dialogueHistory);
  }

  // Save structured summary to ai_summary table
  await saveAiSummary({
    sessionId: finalSessionId,
    appointmentId: summary.appointmentId || null,
    summaryText: summary.clinicalHistory?.chiefComplaint || summary.summaryText || "",
    structuredSummaryJson: summary,
  });

  summary.intakeId = finalSessionId;
  return summary;
}

/**
 * Backward compatibility wrapper for saveTranscript
 */
async function saveTranscript({
  intakeId,
  patient,
  patientName,
  language = "en",
  dialogueHistory = [],
  rawTranscript = "",
}) {
  const session = await createOrGetAiSession({
    sessionId: intakeId || null,
    patientId: patient?.patient_id || null,
    languageCode: typeof language === "object" ? language.code : language,
  });

  const finalSessionId = session.ai_session_id;

  if (Array.isArray(dialogueHistory) && dialogueHistory.length > 0) {
    await syncDialogueHistory(finalSessionId, dialogueHistory);
  }

  return {
    intakeId: finalSessionId,
    patientName: patientName || patient?.name || "Patient",
    dialogueHistory,
    rawTranscript,
  };
}

module.exports = {
  createOrGetAiSession,
  completeAiSession,
  saveConversationTurn,
  syncDialogueHistory,
  getSessionConversation,
  saveAiSummary,
  getLatestSummary,
  getSummaryById,
  getLatestTranscript,
  saveSummary,
  saveTranscript,
};


