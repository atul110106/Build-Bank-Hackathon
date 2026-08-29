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
  Gem,
  Handshake,
  HeartHandshake,
  IndianRupee,
  Languages,
  Landmark,
  Leaf,
  MessageCircle,
  RotateCcw,
  Send,
  Smartphone,
  Sprout,
  Star,
  Store,
  Undo2,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from "lucide-react";

type Lang = "en" | "hi";
type Step =
  | "language"
  | "basics"
  | "trust"
  | "structure"
  | "lender"
  | "insurance"
  | "review"
  | "confirm";
type PurposeId = "crop" | "vehicle" | "capital" | "livestock" | "shop";
type IncomeId = "daily" | "gig" | "seasonal" | "mixed";
type TrustSignalId =
  | "bank"
  | "collateral"
  | "upi"
  | "utility"
  | "gig"
  | "mandi"
  | "shg"
  | "vouch";

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
  "trust",
  "structure",
  "lender",
  "insurance",
  "review",
  "confirm",
];

const TRUST_SIGNALS: {
  id: TrustSignalId;
  weight: number;
  icon: typeof Landmark;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  optionalNoteEn?: string;
  optionalNoteHi?: string;
}[] = [
  {
    id: "bank",
    weight: 18,
    icon: Landmark,
    titleEn: "Bank statement / formal history",
    titleHi: "बैंक स्टेटमेंट / औपचारिक इतिहास",
    descEn: "Optional. Helpful if you have it — not required.",
    descHi: "वैकल्पिक। हो तो मददगार — ज़रूरी नहीं।",
    optionalNoteEn: "Traditional signal — many people skip this.",
    optionalNoteHi: "पारंपरिक संकेत — कई लोग इसे छोड़ देते हैं।",
  },
  {
    id: "collateral",
    weight: 14,
    icon: Gem,
    titleEn: "Collateral offered",
    titleHi: "जमानत / संपत्ति की पेशकश",
    descEn: "Optional — e.g. two-wheeler or gold. Add a short note if yes.",
    descHi: "वैकल्पिक — जैसे दोपहिया या सोना। हाँ हो तो छोटा नोट लिखें।",
  },
  {
    id: "upi",
    weight: 14,
    icon: Smartphone,
    titleEn: "UPI / digital payment consistency",
    titleHi: "UPI / डिजिटल भुगतान की नियमितता",
    descEn: "Small digital payments arriving regularly in recent months.",
    descHi: "हाल के महीनों में छोटे डिजिटल भुगतान नियमित रूप से।",
  },
  {
    id: "utility",
    weight: 12,
    icon: Zap,
    titleEn: "Utility bill payment history",
    titleHi: "बिजली / मोबाइल बिल भुगतान इतिहास",
    descEn: "On-time electricity or mobile recharge patterns.",
    descHi: "समय पर बिजली या मोबाइल रिचार्ज का पैटर्न।",
  },
  {
    id: "gig",
    weight: 12,
    icon: Star,
    titleEn: "Gig platform tenure & rating",
    titleHi: "गिग प्लेटफ़ॉर्म अवधि और रेटिंग",
    descEn: "For gig workers — months active and your rating.",
    descHi: "गिग काम के लिए — सक्रिय महीने और आपकी रेटिंग।",
  },
  {
    id: "mandi",
    weight: 12,
    icon: Store,
    titleEn: "Mandi / market sales record",
    titleHi: "मंडी / बाज़ार बिक्री रिकॉर्ड",
    descEn: "For farmers — regular crop sales through a registered market.",
    descHi: "किसानों के लिए — पंजीकृत मंडी में नियमित फसल बिक्री।",
  },
  {
    id: "shg",
    weight: 10,
    icon: Users,
    titleEn: "SHG / community savings group",
    titleHi: "एसएचजी / सामुदायिक बचत समूह",
    descEn: "Consistent contributions in a self-help or savings group.",
    descHi: "स्वयं सहायता या बचत समूह में नियमित योगदान।",
  },
  {
    id: "vouch",
    weight: 8,
    icon: Handshake,
    titleEn: "Community vouching",
    titleHi: "समुदाय की सिफ़ारिश",
    descEn: "A known contact who already repaid a BharosaLoan is willing to vouch.",
    descHi: "कोई परिचित जिसने पहले भरोसालोन चुकाया हो, सिफ़ारिश करने को तैयार है।",
  },
];

function trustRateDiscount(score: number): number {
  if (score >= 80) return 0.5;
  if (score >= 60) return 0.3;
  if (score >= 40) return 0.15;
  return 0;
}

function trustSkipsExtraVerification(score: number): boolean {
  return score >= 70;
}

const TENURE_OPTIONS = [6, 12, 24, 36] as const;
type TenureMonths = (typeof TENURE_OPTIONS)[number];
const COVER_SLABS = [25, 30, 35, 40, 45, 50] as const;
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
    trustProfileTitle: "Your Trust Profile",
    trustSub:
      "Banks often need paperwork. BharosaLoan can also read everyday reliability — no single signal is required.",
    trustSupport:
      "Toggle what applies to you. Several smaller signals together can be as strong as one traditional document.",
    trustScoreLabel: "Trust Score",
    trustBreakdown: "What built this score",
    trustNoneYet: "Toggle any signal below to start building your score. Zero is a starting point, not a rejection.",
    trustOn: "Included",
    trustOff: "Not using",
    trustPoints: "+{n} points",
    collateralNote: "What are you offering? (optional note)",
    collateralPh: "e.g. two-wheeler, gold jewellery",
    trustBenefitTitle: "A stronger trust profile can improve your rate",
    trustBenefitBody:
      "Score {score}/100 → estimated rate improvement up to {discount}% p.a. {extra}",
    trustBenefitSkip: "You may skip an extra verification step with some partners.",
    trustBenefitNone: "Add a few more signals to unlock a rate improvement.",
    trustBenefitBand: "Current band: {band}",
    trustBandLow: "Building",
    trustBandMid: "Steady",
    trustBandHigh: "Strong",
    trustChecklistItem: "Trust profile reviewed",
    lenderTrustNote: "Your Trust Score {score} improves listed rates by up to {discount}% p.a.",
    lenderSkipVerify: "Extra verification step skipped for this profile",
    baseRate: "Listed rate",
    yourRate: "Your rate with Trust Score",
    structureTitle: "How repayment actually works",
    structureSub:
      "Choose your repayment tenure and buffer allowance. Mark any months as buffer (up to your allowance). Set any payment amount you need on other months — leftovers move to the remaining months so the full total is still paid across the calendar.",
    tenureLen: "Loan repayment tenure",
    tenureHint: "Longer tenures unlock as your loan amount increases.",
    tenureLocked: "Increase loan amount to unlock",
    monthsN: "{n} months",
    bufferLen: "Buffer months you may mark",
    months6: "6 months",
    months12: "12 months",
    bufferHow: "How buffer months work",
    bufferHowBody:
      "Your calendar has {total} months ({repay} repayment tenure + {buffer} buffer slots). Tap months below and mark up to {buffer} of them as buffer (₹0, no interest). On every other month you can set any instalment amount — if you pay less this month, the rest is spread across the remaining payment months so the full loan total is still cleared.",
    modeBefore: "Before repayment starts",
    modeBeforeHint: "No instalment until the buffer ends. Interest still does not run in this wait.",
    modeDist: "You choose which months are buffer",
    modeDistHint: "Mark any months as buffer up to your allowance.",
    timelineLegendRepay: "Payment month",
    timelineLegendBuffer: "Buffer month — ₹0, no interest",
    interestTitle: "Interest is only on repayment tenure",
    interestOn24: "Interest on repayment tenure",
    interestOnBuffer: "Interest on buffer months",
    interestSaved: "Amount you do not pay because buffer months are interest-free",
    interestSavedHint:
      "If interest had run on the unpaid principal during buffer months, this extra amount would have been added. BharosaLoan does not add it.",
    ratePreview:
      "Preview rate {rate}% p.a. — used only so you can see the buffer math. Your partner on the next step sets the final rate.",
    emiTitle: "Month planner — choose buffer months & flexible EMI",
    emiSub:
      "All {total} calendar months are shown. Mark up to {buffer} as buffer. On payment months set any amount you need — the leftover is redistributed so you still pay the full total.",
    deadlineNote: "Choose buffer or change an EMI at least 2–3 days before that month’s due date.",
    actionFull: "Use equal share",
    actionLess: "Set custom amount",
    actionBuffer: "Mark as buffer",
    actionUnbuffer: "Remove buffer mark",
    bufferQuota: "Buffer months marked: {used} / {max}",
    bufferQuotaFull: "You already marked {max} buffer months. Unmark one to choose another.",
    skipMonthInfo: "This month is marked as buffer — ₹0 due, and no interest is charged.",
    skipRequested: "Buffer month — ₹0. Other payment months carry the remaining total.",
    stdEmi: "Standard EMI (if equal each tenure month)",
    targetTotal: "Total to repay across calendar",
    flexHint:
      "Example: if the equal share is ₹2,314 and you pay ₹314 this month, the remaining ₹2,000 is spread across the other payment months.",
    thisMonth: "Selected month",
    resetMonths: "Reset all month choices",
    lockHint: "Custom amount locked",
    gapOver: "Scheduled total is {n} above the required amount — lower a locked month.",
    gapUnder: "{n} still needs to be placed in other payment months.",
    gapOk: "Payment total matches. You can still reshuffle months.",
    calendarSpan: "Calendar span: {n} months",
    repayCount: "{n}-month repayment tenure",
    customAmount: "Amount for this month",
    insFeeSlab: "Premium changes every 5% cover step",
    insFeeSlabNote: "Cover slab {pct}% → premium {fee}",
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
    skipMonth: "Buffer",
    repayMonth: "Pay",
    waitMonth: "Wait",
    userSkipMonth: "Skip",
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
    trustProfileTitle: "आपकी विश्वास प्रोफ़ाइल",
    trustSub:
      "बैंक अक्सर कागज़ात माँगते हैं। BharosaLoan रोज़मर्रा की विश्वसनीयता भी पढ़ सकता है — कोई एक संकेत ज़रूरी नहीं।",
    trustSupport:
      "जो आप पर लागू हो उसे चालू करें। कई छोटे संकेत मिलकर एक पारंपरिक दस्तावेज़ जितने मज़बूत हो सकते हैं।",
    trustScoreLabel: "ट्रस्ट स्कोर",
    trustBreakdown: "इस स्कोर में क्या जुड़ा",
    trustNoneYet: "नीचे कोई भी संकेत चालू करें। शून्य शुरुआत है, अस्वीकृति नहीं।",
    trustOn: "शामिल",
    trustOff: "नहीं ले रहे",
    trustPoints: "+{n} अंक",
    collateralNote: "क्या पेश कर रहे हैं? (वैकल्पिक नोट)",
    collateralPh: "जैसे दोपहिया, सोने के गहने",
    trustBenefitTitle: "मज़बूत ट्रस्ट प्रोफ़ाइल आपकी दर सुधार सकती है",
    trustBenefitBody:
      "स्कोर {score}/100 → अनुमानित दर सुधार {discount}% प्रति वर्ष तक। {extra}",
    trustBenefitSkip: "कुछ साझेदारों के साथ अतिरिक्त जाँच चरण छोड़ सकते हैं।",
    trustBenefitNone: "दर सुधार खोलने के लिए कुछ और संकेत जोड़ें।",
    trustBenefitBand: "वर्तमान स्तर: {band}",
    trustBandLow: "बन रहा है",
    trustBandMid: "स्थिर",
    trustBandHigh: "मज़बूत",
    trustChecklistItem: "ट्रस्ट प्रोफ़ाइल देखी गई",
    lenderTrustNote: "आपके ट्रस्ट स्कोर {score} से सूचीबद्ध दर में {discount}% प्रति वर्ष तक सुधार।",
    lenderSkipVerify: "इस प्रोफ़ाइल के लिए अतिरिक्त जाँच चरण छोड़ा गया",
    baseRate: "सूचीबद्ध दर",
    yourRate: "ट्रस्ट स्कोर के साथ आपकी दर",
    structureTitle: "वापसी वास्तव में कैसे होती है",
    structureSub:
      "वापसी अवधि और राहत भत्ता चुनें। अपनी स्थिति के अनुसार कोई भी महीने राहत के रूप में चिह्नित करें (सीमा तक)। बाकी महीनों पर अपनी ज़रूरत की किस्त तय करें — बाकी राशि अन्य महीनों में बँट जाती है ताकि पूरा योग कैलेंडर में चुकता रहे।",
    tenureLen: "ऋण वापसी की अवधि",
    tenureHint: "ऋण राशि बढ़ने पर लंबी अवधि खुलती है।",
    tenureLocked: "खोलने के लिए ऋण राशि बढ़ाएँ",
    monthsN: "{n} महीने",
    bufferLen: "कितने महीने राहत चिह्नित कर सकते हैं",
    months6: "6 महीने",
    months12: "12 महीने",
    bufferHow: "राहत महीने कैसे काम करते हैं",
    bufferHowBody:
      "आपके कैलेंडर में {total} महीने हैं ({repay} वापसी अवधि + {buffer} राहत स्लॉट)। नीचे महीनों पर टैप करें और अधिकतम {buffer} को राहत (₹0, बिना ब्याज) चिह्नित करें। बाकी हर महीने पर कोई भी किस्त तय कर सकते हैं — इस महीने कम दें तो बाकी राशि अन्य भुगतान महीनों में बँट जाएगी ताकि पूरा ऋण योग पूरा हो।",
    modeBefore: "वापसी शुरू होने से पहले",
    modeBeforeHint: "राहत खत्म होने तक किस्त नहीं। इस इंतज़ार पर ब्याज नहीं चलता।",
    modeDist: "आप चुनते हैं कौन से महीने राहत हैं",
    modeDistHint: "अपनी सीमा तक कोई भी महीने राहत चिह्नित करें।",
    timelineLegendRepay: "भुगतान का महीना",
    timelineLegendBuffer: "राहत महीना — ₹0, बिना ब्याज",
    interestTitle: "ब्याज केवल वापसी अवधि पर",
    interestOn24: "वापसी अवधि पर ब्याज",
    interestOnBuffer: "राहत महीनों पर ब्याज",
    interestSaved: "राहत महीने ब्याज-मुक्त होने से जो राशि नहीं लगती",
    interestSavedHint:
      "अगर राहत महीनों में बकाया मूल राशि पर ब्याज चलता, तो यह अतिरिक्त राशि जुड़ती। BharosaLoan इसे नहीं जोड़ता।",
    ratePreview:
      "पूर्वावलोकन दर {rate}% प्रति वर्ष — केवल राहत अवधि का हिसाब दिखाने के लिए। अगले चरण का साझेदार अंतिम दर तय करेगा।",
    emiTitle: "महीना योजना — राहत चुनें और लचीली किस्त",
    emiSub:
      "सभी {total} कैलेंडर महीने दिखते हैं। अधिकतम {buffer} को राहत चिह्नित करें। भुगतान महीनों पर अपनी राशि तय करें — बाकी राशि बाँटी जाती है ताकि पूरा योग चुकता रहे।",
    deadlineNote: "राहत या किस्त का बदलाव उस महीने की देय तिथि से कम-से-कम 2–3 दिन पहले चुनें।",
    actionFull: "बराबर हिस्सा लगाएँ",
    actionLess: "अपनी राशि तय करें",
    actionBuffer: "राहत चिह्नित करें",
    actionUnbuffer: "राहत हटाएँ",
    bufferQuota: "राहत महीने चिह्नित: {used} / {max}",
    bufferQuotaFull: "आप पहले ही {max} राहत महीने चिह्नित कर चुके हैं। दूसरा चुनने के लिए एक हटाएँ।",
    skipMonthInfo: "यह महीना राहत चिह्नित है — ₹0 देय, और ब्याज नहीं लगता।",
    skipRequested: "राहत महीना — ₹0। बाकी भुगतान महीने शेष योग उठाते हैं।",
    stdEmi: "सामान्य किस्त (अगर अवधि के हर महीने बराबर)",
    targetTotal: "कैलेंडर में चुकाने का कुल योग",
    flexHint:
      "उदाहरण: अगर बराबर हिस्सा ₹2,314 है और आप इस महीने ₹314 देते हैं, तो बाकी ₹2,000 अन्य भुगतान महीनों में बँट जाता है।",
    thisMonth: "चुना हुआ महीना",
    resetMonths: "सभी महीने के विकल्प रीसेट करें",
    lockHint: "अपनी राशि लॉक",
    gapOver: "निर्धारित योग ज़रूरी राशि से {n} अधिक है — किसी लॉक महीने को कम करें।",
    gapUnder: "{n} अभी अन्य भुगतान महीनों में रखना बाकी है।",
    gapOk: "भुगतान का योग मेल खाता है। महीने फिर से बाँट सकते हैं।",
    calendarSpan: "कैलेंडर अवधि: {n} महीने",
    repayCount: "{n}-महीने की वापसी अवधि",
    customAmount: "इस महीने की राशि",
    insFeeSlab: "हर 5% कवर स्लैब पर प्रीमियम बदलता है",
    insFeeSlabNote: "कवर स्लैब {pct}% → प्रीमियम {fee}",
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
    skipMonth: "राहत",
    repayMonth: "भुगतान",
    waitMonth: "इंतज़ार",
    userSkipMonth: "छोड़ें",
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

const EN_ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const HI_ONES = [
  "",
  "एक",
  "दो",
  "तीन",
  "चार",
  "पाँच",
  "छह",
  "सात",
  "आठ",
  "नौ",
  "दस",
  "ग्यारह",
  "बारह",
  "तेरह",
  "चौदह",
  "पंद्रह",
  "सोलह",
  "सत्रह",
  "अठारह",
  "उन्नीस",
];
const HI_TENS = [
  "",
  "",
  "बीस",
  "तीस",
  "चालीस",
  "पचास",
  "साठ",
  "सत्तर",
  "अस्सी",
  "नब्बे",
];
const HI_COMPOUND: Record<number, string> = {
  21: "इक्कीस",
  22: "बाईस",
  23: "तेइस",
  24: "चौबीस",
  25: "पच्चीस",
  26: "छब्बीस",
  27: "सत्ताईस",
  28: "अट्ठाईस",
  29: "उनतीस",
  31: "इकतीस",
  32: "बत्तीस",
  35: "पैंतीस",
  40: "चालीस",
  45: "पैंतालीस",
  50: "पचास",
  75: "पचहत्तर",
  99: "निन्यानवे",
};

/** Convert an integer to English words (Indian numbering: thousand / lakh). */
function numberToWordsEn(n: number): string {
  const num = Math.round(Math.abs(n));
  if (num === 0) return "zero";
  if (num < 20) return EN_ONES[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    return o ? `${EN_TENS[t]} ${EN_ONES[o]}` : EN_TENS[t];
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return rest ? `${EN_ONES[h]} hundred ${numberToWordsEn(rest)}` : `${EN_ONES[h]} hundred`;
  }
  if (num < 100_000) {
    const th = Math.floor(num / 1000);
    const rest = num % 1000;
    const head = `${numberToWordsEn(th)} thousand`;
    return rest ? `${head} ${numberToWordsEn(rest)}` : head;
  }
  const lakh = Math.floor(num / 100_000);
  const rest = num % 100_000;
  const head = `${numberToWordsEn(lakh)} lakh`;
  return rest ? `${head} ${numberToWordsEn(rest)}` : head;
}

/** Convert an integer to Hindi words (Indian numbering: हज़ार / लाख). */
function numberToWordsHi(n: number): string {
  const num = Math.round(Math.abs(n));
  if (num === 0) return "शून्य";
  if (HI_COMPOUND[num]) return HI_COMPOUND[num];
  if (num < 20) return HI_ONES[num];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    if (!o) return HI_TENS[t];
    if (HI_COMPOUND[num]) return HI_COMPOUND[num];
    return `${HI_TENS[t]} ${HI_ONES[o]}`;
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    const hundredWord = h === 1 ? "एक सौ" : `${HI_ONES[h]} सौ`;
    return rest ? `${hundredWord} ${numberToWordsHi(rest)}` : hundredWord;
  }
  if (num < 100_000) {
    const th = Math.floor(num / 1000);
    const rest = num % 1000;
    const head = th === 1 ? "एक हज़ार" : `${numberToWordsHi(th)} हज़ार`;
    return rest ? `${head} ${numberToWordsHi(rest)}` : head;
  }
  const lakh = Math.floor(num / 100_000);
  const rest = num % 100_000;
  const head = lakh === 1 ? "एक लाख" : `${numberToWordsHi(lakh)} लाख`;
  return rest ? `${head} ${numberToWordsHi(rest)}` : head;
}

function numberToWords(n: number, lang: Lang): string {
  return lang === "hi" ? numberToWordsHi(n) : numberToWordsEn(n);
}

/** Speakable rupee amount, e.g. "twenty five thousand rupees" / "पच्चीस हज़ार रुपये". */
function amountToSpeech(n: number, lang: Lang): string {
  const words = numberToWords(n, lang);
  return lang === "hi" ? `${words} रुपये` : `${words} rupees`;
}

/** Replace ₹ / Rs amounts in a string with natural spoken words before TTS. */
function rupeeAmountsToSpeech(text: string, lang: Lang): string {
  return text
    .replace(/₹\s*([\d,]+(?:\.\d+)?)/g, (_m, raw: string) => {
      const n = Number(String(raw).replace(/,/g, ""));
      return Number.isFinite(n) ? amountToSpeech(n, lang) : _m;
    })
    .replace(/\bRs\.?\s*([\d,]+(?:\.\d+)?)/gi, (_m, raw: string) => {
      const n = Number(String(raw).replace(/,/g, ""));
      return Number.isFinite(n) ? amountToSpeech(n, lang) : _m;
    });
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

/** Snap cover % to the nearest 5% slab between 25 and 50. */
function coverSlab(coverPct: number): number {
  const snapped = Math.round(coverPct / 5) * 5;
  return Math.min(50, Math.max(25, snapped));
}

/**
 * One-time protection fee by 5% cover slabs.
 * Each step from 25% → 50% raises the premium (no flat floor that hides changes).
 */
function protectionFee(principal: number, coverPct: number): number {
  const slab = coverSlab(coverPct);
  const steps = (slab - 25) / 5; // 0 … 5
  // 2.2% of principal at 25% cover, +0.8% of principal per +5% cover
  const rate = 0.022 + steps * 0.008;
  // Extra fixed step so small loans still change by at least ₹100 per slab
  const fixedStep = 100;
  return Math.max(199, Math.round(principal * rate) + steps * fixedStep);
}

/** Spread target repayment across calendar months; buffer months stay ₹0. */
function rebalanceCalendar(
  calendarLen: number,
  bufferMarks: Record<number, boolean>,
  overrides: Record<number, number>,
  target: number,
): { amounts: number[]; gap: number } {
  const amounts = Array.from({ length: calendarLen }, () => 0);
  const buffers = new Set(
    Object.keys(bufferMarks)
      .map(Number)
      .filter((i) => bufferMarks[i] && i >= 0 && i < calendarLen),
  );
  for (const i of buffers) amounts[i] = 0;

  const locked = Object.keys(overrides)
    .map(Number)
    .filter((i) => i >= 0 && i < calendarLen && !buffers.has(i));
  let lockedSum = 0;
  for (const i of locked) {
    amounts[i] = Math.max(0, Math.round(overrides[i]));
    lockedSum += amounts[i];
  }

  const unlocked = Array.from({ length: calendarLen }, (_, i) => i).filter(
    (i) => !buffers.has(i) && !locked.includes(i),
  );
  if (unlocked.length === 0) {
    const sum = amounts.reduce((a, b) => a + b, 0);
    return { amounts, gap: target - sum };
  }

  const remaining = target - lockedSum;
  if (remaining <= 0) {
    for (const i of unlocked) amounts[i] = 0;
    const sum = amounts.reduce((a, b) => a + b, 0);
    return { amounts, gap: target - sum };
  }

  const each = Math.max(0, Math.round(remaining / unlocked.length));
  for (const i of unlocked) amounts[i] = each;
  const sum = amounts.reduce((a, b) => a + b, 0);
  const last = unlocked[unlocked.length - 1];
  amounts[last] = Math.max(0, amounts[last] + (target - sum));
  const finalSum = amounts.reduce((a, b) => a + b, 0);
  return { amounts, gap: target - finalSum };
}

function countBufferMarks(bufferMarks: Record<number, boolean>, calendarLen: number): number {
  return Object.keys(bufferMarks)
    .map(Number)
    .filter((i) => bufferMarks[i] && i >= 0 && i < calendarLen).length;
}

/** Keep at most `maxBuffers` buffer marks when the allowance shrinks. */
function trimBufferMarks(
  bufferMarks: Record<number, boolean>,
  calendarLen: number,
  maxBuffers: number,
): Record<number, boolean> {
  const kept = Object.keys(bufferMarks)
    .map(Number)
    .filter((i) => bufferMarks[i] && i >= 0 && i < calendarLen)
    .sort((a, b) => a - b)
    .slice(0, maxBuffers);
  const next: Record<number, boolean> = {};
  for (const i of kept) next[i] = true;
  return next;
}

const FAQS: { keys: string[]; en: string; hi: string }[] = [
  {
    keys: ["miss", "late", "skip payment", "default", "नहीं दे", "चूक", "लेट", "किस्त नहीं", "भूल"],
    en: "If a month is hard, mark it as a buffer month (within your 6 or 12 allowance) for ₹0 due, or set any lower custom instalment — the rest is redistributed to other payment months. A missed payment by choice is not a covered protection event. Talk to your partner early — there is no hidden late-fee in this prototype schedule.",
    hi: "अगर महीना कठिन हो, तो उसे राहत महीना चिह्नित करें (6 या 12 की सीमा में) — ₹0 देय — या कोई भी कम किस्त तय करें; बाकी राशि अन्य भुगतान महीनों में बँट जाती है। जानबूझकर छूटी किस्त सुरक्षा कवर में नहीं आती। साझेदार से जल्दी बात करें — इस प्रोटोटाइप में छिपा लेट-फीस शेड्यूल नहीं है।",
  },
  {
    keys: ["buffer", "skip", "wait", "राहत", "बफर", "छोड़"],
    en: "Your calendar is repayment tenure plus buffer slots (for example 24 + 6 = 30 months). You choose which months are buffer — up to 6 or 12. Buffer months are ₹0 with no interest. On other months set any EMI you need; leftovers move so the full total is still paid. Change buffer or EMI 2–3 days before that month’s due date.",
    hi: "कैलेंडर = वापसी अवधि + राहत स्लॉट (जैसे 24 + 6 = 30 महीने)। आप चुनते हैं कौन से महीने राहत हैं — अधिकतम 6 या 12। राहत पर ₹0 और बिना ब्याज। बाकी महीनों पर अपनी किस्त तय करें; बाकी राशि बँटती है ताकि पूरा योग चुकता रहे। बदलाव देय तिथि से 2–3 दिन पहले करें।",
  },
  {
    keys: ["interest", "byaj", "ब्याज", "interest-free", "free buffer"],
    en: "Interest is calculated only on your chosen repayment months. The buffer does not add interest. The review screen shows the amount you avoid because the buffer is interest-free.",
    hi: "ब्याज केवल चुनी हुई वापसी अवधि पर लगता है। राहत अवधि ब्याज नहीं जोड़ती। समीक्षा पृष्ठ पर वह राशि दिखती है जो राहत ब्याज-मुक्त होने से बचती है।",
  },
  {
    keys: ["emi", "flex", "instal", "install", "60", "140", "income", "किस्त", "लची"],
    en: "There is no hard EMI band. On any payment month you can set the amount you need — even much lower than the equal share. Whatever you do not pay that month is redistributed across the other payment months so the full calendar total is still cleared.",
    hi: "किस्त की कोई कड़ी सीमा नहीं। किसी भी भुगतान महीने पर अपनी ज़रूरत की राशि तय करें — बराबर हिस्से से बहुत कम भी। जो इस महीने नहीं देते, वह अन्य भुगतान महीनों में बँट जाता है ताकि कैलेंडर का पूरा योग चुकता रहे।",
  },
  {
    keys: ["insur", "protect", "cover", "illness", "crop fail", "flood", "drought", "सुरक्षा", "बीमा", "फसल", "बीमार"],
    en: "Protection is optional and off by default. Cover is chosen in 5% slabs from 25% to 50% of the outstanding amount. The one-time premium changes at every slab. Covered hardships include crop failure from flood or drought, serious illness, or loss of main income.",
    hi: "सुरक्षा वैकल्पिक है और डिफ़ॉल्ट रूप से बंद है। कवर 25% से 50% तक हर 5% स्लैब में चुना जाता है। हर स्लैब पर एक बार का प्रीमियम बदलता है। कवर में बाढ़/सूखे से फसल नुकसान, गंभीर बीमारी, या मुख्य कमाई जाना शामिल है।",
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
  {
    keys: ["trust score", "trust profile", "ट्रस्ट", "विश्वास स्कोर", "प्रोफ़ाइल", "score"],
    en: "Your Trust Score (0–100) is built from everyday signals you choose — UPI consistency, utility bills, gig ratings, mandi sales, SHG savings, community vouching, and optional bank or collateral info. Each toggle shows exactly how many points it adds. Nothing is a black box.",
    hi: "आपका ट्रस्ट स्कोर (0–100) उन रोज़मर्रा संकेतों से बनता है जो आप चुनते हैं — UPI नियमितता, बिल, गिग रेटिंग, मंडी बिक्री, एसएचजी बचत, समुदाय की सिफ़ारिश, और वैकल्पिक बैंक या जमानत। हर टॉगल बताता है कितने अंक जुड़ते हैं। कोई ब्लैक-बॉक्स नहीं।",
  },
  {
    keys: ["bank statement", "mandatory", "required", "paperwork", "स्टेटमेंट", "ज़रूरी", "कागज़", "mandatory bank"],
    en: "A bank statement is helpful but never mandatory here. Many reliable people have irregular cash or digital income without thick paperwork. Multiple smaller signals can add up to the same trust as one formal document.",
    hi: "बैंक स्टेटमेंट मददगार है, पर यहाँ कभी अनिवार्य नहीं। कई भरोसेमंद लोगों के पास मोटा कागज़ी इतिहास नहीं होता। कई छोटे संकेत मिलकर एक औपचारिक दस्तावेज़ जितना विश्वास बना सकते हैं।",
  },
  {
    keys: ["vouch", "vouching", "community", " guarantor", "सिफ़ारिश", "वouch", "परिचित", "समुदाय"],
    en: "Community vouching means a known contact who has already repaid a BharosaLoan is willing to support your application. It adds a modest number of points and is optional — never a pressure on friends or family.",
    hi: "समुदाय की सिफ़ारिश का मतलब है कोई परिचित जिसने पहले भरोसालोन चुकाया हो, आपके आवेदन का समर्थन करे। इससे मामूली अंक जुड़ते हैं और यह वैकल्पिक है — दोस्तों या परिवार पर दबाव नहीं।",
  },
];

function matchFaq(q: string, lang: Lang): string {
  const lower = q.toLowerCase();
  let best: { row: (typeof FAQS)[number]; len: number } | null = null;
  for (const row of FAQS) {
    for (const k of row.keys) {
      const key = k.toLowerCase();
      if (lower.includes(key) && (!best || key.length > best.len)) {
        best = { row, len: key.length };
      }
    }
  }
  if (best) return best.row[lang];
  return lang === "hi"
    ? "मैं राहत अवधि, किस्त, ट्रस्ट स्कोर, छूटी किस्त, सुरक्षा, शुल्क, या आरबीआई बैज के बारे में बता सकता/सकती हूँ। थोड़े अलग शब्द आज़माएँ।"
    : "I can explain the buffer, instalments, Trust Score, missed payments, protection, fees, or RBI badges. Try a few different words.";
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
    // Never let TTS read ₹25,000 digit-by-digit — convert to natural words.
    const spoken = rupeeAmountsToSpeech(text, lang);
    const u = new SpeechSynthesisUtterance(spoken);
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
  const [trustSignals, setTrustSignals] = useState<Record<TrustSignalId, boolean>>({
    bank: false,
    collateral: false,
    upi: false,
    utility: false,
    gig: false,
    mandi: false,
    shg: false,
    vouch: false,
  });
  const [collateralNote, setCollateralNote] = useState("");
  const [displayScore, setDisplayScore] = useState(0);
  const [bufferMonths, setBufferMonths] = useState<6 | 12>(6);
  const [lenderId, setLenderId] = useState<string | null>(null);
  const [lenderFilter, setLenderFilter] = useState<"all" | "bank" | "nbfc">("all");
  const [wantInsurance, setWantInsurance] = useState(false);
  const [coverPct, setCoverPct] = useState(25);
  /** calIndex → locked custom EMI amount */
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  /** calIndex → user marked this month as buffer (₹0) */
  const [bufferMarks, setBufferMarks] = useState<Record<number, boolean>>({});
  const [selectedCal, setSelectedCal] = useState(0);
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
  const trustScore = useMemo(
    () => TRUST_SIGNALS.reduce((sum, s) => sum + (trustSignals[s.id] ? s.weight : 0), 0),
    [trustSignals],
  );
  const rateDiscount = trustRateDiscount(trustScore);
  const skipExtraVerify = trustSkipsExtraVerification(trustScore);
  const trustBand =
    trustScore >= 70 ? t(L, "trustBandHigh") : trustScore >= 40 ? t(L, "trustBandMid") : t(L, "trustBandLow");
  const lender = LENDERS.find((x) => x.id === lenderId) ?? null;
  const baseRate = lender?.rate ?? LENDERS[0].rate;
  const rate = Math.round((baseRate - rateDiscount) * 100) / 100;
  const emi = standardEmi(amount, rate, repayMonths);
  const interestTotal = totalInterest(amount, emi, repayMonths);
  const bufferIfCharged = bufferInterestIfCharged(amount, rate, bufferMonths);
  const proc = lender?.processingFee ?? 0;
  const activeCover = coverSlab(coverPct);
  const prot = wantInsurance ? protectionFee(amount, activeCover) : 0;
  const targetPay = emi * repayMonths;
  const calendarLen = repayMonths + bufferMonths;
  const { amounts, gap } = useMemo(
    () => rebalanceCalendar(calendarLen, bufferMarks, overrides, targetPay),
    [calendarLen, bufferMarks, overrides, targetPay],
  );
  const bufferUsed = countBufferMarks(bufferMarks, calendarLen);
  const selectedIsBuffer = !!bufferMarks[selectedCal];
  const selectedLocked = overrides[selectedCal] !== undefined;
  const barMax = Math.max(emi, ...amounts, 1);
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
      setBufferMarks({});
      setSelectedCal(0);
    }
  }, [unlockedTenures, repayMonths]);

  // Keep selected index in range; trim buffer marks if allowance/length shrinks.
  useEffect(() => {
    if (selectedCal >= calendarLen) setSelectedCal(0);
    setBufferMarks((prev) => {
      const trimmed = trimBufferMarks(prev, calendarLen, bufferMonths);
      const prevKeys = Object.keys(prev).sort().join(",");
      const nextKeys = Object.keys(trimmed).sort().join(",");
      return prevKeys === nextKeys ? prev : trimmed;
    });
    setOverrides((prev) => {
      let changed = false;
      const next: Record<number, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        const i = Number(k);
        if (i >= 0 && i < calendarLen) next[i] = v;
        else changed = true;
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  }, [calendarLen, bufferMonths, selectedCal]);

  // Animate the displayed Trust Score toward the real total.
  useEffect(() => {
    if (displayScore === trustScore) return;
    const dir = trustScore > displayScore ? 1 : -1;
    const id = window.setTimeout(() => {
      setDisplayScore((s) => {
        const next = s + dir * Math.max(1, Math.ceil(Math.abs(trustScore - s) / 6));
        if ((dir > 0 && next >= trustScore) || (dir < 0 && next <= trustScore)) return trustScore;
        return next;
      });
    }, 28);
    return () => clearTimeout(id);
  }, [trustScore, displayScore]);

  const trust = [
    { id: "rbi", label: t(L, "trustRbi"), on: true },
    { id: "exit", label: t(L, "trustExit"), on: true },
    { id: "lang", label: t(L, "trustLang"), on: !!lang },
    { id: "details", label: t(L, "trustDetails"), on: reached("trust") },
    { id: "trustProfile", label: t(L, "trustChecklistItem"), on: reached("structure") },
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
    if (step === "trust") {
      const active = TRUST_SIGNALS.filter((s) => trustSignals[s.id]).length;
      return g === "hi"
        ? `आपकी विश्वास प्रोफ़ाइल। ट्रस्ट स्कोर ${trustScore} में से 100 है। ${active} संकेत चालू हैं। बैंक स्टेटमेंट ज़रूरी नहीं। मज़बूत स्कोर आपकी ब्याज दर सुधार सकता है।`
        : `Your Trust Profile. Trust Score is ${trustScore} out of 100. ${active} signals are on. A bank statement is not required. A stronger score can improve your interest rate.`;
    }
    if (step === "structure") {
      return g === "hi"
        ? `कैलेंडर ${calendarLen} महीनों का है — ${repayMonths} वापसी अवधि और अधिकतम ${bufferMonths} राहत। आप स्वयं चुनें कौन से महीने राहत हैं। बाकी महीनों पर कोई भी किस्त तय करें; बाकी राशि अन्य महीनों में बँटती है। सामान्य किस्त लगभग ${inr(emi)} है। ब्याज ${inr(interestTotal)}। राहत पर ब्याज शून्य।`
        : `Your calendar has ${calendarLen} months — ${repayMonths} repayment tenure plus up to ${bufferMonths} buffer months you choose. Mark any months as buffer, and set any EMI on the rest; leftovers redistribute so the full total is paid. Equal-share EMI is about ${inr(emi)}. Interest ${inr(interestTotal)}. Buffer interest is zero.`;
    }
    if (step === "lender") {
      return g === "hi"
        ? `बैंक या एनबीएफसी साझेदार चुनें। आपके ट्रस्ट स्कोर ${trustScore} से दर में ${rateDiscount} प्रतिशत तक सुधार हो सकता है।${skipExtraVerify ? " अतिरिक्त जाँच चरण छोड़ा जा सकता है।" : ""} हर कार्ड पर आरबीआई बैज लिखा है।`
        : `Choose a Bank or NBFC partner. Your Trust Score ${trustScore} can improve rates by up to ${rateDiscount} percent.${skipExtraVerify ? " An extra verification step may be skipped." : ""} Each card shows an RBI badge.`;
    }
    if (step === "insurance") {
      return g === "hi"
        ? wantInsurance
          ? `सुरक्षा चालू है। कवर स्लैब ${activeCover} प्रतिशत है। एक बार का प्रीमियम ${inr(prot)} है — हर 5 प्रतिशत स्लैब पर बदलता है। यह वैकल्पिक है।`
          : "सुरक्षा वैकल्पिक है और अभी बंद है। आप 25 से 50 प्रतिशत तक हर 5 प्रतिशत स्लैब चुन सकते हैं। प्रीमियम हर स्लैब पर बदलता है।"
        : wantInsurance
          ? `Protection is on. Cover slab is ${activeCover} percent. The one-time premium is ${inr(prot)} and changes every 5 percent cover step. This remains optional.`
          : "Protection is optional and currently off. Choose cover in 5 percent slabs from 25 to 50. The premium changes at every slab.";
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
    calendarLen,
    interestTotal,
    bufferIfCharged,
    emi,
    wantInsurance,
    coverPct,
    activeCover,
    prot,
    proc,
    grand,
    undone,
    waitSkipped,
    undoLeft,
    trustScore,
    trustSignals,
    rateDiscount,
    skipExtraVerify,
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
    setTrustSignals({
      bank: false,
      collateral: false,
      upi: false,
      utility: false,
      gig: false,
      mandi: false,
      shg: false,
      vouch: false,
    });
    setCollateralNote("");
    setDisplayScore(0);
    setBufferMarks({});
    setSelectedCal(0);
  }

  function clearMonthOverride(calIndex: number) {
    setOverrides((o) => {
      if (o[calIndex] === undefined) return o;
      const next = { ...o };
      delete next[calIndex];
      return next;
    });
  }

  function setMonthAmount(calIndex: number, value: number) {
    if (bufferMarks[calIndex]) return;
    const capped = Math.max(0, Math.min(targetPay, Math.round(value)));
    setOverrides((o) => ({ ...o, [calIndex]: capped }));
  }

  function toggleBufferMark(calIndex: number) {
    setBufferMarks((prev) => {
      const on = !!prev[calIndex];
      if (on) {
        const next = { ...prev };
        delete next[calIndex];
        return next;
      }
      const used = countBufferMarks(prev, calendarLen);
      if (used >= bufferMonths) return prev;
      return { ...prev, [calIndex]: true };
    });
    clearMonthOverride(calIndex);
  }

  function toggleTrustSignal(id: TrustSignalId) {
    setTrustSignals((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (id === "collateral" && prev[id]) setCollateralNote("");
      return next;
    });
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

          {step === "trust" && (
            <Card>
              <h1 className="text-2xl font-bold sm:text-3xl">{t(L, "trustProfileTitle")}</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{t(L, "trustSub")}</p>
              <p className="mt-2 text-base leading-relaxed text-stone-700">{t(L, "trustSupport")}</p>

              <div
                className="mt-6 rounded-3xl p-5 shadow-card sm:p-6"
                style={{ backgroundColor: "#14532d" }}
                data-testid="trust-score-card"
              >
                <p className="text-sm font-bold uppercase tracking-wide" style={{ color: "#bbf7d0" }}>
                  {t(L, "trustScoreLabel")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-5">
                  <div
                    className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-amber-300"
                    aria-live="polite"
                  >
                    <span
                      className="text-5xl font-black tabular-nums leading-none"
                      style={{ color: "#14532d" }}
                      data-testid="trust-score"
                    >
                      {displayScore}
                    </span>
                    <span className="mt-1 text-sm font-bold text-stone-600">/ 100</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-sm font-bold"
                      style={{ backgroundColor: "#fcd34d", color: "#14532d" }}
                    >
                      {t(L, "trustBenefitBand", { band: trustBand })}
                    </span>
                    <div className="mt-3 h-4 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.25)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.min(100, displayScore)}%`,
                          backgroundColor: "#fbbf24",
                        }}
                      />
                    </div>
                    <p className="mt-3 text-sm font-medium leading-relaxed" style={{ color: "#ecfdf5" }}>
                      <span className="font-bold" style={{ color: "#ffffff" }}>
                        {t(L, "trustBenefitTitle")}
                      </span>
                      <br />
                      {rateDiscount > 0
                        ? t(L, "trustBenefitBody", {
                            score: trustScore,
                            discount: rateDiscount.toFixed(2),
                            extra: skipExtraVerify ? t(L, "trustBenefitSkip") : "",
                          })
                        : t(L, "trustBenefitNone")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="font-semibold">{t(L, "trustBreakdown")}</p>
                {trustScore === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">{t(L, "trustNoneYet")}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {TRUST_SIGNALS.filter((s) => trustSignals[s.id]).map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-sm text-green-950"
                      >
                        <span>{L === "hi" ? s.titleHi : s.titleEn}</span>
                        <span className="font-bold">{t(L, "trustPoints", { n: s.weight })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {TRUST_SIGNALS.map((s) => {
                  const Icon = s.icon;
                  const on = trustSignals[s.id];
                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        on ? "border-green-800 bg-green-50" : "border-stone-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTrustSignal(s.id)}
                        className="flex w-full items-start gap-3 text-left"
                        data-testid={`trust-signal-${s.id}`}
                        aria-pressed={on}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            on ? "bg-green-800 text-white" : "bg-amber-100 text-orange-800"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-base font-semibold text-stone-900">
                              {L === "hi" ? s.titleHi : s.titleEn}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                on ? "bg-green-800 text-white" : "bg-stone-200 text-stone-600"
                              }`}
                            >
                              {on ? t(L, "trustOn") : t(L, "trustOff")} · {s.weight}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-stone-600">
                            {L === "hi" ? s.descHi : s.descEn}
                          </span>
                          {s.optionalNoteEn && (
                            <span className="mt-1 block text-xs text-stone-500">
                              {L === "hi" ? s.optionalNoteHi : s.optionalNoteEn}
                            </span>
                          )}
                        </span>
                      </button>
                      {s.id === "collateral" && on && (
                        <label className="mt-3 block text-sm">
                          <span className="font-medium text-stone-700">{t(L, "collateralNote")}</span>
                          <input
                            value={collateralNote}
                            onChange={(e) => setCollateralNote(e.target.value)}
                            placeholder={t(L, "collateralPh")}
                            className="mt-1 min-h-11 w-full rounded-xl bg-white px-3 text-stone-900 outline-none ring-1 ring-stone-200"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
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
                          setBufferMarks({});
                          setSelectedCal(0);
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
                        onClick={() => {
                          setBufferMonths(n);
                          setSelectedCal(0);
                          setBufferMarks((prev) => trimBufferMarks(prev, repayMonths + n, n));
                          setOverrides({});
                        }}
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

              <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="font-bold text-stone-900">{t(L, "bufferHow")}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-700">
                  {t(L, "bufferHowBody", {
                    repay: repayMonths,
                    buffer: bufferMonths,
                    total: calendarLen,
                  })}
                </p>
                <p className="mt-3 text-sm font-semibold text-green-900">
                  {t(L, "bufferQuota", { used: bufferUsed, max: bufferMonths })}
                </p>
              </div>

              <Timeline
                lang={L}
                calendarLen={calendarLen}
                amounts={amounts}
                barMax={barMax}
                selectedCal={selectedCal}
                bufferMarks={bufferMarks}
                onSelectCal={setSelectedCal}
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
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  {t(L, "emiSub", { total: calendarLen, buffer: bufferMonths })}
                </p>
                <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-950 ring-1 ring-orange-200">
                  {t(L, "deadlineNote")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{t(L, "flexHint")}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <Stat label={t(L, "stdEmi")} value={inr(emi)} />
                  <Stat label={t(L, "targetTotal")} value={inr(targetPay)} />
                  <Stat
                    label={t(L, "bufferQuota", { used: bufferUsed, max: bufferMonths })}
                    value={`${bufferUsed}/${bufferMonths}`}
                  />
                </div>

                <MonthPlannerGrid
                  lang={L}
                  calendarLen={calendarLen}
                  amounts={amounts}
                  overrides={overrides}
                  bufferMarks={bufferMarks}
                  barMax={barMax}
                  std={emi}
                  selectedCal={selectedCal}
                  onSelectCal={setSelectedCal}
                />

                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                  <p className="font-semibold">
                    {t(L, "thisMonth")}: {t(L, "month", { n: selectedCal + 1 })}
                    {selectedIsBuffer && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">
                        {t(L, "skipMonth")}
                      </span>
                    )}
                    {!selectedIsBuffer && selectedLocked && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900">
                        {t(L, "lockHint")}
                      </span>
                    )}
                  </p>

                  <p className="mt-2 text-2xl font-bold text-orange-800">
                    {selectedIsBuffer ? inr(0) : inr(amounts[selectedCal] ?? 0)}
                  </p>

                  {selectedIsBuffer ? (
                    <p className="mt-2 text-base leading-relaxed text-green-900">{t(L, "skipMonthInfo")}</p>
                  ) : (
                    <p className="mt-1 text-sm text-stone-600">
                      {t(L, "stdEmi")}: {inr(emi)}
                    </p>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => toggleBufferMark(selectedCal)}
                      disabled={!selectedIsBuffer && bufferUsed >= bufferMonths}
                      title={
                        !selectedIsBuffer && bufferUsed >= bufferMonths
                          ? t(L, "bufferQuotaFull", { max: bufferMonths })
                          : undefined
                      }
                      className={`min-h-12 rounded-2xl px-3 text-sm font-semibold ${
                        selectedIsBuffer
                          ? "bg-green-800 text-white"
                          : bufferUsed >= bufferMonths
                            ? "cursor-not-allowed bg-stone-100 text-stone-400"
                            : "bg-amber-50 text-stone-800 ring-1 ring-stone-200"
                      }`}
                    >
                      {selectedIsBuffer ? t(L, "actionUnbuffer") : t(L, "actionBuffer")}
                    </button>
                    <button
                      type="button"
                      disabled={selectedIsBuffer}
                      onClick={() => clearMonthOverride(selectedCal)}
                      className={`min-h-12 rounded-2xl px-3 text-sm font-semibold ${
                        !selectedIsBuffer && !selectedLocked
                          ? "bg-orange-700 text-white"
                          : "bg-amber-50 text-stone-800 ring-1 ring-stone-200 disabled:opacity-50"
                      }`}
                    >
                      {t(L, "actionFull")}
                    </button>
                  </div>

                  {!selectedIsBuffer && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-stone-700">
                        {t(L, "customAmount")}
                        <input
                          type="number"
                          min={0}
                          max={targetPay}
                          step={1}
                          value={amounts[selectedCal] ?? 0}
                          onChange={(e) => setMonthAmount(selectedCal, Number(e.target.value) || 0)}
                          className="mt-1 min-h-12 w-full rounded-xl bg-amber-50 px-3 text-lg font-bold text-stone-900 outline-none ring-1 ring-stone-200"
                        />
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={targetPay}
                        step={10}
                        value={amounts[selectedCal] ?? 0}
                        onChange={(e) => setMonthAmount(selectedCal, Number(e.target.value))}
                        className="mt-3 h-3 w-full cursor-pointer accent-orange-700"
                        aria-label={t(L, "customAmount")}
                      />
                      <div className="mt-1 flex justify-between text-xs text-stone-500">
                        <span>{inr(0)}</span>
                        <span>{inr(targetPay)}</span>
                      </div>
                    </div>
                  )}

                  {!selectedIsBuffer && bufferUsed >= bufferMonths && (
                    <p className="mt-2 text-sm text-amber-800">{t(L, "bufferQuotaFull", { max: bufferMonths })}</p>
                  )}

                  <button
                    type="button"
                    className="mt-3 min-h-11 text-sm font-semibold text-orange-800 underline"
                    onClick={() => {
                      setOverrides({});
                      setBufferMarks({});
                    }}
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
              {(rateDiscount > 0 || skipExtraVerify) && (
                <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-950 ring-1 ring-green-200">
                  <p className="font-semibold">
                    {t(L, "lenderTrustNote", {
                      score: trustScore,
                      discount: rateDiscount.toFixed(2),
                    })}
                  </p>
                  {skipExtraVerify && (
                    <p className="mt-1 flex items-center gap-1 font-medium">
                      <Check className="h-4 w-4" /> {t(L, "lenderSkipVerify")}
                    </p>
                  )}
                </div>
              )}
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
                  const yourRate = Math.round((ln.rate - rateDiscount) * 100) / 100;
                  const e = standardEmi(amount, yourRate, repayMonths);
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
                      {skipExtraVerify && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-800/10 px-2 py-1 text-xs font-semibold text-green-900">
                          <Check className="h-3.5 w-3.5" /> {t(L, "lenderSkipVerify")}
                        </p>
                      )}
                      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          {rateDiscount > 0 ? (
                            <>
                              <dt className="text-stone-500">{t(L, "baseRate")}</dt>
                              <dd className="font-semibold text-stone-500 line-through decoration-stone-400">
                                {ln.rate}% p.a.
                              </dd>
                              <dt className="mt-1 text-stone-500">{t(L, "yourRate")}</dt>
                              <dd className="text-lg font-bold text-green-900">{yourRate}% p.a.</dd>
                            </>
                          ) : (
                            <>
                              <dt className="text-stone-500">{t(L, "annualRate")}</dt>
                              <dd className="text-lg font-bold">{ln.rate}% p.a.</dd>
                            </>
                          )}
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
                  <p className="mt-2 text-2xl font-bold text-green-900">{t(L, "insCoverOf", { pct: activeCover })}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COVER_SLABS.map((slab) => (
                      <button
                        key={slab}
                        type="button"
                        onClick={() => setCoverPct(slab)}
                        className={`min-h-11 rounded-full px-3 text-sm font-semibold ${
                          activeCover === slab
                            ? "bg-green-800 text-white"
                            : "bg-green-50 text-green-950 ring-1 ring-green-200"
                        }`}
                      >
                        {slab}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={50}
                    step={5}
                    value={activeCover}
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
                      cover: inr((amount * activeCover) / 100),
                      principal: inr(amount),
                    })}
                  </p>
                  <Line k={t(L, "insFee")} v={inr(prot)} strong />
                  <p className="mt-1 text-sm font-medium text-green-900">{t(L, "insFeeSlab")}</p>
                  <p className="text-sm text-stone-500">
                    {t(L, "insFeeSlabNote", { pct: activeCover, fee: inr(prot) })}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">{t(L, "insFeeHint")}</p>
                  <div className="mt-3 overflow-x-auto rounded-xl bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {t(L, "insFeeSlab")}
                    </p>
                    <div className="mt-2 flex min-w-max gap-3 text-sm">
                      {COVER_SLABS.map((slab) => (
                        <div
                          key={slab}
                          className={`rounded-lg px-2 py-1 ${
                            activeCover === slab ? "bg-green-800 text-white" : "text-stone-700"
                          }`}
                        >
                          <span className="font-semibold">{slab}%</span>
                          <span className="ml-1">{inr(protectionFee(amount, slab))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                  <Row k={t(L, "trustScoreLabel")} v={`${trustScore}/100`} />
                  {rateDiscount > 0 && (
                    <Row k={t(L, "yourRate")} v={`${rate}% p.a. (−${rateDiscount.toFixed(2)})`} />
                  )}
                  <Row k={t(L, "purposeLine")} v={t(L, purposeKey(purpose))} />
                  <Row k={t(L, "incomeLine")} v={t(L, incomeKey(income))} />
                  <Row k={t(L, "tenure")} v={t(L, "years2", { n: repayMonths })} />
                  <Row
                    k={t(L, "bufferLine")}
                    v={`${bufferUsed}/${bufferMonths} · ${t(L, "modeDist")}`}
                  />
                  <Row
                    k={t(L, "coverLine")}
                    v={wantInsurance ? `${activeCover}%` : t(L, "protNone")}
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
  calendarLen,
  amounts,
  barMax,
  selectedCal,
  bufferMarks,
  onSelectCal,
}: {
  lang: Lang;
  calendarLen: number;
  amounts: number[];
  barMax: number;
  selectedCal: number;
  bufferMarks: Record<number, boolean>;
  onSelectCal: (i: number) => void;
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
        {Array.from({ length: calendarLen }, (_, calIndex) => {
          const isBuffer = !!bufferMarks[calIndex];
          const h = !isBuffer
            ? Math.max(18, ((amounts[calIndex] ?? 0) / Math.max(1, barMax)) * 64)
            : 18;
          const sel = calIndex === selectedCal;
          return (
            <button
              key={calIndex}
              type="button"
              title={`${t(lang, "month", { n: calIndex + 1 })} · ${
                isBuffer ? t(lang, "skipMonth") : t(lang, "repayMonth")
              }`}
              onClick={() => onSelectCal(calIndex)}
              className={`flex w-7 shrink-0 flex-col items-center justify-end rounded-md pt-6 sm:w-8 ${
                sel ? "ring-2 ring-orange-700" : ""
              }`}
            >
              <span
                className={`w-full rounded-t-md ${
                  isBuffer ? "border border-dashed border-green-800 bg-green-50" : "bg-orange-600"
                }`}
                style={{ height: h }}
              />
              <span className="mt-1 text-[9px] text-stone-500">{calIndex + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
        <CalendarRange className="h-3.5 w-3.5" /> {calendarLen} {lang === "hi" ? "महीने" : "months"}
      </p>
    </div>
  );
}

function MonthPlannerGrid({
  lang,
  calendarLen,
  amounts,
  overrides,
  bufferMarks,
  barMax,
  std,
  selectedCal,
  onSelectCal,
}: {
  lang: Lang;
  calendarLen: number;
  amounts: number[];
  overrides: Record<number, number>;
  bufferMarks: Record<number, boolean>;
  barMax: number;
  std: number;
  selectedCal: number;
  onSelectCal: (i: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
      {Array.from({ length: calendarLen }, (_, calIndex) => {
        const isBuffer = !!bufferMarks[calIndex];
        const val = isBuffer ? 0 : amounts[calIndex] ?? 0;
        const locked = overrides[calIndex] !== undefined;
        const pct = isBuffer ? 0 : (val / Math.max(1, barMax)) * 100;
        return (
          <button
            key={calIndex}
            type="button"
            onClick={() => onSelectCal(calIndex)}
            className={`flex h-28 flex-col justify-end rounded-xl p-1 ${
              selectedCal === calIndex
                ? "bg-orange-100 ring-2 ring-orange-700"
                : isBuffer
                  ? "bg-green-50 ring-1 ring-dashed ring-green-700"
                  : "bg-amber-50"
            }`}
            aria-label={`${t(lang, "month", { n: calIndex + 1 })} ${
              isBuffer ? t(lang, "skipMonth") : inr(val)
            }`}
          >
            {isBuffer ? (
              <span className="flex flex-1 items-center justify-center px-0.5 text-center text-[10px] font-bold leading-tight text-green-800">
                {t(lang, "skipMonth")}
              </span>
            ) : (
              <span
                className={`w-full rounded-md ${val > std ? "bg-orange-700" : "bg-orange-400"}`}
                style={{ height: `${Math.max(12, pct * 0.72)}%` }}
              />
            )}
            <span className="mt-1 text-[10px] font-medium text-stone-600">{calIndex + 1}</span>
            {locked && !isBuffer && <span className="text-[8px] text-orange-800">●</span>}
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
