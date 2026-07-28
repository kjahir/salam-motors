// Locale support for Ask Salam: the language directive fed to the model,
// script-conformance checking on its output, and the deterministic
// (non-model) server-side string catalog + money formatter used by
// actions.ts / confirmation.ts / openai.ts for content the model never
// gets to translate itself (confirmation changes, receipts, fallback
// confirm/cancel labels).
//
// The 6 supported codes must stay in sync with `languageOptions`/`AppLocale`
// in src/i18n/index.ts (the frontend can't import that file directly since
// this runs on Deno).

export const ASSISTANT_LOCALES = [
  "en-IN",
  "hi-IN",
  "ta-IN",
  "ml-IN",
  "kn-IN",
  "te-IN",
] as const;

export type AssistantLocale = (typeof ASSISTANT_LOCALES)[number];

/** Language name (with native script) used in the model's language directive. */
export const LOCALE_LANGUAGES: Record<AssistantLocale, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi (हिन्दी)",
  "ta-IN": "Tamil (தமிழ்)",
  "ml-IN": "Malayalam (മലയാളം)",
  "kn-IN": "Kannada (ಕನ್ನಡ)",
  "te-IN": "Telugu (తెలుగు)",
};

export function normalizeAssistantLocale(
  locale: string | null | undefined,
): AssistantLocale {
  return (ASSISTANT_LOCALES as readonly string[]).includes(locale ?? "")
    ? (locale as AssistantLocale)
    : "en-IN";
}

// ---------------------------------------------------------------------------
// Script conformance (observability only — see decisions in the task brief:
// log/flag on mismatch, no corrective re-prompt round yet).
// ---------------------------------------------------------------------------

/** Unicode block per locale's script. English/Latin has no dedicated check. */
const SCRIPT_PATTERNS: Partial<Record<AssistantLocale, RegExp>> = {
  "hi-IN": /[ऀ-ॿ]/gu,
  "ta-IN": /[஀-௿]/gu,
  "ml-IN": /[ഀ-ൿ]/gu,
  "kn-IN": /[ಀ-೿]/gu,
  "te-IN": /[ఀ-౿]/gu,
};

const MIN_LETTERS_FOR_SCRIPT_CHECK = 20;
const SCRIPT_MATCH_RATIO_THRESHOLD = 0.15;

export interface ScriptConformanceResult {
  /** False when the locale has no script check (en-IN) or the sample was too short to judge. */
  checked: boolean;
  ratio: number | null;
  mismatch: boolean;
}

/**
 * Best-effort check that `text` is written in the script expected for
 * `locale`. IDs, vehicle names, and money values are expected to stay in
 * Latin/ASCII even in a correctly localized answer, so this only flags a
 * mismatch when the match ratio is negligible, not merely "not 100%".
 */
export function checkScriptConformance(
  locale: string,
  text: string,
): ScriptConformanceResult {
  const pattern = SCRIPT_PATTERNS[normalizeAssistantLocale(locale)];
  if (!pattern) return { checked: false, ratio: null, mismatch: false };
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < MIN_LETTERS_FOR_SCRIPT_CHECK) {
    return { checked: false, ratio: null, mismatch: false };
  }
  const scriptMatches = text.match(pattern) ?? [];
  const ratio = scriptMatches.length / letters.length;
  return {
    checked: true,
    ratio,
    mismatch: ratio < SCRIPT_MATCH_RATIO_THRESHOLD,
  };
}

// ---------------------------------------------------------------------------
// Locale-aware money formatting for deterministic (non-model) content.
// ---------------------------------------------------------------------------

export function formatMoney(value: number, locale: string): string {
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  };
  try {
    return new Intl.NumberFormat(normalizeAssistantLocale(locale), options)
      .format(value);
  } catch {
    return new Intl.NumberFormat("en-IN", options).format(value);
  }
}

// ---------------------------------------------------------------------------
// Deterministic server-side string catalog.
//
// These are the fixed strings actions.ts/confirmation.ts/openai.ts emit
// outside model control (confirmation `changes` labels, receipt content,
// fallback confirm/cancel chrome) — the model can translate its own
// generated titles/summaries, but never these.
// ---------------------------------------------------------------------------

export interface AssistantStringCatalog {
  onboardPurchasedVehicleTitle: string;
  completeVehicleSaleTitle: string;
  /** Placeholders: {{vehicle}}, {{listing}} */
  createVehicleSummary: string;
  completeSaleSummary: string;
  draftListingWord: string;
  noListingWord: string;

  vehicleLabel: string;
  purchaseTotalLabel: string;
  askingPriceLabel: string;
  notSetValue: string;
  vehicleIdLabel: string;
  netRevenueLabel: string;
  vehicleStatusLabel: string;
  expectedGrossProfitLabel: string;

  vehicleOnboardedTitle: string;
  saleCompletedTitle: string;
  stockNumberLabel: string;
  purchasePaymentLabel: string;
  recordedValue: string;
  notRecordedValue: string;
  listingLabel: string;
  draftCreatedValue: string;
  notCreatedValue: string;
  totalVehicleCostLabel: string;
  grossProfitLabel: string;
  grossLossLabel: string;
  partnerDistributionsLabel: string;
  unallocatedProfitLabel: string;
  openVehicleActionLabel: string;

  confirmLabel: string;
  cancelLabel: string;
  cancelProposedActionMessage: string;

  saleCompleteReviewFiguresMessage: string;
  /** Placeholders: {{netRevenue}}, {{profitPhrase}}, {{amount}} */
  saleCompleteMessageTemplate: string;
  /** Placeholders: {{stock}}, {{paymentStatus}}, {{listingStatus}} */
  vehicleOnboardedMessageTemplate: string;
}

export const ASSISTANT_STRINGS: Record<AssistantLocale, AssistantStringCatalog> = {
  "en-IN": {
    onboardPurchasedVehicleTitle: "Onboard purchased vehicle",
    completeVehicleSaleTitle: "Complete vehicle sale",
    createVehicleSummary:
      "Create {{vehicle}}, its purchase, reconciled payment, and {{listing}} atomically.",
    completeSaleSummary:
      "Complete the sale, receipt, vehicle/listing status, and partner distributions atomically.",
    draftListingWord: "draft listing",
    noListingWord: "no listing",

    vehicleLabel: "Vehicle",
    purchaseTotalLabel: "Purchase total",
    askingPriceLabel: "Asking price",
    notSetValue: "Not set",
    vehicleIdLabel: "Vehicle ID",
    netRevenueLabel: "Net revenue",
    vehicleStatusLabel: "Vehicle status",
    expectedGrossProfitLabel: "Expected gross profit",

    vehicleOnboardedTitle: "Vehicle onboarded",
    saleCompletedTitle: "Sale completed",
    stockNumberLabel: "Stock number",
    purchasePaymentLabel: "Purchase payment",
    recordedValue: "Recorded",
    notRecordedValue: "Not recorded",
    listingLabel: "Listing",
    draftCreatedValue: "Draft created",
    notCreatedValue: "Not created",
    totalVehicleCostLabel: "Total vehicle cost",
    grossProfitLabel: "Gross profit",
    grossLossLabel: "Gross loss",
    partnerDistributionsLabel: "Partner distributions",
    unallocatedProfitLabel: "Unallocated profit",
    openVehicleActionLabel: "Open vehicle",

    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    cancelProposedActionMessage: "Cancel this proposed action.",

    saleCompleteReviewFiguresMessage:
      "The sale is complete. Review the vehicle for the final figures.",
    saleCompleteMessageTemplate:
      "The sale is complete. Net revenue {{netRevenue}}, {{profitPhrase}} {{amount}}.",
    vehicleOnboardedMessageTemplate:
      "Vehicle {{stock}} onboarded. Purchase: {{paymentStatus}}. Listing: {{listingStatus}}.",
  },
  "hi-IN": {
    onboardPurchasedVehicleTitle: "खरीदे गए वाहन को ऑनबोर्ड करें",
    completeVehicleSaleTitle: "वाहन की बिक्री पूरी करें",
    createVehicleSummary:
      "{{vehicle}}, उसकी खरीद, मिलान किया गया भुगतान और {{listing}} एक साथ बनाएं।",
    completeSaleSummary:
      "बिक्री, रसीद, वाहन/लिस्टिंग स्थिति और पार्टनर वितरण को एक साथ पूरा करें।",
    draftListingWord: "ड्राफ्ट लिस्टिंग",
    noListingWord: "कोई लिस्टिंग नहीं",

    vehicleLabel: "वाहन",
    purchaseTotalLabel: "कुल खरीद राशि",
    askingPriceLabel: "मांग मूल्य",
    notSetValue: "सेट नहीं है",
    vehicleIdLabel: "वाहन आईडी",
    netRevenueLabel: "शुद्ध राजस्व",
    vehicleStatusLabel: "वाहन स्थिति",
    expectedGrossProfitLabel: "अपेक्षित सकल लाभ",

    vehicleOnboardedTitle: "वाहन ऑनबोर्ड हो गया",
    saleCompletedTitle: "बिक्री पूर्ण हुई",
    stockNumberLabel: "स्टॉक नंबर",
    purchasePaymentLabel: "खरीद भुगतान",
    recordedValue: "दर्ज किया गया",
    notRecordedValue: "दर्ज नहीं किया गया",
    listingLabel: "लिस्टिंग",
    draftCreatedValue: "ड्राफ्ट बनाया गया",
    notCreatedValue: "नहीं बनाया गया",
    totalVehicleCostLabel: "कुल वाहन लागत",
    grossProfitLabel: "सकल लाभ",
    grossLossLabel: "सकल हानि",
    partnerDistributionsLabel: "पार्टनर वितरण",
    unallocatedProfitLabel: "अनआवंटित लाभ",
    openVehicleActionLabel: "वाहन खोलें",

    confirmLabel: "पुष्टि करें",
    cancelLabel: "रद्द करें",
    cancelProposedActionMessage: "इस प्रस्तावित कार्रवाई को रद्द करें।",

    saleCompleteReviewFiguresMessage:
      "बिक्री पूर्ण हो गई है। अंतिम आंकड़ों के लिए वाहन देखें।",
    saleCompleteMessageTemplate:
      "बिक्री पूर्ण हो गई है। शुद्ध राजस्व {{netRevenue}}, {{profitPhrase}} {{amount}}।",
    vehicleOnboardedMessageTemplate:
      "वाहन {{stock}} ऑनबोर्ड हो गया। खरीद: {{paymentStatus}}। लिस्टिंग: {{listingStatus}}।",
  },
  "ta-IN": {
    onboardPurchasedVehicleTitle: "வாங்கிய வாகனத்தைச் சேர்க்கவும்",
    completeVehicleSaleTitle: "வாகன விற்பனையை முடிக்கவும்",
    createVehicleSummary:
      "{{vehicle}}, அதன் வாங்குதல், சரிசெய்யப்பட்ட கட்டணம் மற்றும் {{listing}} ஆகியவற்றை ஒரே செயலாக உருவாக்கவும்.",
    completeSaleSummary:
      "விற்பனை, ரசீது, வாகனம்/பட்டியல் நிலை மற்றும் பங்குதாரர் பங்கீடுகளை ஒரே செயலாக முடிக்கவும்.",
    draftListingWord: "வரைவு பட்டியல்",
    noListingWord: "பட்டியல் இல்லை",

    vehicleLabel: "வாகனம்",
    purchaseTotalLabel: "மொத்த வாங்குதல் தொகை",
    askingPriceLabel: "கேட்கும் விலை",
    notSetValue: "அமைக்கப்படவில்லை",
    vehicleIdLabel: "வாகன ஐடி",
    netRevenueLabel: "நிகர வருவாய்",
    vehicleStatusLabel: "வாகன நிலை",
    expectedGrossProfitLabel: "எதிர்பார்க்கப்படும் மொத்த லாபம்",

    vehicleOnboardedTitle: "வாகனம் சேர்க்கப்பட்டது",
    saleCompletedTitle: "விற்பனை முடிந்தது",
    stockNumberLabel: "ஸ்டாக் எண்",
    purchasePaymentLabel: "வாங்குதல் கட்டணம்",
    recordedValue: "பதிவு செய்யப்பட்டது",
    notRecordedValue: "பதிவு செய்யப்படவில்லை",
    listingLabel: "பட்டியல்",
    draftCreatedValue: "வரைவு உருவாக்கப்பட்டது",
    notCreatedValue: "உருவாக்கப்படவில்லை",
    totalVehicleCostLabel: "மொத்த வாகன செலவு",
    grossProfitLabel: "மொத்த லாபம்",
    grossLossLabel: "மொத்த நஷ்டம்",
    partnerDistributionsLabel: "பங்குதாரர் பங்கீடுகள்",
    unallocatedProfitLabel: "ஒதுக்கப்படாத லாபம்",
    openVehicleActionLabel: "வாகனத்தைத் திற",

    confirmLabel: "உறுதிப்படுத்து",
    cancelLabel: "ரத்துசெய்",
    cancelProposedActionMessage: "இந்த முன்மொழியப்பட்ட செயலை ரத்துசெய்.",

    saleCompleteReviewFiguresMessage:
      "விற்பனை முடிந்துவிட்டது. இறுதி புள்ளிவிவரங்களுக்கு வாகனத்தைப் பார்க்கவும்.",
    saleCompleteMessageTemplate:
      "விற்பனை முடிந்துவிட்டது. நிகர வருவாய் {{netRevenue}}, {{profitPhrase}} {{amount}}.",
    vehicleOnboardedMessageTemplate:
      "வாகனம் {{stock}} சேர்க்கப்பட்டது. வாங்குதல்: {{paymentStatus}}. பட்டியல்: {{listingStatus}}.",
  },
  "ml-IN": {
    onboardPurchasedVehicleTitle: "വാങ്ങിയ വാഹനം ചേർക്കുക",
    completeVehicleSaleTitle: "വാഹന വിൽപ്പന പൂർത്തിയാക്കുക",
    createVehicleSummary:
      "{{vehicle}}, അതിന്റെ വാങ്ങൽ, ഒത്തുനോക്കിയ പേയ്മെന്റ്, {{listing}} എന്നിവ ഒരുമിച്ച് സൃഷ്ടിക്കുക.",
    completeSaleSummary:
      "വിൽപ്പന, രസീത്, വാഹനം/ലിസ്റ്റിംഗ് നില, പങ്കാളി വിതരണം എന്നിവ ഒരുമിച്ച് പൂർത്തിയാക്കുക.",
    draftListingWord: "ഡ്രാഫ്റ്റ് ലിസ്റ്റിംഗ്",
    noListingWord: "ലിസ്റ്റിംഗ് ഇല്ല",

    vehicleLabel: "വാഹനം",
    purchaseTotalLabel: "മൊത്തം വാങ്ങൽ തുക",
    askingPriceLabel: "ചോദിക്കുന്ന വില",
    notSetValue: "സജ്ജമാക്കിയിട്ടില്ല",
    vehicleIdLabel: "വാഹന ഐഡി",
    netRevenueLabel: "അറ്റാദായം",
    vehicleStatusLabel: "വാഹന നില",
    expectedGrossProfitLabel: "പ്രതീക്ഷിത മൊത്ത ലാഭം",

    vehicleOnboardedTitle: "വാഹനം ചേർത്തു",
    saleCompletedTitle: "വിൽപ്പന പൂർത്തിയായി",
    stockNumberLabel: "സ്റ്റോക്ക് നമ്പർ",
    purchasePaymentLabel: "വാങ്ങൽ പേയ്മെന്റ്",
    recordedValue: "രേഖപ്പെടുത്തി",
    notRecordedValue: "രേഖപ്പെടുത്തിയിട്ടില്ല",
    listingLabel: "ലിസ്റ്റിംഗ്",
    draftCreatedValue: "ഡ്രാഫ്റ്റ് സൃഷ്ടിച്ചു",
    notCreatedValue: "സൃഷ്ടിച്ചിട്ടില്ല",
    totalVehicleCostLabel: "മൊത്തം വാഹന ചെലവ്",
    grossProfitLabel: "മൊത്ത ലാഭം",
    grossLossLabel: "മൊത്ത നഷ്ടം",
    partnerDistributionsLabel: "പങ്കാളി വിതരണങ്ങൾ",
    unallocatedProfitLabel: "അനുവദിക്കാത്ത ലാഭം",
    openVehicleActionLabel: "വാഹനം തുറക്കുക",

    confirmLabel: "സ്ഥിരീകരിക്കുക",
    cancelLabel: "റദ്ദാക്കുക",
    cancelProposedActionMessage: "ഈ നിർദ്ദിഷ്ട പ്രവർത്തനം റദ്ദാക്കുക.",

    saleCompleteReviewFiguresMessage:
      "വിൽപ്പന പൂർത്തിയായി. അന്തിമ കണക്കുകൾക്കായി വാഹനം പരിശോധിക്കുക.",
    saleCompleteMessageTemplate:
      "വിൽപ്പന പൂർത്തിയായി. അറ്റാദായം {{netRevenue}}, {{profitPhrase}} {{amount}}.",
    vehicleOnboardedMessageTemplate:
      "വാഹനം {{stock}} ചേർത്തു. വാങ്ങൽ: {{paymentStatus}}. ലിസ്റ്റിംഗ്: {{listingStatus}}.",
  },
  "kn-IN": {
    onboardPurchasedVehicleTitle: "ಖರೀದಿಸಿದ ವಾಹನವನ್ನು ಸೇರಿಸಿ",
    completeVehicleSaleTitle: "ವಾಹನ ಮಾರಾಟವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ",
    createVehicleSummary:
      "{{vehicle}}, ಅದರ ಖರೀದಿ, ಹೊಂದಾಣಿಕೆಯಾದ ಪಾವತಿ, ಮತ್ತು {{listing}} ಅನ್ನು ಒಟ್ಟಿಗೆ ರಚಿಸಿ.",
    completeSaleSummary:
      "ಮಾರಾಟ, ರಸೀದಿ, ವಾಹನ/ಪಟ್ಟಿ ಸ್ಥಿತಿ, ಮತ್ತು ಪಾಲುದಾರ ಹಂಚಿಕೆಗಳನ್ನು ಒಟ್ಟಿಗೆ ಪೂರ್ಣಗೊಳಿಸಿ.",
    draftListingWord: "ಕರಡು ಪಟ್ಟಿ",
    noListingWord: "ಪಟ್ಟಿ ಇಲ್ಲ",

    vehicleLabel: "ವಾಹನ",
    purchaseTotalLabel: "ಒಟ್ಟು ಖರೀದಿ ಮೊತ್ತ",
    askingPriceLabel: "ಕೇಳುವ ಬೆಲೆ",
    notSetValue: "ಹೊಂದಿಸಲಾಗಿಲ್ಲ",
    vehicleIdLabel: "ವಾಹನ ಐಡಿ",
    netRevenueLabel: "ನಿವ್ವಳ ಆದಾಯ",
    vehicleStatusLabel: "ವಾಹನ ಸ್ಥಿತಿ",
    expectedGrossProfitLabel: "ನಿರೀಕ್ಷಿತ ಒಟ್ಟು ಲಾಭ",

    vehicleOnboardedTitle: "ವಾಹನ ಸೇರಿಸಲಾಗಿದೆ",
    saleCompletedTitle: "ಮಾರಾಟ ಪೂರ್ಣಗೊಂಡಿದೆ",
    stockNumberLabel: "ಸ್ಟಾಕ್ ಸಂಖ್ಯೆ",
    purchasePaymentLabel: "ಖರೀದಿ ಪಾವತಿ",
    recordedValue: "ದಾಖಲಿಸಲಾಗಿದೆ",
    notRecordedValue: "ದಾಖಲಿಸಲಾಗಿಲ್ಲ",
    listingLabel: "ಪಟ್ಟಿ",
    draftCreatedValue: "ಕರಡು ರಚಿಸಲಾಗಿದೆ",
    notCreatedValue: "ರಚಿಸಲಾಗಿಲ್ಲ",
    totalVehicleCostLabel: "ಒಟ್ಟು ವಾಹನ ವೆಚ್ಚ",
    grossProfitLabel: "ಒಟ್ಟು ಲಾಭ",
    grossLossLabel: "ಒಟ್ಟು ನಷ್ಟ",
    partnerDistributionsLabel: "ಪಾಲುದಾರ ಹಂಚಿಕೆಗಳು",
    unallocatedProfitLabel: "ಹಂಚಿಕೆಯಾಗದ ಲಾಭ",
    openVehicleActionLabel: "ವಾಹನ ತೆರೆಯಿರಿ",

    confirmLabel: "ದೃಢೀಕರಿಸಿ",
    cancelLabel: "ರದ್ದುಮಾಡಿ",
    cancelProposedActionMessage: "ಈ ಪ್ರಸ್ತಾವಿತ ಕ್ರಿಯೆಯನ್ನು ರದ್ದುಮಾಡಿ.",

    saleCompleteReviewFiguresMessage:
      "ಮಾರಾಟ ಪೂರ್ಣಗೊಂಡಿದೆ. ಅಂತಿಮ ಅಂಕಿಅಂಶಗಳಿಗಾಗಿ ವಾಹನವನ್ನು ಪರಿಶೀಲಿಸಿ.",
    saleCompleteMessageTemplate:
      "ಮಾರಾಟ ಪೂರ್ಣಗೊಂಡಿದೆ. ನಿವ್ವಳ ಆದಾಯ {{netRevenue}}, {{profitPhrase}} {{amount}}.",
    vehicleOnboardedMessageTemplate:
      "ವಾಹನ {{stock}} ಸೇರಿಸಲಾಗಿದೆ. ಖರೀದಿ: {{paymentStatus}}. ಪಟ್ಟಿ: {{listingStatus}}.",
  },
  "te-IN": {
    onboardPurchasedVehicleTitle: "కొనుగోలు చేసిన వాహనాన్ని జోడించండి",
    completeVehicleSaleTitle: "వాహన అమ్మకాన్ని పూర్తి చేయండి",
    createVehicleSummary:
      "{{vehicle}}, దాని కొనుగోలు, సరిపోల్చిన చెల్లింపు మరియు {{listing}}ను ఒకేసారి సృష్టించండి.",
    completeSaleSummary:
      "అమ్మకం, రసీదు, వాహనం/జాబితా స్థితి మరియు భాగస్వామి పంపిణీలను ఒకేసారి పూర్తి చేయండి.",
    draftListingWord: "డ్రాఫ్ట్ జాబితా",
    noListingWord: "జాబితా లేదు",

    vehicleLabel: "వాహనం",
    purchaseTotalLabel: "మొత్తం కొనుగోలు మొత్తం",
    askingPriceLabel: "అడిగే ధర",
    notSetValue: "సెట్ చేయలేదు",
    vehicleIdLabel: "వాహన ఐడి",
    netRevenueLabel: "నికర ఆదాయం",
    vehicleStatusLabel: "వాహన స్థితి",
    expectedGrossProfitLabel: "అంచనా స్థూల లాభం",

    vehicleOnboardedTitle: "వాహనం జోడించబడింది",
    saleCompletedTitle: "అమ్మకం పూర్తయింది",
    stockNumberLabel: "స్టాక్ నంబర్",
    purchasePaymentLabel: "కొనుగోలు చెల్లింపు",
    recordedValue: "నమోదు చేయబడింది",
    notRecordedValue: "నమోదు చేయలేదు",
    listingLabel: "జాబితా",
    draftCreatedValue: "డ్రాఫ్ట్ సృష్టించబడింది",
    notCreatedValue: "సృష్టించలేదు",
    totalVehicleCostLabel: "మొత్తం వాహన ఖర్చు",
    grossProfitLabel: "స్థూల లాభం",
    grossLossLabel: "స్థూల నష్టం",
    partnerDistributionsLabel: "భాగస్వామి పంపిణీలు",
    unallocatedProfitLabel: "కేటాయించని లాభం",
    openVehicleActionLabel: "వాహనాన్ని తెరవండి",

    confirmLabel: "నిర్ధారించండి",
    cancelLabel: "రద్దు చేయండి",
    cancelProposedActionMessage: "ఈ ప్రతిపాదిత చర్యను రద్దు చేయండి.",

    saleCompleteReviewFiguresMessage:
      "అమ్మకం పూర్తయింది. తుది గణాంకాల కోసం వాహనాన్ని పరిశీలించండి.",
    saleCompleteMessageTemplate:
      "అమ్మకం పూర్తయింది. నికర ఆదాయం {{netRevenue}}, {{profitPhrase}} {{amount}}.",
    vehicleOnboardedMessageTemplate:
      "వాహనం {{stock}} జోడించబడింది. కొనుగోలు: {{paymentStatus}}. జాబితా: {{listingStatus}}.",
  },
};

export function assistantStrings(locale: string): AssistantStringCatalog {
  return ASSISTANT_STRINGS[normalizeAssistantLocale(locale)];
}

export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match);
}
