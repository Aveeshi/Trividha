const { getGeminiClient } = require("../utils/gemini");
const { cleanJsonString } = require("../utils/textUtils");
const { generateSmartFallbackDialogue, generateSmartFallbackSummary } = require("../utils/fallbacks");
const {
  createOrGetAiSession,
  saveConversationTurn,
  syncDialogueHistory,
  getSessionConversation,
  saveAiSummary,
  getLatestSummary,
  getSummaryById,
  getLatestTranscript,
  saveSummary,
  saveTranscript,
} = require("../utils/intakeStore");

// Ordered list of models to try — first available and non-rate-limited wins.
// gemini-3.5-flash / gemini-3.5-flash-lite are best daily quota options;
// heavier models (3.7, 3.8) are kept as final fallbacks.
// Prioritize gemini-3.5-flash-lite: fastest (~800ms), highest free quota, reliable.
// Follow with gemini-flash-latest and gemini-3.5-flash.
const GEMINI_CANDIDATES = [
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

/**
 * Call Gemini with automatic fast model cascade.
 * Sets maxOutputTokens to limit generation overhead and improve latency.
 */
async function callGeminiJson(prompt, temperature = 0.2, maxTokens = 600) {
  if (!process.env.GEMINI_API_KEY) return null;
  const ai = getGeminiClient();
  for (const model of GEMINI_CANDIDATES) {
    const t0 = Date.now();
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout after 8000ms")), 8000)
        ),
      ]);
      const raw = response.text || "{}";
      const parsed = JSON.parse(cleanJsonString(raw));
      if (parsed && Object.keys(parsed).length > 0) {
        console.log(`[Gemini:${model}] Responded in ${Date.now() - t0}ms`);
        return { parsed, modelUsed: model };
      }
    } catch (err) {
      const status = err?.status || "";
      console.warn(`[Gemini:${model}] Failed in ${Date.now() - t0}ms (${status} ${err?.message?.slice(0, 100)}). Trying next...`);
    }
  }
  console.error("[Gemini] All candidate models failed — using smart fallback.");
  return null;
}

const handleDialogue = async (req, res) => {
  try {
    const {
      patient,
      language = { code: "en", label: "English" },
      messages = [],
      currentStage = "CHIEF_COMPLAINT",
      extractedData = {},
      sessionId = null,
    } = req.body;

    // Create or retrieve session from Supabase ai_session table
    const aiSession = await createOrGetAiSession({
      sessionId,
      patientId: patient?.patient_id || patient?.id || null,
      languageCode: language.code || "en",
    });
    const activeSessionId = aiSession.ai_session_id;

    // Persist patient statement into ai_conversation table if provided
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        await saveConversationTurn({
          sessionId: activeSessionId,
          sequenceNumber: messages.length,
          speaker: "PATIENT",
          messageText: lastMsg.content,
        });
      }
    }

    // Build rich patient context from DB record
    const isKnownPatient = !!(patient?.name && patient.name !== "Patient");
    const patientContext = isKnownPatient
      ? `PATIENT MEDICAL RECORD (from hospital database):
  Name: ${patient.name} (${patient.age || "?"} yrs, ${patient.gender || "Unspecified"})
  ABHA ID: ${patient.abhaId || "N/A"}
  Blood Group: ${patient.bloodGroup || "Unknown"}
  Known Chronic Conditions: ${patient.knownRecords?.chronicConditions?.join(", ") || "None on file"}
  Known Allergies: ${patient.knownRecords?.allergies?.join(", ") || "None (NKDA)"}
  Current Medications: ${patient.knownRecords?.currentMedications?.join(", ") || "None on file"}
  Past Surgeries: ${patient.knownRecords?.pastSurgeries?.join(", ") || "None"}
  Last Visit: ${patient.knownRecords?.lastVisitDate || "Unknown"} — ${patient.knownRecords?.lastVisitReason || "No recent visit"}`
      : `PATIENT: Walk-in / New patient (no existing hospital records found)`;

    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const turnCount = userMessages.length;
    const isFirstTurn = turnCount === 0;
    const isFinalTurn = turnCount >= 7;

    const previousQuestionsAsked = assistantMessages.map((m) => m.content);
    const lastPatientMessage = userMessages[userMessages.length - 1]?.content || "";
    const stageProgressPercent = Math.min((turnCount + 1) * 12, 100);

    const conversationHistoryText = messages
      .map((m) => `${m.role === "assistant" ? "CareIntake AI" : "Patient"}: "${m.content}"`)
      .join("\n");

    // ── DYNAMIC SYSTEM PROMPT (no rigid roadmap) ──────────────────────────
    const systemPrompt = `
You are CareIntake AI — a warm, empathetic, multilingual pre-consultation clinical assistant at a hospital.
You are conducting a real-time voice interview with a patient BEFORE they see their doctor.
Your job is to take a thorough, natural clinical history by listening carefully to each answer and asking the most clinically relevant NEXT question.

━━━ LANGUAGE ━━━
Patient's chosen language: "${language.label}" (code: ${language.code})
- EVERY word in 'assistantMessage' and 'quickReplies' MUST be in authentic, natural ${language.label} script.
- NEVER use English in 'assistantMessage' or 'quickReplies' unless the language IS English.
- Patients may reply in native script, Romanized text, or mix English medical terms — understand all naturally.

━━━ CLINICAL INTERVIEW STYLE ━━━
- Ask ONE focused, open question per turn. Never ask two questions at once.
- Do NOT follow a fixed script or topic order. Adapt fully to what the patient says.
- After each answer, decide the MOST CLINICALLY IMPORTANT next question based on:
    → What has already been covered (never repeat)
    → Clinical relevance to the symptom described
    → SOCRATES framework (Site, Onset, Character, Radiation, Associations, Time course, Exacerbating/Relieving, Severity) — use naturally
- If the patient's known medical record is relevant, gently reference it naturally.
  Example: "Since you take Metformin for diabetes, has this affected your appetite or energy?"
- NEVER repeat, rephrase, or revisit a question already asked.

━━━ TURN FLOW ━━━
- Turn 0 (opening): Greet the patient warmly and personally (use their first name if known from DB).
  Ask ONE open-ended question about what brings them in today. Do NOT assume any symptom.
- Turns 1–6: Follow the patient's lead. Ask the MOST relevant next clinical question based on everything said.
- Turn 7+ (Final): Warmly close the interview. Confirm concerns are noted and file is sent to doctor. Set isComplete = true.

━━━ RED FLAG RULE ━━━
Sudden severe chest pain, arm/jaw radiation, stroke signs, severe breathlessness, or major bleeding:
→ Set redFlagDetected = true, severity = "CRITICAL", direct to Room 101 (Emergency) immediately.

━━━ OUTPUT — Return ONLY valid JSON ━━━
{
  "assistantMessage": "Natural spoken ${language.label} (1–2 warm sentences, no markdown, no bullets)",
  "translationEn": "Accurate English translation",
  "quickReplies": ["Reply option 1 in ${language.label}", "Option 2", "Option 3", "Option 4"],
  "stage": "CHIEF_COMPLAINT | SYMPTOM_EXPLORATION | SEVERITY_IMPACT | FUNCTIONAL_IMPACT | CLINICAL_HISTORY | SAFETY_CHECK | COMPLETE",
  "stageProgressPercent": ${stageProgressPercent},
  "redFlagDetected": false,
  "redFlagDetails": {
    "severity": "NONE",
    "alertCode": "NONE",
    "reason": "",
    "immediateAction": ""
  },
  "extractedData": {
    "chiefComplaint": "string or null",
    "bodyLocation": "string or null",
    "duration": "string or null",
    "socrates": {
      "site": "string or null",
      "onset": "string or null",
      "character": "string or null",
      "radiation": "string or null",
      "associations": "string or null",
      "timeCourse": "string or null",
      "exacerbatingRelieving": "string or null",
      "severity": "string or null"
    }
  },
  "isComplete": ${isFinalTurn}
}
`;

    // ── DYNAMIC USER PROMPT ───────────────────────────────────────────────
    const userPrompt = isFirstTurn
      ? `
${patientContext}

This is the OPENING TURN (Turn 0). No conversation has happened yet.
${isKnownPatient
  ? `Greet the patient warmly by first name (${patient.name.split(" ")[0]}). You may briefly reference 1 relevant detail from their record (e.g., last visit or known condition) to show you know them. Then ask ONE open, friendly question: what brings them in today? Do NOT assume any symptom.`
  : `Greet the walk-in patient warmly. Ask ONE open question: what brings them to the hospital today? Keep it natural and welcoming, not clinical.`
}
`
      : `
${patientContext}

━━━ CONVERSATION SO FAR ━━━
${conversationHistoryText}

━━━ QUESTIONS ALREADY ASKED — DO NOT REPEAT ━━━
${previousQuestionsAsked.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

━━━ PATIENT'S LATEST ANSWER ━━━
"${lastPatientMessage}"

Based on everything above, decide the SINGLE MOST CLINICALLY IMPORTANT next question.
Acknowledge their answer briefly (3–5 words in ${language.label}), then ask your next question naturally.
`;

    const geminiResult = await callGeminiJson(`${systemPrompt}\n\n${userPrompt}`, 0.2);
    if (geminiResult?.parsed?.assistantMessage) {
      const { parsed, modelUsed } = geminiResult;
      parsed.sessionId = activeSessionId;
      await saveConversationTurn({
        sessionId: activeSessionId,
        sequenceNumber: messages.length + 1,
        speaker: "AI",
        messageText: parsed.assistantMessage,
      });
      console.log(`[Gemini:${modelUsed}] Turn ${turnCount + 1}:`, parsed.assistantMessage);
      return res.json(parsed);
    }

    const fallbackResponse = generateSmartFallbackDialogue(
      messages,
      patient,
      language,
      currentStage,
      extractedData
    );
    fallbackResponse.sessionId = activeSessionId;
    if (fallbackResponse.assistantMessage) {
      await saveConversationTurn({
        sessionId: activeSessionId,
        sequenceNumber: messages.length + 1,
        speaker: "AI",
        messageText: fallbackResponse.assistantMessage,
      });
    }
    return res.json(fallbackResponse);
  } catch (error) {
    console.error("Error in /api/intake/dialogue:", error);
    const fallbackResponse = generateSmartFallbackDialogue(
      [],
      null,
      { code: "en", label: "English" },
      "CHIEF_COMPLAINT",
      {}
    );
    return res.json(fallbackResponse);
  }
};

const handleSummarize = async (req, res) => {
  try {
    const { patient, dialogueHistory = [], extractedData = {}, redFlagDetails = null } = req.body;

    const patientContext = patient
      ? `
Patient Profile:
Name: ${patient.name || "Patient"} (${patient.age || "?"} yrs, ${patient.gender || "Unspecified"})
ABHA ID: ${patient.abhaId || "N/A"}
Known Conditions: ${patient.knownRecords?.chronicConditions?.join(", ") || "None on file"}
Known Allergies: ${patient.knownRecords?.allergies?.join(", ") || "None (NKDA)"}
Known Medications: ${patient.knownRecords?.currentMedications?.join(", ") || "None on file"}
Known Past Surgeries: ${patient.knownRecords?.pastSurgeries?.join(", ") || "None"}
`
      : `Patient Profile: New unregistered patient`;

    const conversationTranscript = dialogueHistory
      .map(
        (m) =>
          `${m.role.toUpperCase()}: ${m.content} ${m.translationEn ? `(English: ${m.translationEn})` : ""}`
      )
      .join("\n");

    const summaryPrompt = `
You are a senior clinical informatician at an accredited hospital.
Analyze the pre-consultation patient intake interview transcript and generate a structured, pristine clinical history dossier formatted specifically for the examining physician before they start the consult.

${patientContext}

Red Flag Status: ${JSON.stringify(redFlagDetails)}
Extracted Data: ${JSON.stringify(extractedData)}

Interview Transcript:
${conversationTranscript}

Generate a comprehensive clinical summary in JSON adhering strictly to this schema:
{
  "intakeId": "INTK-${Date.now()}",
  "timestamp": "${new Date().toISOString()}",
  "patientSummary": {
    "name": "${patient?.name || "Patient"}",
    "age": ${patient?.age || 0},
    "gender": "${patient?.gender || "Unspecified"}",
    "abhaId": "${patient?.abhaId || "N/A"}"
  },
  "triageAssessment": {
    "triageLevel": "LEVEL_1_RESUSCITATION | LEVEL_2_EMERGENT | LEVEL_3_URGENT | LEVEL_4_LESS_URGENT | LEVEL_5_NON_URGENT",
    "triageColor": "red | orange | yellow | green | blue",
    "urgencyBadge": "CRITICAL EMERGENCY | HIGH PRIORITY | PRIORITY REVIEW | ROUTINE APPOINTMENT",
    "recommendedDepartment": "string (e.g. Cardiology, Pulmonology, Orthopedics, General Internal Medicine, Gastroenterology, Dermatology, Neurology)",
    "priorityQueueRank": "IMMEDIATE (0 min wait) | NEXT IN LINE (< 10 min) | STANDARD QUEUE",
    "redFlagAlert": boolean,
    "redFlagNotes": "string or null"
  },
  "clinicalHistory": {
    "chiefComplaint": "string (Concise standard clinical phrasing with onset/duration)",
    "historyOfPresentIllness": {
      "narrative": "Cohesive medical narrative in third-person clinical prose (e.g. 'Patient presents with a 3-day history of...')",
      "socratesBreakdown": {
        "site": "string (exact anatomical location)",
        "onset": "string (acute / subacute / insidious, precise duration)",
        "character": "string (quality of sensation: burning, squeezing, throbbing, etc.)",
        "radiation": "string (referred or radiating pain pathways)",
        "associations": ["string (e.g. diaphoresis, dyspnea, nausea, fever)"],
        "timeCourse": "string (constant, episodic, waxing/waning)",
        "exacerbatingRelieving": "string (aggravating and alleviating factors)",
        "severity": "string (numeric rating 1-10 and functional limitation)"
      }
    },
    "pastMedicalSurgicalHistory": {
      "existingRecordsReconfirmed": ["string"],
      "newDisclosures": ["string"],
      "surgicalHistory": ["string"]
    },
    "medicationHistory": {
      "currentRegimen": ["string"],
      "adherenceStatus": "Good / Regular | Irregular | Self-discontinued | Not Applicable",
      "newOverTheCounterMeds": ["string"]
    },
    "allergies": {
      "knownDrugAllergies": ["string"],
      "newReportedAllergies": ["string"],
      "severeReactionFlag": boolean
    },
    "familyHistory": "string",
    "personalSocialHistory": {
      "tobaccoSmoking": "string",
      "alcoholIntake": "string",
      "dietSleepNotes": "string"
    },
    "reviewOfSystems": {
      "constitutional": "string",
      "cardiovascular": "string",
      "respiratory": "string",
      "gastrointestinal": "string",
      "neurological": "string",
      "musculoskeletal": "string"
    }
  },
  "physicianQuickActions": [
    "Recommended initial pre-consult vital checks (e.g. 12-lead ECG, SpO2, Blood Glucose, BP in both arms)",
    "Suggested targeted physical exam maneuvers",
    "Initial differential diagnoses considerations (top 3)"
  ]
}
`;

    const summaryResult = await callGeminiJson(summaryPrompt, 0.1);
    if (summaryResult?.parsed) {
      const { parsed, modelUsed } = summaryResult;
      parsed.rawTranscript = conversationTranscript;
      parsed.dialogueHistory = dialogueHistory;
      parsed.language = req.body.language || "en";
      parsed.sessionId = req.body.sessionId || null;
      parsed.patient = patient;
      console.log(`[Gemini:${modelUsed}] Clinical summary generated.`);
      await saveSummary(parsed);
      return res.json(parsed);
    }

    const fallbackSummary = generateSmartFallbackSummary(patient, dialogueHistory, extractedData, redFlagDetails);
    fallbackSummary.rawTranscript = conversationTranscript;
    fallbackSummary.dialogueHistory = dialogueHistory;
    fallbackSummary.language = req.body.language || "en";
    fallbackSummary.sessionId = req.body.sessionId || null;
    fallbackSummary.patient = patient;
    await saveSummary(fallbackSummary);
    res.json(fallbackSummary);
  } catch (error) {
    console.error("Error in /api/intake/summarize:", error);
    res.status(500).json({ error: error.message || "Failed to generate structured summary" });
  }
};

const handleGetLatestSummary = async (req, res) => {
  try {
    const summary = await getLatestSummary();
    if (!summary) return res.status(404).json({ error: "No intake summaries yet in Supabase" });
    res.json(summary);
  } catch (err) {
    console.error("Error in /api/intake/summary/latest:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleGetSummaryById = async (req, res) => {
  try {
    const summary = await getSummaryById(req.params.intakeId);
    if (!summary) return res.status(404).json({ error: "Summary not found" });
    res.json(summary);
  } catch (err) {
    console.error("Error in /api/intake/summary/:intakeId:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleGetAllSummaries = async (req, res) => {
  try {
    const latest = await getLatestSummary();
    res.json({ summaries: latest ? [latest] : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const handleSaveTranscript = async (req, res) => {
  try {
    const {
      sessionId,
      intakeId,
      patient,
      language = "en",
      dialogueHistory = [],
      rawTranscript = "",
    } = req.body;

    const result = await saveTranscript({
      intakeId: sessionId || intakeId,
      patient,
      language,
      dialogueHistory,
      rawTranscript,
    });

    res.json({
      success: true,
      message: "Consultation transcript saved successfully in Supabase ai_conversation",
      ...result,
    });
  } catch (err) {
    console.error("Error in /api/intake/transcript:", err);
    res.status(500).json({ error: err.message || "Failed to save transcript" });
  }
};

const handleGetLatestTranscript = async (req, res) => {
  try {
    const record = await getLatestTranscript();
    if (!record) return res.status(404).json({ error: "No intake transcript records yet" });
    res.json(record);
  } catch (err) {
    console.error("Error in /api/intake/transcript/latest:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleGetTranscriptById = async (req, res) => {
  try {
    const conversation = await getSessionConversation(req.params.intakeId);
    res.json({
      sessionId: req.params.intakeId,
      dialogueHistory: conversation.map((c) => ({
        speaker: c.speaker,
        role: c.speaker === "AI" ? "assistant" : "user",
        content: c.message_text,
        sequenceNumber: c.sequence_number,
        timestamp: c.timestamp,
      })),
    });
  } catch (err) {
    console.error("Error in /api/intake/transcript/:intakeId:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleGetAllTranscripts = async (req, res) => {
  try {
    const latest = await getLatestTranscript();
    res.json({ transcripts: latest ? [latest] : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  handleDialogue,
  handleSummarize,
  handleGetLatestSummary,
  handleGetSummaryById,
  handleGetAllSummaries,
  handleSaveTranscript,
  handleGetLatestTranscript,
  handleGetTranscriptById,
  handleGetAllTranscripts,
};


