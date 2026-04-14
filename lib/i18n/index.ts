/**
 * i18n — Beer Hamishaalot (client-safe)
 *
 * This file contains only pure translation data — no server imports.
 * Server components that need to read the lang cookie should import
 * getLang() from '@/lib/i18n/server' instead.
 */

export type Lang = 'en' | 'he'

export function dateLocale(lang: Lang): string {
  return lang === 'he' ? 'he-IL' : 'en-US'
}

/** Forward-navigation arrow — points right in LTR, left in RTL */
export function forwardArrow(lang: Lang): string {
  return lang === 'he' ? '←' : '→'
}

// ── English ───────────────────────────────────────────────────────────────────

const en = {
  siteName: 'Well of Wishes',
  dir: 'ltr' as 'ltr' | 'rtl',

  nav: {
    myMatches: 'My Matches',
    myWishes: 'My Wishes',
    newWish: 'New Wish',
    login: 'Sign In',
    logout: 'Sign Out',
    admin: 'Admin',
    adminTestData: 'Load & Run Matching',
    adminConnections: 'Debug Connections',
    menuAriaLabel: 'Navigation menu',
  },

  lang: {
    switchLabel: 'עב',   // label shown when UI is in English — click to switch to Hebrew
  },

  tagline: 'Connecting people through wishes',

  home: {
    heroLabel: 'AI-powered wish matching',
    h1: 'A good idea starts with a wish',
    subtitle: "Write what's on your mind — AI will find people who can help",
    ctaWrite: 'Get Started',
    myWishes: 'My Wishes',

    inputPlaceholder: 'What would you like to happen?',
    inputHint: 'It can be an idea, question, or direction',
    inputCta: 'Continue',

    howLabel: 'How it works',

    proofText: 'People are already sharing wishes and finding connections',

    adminLink: 'Admin screens',

    steps: [
      {
        title: 'Write',
        desc: 'Write a wish, idea, or request in your own words',
      },
      {
        title: 'AI Processing',
        desc: 'AI analyzes and finds similar and complementary wishes',
      },
      {
        title: 'Connect',
        desc: 'Get contact details and start a conversation',
      },
    ],
  },

  login: {
    pageTitle: 'Sign In — Well of Wishes',
    heading: 'Welcome to the Well',
    subtitle: 'Enter your email address to sign in',
    emailLabel: 'Email address',
    submitBtn: 'Send sign-in link',
    submitting: 'Sending...',
    noPassword: 'No passwords. Just a magic link to your email.',
    backHome: 'Back to home',
    sentTitle: 'Check your email',
    sentDesc: 'We sent a sign-in link to',
    sentInstructions: 'Click the link to sign in to the well.',
    resend: 'Send again with a different email',
    error: 'An error occurred. Please try again.',
    googleBtn: 'Continue with Google',
    orDivider: 'or',
  },

  newWish: {
    pageTitle: 'New Wish — Well of Wishes',
    heading: 'Send a Wish',
    subheading: 'Share what is in your heart. The well is listening.',
    infoNote:
      'After sending, the AI engine will analyze the wish and search for connections with other wishes. Matches will appear on the wish page.',
  },

  wishForm: {
    label: 'What is your wish?',
    placeholder:
      'Share what is in your heart. It can be a dream, intention, hope, or anything you want to come true...',
    hint: 'Share freely — the well is listening',
    contactTitle: '✦ Contact details',
    nameLabel: 'Name',
    nameRequired: '*',
    countryLabel: 'Country',
    cityLabel: 'City',
    cityPlaceholder: 'City',
    phoneLabel: 'Phone',
    optional: '(optional)',
    namePlaceholder: 'Your name',
    phonePlaceholder: '050-0000000',
    submitBtn: 'Send my wish',
    submitting: 'Sending...',
    afterSubmit: 'After sending, the engine will search for matches and update you on the wish page',
    errorGeneric: 'An error occurred. Please try again.',
    consentHelper: 'Your wish may be shared with relevant matches to enable meaningful connections.',
    consentLabel: 'I understand that my wish, including any personal information I choose to include, may be shared with relevant matches when resonance is identified.',
    consentError: 'Please confirm your understanding before submitting.',
  },

  footer: {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
  },

  peekBox: {
    loadingMessages: ['Listening…', 'The well responds…', 'Searching for echoes…'],
    errorShort:      'Try writing a fuller thought',
    emptyMessage:    'Nothing echoed this time… try another thought',
    backBtn:         '← Back',
    placeholder:     'Write a thought… not necessarily a wish',
    hint:            'Release a thought into the well',
    submitBtn:       'Drop into well',
    resultsHeading:  'These wishes echoed with your thought',
    resetBtn:        '← Try another thought',
    noteSent:        '✓ Note sent to the wish owner',
    noteFormTitle:   'Leave a note to the wish owner',
    namePlaceholder:    'Your name (optional)',
    emailPlaceholder:   'Email for contact (optional)',
    messagePlaceholder: 'Write a note to the wish owner…',
    noteValidationError: 'Please write a note',
    noteGenericError:    'Error — try again',
    cancelBtn:  'Cancel',
    sendingBtn: 'Sending…',
    sendBtn:    'Send note',
    leaveNoteBtn: 'Leave a note to the wish owner',
    collabLabels: {
      build: 'Build', learn: 'Learn', connect: 'Connect', support: 'Support', share: 'Share',
    },
  },

  myWishes: {
    pageTitle: 'My Wishes — Well of Wishes',
    personalArea: 'Your personal area',
    title: 'My Wishes',
    newWish: 'New Wish',
    wishCount: (n: number) => (n === 1 ? '1 wish' : `${n} wishes`),
    emptyTitle: 'No wishes yet',
    emptySub: 'Share your first wish — the engine will search for connections.',
    firstWish: 'Write your first wish',
    noMatches: 'No matches found yet',
    matches: (n: number) => (n === 1 ? '1 match' : `${n} matches`),
    resonances: (n: number) => (n === 1 ? '1 resonance' : `${n} resonances`),
    notes: (n: number) => (n === 1 ? '1 note' : `${n} notes`),
    details: 'Click for details →',
    visOpen: 'Open',
    visAnon: 'Anonymous',
    visPrivate: 'Private',
  },

  wishDetail: {
    pageTitle: 'Wish — Well of Wishes',
    originalWish: 'The original wish',
    contactDetails: 'Contact details',
    notesReceived: (n: number) => `💬 ${n === 1 ? '1 note' : `${n} notes`} received`,
    nameLabel: 'Name',
    emailLabel: 'Email',
    cityLabel: 'City',
    addressLabel: 'Address',
    phoneLabel: 'Phone',
    resonateQuestion: 'Does this wish resonate with you?',
    resonateCount: (n: number) => (n === 1 ? '1 person resonates' : `${n} people resonate`),
    yourWish: 'This is your wish',
    yourResonances: (n: number) =>
      `💛 ${n} ${n === 1 ? 'person resonates' : 'people resonate'}`,
  },

  matches: {
    pageTitle: 'My Matches — Well of Wishes',
    personalArea: 'Your personal area',
    title: 'My Matches',
    backToWishes: '← My Wishes',
    matchCount: (n: number, total: number) => {
      const g = n === 1 ? '1 matching wish' : `${n} matching wishes`
      return total !== n
        ? `${g} · ${total} connections · sorted by score`
        : `${g} · sorted by score`
    },
    theirWish: 'Their wish',
    matchesYourWish: 'Matches your wish',
    yourMatchingWishes: 'Your wishes that match',
    moreWishes: (n: number) => `${n} of your wishes match`,
    contactDetails: 'Contact details',
    emailSubject: 'Collaboration — Well of Wishes',
    emptyNoWishes: 'No wishes yet — create your first wish',
    emptyNoMatches: 'The engine has not found matches yet — come back later',
    typeStrong: '✦ Strong',
    typeComplementary: '◈ Complementary',
    typeSimilar: '◎ Similar',
    firstWish: 'Write your first wish',
  },

  matchesSection: {
    loading: 'Searching for resonances…',
    emptyTitle: 'No matching wishes found yet',
    emptyEngine: 'The engine is running in the background — come back later',
    sectionTitle: 'Resonances found',
    scoreLabel: 'Match score',
    matchingWish: 'Matching wish',
    contactDetails: 'Wisher contact details',
    typeStrong: '✦ Strong',
    typeComplementary: '◈ Complementary',
    typeSimilar: '◎ Similar',

    // Disclosure / response UI
    disclosureTitle: 'Would you like to connect?',
    disclosureSubtitle: 'If you accept, choose which contact details to share. The other person will only see your details after they accept too.',
    acceptBtn: 'Accept',
    declineBtn: 'Decline',
    laterBtn: 'Maybe later',
    shareFieldsLabel: 'Fields to share (optional)',
    introLabel: 'Short intro message (optional)',
    introPlaceholder: 'Say something about why you want to connect…',
    submitAccept: 'Confirm connection',
    submitting: 'Saving…',
    waitingOther: 'You accepted — waiting for the other side',
    editSharedFields: 'Update shared details',
    contactMethodRequired: 'Please share at least one contact method (email or phone) to connect.',
    declinedState: 'Connection declined',
    mutualTitle: 'You are connected!',
    mutualSubtitle: 'Here are the details they chose to share:',
    noSharedFields: 'They accepted but did not share any contact details.',
    otherIntroLabel: 'Their message:',
    fieldLabels: {
      display_name: 'Name',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      city: 'City',
    },
    profileEmptyHint: 'Your profile has no saved fields yet. Go to your profile to add contact details.',
  },

  deleteWish: {
    confirm: 'Delete this wish?',
    delete: 'Delete',
    cancel: 'Cancel',
    error: 'Error, please try again',
  },

  resonance: {
    add: 'Resonate with this wish',
    remove: 'Remove resonance',
    active: 'Resonating',
    inactive: 'Resonate',
  },

  wishCard: {
    readMore: 'Read more',
  },
}

// ── Hebrew ────────────────────────────────────────────────────────────────────

const he: typeof en = {
  siteName: 'באר המשאלות',
  dir: 'rtl',

  nav: {
    myMatches: 'ההתאמות שלי',
    myWishes: 'המשאלות שלי',
    newWish: 'משאלה חדשה',
    login: 'כניסה',
    logout: 'יציאה',
    admin: 'ניהול',
    adminTestData: 'טעינה והרצת התאמות',
    adminConnections: 'ניפוי חיבורים',
    menuAriaLabel: 'תפריט ניווט',
  },

  lang: {
    switchLabel: 'EN',
  },

  tagline: 'פלטפורמה לחיבור בין אנשים על בסיס משאלות',

  home: {
    heroLabel: 'חיבורים מבוססי AI',
    h1: 'רעיון טוב מתחיל במשאלה',
    subtitle: 'כתוב מה שבלב — ה-AI ימצא אנשים שיכולים לעזור',
    ctaWrite: 'התחל עכשיו',
    myWishes: 'המשאלות שלי',

    inputPlaceholder: 'מה היית רוצה שיקרה?',
    inputHint: 'זה יכול להיות רעיון, שאלה או כיוון',
    inputCta: 'המשך',

    howLabel: 'איך זה עובד',

    proofText: 'אנשים כבר שיתפו משאלות ומצאו חיבורים',

    adminLink: 'מסכי ניהול',

    steps: [
      {
        title: 'כתיבה',
        desc: 'כתוב משאלה, רעיון, או בקשה בשפה שלך',
      },
      {
        title: 'עיבוד AI',
        desc: 'ה-AI מנתח ומוצא משאלות דומות ומשלימות',
      },
      {
        title: 'חיבור לאנשים',
        desc: 'מקבלים פרטי קשר ומתחילים שיחה',
      },
    ],
  },

  login: {
    pageTitle: 'כניסה — באר המשאלות',
    heading: 'ברוך הבא לבאר',
    subtitle: 'הכנס את כתובת האימייל שלך כדי להיכנס',
    emailLabel: 'כתובת אימייל',
    submitBtn: 'שלח קישור כניסה',
    submitting: 'שולח...',
    noPassword: 'אין סיסמאות. רק קישור קסם לאימייל שלך.',
    backHome: 'חזרה לדף הבית',
    sentTitle: 'בדוק את האימייל שלך',
    sentDesc: 'שלחנו קישור כניסה לכתובת',
    sentInstructions: 'לחץ על הקישור כדי להיכנס לבאר.',
    resend: 'שלח שוב עם אימייל אחר',
    error: 'אירעה שגיאה. נסה שוב.',
    googleBtn: 'המשך עם Google',
    orDivider: 'או',
  },

  newWish: {
    pageTitle: 'משאלה חדשה — באר המשאלות',
    heading: 'שלח משאלה',
    subheading: 'שתף את מה שנמצא בלבך. הבאר מקשיבה.',
    infoNote:
      'לאחר השליחה, מנוע ה-AI ינתח את המשאלה ויחפש חיבורים עם משאלות אחרות. התאמות יופיעו בדף המשאלה.',
  },

  wishForm: {
    label: 'מה משאלתך?',
    placeholder:
      'שתף את מה שנמצא בלבך. זה יכול להיות חלום, כוונה, תקווה, או כל דבר שרצונך שיתגשם...',
    hint: 'שתף בחופשיות — הבאר מקשיבה',
    contactTitle: '✦ פרטי קשר',
    nameLabel: 'שם',
    nameRequired: '*',
    countryLabel: 'ארץ',
    cityLabel: 'ישוב / עיר',
    cityPlaceholder: 'עיר',
    phoneLabel: 'טלפון',
    optional: '(לא חובה)',
    namePlaceholder: 'השם שלך',
    phonePlaceholder: '050-0000000',
    submitBtn: 'שלח את המשאלה',
    submitting: 'שולח...',
    afterSubmit: 'לאחר השליחה, המנוע יחפש התאמות ויעדכן אותך בדף המשאלה',
    errorGeneric: 'אירעה שגיאה. נסה שוב.',
    consentHelper: 'המשאלה שלך עשויה להיות משותפת עם התאמות רלוונטיות כדי לאפשר חיבורים משמעותיים.',
    consentLabel: 'אני מבין/ה שהמשאלה שלי, כולל כל מידע אישי שאבחר לכלול, עשויה להיות משותפת עם התאמות רלוונטיות כאשר מזוהה הדהוד.',
    consentError: 'אנא אשר/י את הסכמתך לפני השליחה.',
  },

  footer: {
    privacy: 'מדיניות פרטיות',
    terms: 'תנאי שימוש',
  },

  peekBox: {
    loadingMessages: ['מקשיב…', 'הבאר מגיב…', 'מחפש הדהודים…'],
    errorShort:      'נסה לכתוב מחשבה מלאה יותר',
    emptyMessage:    'לא הדהד כלום הפעם… נסה מחשבה אחרת',
    backBtn:         '← חזור',
    placeholder:     'כתוב מחשבה… לא בהכרח משאלה',
    hint:            'שחרר מחשבה אל הבאר',
    submitBtn:       'זרוק לבאר',
    resultsHeading:  'המשאלות האלה הדהדו עם המחשבה שלך',
    resetBtn:        '← נסה מחשבה אחרת',
    noteSent:        '✓ הפתק נשלח לבעל המשאלה',
    noteFormTitle:   'השאר פתק לבעל המשאלה',
    namePlaceholder:    'שמך (לא חובה)',
    emailPlaceholder:   'אימייל ליצירת קשר (לא חובה)',
    messagePlaceholder: 'כתוב פתק לבעל המשאלה…',
    noteValidationError: 'נא לכתוב פתק',
    noteGenericError:    'שגיאה — נסה שוב',
    cancelBtn:  'ביטול',
    sendingBtn: 'שולח…',
    sendBtn:    'שלח פתק',
    leaveNoteBtn: 'השאר פתק לבעל המשאלה',
    collabLabels: {
      build: 'בנייה', learn: 'למידה', connect: 'חיבור', support: 'תמיכה', share: 'שיתוף',
    },
  },

  myWishes: {
    pageTitle: 'המשאלות שלי — באר המשאלות',
    personalArea: 'האזור האישי שלך',
    title: 'המשאלות שלי',
    newWish: 'משאלה חדשה',
    wishCount: (n: number) => `${n} משאלות`,
    emptyTitle: 'עדיין אין משאלות',
    emptySub: 'שתף משאלה ראשונה — המנוע יחפש חיבורים.',
    firstWish: 'כתוב את משאלתך הראשונה',
    noMatches: 'טרם נמצאו התאמות',
    matches: (n: number) => `${n} ${n === 1 ? 'התאמה' : 'התאמות'}`,
    resonances: (n: number) => `${n} ${n === 1 ? 'הדהוד' : 'הדהודים'}`,
    notes: (n: number) => `${n} ${n === 1 ? 'פתק' : 'פתקים'}`,
    details: 'לחץ לפרטים ←',
    visOpen: 'פתוח',
    visAnon: 'אנונימי',
    visPrivate: 'פרטי',
  },

  wishDetail: {
    pageTitle: 'משאלה — באר המשאלות',
    originalWish: 'המשאלה המקורית',
    contactDetails: 'פרטי קשר',
    notesReceived: (n: number) => `💬 ${n === 1 ? 'פתק 1' : `${n} פתקים`} שהתקבלו`,
    nameLabel: 'שם',
    emailLabel: 'אימייל',
    cityLabel: 'ישוב',
    addressLabel: 'כתובת',
    phoneLabel: 'טלפון',
    resonateQuestion: 'משאלה זו נוגעת בך?',
    resonateCount: (n: number) =>
      `${n} ${n === 1 ? 'אדם' : 'אנשים'} מהדהדים`,
    yourWish: 'זו המשאלה שלך',
    yourResonances: (n: number) => `💛 ${n} אנשים מהדהדים`,
  },

  matches: {
    pageTitle: 'ההתאמות שלי — באר המשאלות',
    personalArea: 'האזור האישי שלך',
    title: 'ההתאמות שלי',
    backToWishes: '← המשאלות שלי',
    matchCount: (n: number, total: number) => {
      const g = `${n} ${n === 1 ? 'משאלה תואמת' : 'משאלות תואמות'}`
      return total !== n
        ? `${g} · ${total} חיבורים · ממוינות לפי ציון`
        : `${g} · ממוינות לפי ציון`
    },
    theirWish: 'המשאלה התואמת',
    matchesYourWish: 'מתאים למשאלתך',
    yourMatchingWishes: 'המשאלות שלך שתואמות',
    moreWishes: (n: number) => `${n} משאלות שלך תואמות`,
    contactDetails: 'פרטי קשר',
    emailSubject: 'שיתוף פעולה — באר המשאלות',
    emptyNoWishes: 'עדיין אין משאלות — צור משאלה ראשונה',
    emptyNoMatches: 'המנוע טרם מצא התאמות — חזור מאוחר יותר',
    typeStrong: '✦ הדהוד',
    typeComplementary: '◈ משלים',
    typeSimilar: '◎ דומה',
    firstWish: 'כתוב את משאלתך הראשונה',
  },

  matchesSection: {
    loading: 'מחפש הדהודים…',
    emptyTitle: 'טרם נמצאו משאלות מהדהדות',
    emptyEngine: 'המנוע פועל ברקע — חזור מאוחר יותר',
    sectionTitle: 'הדהודים שנמצאו',
    scoreLabel: 'ציון התאמה',
    matchingWish: 'המשאלה התואמת',
    contactDetails: 'פרטי מבקש המשאלה',
    typeStrong: '✦ הדהוד',
    typeComplementary: '◈ משלים',
    typeSimilar: '◎ דומה',

    // Disclosure / response UI
    disclosureTitle: 'האם תרצה להתחבר?',
    disclosureSubtitle: 'אם תאשר, בחר אילו פרטי קשר לשתף. הצד השני יראה את הפרטים שלך רק אחרי שיאשר גם הוא.',
    acceptBtn: 'אישור',
    declineBtn: 'דחייה',
    laterBtn: 'אולי אחר כך',
    shareFieldsLabel: 'שדות לשיתוף (לא חובה)',
    introLabel: 'הודעת היכרות קצרה (לא חובה)',
    introPlaceholder: 'ספר למה אתה רוצה להתחבר…',
    submitAccept: 'אישור חיבור',
    submitting: 'שומר…',
    waitingOther: 'אישרת — ממתין לצד השני',
    editSharedFields: 'עדכן פרטים משותפים',
    contactMethodRequired: 'יש לשתף לפחות אמצעי קשר אחד (אימייל או טלפון) כדי להתחבר.',
    declinedState: 'החיבור נדחה',
    mutualTitle: 'אתם מחוברים!',
    mutualSubtitle: 'הנה הפרטים שהם בחרו לשתף:',
    noSharedFields: 'הם אישרו אך לא שיתפו פרטי קשר.',
    otherIntroLabel: 'הודעתם:',
    fieldLabels: {
      display_name: 'שם',
      email: 'אימייל',
      phone: 'טלפון',
      country: 'ארץ',
      city: 'ישוב / עיר',
    },
    profileEmptyHint: 'הפרופיל שלך ריק. עבור לדף הפרופיל להוסיף פרטי קשר.',
  },

  deleteWish: {
    confirm: 'למחוק את המשאלה?',
    delete: 'מחק',
    cancel: 'ביטול',
    error: 'שגיאה, נסה שוב',
  },

  resonance: {
    add: 'הדהד משאלה זו',
    remove: 'הסר הדהוד',
    active: 'מהדהד',
    inactive: 'הדהד',
  },

  wishCard: {
    readMore: 'קרא עוד',
  },
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const translations = { en, he }
export type Translations = typeof en
export function t(lang: Lang): Translations {
  return translations[lang]
}
