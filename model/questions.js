// AI Q&A Wizard Clinical Questions & Multi-turn Roadmap
const WIZARD_STAGES = [
  {
    stage: "CHIEF_COMPLAINT",
    title: "Chief Complaint & Anatomical Site",
    questionTemplates: {
      en: "Hello! What main health concern brings you to the hospital today?",
      hi: "नमस्ते! आज आप किस मुख्य स्वास्थ्य समस्या या दर्द के लिए डॉक्टर से मिलना चाहते हैं?",
      mr: "नमस्कार! आज तुम्हाला कोणत्या मुख्य त्रासासाठी किंवा दुखण्यासाठी डॉक्टरांना भेटायचे आहे?"
    },
    quickReplies: {
      en: ["Severe knee joint pain", "Chest heaviness / discomfort", "Persistent dry cough", "Stomach ache & acidity"],
      hi: ["घुटनों में तेज दर्द", "छाती में भारीपन/जकड़न", "लगातार सूखी खांसी", "पेट दर्द व गैस"],
      mr: ["गुडघ्यांमध्ये तीव्र वेदना", "छातीत जडपणा", "सतत खोकला", "पोटात दुखणे व पित्त"]
    }
  },
  {
    stage: "DURATION_ONSET",
    title: "Chronology & Timing",
    questionTemplates: {
      en: "How long have you been experiencing this, and did it start suddenly or develop gradually?",
      hi: "यह समस्या कितने समय से है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?",
      mr: "हा त्रास किती दिवसांपासून होत आहे, आणि तो अचानक सुरू झाला की हळूहळू वाढला?"
    },
    quickReplies: {
      en: ["Past 2-3 days", "About 2 weeks", "More than 1 month", "Started suddenly this morning"],
      hi: ["पिछले 2-3 दिनों से", "लगभग 2 हफ्ते से", "1 महीने से अधिक", "आज सुबह अचानक"],
      mr: ["गेल्या २-३ दिवसांपासून", "सुमारे २ आठवड्यांपासून", "१ महिन्यापेक्षा जास्त", "आज सकाळी अचानक"]
    }
  },
  {
    stage: "SEVERITY_CHARACTER",
    title: "Pain Severity & Sensation Character",
    questionTemplates: {
      en: "On a scale of 1 to 10, how severe is the discomfort, and how would you describe the sensation (e.g. sharp, throbbing, dull, burning)?",
      hi: "1 से 10 के पैमाने पर दर्द कितना तीव्र है, और यह किस प्रकार का लगता है (जैसे तेज चुभन, जलन, भारीपन या टीस)?",
      mr: "१ ते १० च्या मोजपट्टीवर वेदना किती तीव्र आहेत, आणि ती कशी वाटते (जसे की ठसठस, जळजळ, तीव्र टोचणे किंवा जडपणा)?"
    },
    quickReplies: {
      en: ["Mild (3-4/10)", "Moderate (5-6/10)", "Severe (7-8/10)", "Burning / Throbbing sensation"],
      hi: ["हल्का (3-4/10)", "मध्यम (5-6/10)", "गंभीर (7-8/10)", "जलन व भारीपन"],
      mr: ["कमी (३-४/१०)", "मध्यम (५-६/१०)", "तीव्र (७-८/१०)", "जळजळ व ठसठस"]
    }
  },
  {
    stage: "FUNCTIONAL_IMPACT",
    title: "Functional & Daily Living Impact",
    questionTemplates: {
      en: "Is this condition affecting your daily activities like walking, working, sleep, or climbing stairs?",
      hi: "क्या इससे आपके दैनिक कार्य जैसे चलना, सीढ़ियां चढ़ना, काम करना या नींद प्रभावित हो रही है?",
      mr: "यामुळे तुमच्या दैनंदिन कामांवर जसे की चालणे, जिन्यावर चढणे, झोप किंवा कामावर काही परिणाम होत आहे का?"
    },
    quickReplies: {
      en: ["Difficulty walking & stairs", "Disturbs night sleep", "Cannot carry heavy objects", "Mild limitation only"],
      hi: ["चलने और सीढ़ी चढ़ने में दिक्कत", "रात में नींद खुल जाती है", "भारी सामान नहीं उठा पाते", "मामूली असर"],
      mr: ["चालणे व जिना चढण्यात अडचण", "रात्री झोप लागत नाही", "वजन उचलता येत नाही", "फारसा परिणाम नाही"]
    }
  },
  {
    stage: "MEDICATION_ALLERGIES",
    title: "Medications & Known Allergies",
    questionTemplates: {
      en: "Have you taken any painkillers or medicines for this, and do you have any drug allergies?",
      hi: "क्या आपने इसके लिए कोई दर्दनिवारक या दवा ली है, और क्या आपको किसी दवा से एलर्जी है?",
      mr: "तुम्ही यासाठी काही गोळ्या किंवा औषध घेतले आहे का, आणि तुम्हाला कोणत्याही औषधाची ॲलर्जी आहे का?"
    },
    quickReplies: {
      en: ["Took Paracetamol / Painkiller", "Applying pain relief gel", "No medicines taken yet", "No known drug allergies"],
      hi: ["पैरासिटामोल/दर्दनिवारक लिया", "दर्द निवारक जेल लगाया", "कोई दवा नहीं ली", "कोई एलर्जी नहीं है"],
      mr: ["पॅरासिटामॉल घेतली", "मलम/जेल लावले", "अजून औषध घेतले नाही", "कोणतीही ॲलर्जी नाही"]
    }
  }
];

module.exports = {
  WIZARD_STAGES
};
