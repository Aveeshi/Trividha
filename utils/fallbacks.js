function generateSmartFallbackDialogue(
  messages,
  patient,
  language,
  stage,
  extracted
) {
  const isHindi = language.code === "hi";
  const isMarathi = language.code === "mr";
  const isTamil = language.code === "ta";

  const userMessages = messages.filter((m) => m.role === "user");
  const turnCount = userMessages.length;
  const lastUserMsg = userMessages[turnCount - 1]?.content || "";
  const allUserText = userMessages.map((m) => m.content).join(" ").toLowerCase();

  // 1. Instant Red-Flag Check
  const hasChestPain = /chest|chhati|heart|dil|seena|marbu|pain in left arm|sweating|crushing|breathless|saans|moochu/i.test(lastUserMsg);
  const hasStroke = /face droop|weakness in arm|slurred speech|bolne me takleef|paralysis|chehra/i.test(lastUserMsg);
  if (hasChestPain || hasStroke) {
    return {
      assistantMessage: isHindi
        ? "कृपया तुरंत ध्यान दें: आपके सीने में दर्द और सांस लेने के लक्षणों के कारण आपको तत्काल आपातकालीन जांच की आवश्यकता है। कृपया तुरंत कमरा नंबर 101 (इमरजेंसी) में जाएं।"
        : isMarathi
        ? "कृपया त्वरित लक्ष द्या: आपल्या छातीत दुखणे आणि श्वास घेण्याच्या त्रासामुळे तात्काळ आपत्कालीन तपासणीची गरज आहे. कृपया त्वरित रूम १०१ मध्ये जा."
        : "Please note: Based on your reported symptoms of chest discomfort and breathlessness, you need immediate evaluation. Please proceed directly to Room 101 (Emergency Triage).",
      translationEn: "Immediate Priority Alert: Please proceed to Room 101 for emergency evaluation.",
      quickReplies: ["I am walking to Room 101 now", "Need emergency assistance"],
      stage: "COMPLETE",
      stageProgressPercent: 100,
      redFlagDetected: true,
      redFlagDetails: {
        severity: "CRITICAL",
        alertCode: hasChestPain ? "ACS_CHEST_PAIN" : "STROKE_SIGNS",
        reason: "Acute severe chest discomfort / possible cardiac or stroke signs",
        immediateAction: "Direct patient immediately to Emergency Room 101",
      },
      extractedData: { ...extracted, chiefComplaint: lastUserMsg },
      isComplete: true,
    };
  }

  // Turn 0: Initial Greeting
  if (turnCount === 0) {
    const greeting = isHindi
      ? "नमस्ते! मैं आपका एआई केयर असिस्टेंट हूँ। डॉक्टर साहब से मिलने से पहले, आज आप किस मुख्य तकलीफ या लक्षण के लिए आए हैं?"
      : isMarathi
      ? "नमस्कार! मी तुमचा एआय केअर असिस्टंट आहे. आज तुम्हाला काय त्रास होत आहे ते कृपया सांगा."
      : "Hello! I am your AI pre-consultation assistant. What symptom or medical issue brings you in today?";
    return {
      assistantMessage: greeting,
      translationEn: "Hello! What symptom or medical issue brings you to the hospital today?",
      quickReplies: isHindi
        ? ["बुखार और गले में दर्द", "पैर या घुटने में चोट लगी है", "पेट में तेज दर्द और उल्टी", "आंखों में लाली और जलन", "कमर में तेज दर्द"]
        : ["High fever & sore throat", "Twisted ankle / knee fall", "Severe stomach ache & nausea", "Red, itchy eyes", "Severe lower back pain"],
      stage: "CHIEF_COMPLAINT",
      stageProgressPercent: 20,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted },
      isComplete: false,
    };
  }

  // Determine Domain Categories from conversation
  const isArthritis = /arthrit|joint|sandhivad|gathiya|rheumat|osteoarthrit|gout|uric acid|knuckle|finger joint|stiff joint|crepitus/i.test(allUserText);
  const isInjury = !isArthritis && /ankle|knee|leg|foot|arm|fall|fell|twist|fracture|chot|gira|pair|ghutna|accident|hit|shoulder|wrist|bone|ligament/i.test(allUserText);
  const isFever = /fever|bukhar|tap|cough|khansi|cold|sore throat|gala|temperature|chills|thandi|shivering|phlegm|sputum|pneumonia/i.test(allUserText);
  const isStomach = /stomach|pet|abdomen|potat|vomit|nausea|loose motion|diarrhea|acidity|gas|digestion|constipation|cramp|ulcer/i.test(allUserText);
  const isHeadache = /head|headache|sir|dird|migraine|throbbing|forehead|temple/i.test(allUserText);
  const isEye = /eye|aankh|vision|dola|drishti|blur|red eye|itchy eye|blind|discharge|conjunctiv/i.test(allUserText);
  const isEar = /ear|kaan|hearing|tinnitus|earache|discharge|vertigo|otitis/i.test(allUserText);
  const isSkin = /skin|rash|khujli|itch|allergy|spot|twacha|dana|redness|blister|eczema|hive/i.test(allUserText);
  const isBack = /back|spine|kamar|peeth|lower back|sciatica|disc|lumbago|bending/i.test(allUserText);
  const isUrinary = /urine|peshab|burning|mutra|kidney|bladder|frequent urination|dysuria/i.test(allUserText);
  const isDental = /tooth|teeth|daant|gums|mukh|jaw pain|cavity|molar|chewing/i.test(allUserText);
  const isDizziness = /dizzy|chakkar|giddiness|spinning|vertigo|faint|unsteady|lightheaded/i.test(allUserText);

  // Turn 1: Specific Subtype & Anatomical Location (15% progress)
  if (turnCount === 1) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "क्या डॉक्टर ने बताया है कि आपको किस प्रकार का गठिया (जैसे ऑस्टियोआर्थराइटिस, रूमेटॉइड या गाउट) है, और मुख्य रूप से कौन से जोड़ (जैसे घुटने, उंगलियां, या कूल्हे) प्रभावित हैं?"
          : isMarathi
          ? "डॉक्टरांनी तुम्हाला कोणत्या प्रकारचा संधिवात (उदा. ऑस्टियोआर्थरायटिस, संधिवात किंवा गाऊट) असल्याचे सांगितले आहे, आणि प्रामुख्याने कोणते सांधे दुखतात?"
          : "Has a doctor diagnosed which type of arthritis you have (such as Osteoarthritis, Rheumatoid Arthritis, or Gout), and which specific joints (like knees, fingers, wrists, or hips) are most painful?",
        translationEn: "Has a doctor diagnosed what type of arthritis you have, and which specific joints are affected?",
        quickReplies: ["Osteoarthritis in knees", "Rheumatoid in hands & wrists", "High uric acid / Gout in big toe", "Joint pain not yet diagnosed"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { site: "Joints / Musculoskeletal", character: "Arthritis" } },
        isComplete: false,
      };
    }
    if (isInjury) {
      return {
        assistantMessage: isHindi
          ? "चोट के बारे में जानकर खेद है। क्या चोट वाली जगह पर सूजन, नीलापन या कोई विकृति दिख रही है, और क्या आप उस पर वजन डालकर चल पा रहे हैं?"
          : "I understand you have an injury. Is there visible swelling, bruising, or deformity, and are you able to bear weight on it?",
        translationEn: "Is there visible swelling or bruising, and can you bear weight on it?",
        quickReplies: ["Swollen & unable to walk", "Mild swelling, walking with limp", "Severe bruising & sharp pain", "Cannot bend or move it"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { site: "Musculoskeletal", character: "Trauma / Strain" } },
        isComplete: false,
      };
    }
    if (isFever) {
      return {
        assistantMessage: isHindi
          ? "यह बुखार कितने दिनों से आ रहा है, क्या इसके साथ तेज कंपकंपी या ठंड लगती है, और क्या खांसी या गले में खराश भी है?"
          : "How many days have you had this fever, does it come with severe chills or shivering, and do you also have a cough or sore throat?",
        translationEn: "How many days has the fever lasted, do you have chills, and is there cough or throat pain?",
        quickReplies: ["Past 2-3 days with chills", "High fever since morning", "Dry cough & throat pain", "Fever with severe body ache"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { character: "Febrile illness" } },
        isComplete: false,
      };
    }
    if (isStomach) {
      return {
        assistantMessage: isHindi
          ? "पेट में दर्द किस तरफ ज्यादा है (ऊपरी हिस्से, नाभि के पास या दाईं तरफ), और क्या उल्टी या खट्टी डकारें भी आ रही हैं?"
          : "Where in your abdomen is the discomfort located (upper stomach, around navel, or lower right side), and do you have vomiting or acidity?",
        translationEn: "Where in the abdomen is the pain located, and do you have nausea or acidity?",
        quickReplies: ["Upper stomach with burning", "Lower right sharp cramp", "Frequent loose motions & nausea", "Constant bloating & heavy ache"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { site: "Abdomen" } },
        isComplete: false,
      };
    }
    if (isBack) {
      return {
        assistantMessage: isHindi
          ? "कमर का यह दर्द कब से है, और क्या यह दर्द कूल्हे से होते हुए पैर की उंगलियों तक करंट की तरह जाता है?"
          : "When did this back pain start, and does the pain radiate like an electric shock down your hip into your leg or toes?",
        translationEn: "When did the back pain start, and does it shoot down your leg into your foot?",
        quickReplies: ["Shooting pain down right leg", "Severe morning stiffness", "Pain when bending or lifting", "Constant dull lower ache"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { site: "Lumbar Spine" } },
        isComplete: false,
      };
    }
    if (isEye) {
      return {
        assistantMessage: isHindi
          ? "क्या आंख में लाली, पानी या चिपचिपा स्राव आ रहा है, और क्या रोशनी देखने में तेज चुभन या धुंधलापन महसूस हो रहा है?"
          : "Is there eye redness, watery or sticky discharge, and do you experience gritty pain, blurred vision, or sensitivity to bright light?",
        translationEn: "Is there redness, discharge, gritty feeling, or blurred vision in your eyes?",
        quickReplies: ["Redness & yellow discharge", "Watery eyes & burning itch", "Blurred vision & pain", "Foreign body gritty feeling"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 15,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, chiefComplaint: lastUserMsg, socrates: { site: "Ocular" } },
        isComplete: false,
      };
    }

    // Default turn 1
    return {
      assistantMessage: isHindi
        ? `मैं समझ गया। कृपया बताएं कि यह समस्या ठीक किस जगह पर महसूस हो रही है और यह कितने दिनों या हफ्तों से है?`
        : `I understand. Could you tell me exactly where you feel this discomfort, and how many days or weeks it has been present?`,
      translationEn: "Where exactly is this discomfort located, and how long has it been present?",
      quickReplies: isHindi 
        ? ["2-3 दिन पहले शुरू हुआ", "कई हफ्तों से है", "आज अचानक तेज दर्द हुआ", "महीनों से धीरे-धीरे बढ़ रहा है"]
        : ["Started 2-3 days ago", "Present for several weeks", "Sudden sharp onset today", "Gradual worsening over months"],
      stage: "SYMPTOM_EXPLORATION",
      stageProgressPercent: 15,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, chiefComplaint: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 2: Chronology, Morning Variations & Diurnal Patterns (28% progress)
  if (turnCount === 2) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "सुबह सोकर उठने पर क्या जोड़ों में बहुत ज्यादा अकड़न महसूस होती है, और इसे सामान्य होने में लगभग कितना समय (जैसे 30 मिनट या 1 घंटे से अधिक) लगता है?"
          : isMarathi
          ? "सकाळी झोपेतून उठल्यावर सांधे खूप ताठरलेले किंवा कडक वाटतात का, आणि ते मोकळे व्हायला किती वेळ (३० मिनिटे की १ तासापेक्षा जास्त) लागतो?"
          : "When you wake up in the morning, do you experience joint stiffness, and how long does it usually take (e.g. 30 minutes or over an hour) to ease up?",
        translationEn: "Do you have morning joint stiffness, and how long does it take to ease up?",
        quickReplies: ["Stiffness lasts over 1 hour", "Mild stiffness for 15-20 mins", "Joints feel swollen & warm", "Stiffest after sitting idle"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 28,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, morningStiffness: lastUserMsg },
        isComplete: false,
      };
    }
    if (isInjury) {
      return {
        assistantMessage: isHindi
          ? "यह चोट कैसे लगी थी (जैसे फिसलने, बाइक गिरने या मुड़ने से), और क्या चोट लगते समय कोई चटकने या टूटने की आवाज आई थी?"
          : "How did this injury occur (such as a slip, fall from a bike, or twisting), and did you hear or feel a popping or cracking sound at that moment?",
        translationEn: "How did the injury happen, and did you feel or hear a popping/cracking sound?",
        quickReplies: ["Fell from two-wheeler", "Heard a loud popping sound", "Twisted ankle while walking", "Direct hit / blunt trauma"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 28,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, injuryMechanism: lastUserMsg },
        isComplete: false,
      };
    }
    if (isFever) {
      return {
        assistantMessage: isHindi
          ? "क्या बुखार दिन के किसी खास समय (जैसे शाम या रात में) तेज चढ़ता है, और क्या आपने थर्मामीटर से तापमान नापा है?"
          : "Does the fever spike at a specific time of day (such as evening or night), and have you measured your temperature on a thermometer?",
        translationEn: "Does fever spike at specific times, and have you measured your temperature?",
        quickReplies: ["Spikes in evening (102°F+)", "Continuous high temperature", "Mild low-grade fever (99-100°F)", "Comes and goes in waves"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 28,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, feverPattern: lastUserMsg },
        isComplete: false,
      };
    }
    if (isStomach) {
      return {
        assistantMessage: isHindi
          ? "क्या यह दर्द खाना खाने के तुरंत बाद बढ़ता है या खाली पेट रहने पर ज्यादा तकलीफ होती है?"
          : "Does the pain get worse immediately after eating meals, or does it hurt more on an empty stomach?",
        translationEn: "Does the stomach pain worsen after meals or when on an empty stomach?",
        quickReplies: ["Worse right after eating meals", "Worse on empty stomach / night", "Pain is constant all day", "Worse after spicy/oily food"],
        stage: "SYMPTOM_EXPLORATION",
        stageProgressPercent: 28,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, mealRelation: lastUserMsg },
        isComplete: false,
      };
    }

    return {
      assistantMessage: isHindi
        ? "क्या यह तकलीफ दिन के किसी खास समय या किसी खास काम के दौरान ज्यादा महसूस होती है, या यह लगातार बनी रहती है?"
        : "Does this discomfort become more intense during certain times of the day or with particular postures, or is it constant?",
      translationEn: "Does the symptom fluctuate throughout the day or remain continuous?",
      quickReplies: isHindi
        ? ["सुबह के समय ज्यादा दर्द", "शाम/रात को बढ़ जाता है", "दिन-रात लगातार बना रहता है", "कभी-कभी अचानक दर्द होता है"]
        : ["Worse in the morning", "Worse by evening / end of day", "Constant throughout day & night", "Intermittent flare-ups"],
      stage: "SYMPTOM_EXPLORATION",
      stageProgressPercent: 28,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, diurnalPattern: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 3: Character of Pain & Severity Rating (42% progress)
  if (turnCount === 3) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "यह दर्द किस प्रकार का है (जैसे अंदरूनी जलन, भारी टीस, या हड्डियों के आपस में रगड़ने जैसा), और 1 से 10 के पैमाने पर आप इसे कितना आंकेंगे?"
          : isMarathi
          ? "हे दुखणे कोणत्या प्रकारचे आहे (जसे की खोलवर ठसठस, जळजळ, किंवा सांधे घासल्यासारखा आवाज), आणि १ ते १० च्या प्रमाणात तीव्रता किती आहे?"
          : "What does the pain feel like (a deep burning ache, sharp throbbing, or grinding sensation with crepitus), and on a scale of 1 to 10, how severe is it?",
        translationEn: "What is the nature of the joint pain (burning, throbbing, grinding), and pain score 1-10?",
        quickReplies: ["Severe aching 7/10 with cracking sound", "Deep burning pain 8/10", "Moderate throbbing 5/10", "Severe sharp pain 9/10"],
        stage: "SEVERITY_IMPACT",
        stageProgressPercent: 42,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, socrates: { ...extracted?.socrates, character: lastUserMsg, severity: "Moderate-Severe" } },
        isComplete: false,
      };
    }
    if (isInjury) {
      return {
        assistantMessage: isHindi
          ? "1 से 10 के पैमाने पर दर्द की तीव्रता कितनी है, और क्या छूने पर तेज टीस या सुई जैसी चुभन होती है?"
          : "On a scale of 1 to 10, how severe is the pain, and is it acutely tender to touch or throbbing continuously?",
        translationEn: "What is the pain rating from 1 to 10, and is it tender to gentle touch?",
        quickReplies: ["Pain is 8/10, very sharp", "Pain is 6/10, dull ache", "Severe 9/10, cannot touch at all", "Moderate 4/10 with swelling"],
        stage: "SEVERITY_IMPACT",
        stageProgressPercent: 42,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, severity: lastUserMsg },
        isComplete: false,
      };
    }
    if (isFever) {
      return {
        assistantMessage: isHindi
          ? "क्या शरीर में गंभीर कमजोरी, सिरदर्द, आंखों के पीछे दर्द या मांसपेशियों में तेज टूटन महसूस हो रही है?"
          : "Are you experiencing severe fatigue, headache, pain behind the eyes, or intense body aches and muscle pain?",
        translationEn: "Do you have severe weakness, headache, retro-orbital pain, or generalized body aches?",
        quickReplies: ["Severe body ache & muscle pain", "Pain behind eyes & heavy head", "Extreme fatigue & bedridden", "Mild tiredness with throat ache"],
        stage: "SEVERITY_IMPACT",
        stageProgressPercent: 42,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, associatedAches: lastUserMsg },
        isComplete: false,
      };
    }

    return {
      assistantMessage: isHindi
        ? "1 से 10 के पैमाने पर (जहां 1 हल्का और 10 असहनीय है), आप इस तकलीफ की गंभीरता को कितना नंबर देंगे?"
        : "On a scale of 1 to 10 (where 1 is mild and 10 is unbearable), how would you rate the severity of your discomfort?",
      translationEn: "On a scale of 1 to 10, how severe is your discomfort?",
      quickReplies: isHindi
        ? ["मध्यम (4-5/10)", "गंभीर (7-8/10)", "बहुत गंभीर (9/10)", "हल्का (2-3/10)"]
        : ["Moderate (4-5/10)", "Severe (7-8/10)", "Very Severe (9/10)", "Mild (2-3/10)"],
      stage: "SEVERITY_IMPACT",
      stageProgressPercent: 42,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, severityRating: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 4: Functional Impact on Daily Activities & Mobility (55% progress)
  if (turnCount === 4) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "क्या इस दर्द की वजह से आपको दैनिक कार्यों जैसे चलने, सीढ़ियां चढ़ने, बोतल का ढक्कन खोलने या उंगलियों से चीजें पकड़ने में परेशानी होती है?"
          : isMarathi
          ? "या त्रासामुळे तुम्हाला चालणे, जिने चढणे, बाटलीचे झाकण उघडणे किंवा हाताने वस्तू पकडणे यात अडचण येत आहे का?"
          : "Does this arthritis pain limit your ability to perform daily tasks, such as walking, climbing stairs, opening jars, or gripping utensils and tools?",
        translationEn: "Does the joint pain limit daily tasks like walking, stairs, opening jars, or gripping objects?",
        quickReplies: ["Difficulty climbing stairs & walking", "Cannot grip objects or open jars", "Pain disturbs my night sleep", "Able to manage with slow pace"],
        stage: "FUNCTIONAL_IMPACT",
        stageProgressPercent: 55,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, functionalImpact: lastUserMsg },
        isComplete: false,
      };
    }
    if (isInjury) {
      return {
        assistantMessage: isHindi
          ? "क्या आप उस पैर या हाथ का बिल्कुल भी इस्तेमाल नहीं कर पा रहे हैं, और क्या रात में करवट बदलने या सोने में परेशानी हो रही है?"
          : "Are you unable to use that limb for normal movement, and does the pain prevent you from sleeping comfortably?",
        translationEn: "Are you unable to use that limb, and does the pain disturb sleep?",
        quickReplies: ["Completely immobilized", "Can move with severe pain", "Cannot sleep due to throbbing", "Managing with support/crutch"],
        stage: "FUNCTIONAL_IMPACT",
        stageProgressPercent: 55,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, functionalLimitation: lastUserMsg },
        isComplete: false,
      };
    }
    if (isStomach) {
      return {
        assistantMessage: isHindi
          ? "क्या आप पानी, ओआरएस या हल्का भोजन पचा पा रहे हैं, या सब कुछ उल्टी में निकल जा रहा है?"
          : "Are you able to keep down water, oral rehydration fluids, or light food, or are you unable to hold anything in?",
        translationEn: "Are you able to hold down fluids and light food, or is everything vomiting out?",
        quickReplies: ["Unable to keep fluids down", "Can sip water & light porridge", "Frequent watery stools / dehydration", "Eating normal light food"],
        stage: "FUNCTIONAL_IMPACT",
        stageProgressPercent: 55,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, oralTolerance: lastUserMsg },
        isComplete: false,
      };
    }

    return {
      assistantMessage: isHindi
        ? "क्या इस तकलीफ के कारण आपके काम करने, चलने-फिरने या रात की नींद में कोई गंभीर रुकावट आ रही है?"
        : "How does this condition impact your daily routine, your ability to work, or your sleep at night?",
      translationEn: "How does this condition impact your work, movement, or sleep at night?",
      quickReplies: isHindi
        ? ["काम और चलने में बहुत परेशानी", "रात की नींद अक्सर टूट जाती है", "दिन में हल्की परेशानी", "रोजमर्रा के काम नहीं कर पा रहा"]
        : ["Severely affects work & mobility", "Disturbs night sleep frequently", "Mild inconvenience during day", "Unable to do routine chores"],
      stage: "FUNCTIONAL_IMPACT",
      stageProgressPercent: 55,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, functionalImpact: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 5: Aggravating & Relieving Factors (68% progress)
  if (turnCount === 5) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "क्या ठंड के मौसम में या ज्यादा देर बैठने के बाद दर्द बढ़ जाता है, और क्या गर्म पानी की सिकाई या तेल मालिश से कुछ राहत मिलती है?"
          : isMarathi
          ? "थंडीच्या दिवसात किंवा जास्त वेळ बसून राहिल्यावर दुखणे वाढते का, आणि गरम पाण्याच्या शेक किंवा तेलाने आराम मिळतो का?"
          : "Does cold weather or prolonged sitting aggravate the pain, and does warm fomentation or gentle movement provide any temporary relief?",
        translationEn: "Does cold weather or rest worsen the pain, and does heat application relieve it?",
        quickReplies: ["Much worse in cold weather", "Hot fomentation gives mild relief", "Worse after walking long distance", "Worse after sitting idle"],
        stage: "SEVERITY_IMPACT",
        stageProgressPercent: 68,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, relievingFactors: lastUserMsg },
        isComplete: false,
      };
    }
    if (isBack) {
      return {
        assistantMessage: isHindi
          ? "क्या आगे झुकने, वजन उठाने या खांसने-छींकने पर दर्द अचानक बढ़ता है, और क्या लेटने पर आराम मिलता है?"
          : "Does the back pain spike when bending forward, lifting weights, or coughing/sneezing, and does lying flat give relief?",
        translationEn: "Does bending forward or coughing spike the pain, and does lying flat give relief?",
        quickReplies: ["Worse when bending forward", "Relieved only when lying down", "Spikes with coughing/sneezing", "Worse with prolonged standing"],
        stage: "SEVERITY_IMPACT",
        stageProgressPercent: 68,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, backTriggers: lastUserMsg },
        isComplete: false,
      };
    }

    return {
      assistantMessage: isHindi
        ? "क्या कोई खास स्थिति, गतिविधि या घरेलू उपाय (जैसे आराम, गर्म/ठंडी सिकाई) इस परेशानी को कम या ज्यादा करती है?"
        : "Does any specific position, physical activity, or home measure (such as rest, ice, or heat) make the symptom better or worse?",
      translationEn: "Does any specific activity or rest make the symptom better or worse?",
      quickReplies: isHindi
        ? ["चलने से बढ़ता है / आराम से घटता है", "सिकाई से आराम / ठंड से दर्द", "हमेशा एक जैसा रहता है", "शारीरिक मेहनत के बाद बढ़ता है"]
        : ["Worse with movement / Better with rest", "Better with heat / Worse in cold", "Constant regardless of posture", "Worse after physical strain"],
      stage: "SEVERITY_IMPACT",
      stageProgressPercent: 68,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, aggravatingFactors: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 6: Current Medications & Treatments Tried (80% progress)
  if (turnCount === 6) {
    if (isArthritis) {
      return {
        assistantMessage: isHindi
          ? "क्या आप इसके लिए कोई दर्द निवारक गोलियां, जेल या गठिया की नियमित दवाएं (जैसे मेथोट्रेक्सेट या पेनकिलर) ले रहे हैं, और क्या उनसे आराम मिल रहा है?"
          : isMarathi
          ? "तुम्ही यासाठी कोणती पेनकिलर गोळी, जेल किंवा डॉक्टरांचे औषध घेत आहात का, आणि त्याने काही आराम मिळतो का?"
          : "Are you taking any anti-inflammatory painkillers, topical gels, or regular prescription arthritis medications, and have they provided relief?",
        translationEn: "Are you taking painkillers, topical gels, or prescription arthritis meds, and do they help?",
        quickReplies: ["Taking painkiller with temporary relief", "Using pain relief spray/gel only", "Taking regular doctor's prescription", "Have not taken any medicine yet"],
        stage: "CLINICAL_HISTORY",
        stageProgressPercent: 80,
        redFlagDetected: false,
        redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
        extractedData: { ...extracted, currentMedsForCondition: lastUserMsg },
        isComplete: false,
      };
    }

    return {
      assistantMessage: isHindi
        ? "क्या आपने इस तकलीफ के लिए घर पर कोई दवा (जैसे पैरासिटामोल, पेनकिलर या एंटासिड) ली है, और क्या उससे कोई सुधार हुआ?"
        : "Have you taken any over-the-counter medicines or home remedies for this so far, and did they bring any noticeable improvement?",
      translationEn: "Have you taken any medications or remedies for this, and did they bring improvement?",
      quickReplies: isHindi
        ? ["पैरासिटामोल / पेनकिलर ली है", "एंटासिड / घरेलू उपाय किया", "अभी तक कोई दवा नहीं ली", "दवा से सिर्फ थोड़ी देर आराम मिला"]
        : ["Took Paracetamol / Painkiller", "Took Antacid / Home remedy", "No medicine taken yet", "Medicine gave only temporary relief"],
      stage: "CLINICAL_HISTORY",
      stageProgressPercent: 80,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, treatmentResponse: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 7: Associated Systemic Symptoms & Medical Safety (90% progress)
  if (turnCount === 7) {
    const chronicCondition = patient?.knownRecords?.chronicConditions?.[0];
    const allergy = patient?.knownRecords?.allergies?.[0];

    let safetyMsg = "";
    let transMsg = "";

    if (isArthritis) {
      safetyMsg = isHindi
        ? "क्या जोड़ों के दर्द के साथ आपको हल्का बुखार, त्वचा पर लाल चकत्ते, आंखों में लाली, या हाथ-पैरों में झनझनाहट/सुन्नपन भी महसूस होता है?"
        : "Along with joint pain, do you experience low-grade fever, skin rashes, red eyes, or tingling and numbness in your hands or feet?";
      transMsg = "Any associated fever, skin rashes, red eyes, or numbness/tingling in hands or feet?";
    } else if (chronicCondition) {
      safetyMsg = isHindi
        ? `आपके रिकॉर्ड में ${chronicCondition} दर्ज है। क्या आप अपनी नियमित दवाएं ले रहे हैं, और क्या आपको किसी दवा से एलर्जी है?`
        : `Your record shows a history of ${chronicCondition}. Are you taking your prescribed meds regularly, and do you have any drug allergies?`;
      transMsg = `Record shows ${chronicCondition}. Are you taking medications regularly, and any drug allergies?`;
    } else {
      safetyMsg = isHindi
        ? "क्या आपको कोई अन्य पुरानी बीमारी (जैसे मधुमेह, उच्च रक्तचाप, थायराइड) है, और क्या आपको किसी दवा से एलर्जी है?"
        : "Do you have any existing chronic medical conditions (such as diabetes, hypertension, thyroid), and do you have any known drug allergies?";
      transMsg = "Do you have any chronic medical conditions or known drug allergies?";
    }

    return {
      assistantMessage: safetyMsg,
      translationEn: transMsg,
      quickReplies: isHindi
        ? ["कोई अन्य लक्षण या एलर्जी नहीं है", "हाँ, बीपी और शुगर की समस्या है", "हाथ-पैरों में झनझनाहट होती है", "पेनिसिलिन / सल्फा से एलर्जी है"]
        : ["No other symptoms / No allergies", "Have Diabetes & High Blood Pressure", "Tingling & numbness in fingers/toes", "Allergic to Penicillin / Sulfa"],
      stage: "SAFETY_CHECK",
      stageProgressPercent: 90,
      redFlagDetected: false,
      redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
      extractedData: { ...extracted, systemicSafety: lastUserMsg },
      isComplete: false,
    };
  }

  // Turn 8: Comprehensive Wrap-Up and Transition to Doctor (100% progress)
  const closingMessage = isHindi
    ? "बहुत धन्यवाद! आपकी समस्या की पूरी विस्तृत जानकारी (लक्षण, प्रकार, गंभीरता, और प्रभाव) दर्ज कर ली गई है और डॉक्टर साहब के क्लिनिकल डैशबोर्ड पर भेज दी गई है। कृपया प्रतीक्षालय में बैठें, आपका टोकन जल्द ही पुकारा जाएगा।"
    : isMarathi
    ? "खूप धन्यवाद! आपल्या त्रासाची सर्व सविस्तर माहिती (लक्षणे, प्रकार, तीव्रता आणि परिणाम) नोंदवून डॉक्टरांच्या डॅशबोर्डवर पाठवण्यात आली आहे. कृपया प्रतीक्षालयात बसा, आपला नंबर लवकरच पुकारला जाईल."
    : "Thank you very much! A comprehensive clinical summary of your symptoms, duration, severity, functional impact, and medical history has been prepared and sent directly to your consulting physician. Please take a seat in the waiting lounge; your token number will be announced shortly.";

  return {
    assistantMessage: closingMessage,
    translationEn: "Thank you! A comprehensive clinical summary has been prepared and sent directly to your doctor. Please wait in the lounge.",
    quickReplies: ["View Doctor's Summary", "Print Intake Slip", "Waiting in Lounge"],
    stage: "COMPLETE",
    stageProgressPercent: 100,
    redFlagDetected: false,
    redFlagDetails: { severity: "NONE", alertCode: "NONE", reason: "", immediateAction: "" },
    extractedData: { ...extracted, finalConfirmation: lastUserMsg },
    isComplete: true,
  };
}

function generateSmartFallbackSummary(patient, history, extracted, redFlag) {
  const isRed = redFlag?.severity === "CRITICAL" || redFlag?.severity === "HIGH";

  return {
    intakeId: `INTK-${Date.now()}`,
    timestamp: new Date().toISOString(),
    patientSummary: {
      name: patient?.name || "Patient",
      age: patient?.age || 45,
      gender: patient?.gender || "Unspecified",
      abhaId: patient?.abhaId || "ABHA-NEW-9901",
    },
    triageAssessment: {
      triageLevel: isRed ? "LEVEL_2_EMERGENT" : "LEVEL_4_LESS_URGENT",
      triageColor: isRed ? "red" : "green",
      urgencyBadge: isRed ? "CRITICAL EMERGENCY" : "ROUTINE APPOINTMENT",
      recommendedDepartment: isRed ? "Cardiology / Emergency Medicine" : "Gastroenterology / Internal Medicine",
      priorityQueueRank: isRed ? "IMMEDIATE (0 min wait)" : "STANDARD QUEUE (approx 12 min)",
      redFlagAlert: isRed,
      redFlagNotes: isRed ? redFlag?.reason || "Patient reported acute chest tightness and dyspnea." : null,
    },
    clinicalHistory: {
      chiefComplaint: extracted?.chiefComplaint || (isRed ? "Acute chest discomfort with breathlessness" : "Epigastric burning and abdominal discomfort x 3 days"),
      historyOfPresentIllness: {
        narrative: isRed
          ? "The patient presents with an acute onset of substernal chest pressure radiating to the left shoulder and associated with shortness of breath. Symptoms began abruptly this morning and are rated 8/10 in severity."
          : "The patient presents with a 3-day history of postprandial epigastric burning and moderate bloating. Discomfort is rated 5-6/10, worsened by spicy food, and partially relieved by antacids. No radiation to back.",
        socratesBreakdown: {
          site: extracted?.socrates?.site || (isRed ? "Retrosternal / Precordial" : "Epigastrium"),
          onset: extracted?.socrates?.onset || (isRed ? "Acute sudden onset" : "Subacute, 3 days duration"),
          character: extracted?.socrates?.character || (isRed ? "Heavy crushing pressure" : "Burning / Crampy sensation"),
          radiation: extracted?.socrates?.radiation || (isRed ? "Radiating to left arm/jaw" : "None / Non-radiating"),
          associations: extracted?.socrates?.associations || (isRed ? ["Diaphoresis", "Dyspnea", "Nausea"] : ["Postprandial fullness", "Mild nausea"]),
          timeCourse: extracted?.socrates?.timeCourse || (isRed ? "Constant worsening" : "Intermittent, worsens 45 min after meals"),
          exacerbatingRelieving: extracted?.socrates?.exacerbatingRelieving || (isRed ? "Exertion worsens; rest does not alleviate" : "Aggravated by oily food; relieved by water/antacids"),
          severity: extracted?.socrates?.severity || (isRed ? "8/10 (Severe)" : "5/10 (Moderate)"),
        },
      },
      pastMedicalSurgicalHistory: {
        existingRecordsReconfirmed: patient?.knownRecords?.chronicConditions || ["Type 2 Diabetes (reconfirmed)", "Hypertension (reconfirmed)"],
        newDisclosures: ["Occasional acid reflux noted in past months"],
        surgicalHistory: patient?.knownRecords?.pastSurgeries || ["None reported"],
      },
      medicationHistory: {
        currentRegimen: patient?.knownRecords?.currentMedications || ["Tab. Metformin 500mg BD", "Tab. Telmisartan 40mg OD"],
        adherenceStatus: "Good / Regular",
        newOverTheCounterMeds: ["Took OTC Antacid Gel twice yesterday"],
      },
      allergies: {
        knownDrugAllergies: patient?.knownRecords?.allergies || ["Penicillin (Severe rash)"],
        newReportedAllergies: ["None"],
        severeReactionFlag: (patient?.knownRecords?.allergies || []).some((a) => /severe|anaph/i.test(a)),
      },
      familyHistory: "Father had CAD at age 62; Mother has Type 2 Diabetes Mellitus.",
      personalSocialHistory: {
        tobaccoSmoking: "Non-smoker",
        alcoholIntake: "Occasional social intake (< 2 units/week)",
        dietSleepNotes: "Mixed diet, reports disturbed sleep over past 2 nights due to symptoms.",
      },
      reviewOfSystems: {
        constitutional: "No fever, no unexpected weight loss.",
        cardiovascular: isRed ? "Positive for chest tightness and palpitations." : "No palpitations, no orthopnea, no ankle swelling.",
        respiratory: isRed ? "Positive for exertional dyspnea." : "No cough, no hemoptysis, no wheeze.",
        gastrointestinal: isRed ? "Mild nausea." : "Positive for epigastric burning, mild nausea; no melena or hematemesis.",
        neurological: "No syncope, no focal weakness, alert and oriented x 3.",
        musculoskeletal: "No joint swelling or severe muscle pain.",
      },
    },
    physicianQuickActions: [
      isRed ? "STAT: 12-Lead Electrocardiogram (ECG) & Troponin-I assay" : "Physical examination: Palpate epigastrium for tenderness / guarding",
      isRed ? "STAT: Continuous cardiac telemetry and IV line establishment" : "Check recent HbA1c and lipid profile records",
      isRed ? "Consider loading dose of Aspirin 300mg + Clopidogrel 300mg if ACS confirmed" : "Consider H. pylori stool antigen test or empirical PPI trial (e.g. Pantoprazole 40mg OD)",
    ],
  };
}

module.exports = {
  generateSmartFallbackDialogue,
  generateSmartFallbackSummary
};
