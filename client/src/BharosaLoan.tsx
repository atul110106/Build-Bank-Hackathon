import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Bike,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  HeartHandshake,
  IndianRupee,
  Languages,
  Leaf,
  MessageCircle,
  RotateCcw,
  Send,
  Sprout,
  Store,
  Undo2,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";

type Lang = "en" | "hi";
type Step =
  | "language"
  | "basics"
  | "structure"
  | "lender"
  | "insurance"
  | "review"
  | "confirm";
type BufferMode = "before" | "distributed";
type PurposeId = "crop" | "vehicle" | "capital" | "livestock" | "shop";
type IncomeId = "daily" | "gig" | "seasonal" | "mixed";

type Lender = {
  id: string;
  name: string;
  kind: "nbfc" | "bank";
  rate: number;
  processingFee: number;
  badge: "registered" | "licensed";
  focusEn: string;
  focusHi: string;
};

type ChatMsg = { id: number; role: "user" | "bot"; text: string };

const STEPS: Step[] = [
  "language",
  "basics",
  "structure",
  "lender",
  "insurance",
  "review",
  "confirm",
];

const TENURE_OPTIONS = [6, 12, 24, 36] as const;
type TenureMonths = (typeof TENURE_OPTIONS)[number];
const MIN_EMI_RATIO = 0.6;
const MAX_EMI_RATIO = 1.4;
const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 200_000;
const UNDO_SECONDS = 30;

/** Longer tenures unlock as the loan amount grows. */
function availableTenures(amount: number): TenureMonths[] {
  const opts: TenureMonths[] = [6, 12];
  if (amount >= 25_000) opts.push(24);
  if (amount >= 50_000) opts.push(36);
  return opts;
}

function tenureUnlockHint(months: TenureMonths, lang: Lang): string | null {
  if (months === 24) {
    return lang === "hi" ? "₹25,000 या अधिक पर उपलब्ध" : "Available from ₹25,000";
  }
  if (months === 36) {
    return lang === "hi" ? "₹50,000 या अधिक पर उपलब्ध" : "Available from ₹50,000";
  }
  return null;
}

const LENDERS: Lender[] = [
  {
    id: "trustfin",
    name: "TrustFin NBFC",
    kind: "nbfc",
    rate: 12.4,
    processingFee: 0,
    badge: "registered",
    focusEn: "No processing fee. Clear for first-time borrowers.",
    focusHi: "कोई प्रोसेसिंग शुल्क नहीं। पहली बार ऋण लेने वालों के लिए साफ़ शर्तें।",
  },
  {
    id: "nova",
    name: "Nova Bank",
    kind: "bank",
    rate: 11.9,
    processingFee: 499,
    badge: "licensed",
    focusEn: "Lowest listed bank rate. ₹499 processing fee, shown up front.",
    focusHi: "सबसे कम सूचीबद्ध बैंक दर। ₹499 प्रोसेसिंग शुल्क, पहले से दिखता है।",
  },
  {
    id: "sahayak",
    name: "Sahayak Capital NBFC",
    kind: "nbfc",
    rate: 13.0,
    processingFee: 0,
    badge: "registered",
    focusEn: "Built around irregular weekly payouts.",
    focusHi: "अनियमित साप्ताहिक कमाई को ध्यान में रखकर बनाया गया।",
  },
  {
    id: "riverstone",
    name: "Riverstone Bank",
    kind: "bank",
    rate: 12.0,
    processingFee: 350,
    badge: "licensed",
    focusEn: "Bank partner for gig and daily-wage income. ₹350 processing fee.",
    focusHi: "गिग और दैनिक मज़दूरी के लिए बैंक साझेदार। ₹350 प्रोसेसिंग शुल्क।",
  },
  {
    id: "harvest",
    name: "HarvestLink NBFC",
    kind: "nbfc",
    rate: 12.1,
    processingFee: 250,
    badge: "registered",
    focusEn: "Crop-cycle friendly. ₹250 processing fee, no other add-ons.",
    focusHi: "फसल चक्र के अनुकूल। ₹250 प्रोसेसिंग शुल्क, कोई और जोड़ नहीं।",
  },
  {
    id: "apexco",
    name: "Apex Cooperative Bank",
    kind: "bank",
    rate: 12.6,
    processingFee: 0,
    badge: "licensed",
    focusEn: "Cooperative bank option with ₹0 processing fee.",
    focusHi: "सहकारी बैंक विकल्प — प्रोसेसिंग शुल्क ₹0।",
  },
];

const PURPOSES: { id: PurposeId; icon: typeof Sprout }[] = [
  { id: "crop", icon: Sprout },
  { id: "vehicle", icon: Bike },
  { id: "capital", icon: Wallet },
  { id: "livestock", icon: Leaf },
  { id: "shop", icon: Store },
];

const INCOMES: { id: IncomeId }[] = [
  { id: "daily" },
  { id: "gig" },
  { id: "seasonal" },
  { id: "mixed" },
];

const COPY = {
  en: {
    brand: "BharosaLoan",
    tagline: "A loan that waits when your income cannot.",
    exit: "Back to banking",
    langSwitch: "Language",
    mute: "Mute voice",
    unmute: "Unmute voice",
    replay: "Replay voice guide",
    voiceOn: "Voice on",
    voiceOff: "Voice off",
    next: "Continue",
    back: "Back",
    skipIns: "Continue without protection",
    chooseLang: "Choose your language",
    chooseLangSub: "You can switch anytime. Voice guidance will follow this language.",
    english: "English",
    hindi: "हिन्दी",
    stepOf: "Step {n} of {total}",
    basicsTitle: "Tell us what you need",
    basicsSub:
      "There is no credit score trap here. We only need the amount, why you need it, and how money usually arrives for you.",
    amount: "Loan amount",
    amountHint: "You can pick a preset or use the slider. Range ₹10,000 – ₹2,00,000.",
    purpose: "Purpose of this loan",
    purposeCrop: "Crop cycle",
    purposeVehicle: "Vehicle for gig work",
    purposeCapital: "Working capital",
    purposeLivestock: "Livestock or farm tools",
    purposeShop: "Shop stock / small trade",
    income: "How does money usually arrive?",
    incomeDaily: "Most days — amounts change",
    incomeGig: "Gig or platform payouts (weekly)",
    incomeSeasonal: "Seasonal — harvest or peak months",
    incomeMixed: "Mixed / hard to predict",
    incomeHintSeasonal:
      "A 12-month buffer is often helpful for harvest cycles. You can still choose 6 months.",
    incomeHintOther:
      "A 6-month buffer is a common starting point. You can choose 12 if you want more breathing room.",
    structureTitle: "How repayment actually works",
    structureSub:
      "Choose your repayment tenure. Buffer months are extra time with no extra interest.",
    tenureLen: "Loan repayment tenure",
    tenureHint: "Longer tenures unlock as your loan amount increases.",
    tenureLocked: "Increase loan amount to unlock",
    monthsN: "{n} months",
    bufferLen: "Buffer length",
    months6: "6 months",
    months12: "12 months",
    bufferMode: "Where should the buffer sit?",
    modeBefore: "Before repayment starts",
    modeBeforeHint: "No instalment until the buffer ends. Interest still does not run in this wait.",
    modeDist: "Skip-eligible months inside the tenure",
    modeDistHint: "Repayment months plus skip months spread through the calendar.",
    timelineLegendRepay: "Repayment month",
    timelineLegendBuffer: "Buffer / skip — ₹0, no interest",
    interestTitle: "Interest is only on repayment months",
    interestOn24: "Interest on repayment tenure",
    interestOnBuffer: "Interest on buffer period",
    interestSaved: "Amount you do not pay because the buffer is interest-free",
    interestSavedHint:
      "If interest had run on the unpaid principal during the buffer, this extra amount would have been added. BharosaLoan does not add it.",
    ratePreview:
      "Preview rate {rate}% p.a. — used only so you can see the buffer math. Your partner on the next step sets the final rate.",
    emiTitle: "Flexible instalments (60% – 140%)",
    emiSub:
      "Tap a repayment month and move it up or down. Other unlocked months rebalance so the tenure total still matches.",
    stdEmi: "Standard instalment",
    minEmi: "Low-income floor (60%)",
    maxEmi: "Good-income cap (140%)",
    thisMonth: "Selected month",
    resetMonths: "Reset all months to standard",
    lockHint: "Adjusted",
    gapOver: "Scheduled total is {n} above the required tenure amount.",
    gapUnder: "{n} still needs to be placed in other months (within the 60–140% band).",
    gapOk: "Tenure total matches. You can still reshuffle months.",
    calendarSpan: "Calendar span: {n} months",
    repayCount: "{n} months of actual repayment",
    lenderTitle: "Choose a bank or NBFC partner",
    lenderSub:
      "Filter by Bank or NBFC. Every partner shows an RBI badge, rate, and fee before you pick.",
    filterAll: "All partners",
    filterBank: "Banks",
    filterNbfc: "NBFCs",
    kindBank: "Bank",
    kindNbfc: "NBFC",
    rbiReg: "RBI Registered",
    rbiLic: "RBI Licensed",
    annualRate: "Annual interest",
    procFee: "Processing fee",
    none: "₹0",
    youReceive: "You receive",
    monthlyStd: "Standard monthly instalment",
    selected: "Selected",
    insTitle: "Optional protection — only if you want it",
    insSub:
      "This is a safety net you can attach to the loan. It is off unless you switch it on. Nothing is pre-selected.",
    insToggleOff: "No protection added",
    insToggleOn: "Add protection to this loan",
    insCover: "If a covered event happens, pay this share of whatever you still owe",
    insCoverOf: "{pct}% of outstanding amount",
    insExample: "Example if the event happened today: about {cover} of {principal} could be covered.",
    insFee: "One-time protection fee",
    insFeeHint: "Charged once, shown in your total. No monthly surprise.",
    insEvents: "Covered events (you would need to share documents)",
    insE1: "Crop failure after flood or drought",
    insE2: "Serious illness that stops you from working",
    insE3: "Loss of your main income source",
    insNot: "This does not cover a missed payment by choice, and it does not hide any other fee.",
    insTone:
      "Think of it as practical protection if the unexpected happens — not a requirement to get the loan.",
    reviewTitle: "Review every rupee before you confirm",
    reviewSub: "Please read this page. Voice guidance will also read the totals.",
    ack:
      "I have read the total I will repay ({total}). No other fee will be added without my agreement.",
    confirmCta: "Confirm application",
    confirmNeedAck: "Tick the box above to confirm you have seen the full total.",
    breakdown: "Payment breakdown",
    principal: "Loan amount you receive",
    interest: "Interest (repayment months only)",
    bufferInterest: "Buffer-period interest",
    proc: "Processing fee",
    protFee: "Protection fee (optional)",
    protNone: "Not added",
    grand: "Total you repay",
    tenure: "Repayment tenure",
    bufferLine: "Buffer",
    partner: "Partner",
    purposeLine: "Purpose",
    incomeLine: "Income pattern",
    coverLine: "Protection cover",
    confirmTitle: "Application received",
    confirmSub:
      "You can cancel this application in the next {n} seconds. Or skip the wait if you are sure.",
    undo: "Cancel this application",
    undone: "Application cancelled. No amount is due.",
    doneKeep: "Keep this application",
    afterUndo: "Nothing was submitted. You can start again or leave.",
    restart: "Start over",
    cooling: "Cancel window open — 30 seconds",
    coolingClosed: "Cancel window ended — you can still exit; no money has been sent in this prototype.",
    skipWait: "Skip wait & keep application",
    waitSkipped: "Wait skipped. Your application is kept. No money has been sent in this prototype.",
    speaking: "Speaking…",
    voiceUnavailable: "Audio voice is limited on this device — please read the subtitle below.",
    trustTitle: "Trust checklist",
    trustRbi: "RBI-verified partners only",
    trustExit: "Cancel or exit anytime",
    trustLang: "Language chosen",
    trustDetails: "Amount and purpose set",
    trustStructure: "Buffer and flexible instalments shown",
    trustPartner: "Verified partner selected",
    trustPrice: "Full price shown before confirm",
    chatTitle: "Ask about this loan",
    chatPh: "Type a question…",
    chatHello:
      "Hello. Ask about the buffer, instalments, missed payments, or protection. I use short prepared answers in this prototype.",
    chatTyping: "Thinking…",
    subtitleLabel: "Voice guide (also on screen)",
    prototype: "Prototype · fictional partners only · not a real loan offer",
    month: "Month {n}",
    skipMonth: "Skip",
    repayMonth: "Pay",
    waitMonth: "Wait",
    flexBand: "Your band this month",
    years2: "{n} months repayment",
    plusBuffer: "+ {n} buffer months",
  },
  hi: {
    brand: "BharosaLoan",
    tagline: "जब कमाई रुक जाए, किस्त इंतज़ार कर सकती है।",
    exit: "बैंकिंग पर वापस",
    langSwitch: "भाषा",
    mute: "आवाज़ बंद करें",
    unmute: "आवाज़ चालू करें",
    replay: "गाइड फिर से सुनें",
    voiceOn: "आवाज़ चालू",
    voiceOff: "आवाज़ बंद",
    next: "आगे बढ़ें",
    back: "पीछे",
    skipIns: "बिना सुरक्षा के आगे बढ़ें",
    chooseLang: "अपनी भाषा चुनें",
    chooseLangSub: "आप कभी भी बदल सकते हैं। आवाज़ी गाइड इसी भाषा में चलेगी।",
    english: "English",
    hindi: "हिन्दी",
    stepOf: "चरण {n} / {total}",
    basicsTitle: "आपको कितनी राशि चाहिए",
    basicsSub:
      "यहाँ क्रेडिट स्कोर का जाल नहीं है। केवल राशि, वजह, और पैसे आमतौर पर कैसे आते हैं — बस इतना बताएँ।",
    amount: "ऋण राशि",
    amountHint: "तैयार विकल्प चुनें या स्लाइडर चलाएँ। सीमा ₹10,000 – ₹2,00,000।",
    purpose: "यह ऋण किस काम के लिए है",
    purposeCrop: "फसल चक्र",
    purposeVehicle: "गिग काम के लिए वाहन",
    purposeCapital: "कामकाजी पूँजी",
    purposeLivestock: "पशुधन या कृषि औज़ार",
    purposeShop: "दुकान का माल / छोटा व्यापार",
    income: "पैसे आमतौर पर कैसे आते हैं?",
    incomeDaily: "ज़्यादातर दिनों में — राशि बदलती रहती है",
    incomeGig: "गिग या प्लेटफ़ॉर्म भुगतान (साप्ताहिक)",
    incomeSeasonal: "मौसमी — फसल या व्यस्त महीने",
    incomeMixed: "मिला-जुला / अनुमान लगाना कठिन",
    incomeHintSeasonal:
      "फसल चक्र के लिए अक्सर 12 महीने की राहत अवधि मददगार होती है। फिर भी आप 6 महीने चुन सकते हैं।",
    incomeHintOther:
      "6 महीने की राहत अवधि एक साधारण शुरुआत है। ज़्यादा समय चाहिए तो 12 महीने चुनें।",
    structureTitle: "वापसी वास्तव में कैसे होती है",
    structureSub:
      "अपनी वापसी अवधि चुनें। राहत के महीने अतिरिक्त समय हैं — उन पर कोई अतिरिक्त ब्याज नहीं।",
    tenureLen: "ऋण वापसी की अवधि",
    tenureHint: "ऋण राशि बढ़ने पर लंबी अवधि खुलती है।",
    tenureLocked: "खोलने के लिए ऋण राशि बढ़ाएँ",
    monthsN: "{n} महीने",
    bufferLen: "राहत अवधि की लंबाई",
    months6: "6 महीने",
    months12: "12 महीने",
    bufferMode: "राहत अवधि कहाँ रहे?",
    modeBefore: "वापसी शुरू होने से पहले",
    modeBeforeHint: "राहत खत्म होने तक किस्त नहीं। इस इंतज़ार पर ब्याज नहीं चलता।",
    modeDist: "अवधि के अंदर छोड़ने योग्य महीने",
    modeDistHint: "भुगतान महीनों के साथ कैलेंडर में फैले छोड़ने योग्य महीने।",
    timelineLegendRepay: "भुगतान का महीना",
    timelineLegendBuffer: "राहत / छोड़ें — ₹0, बिना ब्याज",
    interestTitle: "ब्याज केवल भुगतान महीनों पर",
    interestOn24: "वापसी अवधि पर ब्याज",
    interestOnBuffer: "राहत अवधि पर ब्याज",
    interestSaved: "राहत अवधि ब्याज-मुक्त होने से जो राशि नहीं लगती",
    interestSavedHint:
      "अगर राहत के दौरान बकाया मूल राशि पर ब्याज चलता, तो यह अतिरिक्त राशि जुड़ती। BharosaLoan इसे नहीं जोड़ता।",
    ratePreview:
      "पूर्वावलोकन दर {rate}% प्रति वर्ष — केवल राहत अवधि का हिसाब दिखाने के लिए। अगले चरण का साझेदार अंतिम दर तय करेगा।",
    emiTitle: "लचीली किस्त (60% – 140%)",
    emiSub:
      "किसी भुगतान महीने पर टैप करें और उसे ऊपर-नीचे करें। बाकी खुले महीने संतुलित हो जाते हैं ताकि अवधि का योग वही रहे।",
    stdEmi: "सामान्य किस्त",
    minEmi: "कम कमाई की न्यूनतम सीमा (60%)",
    maxEmi: "अच्छी कमाई की अधिकतम सीमा (140%)",
    thisMonth: "चुना हुआ महीना",
    resetMonths: "सभी महीने सामान्य किस्त पर लाएँ",
    lockHint: "बदला गया",
    gapOver: "निर्धारित योग ज़रूरी अवधि की राशि से {n} अधिक है।",
    gapUnder: "{n} अभी अन्य महीनों में रखना बाकी है (60–140% सीमा में)।",
    gapOk: "अवधि का योग मेल खाता है। महीने फिर से बाँट सकते हैं।",
    calendarSpan: "कैलेंडर अवधि: {n} महीने",
    repayCount: "वास्तविक वापसी के {n} महीने",
    lenderTitle: "बैंक या एनबीएफसी साझेदार चुनें",
    lenderSub:
      "बैंक या एनबीएफसी से छानें। हर साझेदार पर आरबीआई बैज, दर और शुल्क चुनने से पहले दिखता है।",
    filterAll: "सभी साझेदार",
    filterBank: "बैंक",
    filterNbfc: "एनबीएफसी",
    kindBank: "बैंक",
    kindNbfc: "एनबीएफसी",
    rbiReg: "आरबीआई पंजीकृत",
    rbiLic: "आरबीआई लाइसेंस प्राप्त",
    annualRate: "वार्षिक ब्याज",
    procFee: "प्रोसेसिंग शुल्क",
    none: "₹0",
    youReceive: "आपको मिलता है",
    monthlyStd: "सामान्य मासिक किस्त",
    selected: "चुना गया",
    insTitle: "वैकल्पिक सुरक्षा — केवल अगर आप चाहें",
    insSub:
      "यह ऋण से जोड़ा जा सकने वाला सुरक्षा जाल है। चालू करने पर ही लगता है। कुछ भी पहले से टिक नहीं है।",
    insToggleOff: "कोई सुरक्षा नहीं जोड़ी",
    insToggleOn: "इस ऋण में सुरक्षा जोड़ें",
    insCover: "कवर घटना पर, जो राशि अभी बाकी हो उसका यह हिस्सा",
    insCoverOf: "बकाया राशि का {pct}%",
    insExample: "अगर घटना आज हो: लगभग {cover} ({principal} में से) कवर हो सकते हैं।",
    insFee: "एक बार का सुरक्षा शुल्क",
    insFeeHint: "एक बार लगता है, आपके कुल में दिखता है। कोई छिपी मासिक कटौती नहीं।",
    insEvents: "कवर घटनाएँ (दस्तावेज़ साझा करने होते हैं)",
    insE1: "बाढ़ या सूखे से फसल खराब होना",
    insE2: "गंभीर बीमारी जिससे काम रुक जाए",
    insE3: "मुख्य कमाई का स्रोत छूट जाना",
    insNot: "अपनी इच्छा से छूटी किस्त इसमें नहीं आती, और कोई और शुल्क छिपा नहीं है।",
    insTone:
      "इसे अनपेक्षित स्थिति के लिए व्यावहारिक सुरक्षा मानें — ऋण पाने की शर्त नहीं।",
    reviewTitle: "पुष्टि से पहले हर रुपया देखें",
    reviewSub: "यह पृष्ठ पढ़ें। आवाज़ी गाइड कुल राशियाँ भी पढ़ेगी।",
    ack: "मैंने कुल चुकाने योग्य राशि ({total}) पढ़ ली है। मेरी सहमति के बिना कोई और शुल्क नहीं जुड़ेगा।",
    confirmCta: "आवेदन की पुष्टि करें",
    confirmNeedAck: "कुल राशि देखने की पुष्टि के लिए ऊपर वाला बॉक्स चुनें।",
    breakdown: "भुगतान का विवरण",
    principal: "आपको मिलने वाली ऋण राशि",
    interest: "ब्याज (केवल भुगतान महीने)",
    bufferInterest: "राहत अवधि का ब्याज",
    proc: "प्रोसेसिंग शुल्क",
    protFee: "सुरक्षा शुल्क (वैकल्पिक)",
    protNone: "नहीं जोड़ा",
    grand: "कुल चुकाने योग्य",
    tenure: "वापसी की अवधि",
    bufferLine: "राहत अवधि",
    partner: "साझेदार",
    purposeLine: "उद्देश्य",
    incomeLine: "कमाई का पैटर्न",
    coverLine: "सुरक्षा कवर",
    confirmTitle: "आवेदन मिल गया",
    confirmSub:
      "अगले {n} सेकंड में आप यह आवेदन रद्द कर सकते हैं। सुनिश्चित हों तो प्रतीक्षा छोड़ सकते हैं।",
    undo: "यह आवेदन रद्द करें",
    undone: "आवेदन रद्द। कोई राशि देय नहीं।",
    doneKeep: "यह आवेदन रखें",
    afterUndo: "कुछ जमा नहीं हुआ। फिर से शुरू करें या बाहर जाएँ।",
    restart: "फिर से शुरू करें",
    cooling: "रद्द करने की खिड़की खुली है — 30 सेकंड",
    coolingClosed: "रद्द खिड़की खत्म — आप बाहर जा सकते हैं; इस प्रोटोटाइप में पैसे नहीं भेजे गए।",
    skipWait: "प्रतीक्षा छोड़ें और आवेदन रखें",
    waitSkipped: "प्रतीक्षा छोड़ दी। आपका आवेदन रखा गया। इस प्रोटोटाइप में पैसे नहीं भेजे गए।",
    speaking: "बोल रहे हैं…",
    voiceUnavailable: "इस डिवाइस पर आवाज़ सीमित हो सकती है — कृपया नीचे लिखा गाइड पढ़ें।",
    trustTitle: "विश्वास सूची",
    trustRbi: "केवल आरबीआई-सत्यापित साझेदार",
    trustExit: "कभी भी रद्द या बाहर",
    trustLang: "भाषा चुनी गई",
    trustDetails: "राशि और उद्देश्य तय",
    trustStructure: "राहत और लचीली किस्त दिखाई",
    trustPartner: "सत्यापित साझेदार चुना",
    trustPrice: "पुष्टि से पहले पूरी कीमत",
    chatTitle: "इस ऋण के बारे में पूछें",
    chatPh: "प्रश्न लिखें…",
    chatHello:
      "नमस्ते। राहत अवधि, किस्त, छूटी किस्त, या सुरक्षा के बारे में पूछें। इस प्रोटोटाइप में तैयार उत्तर हैं।",
    chatTyping: "सोच रहे हैं…",
    subtitleLabel: "आवाज़ी गाइड (यहाँ लिखा भी है)",
    prototype: "प्रोटोटाइप · काल्पनिक साझेदार · वास्तविक ऋण प्रस्ताव नहीं",
    month: "महीना {n}",
    skipMonth: "छोड़ें",
    repayMonth: "भुगतान",
    waitMonth: "इंतज़ार",
    flexBand: "इस महीने आपकी सीमा",
    years2: "{n} महीने की वापसी",
    plusBuffer: "+ {n} राहत महीने",
  },
} as const;

type CopyKey = keyof typeof COPY.en;

function t(lang: Lang, key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = COPY[lang][key] || COPY.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function monthlyRate(annualPct: number): number {
  return annualPct / 12 / 100;
}

function standardEmi(principal: number, annualPct: number, months: number): number {
  const r = monthlyRate(annualPct);
  if (r === 0) return Math.round(principal / months);
  const pow = Math.pow(1 + r, months);
  return Math.round((principal * r * pow) / (pow - 1));
}

function totalInterest(principal: number, emi: number, months: number): number {
  return emi * months - principal;
}

/** Extra interest that would accrue on unpaid principal during an interest-bearing buffer. */
function bufferInterestIfCharged(principal: number, annualPct: number, bufferMonths: number): number {
  return Math.round(principal * monthlyRate(annualPct) * bufferMonths);
}

function protectionFee(principal: number, coverPct: number): number {
  const pct = 0.006 + ((coverPct - 25) / 25) * 0.008;
  return Math.round(principal * pct);
}

type CalMonth = { kind: "buffer" | "skip" | "repay"; repayIndex: number | null; calIndex: number };

function buildCalendar(repayMonths: number, bufferMonths: number, mode: BufferMode): CalMonth[] {
  if (mode === "before") {
    const wait: CalMonth[] = Array.from({ length: bufferMonths }, (_, i) => ({
      kind: "buffer" as const,
      repayIndex: null,
      calIndex: i,
    }));
    const repay: CalMonth[] = Array.from({ length: repayMonths }, (_, i) => ({
      kind: "repay" as const,
      repayIndex: i,
      calIndex: bufferMonths + i,
    }));
    return [...wait, ...repay];
  }
  const total = repayMonths + bufferMonths;
  const kinds: ("skip" | "repay")[] = Array(total).fill("repay");
  const used = new Set<number>();
  for (let i = 0; i < bufferMonths; i++) {
    let idx = Math.min(total - 1, Math.floor(((i + 0.5) * total) / bufferMonths));
    while (used.has(idx) && idx < total - 1) idx += 1;
    if (used.has(idx)) {
      idx = kinds.findIndex((k, j) => k === "repay" && !used.has(j));
    }
    if (idx >= 0) {
      kinds[idx] = "skip";
      used.add(idx);
    }
  }
  let repayIndex = 0;
  return kinds.map((kind, calIndex) => {
    if (kind === "skip") return { kind, repayIndex: null, calIndex };
    const row: CalMonth = { kind: "repay", repayIndex, calIndex };
    repayIndex += 1;
    return row;
  });
}

function rebalance(
  overrides: Record<number, number>,
  std: number,
  minEmi: number,
  maxEmi: number,
  target: number,
  repayMonths: number,
): { amounts: number[]; gap: number } {
  const amounts = Array.from({ length: repayMonths }, () => std);
  const locked = Object.keys(overrides)
    .map(Number)
    .filter((i) => i >= 0 && i < repayMonths);
  let lockedSum = 0;
  for (const i of locked) {
    amounts[i] = Math.min(maxEmi, Math.max(minEmi, Math.round(overrides[i])));
    lockedSum += amounts[i];
  }
  const unlocked = Array.from({ length: repayMonths }, (_, i) => i).filter((i) => !locked.includes(i));
  if (unlocked.length === 0) {
    const sum = amounts.reduce((a, b) => a + b, 0);
    return { amounts, gap: target - sum };
  }
  let each = Math.round((target - lockedSum) / unlocked.length);
  each = Math.min(maxEmi, Math.max(minEmi, each));
  for (const i of unlocked) amounts[i] = each;
  const sum = amounts.reduce((a, b) => a + b, 0);
  const last = unlocked[unlocked.length - 1];
  const adjusted = Math.min(maxEmi, Math.max(minEmi, amounts[last] + (target - sum)));
  amounts[last] = adjusted;
  const finalSum = amounts.reduce((a, b) => a + b, 0);
  return { amounts, gap: target - finalSum };
}

const FAQS: { keys: string[]; en: string; hi: string }[] = [
  {
    keys: ["miss", "late", "skip payment", "default", "नहीं दे", "चूक", "लेट", "किस्त नहीं", "भूल"],
    en: "If a month is hard, use a skip-eligible buffer month or pay as low as 60% of the standard instalment. A missed payment by choice is not a covered protection event. Talk to your partner early — there is no hidden late-fee in this prototype schedule.",
    hi: "अगर महीना कठिन हो, तो छोड़ने योग्य राहत महीना इस्तेमाल करें या सामान्य किस्त का कम-से-कम 60% दें। जानबूझकर छूटी किस्त सुरक्षा कवर में नहीं आती। साझेदार से जल्दी बात करें — इस प्रोटोटाइप में छिपा लेट-फीस शेड्यूल नहीं है।",
  },
  {
    keys: ["buffer", "skip", "wait", "राहत", "बफर", "छोड़"],
    en: "You get 6 or 12 extra buffer months on top of your chosen repayment tenure (6, 12, 24, or 36). Place them before repayment starts, or as skip months inside the calendar. Interest is not charged on buffer months.",
    hi: "चुनी हुई वापसी अवधि (6, 12, 24, या 36) के अलावा 6 या 12 राहत महीने मिलते हैं। इन्हें शुरुआत में इंतज़ार के रूप में रखें, या कैलेंडर में छोड़ने योग्य महीने बनाएँ। राहत महीनों पर ब्याज नहीं लगता।",
  },
  {
    keys: ["interest", "byaj", "ब्याज", "interest-free", "free buffer"],
    en: "Interest is calculated only on your chosen repayment months. The buffer does not add interest. The review screen shows the amount you avoid because the buffer is interest-free.",
    hi: "ब्याज केवल चुनी हुई वापसी अवधि पर लगता है। राहत अवधि ब्याज नहीं जोड़ती। समीक्षा पृष्ठ पर वह राशि दिखती है जो राहत ब्याज-मुक्त होने से बचती है।",
  },
  {
    keys: ["emi", "flex", "instal", "install", "60", "140", "income", "किस्त", "लची"],
    en: "There is no rigid equal EMI. Each repayment month can be between 60% and 140% of the standard instalment, as long as the full tenure together repays the total. Raise a good month, lower a lean month.",
    hi: "कड़ी समान EMI नहीं है। हर भुगतान महीना सामान्य किस्त के 60% से 140% के बीच हो सकता है, बशर्ते पूरी अवधि का योग पूरा चुकता हो। अच्छे महीने अधिक, कम कमाई वाले महीने कम।",
  },
  {
    keys: ["insur", "protect", "cover", "illness", "crop fail", "flood", "drought", "सुरक्षा", "बीमा", "फसल", "बीमार"],
    en: "Protection is optional and off by default. If you add it, you choose 25–50% of the outstanding amount to be covered after a defined hardship: crop failure from flood or drought, serious illness, or loss of main income. The one-time fee is listed before you confirm.",
    hi: "सुरक्षा वैकल्पिक है और डिफ़ॉल्ट रूप से बंद है। जोड़ने पर आप बकाया राशि का 25–50% कवर चुनते हैं — बाढ़/सूखे से फसल नुकसान, गंभीर बीमारी, या मुख्य कमाई जाना। एक बार का शुल्क पुष्टि से पहले दिखता है।",
  },
  {
    keys: ["cancel", "undo", "exit", "quit", "रद्द", "वापस", "छोड़ दो"],
    en: "You can exit at any step with no application. After confirm, this prototype keeps a short undo window. A live product would keep a full-day cooling-off period before money is sent, with no charge if you cancel in time.",
    hi: "किसी भी चरण पर बिना आवेदन छोड़े बाहर जा सकते हैं। पुष्टि के बाद इस प्रोटोटाइप में छोटी undo खिड़की है। असली उत्पाद में पैसे से पहले पूरा दिन सोचने का समय होता, समय पर रद्द करने पर शुल्क नहीं।",
  },
  {
    keys: ["rbi", "register", "licensed", "nbfc", "verified", "आरबीआई", "पंजीकृत", "लाइसेंस"],
    en: "Every lender shown carries a visible RBI Registered or RBI Licensed badge. BharosaLoan only lists fictional partners in this prototype, all marked as verified so you can see how that check would look.",
    hi: "दिखाया गया हर ऋणदाता आरबीआई पंजीकृत या लाइसेंस बैज के साथ है। इस प्रोटोटाइप में साझेदार काल्पनिक हैं, सभी सत्यापित चिह्न के साथ — ताकि वह जाँच कैसी दिखे, साफ़ रहे।",
  },
  {
    keys: ["fee", "hidden", "charge", "total", "cost", "शुल्क", "छिप", "कुल"],
    en: "The review screen lists principal, 24-month interest, ₹0 buffer interest, processing fee, and optional protection fee. Confirm stays disabled until you tick that you have seen the grand total.",
    hi: "समीक्षा पृष्ठ पर मूल राशि, 24 महीने का ब्याज, राहत पर ₹0 ब्याज, प्रोसेसिंग शुल्क, और वैकल्पिक सुरक्षा शुल्क है। कुल राशि देखने का बॉक्स चुनने तक पुष्टि बंद रहती है।",
  },
  {
    keys: ["tenure", "duration", "year", "24", "36", "अवधि", "साल", "महीने"],
    en: "You can choose a repayment tenure of 6, 12, 24, or 36 months depending on your loan amount. Buffer of 6 or 12 months is extra calendar time, not extra interest-bearing tenure.",
    hi: "ऋण राशि के अनुसार आप 6, 12, 24, या 36 महीने की वापसी अवधि चुन सकते हैं। 6 या 12 महीने की राहत अतिरिक्त कैलेंडर समय है, अतिरिक्त ब्याज वाली अवधि नहीं।",
  },
  {
    keys: ["bank", "nbfc", "partner", "बैंक", "एनबीएफसी", "साझेदार"],
    en: "You can filter partners by Bank or NBFC. Every listed partner shows an RBI Registered or RBI Licensed badge with rate and processing fee before you choose.",
    hi: "आप साझेदारों को बैंक या एनबीएफसी से छान सकते हैं। हर सूचीबद्ध साझेदार पर आरबीआई बैज, दर और प्रोसेसिंग शुल्क चुनने से पहले दिखता है।",
  },
];

function matchFaq(q: string, lang: Lang): string {
  const lower = q.toLowerCase();
  for (const row of FAQS) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) return row[lang];
  }
  return lang === "hi"
    ? "मैं राहत अवधि, किस्त, छूटी किस्त, सुरक्षा, शुल्क, या आरबीआई बैज के बारे में बता सकता/सकती हूँ। थोड़े अलग शब्द आज़माएँ।"
    : "I can explain the buffer, instalments, missed payments, protection, fees, or RBI badges. Try a few different words.";
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return null;
  const want = lang === "hi" ? "hi" : "en";
  return (
    all.find((v) => v.lang.toLowerCase() === `${want}-in`) ||
    all.find((v) => v.lang.toLowerCase().startsWith(`${want}-`)) ||
    all.find((v) => v.lang.toLowerCase().startsWith(want)) ||
    all.find((v) => v.name.toLowerCase().includes(want === "hi" ? "hindi" : "english")) ||
    all[0] ||
    null
  );
}

function speak(
  text: string,
  lang: Lang,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
    handlers?.onError?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    // Chrome sometimes stays paused after cancel — nudge it.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = 1;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onstart = () => handlers?.onStart?.();
    u.onend = () => handlers?.onEnd?.();
    u.onerror = () => handlers?.onError?.();
    // Small delay helps Chrome after cancel() / first user gesture.
    window.setTimeout(() => {
      try {
        window.speechSynthesis.speak(u);
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {
        handlers?.onError?.();
      }
    }, 60);
    return true;
  } catch {
    handlers?.onError?.();
    return false;
  }
}

export function BharosaLoan({ onExit }: { onExit?: () => void }) {
  const [lang, setLang] = useState<Lang | null>(null);
  const [step, setStep] = useState<Step>("language");
  const [muted, setMuted] = useState(false);
  const [subtitle, setSubtitle] = useState(
    "Welcome to BharosaLoan. Please choose English or Hindi. Voice guidance is always shown as text on screen as well.",
  );
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [amount, setAmount] = useState(50_000);
  const [repayMonths, setRepayMonths] = useState<TenureMonths>(24);
  const [purpose, setPurpose] = useState<PurposeId>("crop");
  const [income, setIncome] = useState<IncomeId>("seasonal");
  const [bufferMonths, setBufferMonths] = useState<6 | 12>(6);
  const [bufferMode, setBufferMode] = useState<BufferMode>("before");
  const [lenderId, setLenderId] = useState<string | null>(null);
  const [lenderFilter, setLenderFilter] = useState<"all" | "bank" | "nbfc">("all");
  const [wantInsurance, setWantInsurance] = useState(false);
  const [coverPct, setCoverPct] = useState(25);
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [selectedRepay, setSelectedRepay] = useState(0);
  const [ack, setAck] = useState(false);
  const [undone, setUndone] = useState(false);
  const [waitSkipped, setWaitSkipped] = useState(false);
  const [undoLeft, setUndoLeft] = useState(UNDO_SECONDS);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const msgId = useRef(1);
  const audioUnlocked = useRef(false);
  const L = (lang ?? "en") as Lang;

  const unlockedTenures = useMemo(() => availableTenures(amount), [amount]);
  const lender = LENDERS.find((x) => x.id === lenderId) ?? null;
  const rate = lender?.rate ?? LENDERS[0].rate;
  const emi = standardEmi(amount, rate, repayMonths);
  const minEmi = Math.round(emi * MIN_EMI_RATIO);
  const maxEmi = Math.round(emi * MAX_EMI_RATIO);
  const interestTotal = totalInterest(amount, emi, repayMonths);
  const bufferIfCharged = bufferInterestIfCharged(amount, rate, bufferMonths);
  const proc = lender?.processingFee ?? 0;
  const prot = wantInsurance ? protectionFee(amount, coverPct) : 0;
  const targetPay = emi * repayMonths;
  const { amounts, gap } = useMemo(
    () => rebalance(overrides, emi, minEmi, maxEmi, targetPay, repayMonths),
    [overrides, emi, minEmi, maxEmi, targetPay, repayMonths],
  );
  const calendar = useMemo(
    () => buildCalendar(repayMonths, bufferMonths, bufferMode),
    [repayMonths, bufferMonths, bufferMode],
  );
  const grand = amount + interestTotal + proc + prot;
  const filteredLenders = useMemo(
    () =>
      LENDERS.filter((ln) => {
        if (lenderFilter === "all") return true;
        return ln.kind === lenderFilter;
      }),
    [lenderFilter],
  );
  const reached = (s: Step) => STEPS.indexOf(step) >= STEPS.indexOf(s);

  // Keep tenure valid when amount changes.
  useEffect(() => {
    if (!unlockedTenures.includes(repayMonths)) {
      setRepayMonths(unlockedTenures[unlockedTenures.length - 1]);
      setOverrides({});
      setSelectedRepay(0);
    }
  }, [unlockedTenures, repayMonths]);

  const trust = [
    { id: "rbi", label: t(L, "trustRbi"), on: true },
    { id: "exit", label: t(L, "trustExit"), on: true },
    { id: "lang", label: t(L, "trustLang"), on: !!lang },
    { id: "details", label: t(L, "trustDetails"), on: reached("structure") },
    { id: "structure", label: t(L, "trustStructure"), on: reached("lender") },
    { id: "partner", label: t(L, "trustPartner"), on: !!lenderId },
    { id: "price", label: t(L, "trustPrice"), on: reached("review") },
  ];

  const voiceText = useCallback(() => {
    const g = lang ?? "en";
    if (step === "language") {
      return g === "hi"
        ? "भरोसालोन में आपका स्वागत है। कृपया अंग्रेज़ी या हिन्दी चुनें। आवाज़ी गाइड हर बात को स्क्रीन पर भी लिखेगी।"
        : "Welcome to BharosaLoan. Please choose English or Hindi. Voice guidance is always shown as text on screen as well.";
    }
    if (step === "basics") {
      return g === "hi"
        ? `ऋण राशि चुनें, उद्देश्य बताएँ, और कमाई कैसे आती है। अभी राशि ${inr(amount)} है।`
        : `Choose a loan amount, a purpose, and how income usually arrives. Amount is currently ${inr(amount)}.`;
    }
    if (step === "structure") {
      return g === "hi"
        ? `वापसी ${repayMonths} महीने की है। ${bufferMonths} महीने की राहत पर ब्याज शून्य है। ब्याज ${inr(interestTotal)} है। अगर राहत पर ब्याज लगता तो अतिरिक्त ${inr(bufferIfCharged)} जुड़ता — वह नहीं लगता। किस्त ${inr(emi)} के 60 से 140 प्रतिशत के बीच लचीली है।`
        : `You repay for ${repayMonths} months. Your ${bufferMonths}-month buffer has zero interest. Interest is ${inr(interestTotal)}. If the buffer were charged, an extra ${inr(bufferIfCharged)} would be added — it is not. Instalments can move between 60 and 140 percent of ${inr(emi)}.`;
    }
    if (step === "lender") {
      return g === "hi"
        ? "बैंक या एनबीएफसी साझेदार चुनें। हर कार्ड पर आरबीआई बैज, दर और प्रोसेसिंग शुल्क पहले से लिखा है।"
        : "Choose a Bank or NBFC partner. Each card lists the RBI badge, rate, and processing fee before you select.";
    }
    if (step === "insurance") {
      return g === "hi"
        ? wantInsurance
          ? `सुरक्षा चालू है। कवर बकाया का ${coverPct} प्रतिशत है। एक बार का शुल्क ${inr(prot)} है। यह वैकल्पिक है।`
          : "सुरक्षा वैकल्पिक है और अभी बंद है। आप 25 से 50 प्रतिशत कवर चुन सकते हैं। कोई छिपी शर्त नहीं।"
        : wantInsurance
          ? `Protection is on. Cover is ${coverPct} percent of the outstanding amount. The one-time fee is ${inr(prot)}. This remains optional.`
          : "Protection is optional and currently off. You may choose 25 to 50 percent cover. No hidden terms.";
    }
    if (step === "review") {
      return g === "hi"
        ? `आपको ${inr(amount)} मिलते हैं। ${repayMonths} महीने का ब्याज ${inr(interestTotal)}। राहत पर ब्याज शून्य। प्रोसेसिंग ${inr(proc)}। सुरक्षा शुल्क ${wantInsurance ? inr(prot) : "शून्य"}। कुल चुकाने योग्य ${inr(grand)}। पुष्टि से पहले बॉक्स चुनें।`
        : `You receive ${inr(amount)}. Interest for ${repayMonths} months is ${inr(interestTotal)}. Buffer interest is zero. Processing fee ${inr(proc)}. Protection fee ${wantInsurance ? inr(prot) : "zero"}. Total to repay ${inr(grand)}. Tick the box before you confirm.`;
    }
    if (undone) {
      return g === "hi"
        ? "आवेदन रद्द हो गया। कोई राशि देय नहीं।"
        : "The application was cancelled. Nothing is due.";
    }
    if (waitSkipped) {
      return g === "hi"
        ? "प्रतीक्षा छोड़ दी। आवेदन रखा गया। इस प्रोटोटाइप में पैसे नहीं भेजे गए।"
        : "Wait skipped. Application kept. No money is sent in this prototype.";
    }
    if (undoLeft <= 0) {
      return g === "hi"
        ? "आवेदन मिल गया। रद्द करने की 30 सेकंड की खिड़की खत्म हो गई। इस प्रोटोटाइप में पैसे नहीं भेजे गए।"
        : "Application received. The 30-second cancel window has ended. No money is sent in this prototype.";
    }
    return g === "hi"
      ? `आवेदन मिल गया। आप ${undoLeft} सेकंड में रद्द कर सकते हैं, या प्रतीक्षा छोड़ सकते हैं।`
      : `Application received. You can cancel for ${undoLeft} seconds, or skip the wait.`;
  }, [
    lang,
    step,
    amount,
    repayMonths,
    bufferMonths,
    interestTotal,
    bufferIfCharged,
    emi,
    wantInsurance,
    coverPct,
    prot,
    proc,
    grand,
    undone,
    waitSkipped,
    undoLeft,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.speechSynthesis) {
      setVoiceSupported(false);
      return;
    }
    const load = () => {
      window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const playVoice = useCallback(
    (force = false) => {
      const text = voiceText();
      setSubtitle(text || t(L, "voiceUnavailable"));
      audioUnlocked.current = true;
      if (muted && !force) {
        setSpeaking(false);
        return;
      }
      if (!window.speechSynthesis) {
        setVoiceSupported(false);
        setSpeaking(false);
        return;
      }
      const ok = speak(text, (lang ?? "en") as Lang, {
        onStart: () => {
          setSpeaking(true);
          setVoiceSupported(true);
        },
        onEnd: () => setSpeaking(false),
        onError: () => {
          setSpeaking(false);
          setVoiceSupported(false);
        },
      });
      if (!ok) {
        setSpeaking(false);
        setVoiceSupported(false);
      }
    },
    [voiceText, muted, lang, L],
  );

  // Keep subtitle always in sync with the current screen text.
  useEffect(() => {
    setSubtitle(voiceText());
  }, [voiceText]);

  // Auto-speak when the step/language changes after the user has unlocked audio.
  useEffect(() => {
    if (muted) {
      setSpeaking(false);
      return;
    }
    if (!audioUnlocked.current && step === "language") return;
    if (!audioUnlocked.current) return;
    const tmr = window.setTimeout(() => playVoice(false), 180);
    return () => {
      clearTimeout(tmr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lang, muted, undone, waitSkipped]);

  useEffect(() => {
    if (step !== "confirm" || undone || waitSkipped) return;
    setUndoLeft(UNDO_SECONDS);
    const id = window.setInterval(() => {
      setUndoLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step, undone, waitSkipped]);

  useEffect(() => {
    if (!lang) return;
    setMsgs([{ id: 0, role: "bot", text: t(lang, "chatHello") }]);
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = L === "hi" ? "hi" : "en";
  }, [L]);

  function go(next: Step) {
    setAck(false);
    setStep(next);
  }

  function nextStep() {
    const i = STEPS.indexOf(step);
    if (step === "language" && !lang) return;
    if (step === "lender" && !lenderId) return;
    audioUnlocked.current = true;
    if (i < STEPS.length - 1) go(STEPS[i + 1]);
  }

  function chooseLanguage(next: Lang) {
    audioUnlocked.current = true;
    setLang(next);
    // Speak immediately on the user gesture so browsers allow TTS.
    window.setTimeout(() => {
      const text =
        next === "hi"
          ? "भरोसालोन में आपका स्वागत है। कृपया अंग्रेज़ी या हिन्दी चुनें। आवाज़ी गाइड हर बात को स्क्रीन पर भी लिखेगी।"
          : "Welcome to BharosaLoan. Please choose English or Hindi. Voice guidance is always shown as text on screen as well.";
      setSubtitle(text);
      if (!muted) {
        speak(text, next, {
          onStart: () => {
            setSpeaking(true);
            setVoiceSupported(true);
          },
          onEnd: () => setSpeaking(false),
          onError: () => {
            setSpeaking(false);
            setVoiceSupported(false);
          },
        });
      }
    }, 40);
  }

  function prevStep() {
    const i = STEPS.indexOf(step);
    if (i === 0) {
      onExit?.();
      return;
    }
    go(STEPS[i - 1]);
  }

  function sendChat() {
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    const id = msgId.current++;
    setMsgs((m) => [...m, { id, role: "user", text: q }]);
    setChatInput("");
    setChatBusy(true);
    window.setTimeout(() => {
      const ans = matchFaq(q, L);
      setMsgs((m) => [...m, { id: msgId.current++, role: "bot", text: ans }]);
      setChatBusy(false);
    }, 700);
  }

  function resetFlow() {
    setStep("language");
    setUndone(false);
    setWaitSkipped(false);
    setAck(false);
    setWantInsurance(false);
    setOverrides({});
    setLenderId(null);
    setLenderFilter("all");
    setUndoLeft(UNDO_SECONDS);
  }

  const canNext =
    step === "language"
      ? !!lang
      : step === "lender"
        ? !!lenderId
        : step === "review"
          ? ack
          : step !== "confirm";

  const stepIndex = STEPS.indexOf(step);

  return (
    <div
      id="bharosa-root"
      className="min-h-screen w-full bg-amber-50 text-stone-900 font-sans antialiased [&_*]:box-border"
      lang={L === "hi" ? "hi" : "en"}
    >
      <a
        href="#bharosa-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-amber-200/80 bg-amber-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-700 text-white shadow-card">
              <HeartHandshake className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-stone-900">{t(L, "brand")}</div>
              <div className="text-sm text-stone-600">{t(L, "tagline")}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lang && (
              <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
                {(["en", "hi"] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={`inline-flex min-h-11 min-w-11 items-center gap-1 rounded-full px-3 text-sm font-semibold ${
                      L === x ? "bg-orange-700 text-white" : "text-stone-700"
                    }`}
                    onClick={() => chooseLanguage(x)}
                    aria-pressed={L === x}
                  >
                    <Languages className="h-4 w-4" aria-hidden />
                    {x === "en" ? "EN" : "हिं"}
                  </button>
                ))}
              </div>
            )}
            <IconBtn
              label={muted ? t(L, "unmute") : t(L, "mute")}
              onClick={() => {
                setMuted((m) => {
                  const next = !m;
                  if (next) {
                    window.speechSynthesis?.cancel();
                    setSpeaking(false);
                  } else {
                    audioUnlocked.current = true;
                    window.setTimeout(() => playVoice(true), 40);
                  }
                  return next;
                });
              }}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              <span className="hidden sm:inline">{muted ? t(L, "voiceOff") : t(L, "voiceOn")}</span>
            </IconBtn>
            <IconBtn
              label={t(L, "replay")}
              onClick={() => {
                setMuted(false);
                audioUnlocked.current = true;
                playVoice(true);
              }}
            >
              <RotateCcw className="h-5 w-5" />
              <span className="hidden sm:inline">{t(L, "replay")}</span>
            </IconBtn>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="min-h-11 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800"
              >
                {t(L, "exit")}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 pb-40 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t(L, "trustTitle")}
          </p>
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {trust.map((item) => (
              <li
                key={item.id}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
                  item.on
                    ? "border-green-700/30 bg-green-50 text-green-900"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    item.on ? "bg-green-800 text-white" : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {item.on ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-stone-400" />}
                </span>
                <span className="whitespace-nowrap font-medium lg:whitespace-normal">{item.label}</span>
              </li>
            ))}
          </ul>
          {step !== "language" && (
            <p className="mt-4 hidden text-sm text-stone-500 lg:block">
              {t(L, "stepOf", { n: Math.max(1, stepIndex), total: STEPS.length - 1 })}
            </p>
          )}
        </aside>

        <main id="bharosa-main" className="min-w-0">
          {step !== "language" && step !== "confirm" && (
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-sm text-stone-600">
                <span>{t(L, "stepOf", { n: stepIndex, total: STEPS.length - 1 })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-amber-200">
                <div
                  className="h-full rounded-full bg-orange-700 transition-all"
                  style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === "language" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{COPY.en.chooseLang}</h1>
              <p className="mt-1 text-lg text-stone-600">{COPY.hi.chooseLang}</p>
              <p className="mt-3 text-base text-stone-600">
                {COPY.en.chooseLangSub} · {COPY.hi.chooseLangSub}
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <LangCard
                  active={lang === "en"}
                  title="English"
                  sub="Voice: en-IN"
                  onClick={() => chooseLanguage("en")}
                  testId="lang-en"
                />
                <LangCard
                  active={lang === "hi"}
                  title="हिन्दी"
                  sub="आवाज़: hi-IN"
                  onClick={() => chooseLanguage("hi")}
                  testId="lang-hi"
                />
              </div>
            </Card>
          )}

          {step === "basics" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "basicsTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "basicsSub")}</p>

              <label className="mt-8 block text-lg font-semibold">{t(L, "amount")}</label>
              <p className="text-sm text-stone-500">{t(L, "amountHint")}</p>
              <div className="mt-3 text-3xl font-bold text-orange-800">{inr(amount)}</div>
              <input
                type="range"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-4 h-3 w-full cursor-pointer accent-orange-700"
                aria-label={t(L, "amount")}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[10000, 25000, 50000, 75000, 100000, 150000, 200000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmount(n)}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                      amount === n ? "bg-orange-700 text-white" : "bg-white text-stone-800 ring-1 ring-stone-200"
                    }`}
                  >
                    {inr(n)}
                  </button>
                ))}
              </div>

              <p className="mt-8 text-lg font-semibold">{t(L, "purpose")}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PURPOSES.map((p) => {
                  const Icon = p.icon;
                  const label = t(L, purposeKey(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPurpose(p.id)}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base font-medium ${
                        purpose === p.id
                          ? "border-orange-700 bg-orange-50 text-orange-950"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <Icon className="h-6 w-6 shrink-0 text-orange-700" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-8 text-lg font-semibold">{t(L, "income")}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {INCOMES.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setIncome(row.id)}
                    className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-medium ${
                      income === row.id
                        ? "border-orange-700 bg-orange-50"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    {t(L, incomeKey(row.id))}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-stone-600">
                {income === "seasonal" ? t(L, "incomeHintSeasonal") : t(L, "incomeHintOther")}
              </p>
            </Card>
          )}

          {step === "structure" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "structureTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "structureSub")}</p>

              <div className="mt-6">
                <p className="font-semibold">{t(L, "tenureLen")}</p>
                <p className="mt-1 text-sm text-stone-500">{t(L, "tenureHint")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TENURE_OPTIONS.map((n) => {
                    const unlocked = unlockedTenures.includes(n);
                    const hint = tenureUnlockHint(n, L);
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!unlocked}
                        title={!unlocked && hint ? hint : undefined}
                        onClick={() => {
                          if (!unlocked) return;
                          setRepayMonths(n);
                          setOverrides({});
                          setSelectedRepay(0);
                        }}
                        className={`min-h-14 rounded-2xl px-2 py-2 font-semibold ${
                          repayMonths === n
                            ? "bg-orange-700 text-white"
                            : unlocked
                              ? "bg-white text-stone-800 ring-1 ring-stone-200"
                              : "cursor-not-allowed bg-stone-100 text-stone-400 ring-1 ring-stone-200"
                        }`}
                      >
                        <span className="block">{t(L, "monthsN", { n })}</span>
                        {!unlocked && hint && (
                          <span className="mt-1 block text-[10px] font-normal leading-tight">{hint}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-semibold">{t(L, "bufferLen")}</p>
                  <div className="mt-2 flex gap-2">
                    {([6, 12] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBufferMonths(n)}
                        className={`min-h-12 flex-1 rounded-2xl font-semibold ${
                          bufferMonths === n ? "bg-orange-700 text-white" : "bg-white ring-1 ring-stone-200"
                        }`}
                      >
                        {t(L, n === 6 ? "months6" : "months12")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-green-50 p-4 text-green-950 ring-1 ring-green-200">
                  <p className="text-sm font-semibold">{t(L, "repayCount", { n: repayMonths })}</p>
                  <p className="text-sm">{t(L, "calendarSpan", { n: repayMonths + bufferMonths })}</p>
                  <p className="mt-1 text-sm">
                    {t(L, "years2", { n: repayMonths })} {t(L, "plusBuffer", { n: bufferMonths })}
                  </p>
                </div>
              </div>

              <p className="mt-6 font-semibold">{t(L, "bufferMode")}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <ModeBtn
                  active={bufferMode === "before"}
                  title={t(L, "modeBefore")}
                  hint={t(L, "modeBeforeHint")}
                  onClick={() => setBufferMode("before")}
                />
                <ModeBtn
                  active={bufferMode === "distributed"}
                  title={t(L, "modeDist")}
                  hint={t(L, "modeDistHint")}
                  onClick={() => setBufferMode("distributed")}
                />
              </div>

              <Timeline
                lang={L}
                calendar={calendar}
                amounts={amounts}
                maxEmi={maxEmi}
                selectedRepay={selectedRepay}
                onSelect={(i) => setSelectedRepay(i)}
              />

              <div className="mt-6 rounded-2xl border border-green-800/20 bg-white p-4 sm:p-5">
                <p className="flex items-center gap-2 text-lg font-bold text-green-900">
                  <IndianRupee className="h-5 w-5" />
                  {t(L, "interestTitle")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {t(L, "ratePreview", { rate: rate.toFixed(1) })}
                </p>
                <Line k={t(L, "interestOn24")} v={inr(interestTotal)} />
                <Line k={t(L, "interestOnBuffer")} v={inr(0)} strong />
                <div className="mt-3 rounded-xl bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-stone-800">
                    {t(L, "interestSaved")}:{" "}
                    <span className="text-green-800">{inr(bufferIfCharged)}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{t(L, "interestSavedHint")}</p>
                  <p className="mt-2 text-sm text-stone-500 line-through">
                    {inr(interestTotal + bufferIfCharged)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-lg font-bold">{t(L, "emiTitle")}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{t(L, "emiSub")}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <Stat label={t(L, "stdEmi")} value={inr(emi)} />
                  <Stat label={t(L, "minEmi")} value={inr(minEmi)} />
                  <Stat label={t(L, "maxEmi")} value={inr(maxEmi)} />
                </div>

                <EmiBars
                  amounts={amounts}
                  overrides={overrides}
                  minEmi={minEmi}
                  maxEmi={maxEmi}
                  std={emi}
                  selected={selectedRepay}
                  onSelect={setSelectedRepay}
                />

                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <p className="font-semibold">
                    {t(L, "thisMonth")}: {t(L, "month", { n: selectedRepay + 1 })}
                  </p>
                  <p className="text-2xl font-bold text-orange-800">{inr(amounts[selectedRepay])}</p>
                  <input
                    type="range"
                    min={minEmi}
                    max={maxEmi}
                    step={50}
                    value={amounts[selectedRepay]}
                    onChange={(e) =>
                      setOverrides((o) => ({ ...o, [selectedRepay]: Number(e.target.value) }))
                    }
                    className="mt-3 h-3 w-full cursor-pointer accent-orange-700"
                    aria-label={t(L, "flexBand")}
                  />
                  <button
                    type="button"
                    className="mt-3 min-h-11 text-sm font-semibold text-orange-800 underline"
                    onClick={() => setOverrides({})}
                  >
                    {t(L, "resetMonths")}
                  </button>
                  <p className="mt-2 text-sm text-stone-600">
                    {Math.abs(gap) < 5
                      ? t(L, "gapOk")
                      : gap > 0
                        ? t(L, "gapUnder", { n: inr(Math.abs(gap)) })
                        : t(L, "gapOver", { n: inr(Math.abs(gap)) })}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {step === "lender" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "lenderTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "lenderSub")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "filterAll"],
                    ["bank", "filterBank"],
                    ["nbfc", "filterNbfc"],
                  ] as const
                ).map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLenderFilter(id)}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                      lenderFilter === id
                        ? "bg-green-800 text-white"
                        : "bg-white text-stone-800 ring-1 ring-stone-200"
                    }`}
                  >
                    {t(L, key)}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredLenders.map((ln) => {
                  const e = standardEmi(amount, ln.rate, repayMonths);
                  const active = lenderId === ln.id;
                  return (
                    <button
                      key={ln.id}
                      type="button"
                      onClick={() => {
                        setLenderId(ln.id);
                        setOverrides({});
                      }}
                      className={`rounded-2xl border p-4 text-left sm:p-5 ${
                        active ? "border-green-800 bg-green-50" : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold">{ln.name}</p>
                          <p className="text-sm font-semibold text-stone-600">
                            {ln.kind === "nbfc" ? t(L, "kindNbfc") : t(L, "kindBank")}
                          </p>
                        </div>
                        <RbiBadge lang={L} kind={ln.badge} />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-stone-600">
                        {L === "hi" ? ln.focusHi : ln.focusEn}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-stone-500">{t(L, "annualRate")}</dt>
                          <dd className="text-lg font-bold">{ln.rate}% p.a.</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t(L, "procFee")}</dt>
                          <dd className="text-lg font-bold">{ln.processingFee ? inr(ln.processingFee) : t(L, "none")}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t(L, "monthlyStd")}</dt>
                          <dd className="font-semibold">{inr(e)}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t(L, "youReceive")}</dt>
                          <dd className="font-semibold">{inr(amount)}</dd>
                        </div>
                      </dl>
                      {active && (
                        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-green-800">
                          <Check className="h-4 w-4" /> {t(L, "selected")}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {step === "insurance" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "insTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "insSub")}</p>
              <p className="mt-3 text-base text-stone-700">{t(L, "insTone")}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setWantInsurance(false)}
                  className={`min-h-14 rounded-2xl border px-4 py-3 text-left font-semibold ${
                    !wantInsurance ? "border-orange-700 bg-orange-50" : "border-stone-200 bg-white"
                  }`}
                >
                  {t(L, "insToggleOff")}
                </button>
                <button
                  type="button"
                  onClick={() => setWantInsurance(true)}
                  className={`min-h-14 rounded-2xl border px-4 py-3 text-left font-semibold ${
                    wantInsurance ? "border-green-800 bg-green-50" : "border-stone-200 bg-white"
                  }`}
                >
                  {t(L, "insToggleOn")}
                </button>
              </div>

              {wantInsurance && (
                <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-green-200 sm:p-5">
                  <p className="font-semibold">{t(L, "insCover")}</p>
                  <p className="mt-2 text-2xl font-bold text-green-900">{t(L, "insCoverOf", { pct: coverPct })}</p>
                  <input
                    type="range"
                    min={25}
                    max={50}
                    step={5}
                    value={coverPct}
                    onChange={(e) => setCoverPct(Number(e.target.value))}
                    className="mt-4 h-3 w-full cursor-pointer accent-green-800"
                    aria-label={t(L, "coverLine")}
                  />
                  <div className="mt-2 flex justify-between text-sm text-stone-500">
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-stone-600">
                    {t(L, "insExample", {
                      cover: inr((amount * coverPct) / 100),
                      principal: inr(amount),
                    })}
                  </p>
                  <Line k={t(L, "insFee")} v={inr(prot)} strong />
                  <p className="text-sm text-stone-500">{t(L, "insFeeHint")}</p>
                </div>
              )}

              <div className="mt-6">
                <p className="font-semibold">{t(L, "insEvents")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-stone-700">
                  <li>{t(L, "insE1")}</li>
                  <li>{t(L, "insE2")}</li>
                  <li>{t(L, "insE3")}</li>
                </ul>
                <p className="mt-3 text-sm text-stone-500">{t(L, "insNot")}</p>
              </div>
            </Card>
          )}

          {step === "review" && lender && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "reviewTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "reviewSub")}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <Row k={t(L, "partner")} v={lender.name} />
                  <div className="mt-2">
                    <RbiBadge lang={L} kind={lender.badge} />
                  </div>
                  <Row k={t(L, "purposeLine")} v={t(L, purposeKey(purpose))} />
                  <Row k={t(L, "incomeLine")} v={t(L, incomeKey(income))} />
                  <Row k={t(L, "tenure")} v={t(L, "years2", { n: repayMonths })} />
                  <Row
                    k={t(L, "bufferLine")}
                    v={`${bufferMonths} · ${bufferMode === "before" ? t(L, "modeBefore") : t(L, "modeDist")}`}
                  />
                  <Row
                    k={t(L, "coverLine")}
                    v={wantInsurance ? `${coverPct}%` : t(L, "protNone")}
                  />
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <p className="font-bold">{t(L, "breakdown")}</p>
                  <Line k={t(L, "principal")} v={inr(amount)} />
                  <Line k={t(L, "interest")} v={inr(interestTotal)} />
                  <Line k={t(L, "bufferInterest")} v={inr(0)} strong />
                  <Line k={t(L, "proc")} v={proc ? inr(proc) : t(L, "none")} />
                  <Line
                    k={t(L, "protFee")}
                    v={wantInsurance ? inr(prot) : t(L, "protNone")}
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3">
                    <span className="text-lg font-bold">{t(L, "grand")}</span>
                    <span className="text-2xl font-bold text-orange-800">{inr(grand)}</span>
                  </div>
                  <p className="mt-2 text-sm text-green-800">
                    {t(L, "interestSaved")}: {inr(bufferIfCharged)}
                  </p>
                </div>
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-amber-100/70 p-4 text-base leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-orange-700"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                <span>{t(L, "ack", { total: inr(grand) })}</span>
              </label>
              {!ack && <p className="mt-2 text-sm text-stone-500">{t(L, "confirmNeedAck")}</p>}
            </Card>
          )}

          {step === "confirm" && (
            <Card>
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-white ${
                  undone ? "bg-stone-700" : "bg-green-800"
                }`}
              >
                {undone ? <Undo2 className="h-7 w-7" /> : <Check className="h-7 w-7" />}
              </div>
              <h1 className="mt-4 text-2xl font-bold sm:text-3xl" data-testid="confirm-title">
                {undone ? t(L, "undone") : t(L, "confirmTitle")}
              </h1>
              {!undone && !waitSkipped && (
                <p className="mt-2 text-base leading-relaxed text-stone-600">
                  {undoLeft > 0 ? t(L, "confirmSub", { n: undoLeft }) : t(L, "coolingClosed")}
                </p>
              )}
              {waitSkipped && !undone && (
                <div className="mt-4 rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
                  <p className="text-base font-semibold text-green-900">{t(L, "waitSkipped")}</p>
                </div>
              )}
              {undone && (
                <div className="mt-4 rounded-2xl bg-stone-100 p-4 ring-1 ring-stone-300">
                  <p className="text-base font-semibold text-stone-900">{t(L, "afterUndo")}</p>
                  <p className="mt-1 text-sm text-stone-600">{t(L, "coolingClosed")}</p>
                </div>
              )}

              {!undone && !waitSkipped && (
                <div
                  className={`mt-6 rounded-2xl p-4 ${
                    undoLeft > 0 ? "bg-green-50 ring-1 ring-green-200" : "bg-stone-100"
                  }`}
                >
                  <p className="font-semibold">
                    {undoLeft > 0 ? t(L, "cooling") : t(L, "coolingClosed")}
                  </p>
                  {undoLeft > 0 && (
                    <p className="mt-1 font-mono text-3xl font-bold text-green-900">{undoLeft}s</p>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!undone && !waitSkipped && undoLeft > 0 && (
                  <button
                    type="button"
                    data-testid="bharosa-undo"
                    onClick={() => setUndone(true)}
                    className="min-h-12 flex-1 rounded-2xl bg-white px-4 font-semibold text-stone-800 ring-1 ring-stone-300"
                  >
                    {t(L, "undo")}
                  </button>
                )}
                {!undone && !waitSkipped && undoLeft > 0 && (
                  <button
                    type="button"
                    data-testid="bharosa-skip-wait"
                    onClick={() => {
                      setWaitSkipped(true);
                      setUndoLeft(0);
                    }}
                    className="min-h-12 flex-1 rounded-2xl bg-green-800 px-4 font-semibold text-white"
                  >
                    {t(L, "skipWait")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetFlow}
                  className="min-h-12 flex-1 rounded-2xl bg-orange-700 px-4 font-semibold text-white"
                >
                  {t(L, "restart")}
                </button>
                {onExit && (
                  <button
                    type="button"
                    onClick={onExit}
                    className="min-h-12 flex-1 rounded-2xl bg-white px-4 font-semibold ring-1 ring-stone-300"
                  >
                    {t(L, "exit")}
                  </button>
                )}
              </div>
            </Card>
          )}

          {step !== "confirm" && (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={prevStep}
                data-testid="bharosa-back"
                className="inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-white px-5 font-semibold text-stone-800 ring-1 ring-stone-300"
              >
                <ChevronLeft className="h-5 w-5" /> {t(L, "back")}
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={nextStep}
                data-testid="bharosa-next"
                className="inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-orange-700 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === "insurance" && !wantInsurance ? t(L, "skipIns") : step === "review" ? t(L, "confirmCta") : t(L, "next")}
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-stone-500">{t(L, "prototype")}</p>
        </main>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-orange-300 bg-amber-50 px-4 py-3 shadow-[0_-8px_24px_rgba(124,45,18,0.12)] sm:px-6"
        aria-live="polite"
        data-testid="bharosa-subtitle"
      >
        <div className="mx-auto flex max-w-6xl items-start gap-3">
          <span className="mt-0.5 shrink-0 text-orange-800">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t(L, "subtitleLabel")}
              </p>
              {speaking && !muted && (
                <span className="rounded-full bg-orange-700 px-2 py-0.5 text-[11px] font-bold text-white">
                  {t(L, "speaking")}
                </span>
              )}
              {!voiceSupported && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                  {t(L, "voiceUnavailable")}
                </span>
              )}
            </div>
            <p className="mt-1 min-h-[1.5rem] text-base font-medium leading-relaxed text-stone-900">
              {subtitle || t(L, "voiceUnavailable")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMuted(false);
              audioUnlocked.current = true;
              playVoice(true);
            }}
            className="min-h-11 shrink-0 rounded-full bg-orange-700 px-3 text-sm font-semibold text-white"
          >
            {t(L, "replay")}
          </button>
        </div>
      </div>
      {/* Spacer so content is not hidden behind the fixed subtitle bar */}
      <div className="h-28" aria-hidden />

      <ChatWidget
        lang={L}
        open={chatOpen}
        setOpen={setChatOpen}
        msgs={msgs}
        busy={chatBusy}
        input={chatInput}
        setInput={setChatInput}
        onSend={sendChat}
      />
    </div>
  );
}

function purposeKey(id: PurposeId): CopyKey {
  return (
    {
      crop: "purposeCrop",
      vehicle: "purposeVehicle",
      capital: "purposeCapital",
      livestock: "purposeLivestock",
      shop: "purposeShop",
    } as const
  )[id];
}

function incomeKey(id: IncomeId): CopyKey {
  return (
    {
      daily: "incomeDaily",
      gig: "incomeGig",
      seasonal: "incomeSeasonal",
      mixed: "incomeMixed",
    } as const
  )[id];
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card sm:p-8">{children}</section>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800"
    >
      {children}
    </button>
  );
}

function LangCard({
  active,
  title,
  sub,
  onClick,
  testId,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`min-h-28 rounded-3xl border-2 p-5 text-left ${
        active ? "border-orange-700 bg-orange-50" : "border-stone-200 bg-white"
      }`}
    >
      <p className="text-2xl font-bold">{title}</p>
      <p className="mt-1 text-sm text-stone-500">{sub}</p>
    </button>
  );
}

function ModeBtn({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left ${
        active ? "border-orange-700 bg-orange-50" : "border-stone-200 bg-white"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{hint}</p>
    </button>
  );
}

function RbiBadge({ lang, kind }: { lang: Lang; kind: "registered" | "licensed" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-800 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
      <BadgeCheck className="h-3.5 w-3.5" />
      {kind === "licensed" ? t(lang, "rbiLic") : t(lang, "rbiReg")}
    </span>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="mt-2 flex items-start justify-between gap-3 text-sm sm:text-base">
      <span className="text-stone-600">{k}</span>
      <span className={`shrink-0 font-semibold ${strong ? "text-green-800" : "text-stone-900"}`}>{v}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="mt-2 text-sm">
      <span className="text-stone-500">{k}: </span>
      <span className="font-medium">{v}</span>
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-amber-50 p-3">
      <p className="text-stone-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Timeline({
  lang,
  calendar,
  amounts,
  maxEmi,
  selectedRepay,
  onSelect,
}: {
  lang: Lang;
  calendar: CalMonth[];
  amounts: number[];
  maxEmi: number;
  selectedRepay: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap gap-3 text-xs font-medium">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-orange-600" /> {t(lang, "timelineLegendRepay")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-dashed border-green-800 bg-green-50" />{" "}
          {t(lang, "timelineLegendBuffer")}
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {calendar.map((m) => {
          const isRepay = m.kind === "repay" && m.repayIndex !== null;
          const h = isRepay ? Math.max(18, (amounts[m.repayIndex!] / maxEmi) * 64) : 18;
          const sel = isRepay && m.repayIndex === selectedRepay;
          return (
            <button
              key={m.calIndex}
              type="button"
              title={`${t(lang, "month", { n: m.calIndex + 1 })} · ${
                isRepay ? t(lang, "repayMonth") : m.kind === "buffer" ? t(lang, "waitMonth") : t(lang, "skipMonth")
              }`}
              onClick={() => {
                if (m.repayIndex !== null) onSelect(m.repayIndex);
              }}
              className={`flex w-7 shrink-0 flex-col items-center justify-end rounded-md pt-6 sm:w-8 ${
                isRepay ? (sel ? "ring-2 ring-orange-700" : "") : ""
              }`}
            >
              <span
                className={`w-full rounded-t-md ${
                  isRepay
                    ? "bg-orange-600"
                    : "border border-dashed border-green-800 bg-green-50"
                }`}
                style={{ height: h }}
              />
              <span className="mt-1 text-[9px] text-stone-500">{m.calIndex + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
        <CalendarRange className="h-3.5 w-3.5" /> {calendar.length} {lang === "hi" ? "महीने" : "months"}
      </p>
    </div>
  );
}

function EmiBars({
  amounts,
  overrides,
  minEmi,
  maxEmi,
  std,
  selected,
  onSelect,
}: {
  amounts: number[];
  overrides: Record<number, number>;
  minEmi: number;
  maxEmi: number;
  std: number;
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
      {amounts.map((val, i) => {
        const locked = overrides[i] !== undefined;
        const pct = ((val - minEmi) / Math.max(1, maxEmi - minEmi)) * 100;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex h-28 flex-col justify-end rounded-xl p-1 ${
              selected === i ? "bg-orange-100 ring-2 ring-orange-700" : "bg-amber-50"
            }`}
            aria-label={`Month ${i + 1} ${inr(val)}`}
          >
            <span
              className={`w-full rounded-md ${val > std ? "bg-orange-700" : "bg-orange-400"}`}
              style={{ height: `${Math.max(12, pct * 0.72)}%` }}
            />
            <span className="mt-1 text-[10px] font-medium text-stone-600">{i + 1}</span>
            {locked && <span className="text-[8px] text-orange-800">●</span>}
          </button>
        );
      })}
    </div>
  );
}

function ChatWidget({
  lang,
  open,
  setOpen,
  msgs,
  busy,
  input,
  setInput,
  onSend,
}: {
  lang: Lang;
  open: boolean;
  setOpen: (v: boolean) => void;
  msgs: ChatMsg[];
  busy: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, open]);

  return (
    <div className="fixed bottom-32 right-4 z-50 sm:bottom-36 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[min(70vh,480px)] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-card">
          <div className="flex items-center justify-between bg-orange-700 px-4 py-3 text-white">
            <p className="flex items-center gap-2 font-semibold">
              <CircleHelp className="h-5 w-5" /> {t(lang, "chatTitle")}
            </p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-orange-700 text-white"
                    : "bg-amber-50 text-stone-800"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="max-w-[70%] rounded-2xl bg-amber-50 px-3 py-2 text-sm text-stone-500">
                {t(lang, "chatTyping")}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t border-stone-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(lang, "chatPh")}
              className="min-h-11 flex-1 rounded-full bg-amber-50 px-4 text-sm text-stone-900 outline-none ring-1 ring-stone-200"
            />
            <button
              type="submit"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-700 text-white"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-700 text-white shadow-lg"
        aria-label={t(lang, "chatTitle")}
        data-testid="bharosa-chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
