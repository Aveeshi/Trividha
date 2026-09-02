const INDIC_VOICE_KEYWORDS = {
  hi: ["hindi", "हिन्दी", "swara", "madhav", "kalpana", "hemant", "hi-in", "hi_in"],
  mr: ["marathi", "मराठी", "mr-in", "mr_in", "maharashtra"],
  ta: ["tamil", "தமிழ்", "valluvar", "ta-in", "ta_in"],
  te: ["telugu", "తెలుగు", "chitra", "mohan", "te-in", "te_in"],
  bn: ["bengali", "bangla", "বাংলা", "bn-in", "bn_in", "bn-bd"],
  gu: ["gujarati", "ગુજરાતી", "gu-in", "gu_in"],
  kn: ["kannada", "ಕನ್ನಡ", "kn-in", "kn_in"],
  ml: ["malayalam", "മലയാളം", "ml-in", "ml_in"],
  pa: ["punjabi", "ਪੰਜਾਬੀ", "pa-in", "pa_in"],
  ur: ["urdu", "اردو", "ur-in", "ur_in", "ur-pk"],
  ne: ["nepali", "नेपाली", "ne-np", "ne_np"],
  as: ["assamese", "অসমীয়া", "as-in"],
  or: ["odia", "oriya", "ଓଡ଼ିଆ", "or-in"],
  en: ["en-in", "india", "en-us", "en-gb", "english", "neerja", "prabhat"]
};

class SpeechEngine {
  constructor() {
    this.synth = null;
    this.recognition = null;
    this.isListeningState = false;
    this.isSpeakingState = false;
    this.availableVoices = [];
    this.currentUtterance = null;
    this.keepAliveTimer = null;
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.animFrameId = null;

    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        this.synth = window.speechSynthesis;
        this.loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => this.loadVoices();
        }
        setTimeout(() => this.loadVoices(), 300);
        setTimeout(() => this.loadVoices(), 1000);
      }
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  loadVoices() {
    if (this.synth) {
      const voices = this.synth.getVoices();
      if (voices && voices.length > 0) {
        this.availableVoices = voices;
      }
    }
  }

  getVoices() {
    if (this.availableVoices.length === 0 && this.synth) {
      this.loadVoices();
    }
    return this.availableVoices;
  }

  isSpeaking() {
    return this.isSpeakingState || (this.synth ? this.synth.speaking : false);
  }

  findVoiceForLocale(locale, langCode) {
    const voices = this.getVoices();
    if (!voices || voices.length === 0) return { voice: null, isNative: false };

    const normLocale = locale.toLowerCase().replace("_", "-");
    const langPrefix = (langCode || normLocale.split("-")[0]).toLowerCase();
    const keywords = INDIC_VOICE_KEYWORDS[langPrefix] || [langPrefix];

    const exactVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === normLocale);
    if (exactVoice) return { voice: exactVoice, isNative: true };

    const prefixVoice = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(langPrefix));
    if (prefixVoice) return { voice: prefixVoice, isNative: true };

    const keywordVoice = voices.find((v) => {
      const vName = v.name.toLowerCase();
      const vLang = v.lang.toLowerCase();
      return keywords.some((kw) => vName.includes(kw) || vLang.includes(kw));
    });
    if (keywordVoice) return { voice: keywordVoice, isNative: true };

    if (langPrefix === "en") {
      const indianEnglish = voices.find((v) => v.lang.toLowerCase().includes("en-in") || v.name.toLowerCase().includes("india"));
      if (indianEnglish) return { voice: indianEnglish, isNative: true };
      const anyEnglish = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
      if (anyEnglish) return { voice: anyEnglish, isNative: true };
    }

    const fallbackVoice = voices.find((v) => v.lang.toLowerCase().includes("en-in")) || voices.find((v) => v.lang.toLowerCase().startsWith("en")) || voices[0] || null;
    return { voice: fallbackVoice, isNative: false };
  }

  speak(text, locale = "en-IN", langCodeOrStart, fallbackTextOrEnd, onStartCallback, onEndCallback) {
    if (!this.synth) {
      if (typeof fallbackTextOrEnd === "function") fallbackTextOrEnd();
      else if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    let langCode = "en";
    let fallbackEnglishText = "";
    let onStart = onStartCallback;
    let onEnd = onEndCallback;

    if (typeof langCodeOrStart === "function") {
      onStart = langCodeOrStart;
      if (typeof fallbackTextOrEnd === "function") onEnd = fallbackTextOrEnd;
      langCode = locale.split("-")[0].toLowerCase();
    } else {
      if (typeof langCodeOrStart === "string") langCode = langCodeOrStart;
      if (typeof fallbackTextOrEnd === "string") fallbackEnglishText = fallbackTextOrEnd;
      else if (typeof fallbackTextOrEnd === "function") onEnd = fallbackTextOrEnd;
    }

    try {
      this.stopListening();
      if (this.synth.speaking || this.synth.pending) this.synth.cancel();
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }

      const { voice, isNative } = this.findVoiceForLocale(locale, langCode);
      const isNonLatin = /[^\u0000-\u007F]/.test(text);

      let textToSpeak = text;
      let speakLocale = locale;

      if (isNonLatin && !isNative && fallbackEnglishText) {
        textToSpeak = fallbackEnglishText;
        speakLocale = "en-IN";
      }

      const cleanText = textToSpeak.replace(/[*_#`~[\]()]/g, "").replace(/\s+/g, " ").trim();
      if (!cleanText) {
        if (onEnd) onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.lang = isNative ? locale : speakLocale;

      if (voice) utterance.voice = voice;
      this.currentUtterance = utterance;
      window.__activeUtterance = utterance;

      let hasFinished = false;
      const finishUtterance = (triggerCallback) => {
        if (hasFinished) return;
        hasFinished = true;
        this.isSpeakingState = false;
        this.currentUtterance = null;
        window.__activeUtterance = null;
        if (this.keepAliveTimer) {
          clearInterval(this.keepAliveTimer);
          this.keepAliveTimer = null;
        }
        if (triggerCallback && onEnd) onEnd();
      };

      utterance.onstart = () => {
        this.isSpeakingState = true;
        if (onStart) onStart();
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = setInterval(() => {
          if (this.synth.speaking) {
            this.synth.pause();
            this.synth.resume();
          } else {
            clearInterval(this.keepAliveTimer);
          }
        }, 4500);
      };

      utterance.onend = () => finishUtterance(true);
      utterance.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted") {
          finishUtterance(false);
          return;
        }
        finishUtterance(true);
      };

      setTimeout(() => {
        if (this.synth) {
          try {
            this.synth.speak(utterance);
          } catch (speakErr) {
            finishUtterance(true);
          }
        }
      }, 50);
    } catch (e) {
      this.isSpeakingState = false;
      if (onEnd) onEnd();
    }
  }

  stopSpeaking() {
    this.isSpeakingState = false;
    this.currentUtterance = null;
    window.__activeUtterance = null;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch (e) {}
    }
  }

  startListening(locale = "en-IN", onInterim, onFinal, onError) {
    if (!this.recognition) {
      onError(new Error("Speech recognition not supported in this browser"));
      return;
    }
    try {
      this.stopSpeaking();
      try { this.recognition.abort(); } catch (e) {}

      this.recognition.lang = locale;
      let lastInterimText = "";
      let hasDispatchedFinal = false;

      this.recognition.onstart = () => {
        this.isListeningState = true;
        hasDispatchedFinal = false;
        lastInterimText = "";
        this.playMicStartChime();
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        if (interimTranscript) {
          lastInterimText = interimTranscript;
          onInterim(interimTranscript);
        }
        if (finalTranscript) {
          hasDispatchedFinal = true;
          lastInterimText = "";
          this.playMicAcknowledgeChime();
          onFinal(finalTranscript);
        }
      };

      this.recognition.onerror = (e) => {
        this.isListeningState = false;
        if (!hasDispatchedFinal && lastInterimText.trim()) {
          hasDispatchedFinal = true;
          const text = lastInterimText.trim();
          lastInterimText = "";
          this.playMicAcknowledgeChime();
          onFinal(text);
          return;
        }
        if (e.error === "language-not-supported" && locale !== "en-IN" && locale !== "hi-IN") {
          try {
            this.recognition.lang = "hi-IN";
            this.recognition.start();
            return;
          } catch (retryErr) {}
        }
        if (e.error !== "no-speech") onError(e);
      };

      this.recognition.onend = () => {
        this.isListeningState = false;
        if (!hasDispatchedFinal && lastInterimText.trim()) {
          hasDispatchedFinal = true;
          const text = lastInterimText.trim();
          lastInterimText = "";
          this.playMicAcknowledgeChime();
          onFinal(text);
        }
      };

      this.recognition.start();
    } catch (err) {
      this.isListeningState = false;
      onError(err);
    }
  }

  stopListening() {
    if (this.recognition && this.isListeningState) {
      try { this.recognition.stop(); } catch (e) {}
      this.isListeningState = false;
    }
    this.stopAudioAnalysis();
  }

  isListening() { return this.isListeningState; }
  isRecognitionSupported() { return !!this.recognition; }

  startAudioAnalysis(onVolumeChange) {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    try {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this.micStream = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.audioCtx = new AudioCtx();
        const source = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          onVolumeChange(normalized);
          this.animFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      }).catch(() => {});
    } catch (e) {}
  }

  stopAudioAnalysis() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  playMicStartChime() {}
  playMicAcknowledgeChime() {}
  playEmergencyChime() {}
}

const speechEngine = new SpeechEngine();
window.speechEngine = speechEngine;
