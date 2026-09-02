document.addEventListener("DOMContentLoaded", () => {
  let currentLangCode = "en";
  let isSessionActive = false;
  let isComplete = false;
  let currentStage = "CHIEF_COMPLAINT";
  let dialogueMessages = [];
  let extractedData = {};
  let sessionSaved = false;
  let currentSessionId = null;
  
  const ui = {
    langBtn: document.getElementById("langBtn"),
    langDisplay: document.getElementById("langDisplay"),
    langNotice: document.getElementById("langNotice"),
    langModal: document.getElementById("langModal"),
    langList: document.getElementById("langList"),
    closeLangBtn: document.getElementById("closeLangBtn"),
    
    mainStatusText: document.getElementById("mainStatusText"),
    dialogueContainer: document.getElementById("dialogueContainer"),
    assistantText: document.getElementById("assistantText"),
    assistantTranslation: document.getElementById("assistantTranslation"),
    quickRepliesContainer: document.getElementById("quickRepliesContainer"),
    
    transcribeContainer: document.getElementById("transcribeContainer"),
    transcribeText: document.getElementById("transcribeText"),
    
    micBtn: document.getElementById("micBtn"),
    micIcon: document.getElementById("micIcon"),
    micLabel: document.getElementById("micLabel"),
    micOuterRing: document.getElementById("micOuterRing"),
    resetBtn: document.getElementById("resetBtn")
  };

  // Populate Languages
  ALL_LANGUAGES.forEach(lang => {
    const btn = document.createElement("button");
    btn.className = "kiosk-lang-option";
    btn.innerHTML = `<span class="kiosk-lang-option-native">${lang.native}</span><span class="kiosk-lang-option-english">${lang.english}</span>`;
    btn.onclick = () => {
      currentLangCode = lang.code;
      ui.langDisplay.innerText = lang.native;
      ui.langNotice.innerText = `Speaks in ${lang.native}`;
      ui.langModal.classList.add("hidden");
      speechEngine.stopSpeaking();
      if (isSessionActive && !isComplete) {
        initiateTurn();
      }
    };
    ui.langList.appendChild(btn);
  });

  ui.langBtn.onclick = () => ui.langModal.classList.remove("hidden");
  ui.closeLangBtn.onclick = () => ui.langModal.classList.add("hidden");

  // Mic Logic
  ui.micBtn.onclick = () => {
    if (!isSessionActive) {
      isSessionActive = true;
      initiateTurn();
    } else {
      if (speechEngine.isListening()) {
        speechEngine.stopListening();
        ui.micBtn.classList.remove("mic-listening");
        updateMicState("Tap to Answer", "mic");
      } else if (speechEngine.isSpeaking()) {
        speechEngine.stopSpeaking();
        startListening();
      } else {
        startListening();
      }
    }
  };

  ui.resetBtn.onclick = () => {
    if (!sessionSaved && dialogueMessages.length > 0) {
      const langMeta = ALL_LANGUAGES.find(l => l.code === currentLangCode);
      saveSessionData(langMeta, {});
    }
    sessionSaved = false;
    currentSessionId = null;
    isSessionActive = false;
    isComplete = false;
    currentStage = "CHIEF_COMPLAINT";
    dialogueMessages = [];
    extractedData = {};
    speechEngine.stopSpeaking();
    speechEngine.stopListening();
    ui.dialogueContainer.classList.add("hidden");
    ui.transcribeContainer.classList.add("hidden");
    updateMicState("Start", "mic");
    ui.mainStatusText.innerText = "Tap the microphone to speak";
  };

  function updateMicState(label, iconName) {
    ui.micLabel.innerText = label;
    // Basic lucide re-render
    ui.micIcon.setAttribute("data-lucide", iconName);
    lucide.createIcons();
  }

  function startListening() {
    if (isComplete) return;
    ui.transcribeContainer.classList.remove("hidden");
    ui.transcribeText.innerText = "...";
    updateMicState("Listening", "mic");
    ui.micBtn.classList.add("mic-listening");
    ui.mainStatusText.innerText = "Listening to you...";

    const langMeta = ALL_LANGUAGES.find(l => l.code === currentLangCode);
    speechEngine.startListening(
      langMeta.locale,
      (interim) => { ui.transcribeText.innerText = interim; },
      (final) => {
        ui.transcribeText.innerText = final;
        ui.micBtn.classList.remove("mic-listening");
        setTimeout(() => handleUserReply(final), 500);
      },
      (err) => {
        ui.micBtn.classList.remove("mic-listening");
        updateMicState("Tap to Answer", "mic");
      }
    );
  }

  function handleUserReply(text) {
    if (!text.trim()) return;
    ui.transcribeContainer.classList.add("hidden");
    dialogueMessages.push({ role: "user", content: text, timestamp: new Date().toISOString() });
    initiateTurn();
  }

  async function initiateTurn() {
    ui.mainStatusText.innerText = "Thinking...";
    updateMicState("Thinking", "loader");
    
    const langMeta = ALL_LANGUAGES.find(l => l.code === currentLangCode);

    try {
      const res = await fetch("/api/intake/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          language: { code: langMeta.code, label: langMeta.english },
          messages: dialogueMessages,
          currentStage,
          extractedData
        })
      });
      const data = await res.json();
      if (data.sessionId) currentSessionId = data.sessionId;
      
      const aiText = data.assistantMessage || "How can I help?";
      dialogueMessages.push({ role: "assistant", content: aiText, translationEn: data.translationEn });
      currentStage = data.stage || currentStage;
      if (data.extractedData) Object.assign(extractedData, data.extractedData);
      
      ui.dialogueContainer.classList.remove("hidden");
      ui.assistantText.innerText = `"${aiText}"`;
      ui.assistantTranslation.innerText = data.translationEn ? `(Eng: ${data.translationEn})` : "";
      
      ui.quickRepliesContainer.innerHTML = "";
      if (data.quickReplies && !data.isComplete) {
        data.quickReplies.forEach(reply => {
          const rBtn = document.createElement("button");
          rBtn.className = "kiosk-quick-reply-btn";
          rBtn.innerText = reply;
          rBtn.onclick = () => {
            speechEngine.stopSpeaking();
            handleUserReply(reply);
          };
          ui.quickRepliesContainer.appendChild(rBtn);
        });
      }

      isComplete = !!data.isComplete;
      
      if (data.redFlagDetected) {
        speechEngine.playEmergencyChime();
        ui.mainStatusText.innerHTML = `<span class="kiosk-emergency-text">EMERGENCY: ${data.redFlagDetails.reason}</span>`;
      } else if (isComplete) {
        ui.mainStatusText.innerText = "Consultation Complete";
        updateMicState("Done", "check-circle");
        saveSessionData(langMeta, data);
      } else {
        ui.mainStatusText.innerText = "Speaking...";
        updateMicState("Speaking", "volume-2");
      }

      speechEngine.speak(aiText, langMeta.locale, langMeta.code, data.translationEn, null, () => {
        if (!isComplete) {
          updateMicState("Tap to Answer", "mic");
          ui.mainStatusText.innerText = "Tap mic or select an answer";
          startListening();
        }
      });
    } catch (e) {
      console.error(e);
      ui.mainStatusText.innerText = "Error connecting to AI";
      updateMicState("Retry", "refresh-cw");
    }
  }

  async function saveSessionData(langMeta, lastTurnData) {
    if (sessionSaved || dialogueMessages.length === 0) return;
    sessionSaved = true;

    try {
      // 1. Direct save of complete verbatim transcript to Supabase ai_conversation and file
      await fetch("/api/intake/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          language: { code: langMeta.code, label: langMeta.english },
          dialogueHistory: dialogueMessages,
          extractedData: extractedData
        })
      });

      // 2. Generate and save clinical summary dossier into Supabase ai_summary table
      await fetch("/api/intake/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          language: { code: langMeta.code, label: langMeta.english },
          dialogueHistory: dialogueMessages,
          extractedData: extractedData,
          redFlagDetails: lastTurnData?.redFlagDetails || null
        })
      });

      console.log("Consultation transcript and summary saved to Supabase (ai_session, ai_conversation, ai_summary).");
    } catch (saveErr) {
      console.error("Failed to auto-save intake consultation to Supabase:", saveErr);
    }
  }
});

