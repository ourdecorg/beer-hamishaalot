/**
 * i18n — Beer Hamishaalot
 *
 * Lang is persisted in a `lang` cookie (server-readable).
 * Default for new users: 'en'.
 * Client components read via useLang() (LangProvider context).
 * Server components call getLang() directly.
 */
import { cookies } from 'next/headers'

export type Lang = 'en' | 'he'

export async function getLang(): Promise<Lang> {
  const c = await cookies()
  const val = c.get('lang')?.value
  return val === 'he' ? 'he' : 'en'
}

export function dateLocale(lang: Lang): string {
  return lang === 'he' ? 'he-IL' : 'en-US'
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

  home: {
    sectionLabel: 'Well of Wishes',
    h1a: 'Share a wish from your heart —',
    h1b: 'and find who can help',
    subtitle:
      'A platform for connecting people through wishes. The AI analyzes each wish and finds matches — people who can help, collaborate, or join you.',
    ctaWrite: 'Write Your Wish',
    myWishes: 'My Wishes',
    freeLabel: 'Free · No commitment',

    howLabel: 'How it works',
    howTitle: 'Three steps to connection',

    whatLabel: 'What you get',
    whatTitle: 'More than a place to save wishes',

    featuresLabel: 'What makes it special',
    featuresTitle: 'What makes the engine special',

    previewLabel: 'A peek into the well',
    previewTitle: "What's already here",
    previewSub: 'Real wishes from the well',

    ctaLabel: 'Join the well',
    ctaTitle: 'Ready to send your wish?',
    ctaSub:
      'The engine is waiting. The well is open. Maybe someone out there is waiting for exactly your wish.',
    ctaBtn: 'Send a Wish',

    adminLink: 'Admin screens',

    steps: [
      {
        emoji: '✍️',
        title: 'Write your wish',
        desc: 'Share a dream, intention, or hope — in a few words, with contact details so others can reach you.',
      },
      {
        emoji: '✨',
        title: 'AI analyzes the wish',
        desc: 'The language model identifies themes, needs, capabilities, location and timeframe — to find precise connections.',
      },
      {
        emoji: '🔗',
        title: 'The well discovers connections',
        desc: 'The engine finds related and complementary wishes and shows contact details — so you can start a conversation.',
      },
    ],

    outcomes: [
      {
        icon: '🎯',
        bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
        title: 'Precise matches',
        desc: 'The engine analyzes theme, needs, capabilities, location and availability — connecting wishes that can truly meet.',
      },
      {
        icon: '🤝',
        bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
        title: 'Direct connection',
        desc: "When a match is found, both parties' contact details are shown — reach out immediately.",
      },
      {
        icon: '💫',
        bg: 'linear-gradient(145deg, #fdfaf5, #f9f3e7)',
        title: 'Community resonance',
        desc: "When your wish touches someone, they can resonate — and show you you're not alone.",
      },
    ],

    features: [
      {
        icon: '🎯',
        bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
        title: 'Smart matches',
        desc: 'The engine identifies similar and complementary wishes — whether someone is looking for exactly what you offer, or shares your aspiration.',
      },
      {
        icon: '📍',
        bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
        title: 'Location and time aware',
        desc: 'If you mentioned a location or timeframe, the engine ensures matched wishes are relevant geographically and temporally.',
      },
      {
        icon: '✨',
        bg: 'linear-gradient(145deg, #fdfaf5, #f2e5cd)',
        title: 'Context-aware AI',
        desc: 'The analysis identifies domain, intention and object type — to avoid wrong connections between different topics.',
      },
      {
        icon: '📬',
        bg: 'linear-gradient(145deg, #edf5f8, #a9d2e2)',
        title: 'Direct contact',
        desc: 'Each wish includes contact details. When a match is found — reach out directly, no intermediaries.',
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
    contactTitle: '✦ Contact details — will be shown with the wish',
    nameLabel: 'Name',
    nameRequired: '*',
    cityLabel: 'City',
    addressLabel: 'Address',
    phoneLabel: 'Phone',
    optional: '(optional)',
    namePlaceholder: 'Your name',
    addressPlaceholder: 'Street and number',
    phonePlaceholder: '050-0000000',
    submitBtn: 'Send my wish',
    submitting: 'Sending...',
    afterSubmit: 'After sending, the engine will search for matches and update you on the wish page',
    errorGeneric: 'An error occurred. Please try again.',
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
    details: 'Click for details →',
    visOpen: 'Open',
    visAnon: 'Anonymous',
    visPrivate: 'Private',
  },

  wishDetail: {
    pageTitle: 'Wish — Well of Wishes',
    originalWish: 'The original wish',
    contactDetails: 'Contact details',
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

  home: {
    sectionLabel: 'באר המשאלות',
    h1a: 'שתף משאלה שבלב —',
    h1b: 'ומצא את מי שיכול לעזור',
    subtitle:
      'פלטפורמה לחיבור בין אנשים על בסיס משאלות. ה-AI מנתח כל משאלה ומוצא התאמות — אנשים שיכולים לסייע, לשתף פעולה, או להצטרף אליך.',
    ctaWrite: 'כתוב את משאלתך',
    myWishes: 'המשאלות שלי',
    freeLabel: 'בחינם · ללא מחויבות',

    howLabel: 'איך זה עובד',
    howTitle: 'שלושה צעדים לחיבור',

    whatLabel: 'מה מקבלים',
    whatTitle: 'יותר ממקום לשמור משאלות',

    featuresLabel: 'מה מיוחד כאן',
    featuresTitle: 'מה מיוחד במנוע',

    previewLabel: 'הצצה לבאר',
    previewTitle: 'מה כבר נמצא כאן',
    previewSub: 'משאלות אמיתיות מהבאר',

    ctaLabel: 'הצטרף לבאר',
    ctaTitle: 'מוכן לשלח את משאלתך?',
    ctaSub:
      'המנוע ממתין. הבאר פתוחה. אולי מישהו שם בחוץ מחכה בדיוק למשאלה שלך.',
    ctaBtn: 'שלח משאלה',

    adminLink: 'מסכי ניהול',

    steps: [
      {
        emoji: '✍️',
        title: 'כתוב את משאלתך',
        desc: 'שתף חלום, כוונה, או תקווה — בכמה מילים, עם פרטי קשר כדי שאחרים יוכלו ליצור קשר.',
      },
      {
        emoji: '✨',
        title: 'ה-AI מנתח את המשאלה',
        desc: 'מודל השפה מזהה נושאים, צרכים, יכולות, מיקום וטווח זמן — כדי למצוא חיבורים מדויקים.',
      },
      {
        emoji: '🔗',
        title: 'הבאר מגלה חיבורים',
        desc: 'המנוע מוצא משאלות קשורות ומשלימות ומציג פרטי קשר — כדי שתוכל להתחיל שיחה.',
      },
    ],

    outcomes: [
      {
        icon: '🎯',
        bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
        title: 'התאמות מדויקות',
        desc: 'המנוע מנתח נושא, צרכים, יכולות, מיקום וזמינות — ומחבר בין משאלות שיכולות באמת להיפגש.',
      },
      {
        icon: '🤝',
        bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
        title: 'חיבור ישיר',
        desc: 'כשנמצאת התאמה, פרטי הקשר של שני הצדדים מוצגים — ניתן ליצור קשר מיידית.',
      },
      {
        icon: '💫',
        bg: 'linear-gradient(145deg, #fdfaf5, #f9f3e7)',
        title: 'הדהוד קהילתי',
        desc: 'כשמשאלתך נוגעת למישהו, הם יכולים להדהד — ולהראות לך שאתה לא לבד.',
      },
    ],

    features: [
      {
        icon: '🎯',
        bg: 'linear-gradient(145deg, #fff7ed, #fef3c7)',
        title: 'התאמות חכמות',
        desc: 'המנוע מזהה משאלות דומות ומשלימות — בין אם מישהו מחפש בדיוק מה שיש לך לתת, ובין אם חולקים אתך אותה שאיפה.',
      },
      {
        icon: '📍',
        bg: 'linear-gradient(145deg, #edf5f8, #d3e8f0)',
        title: 'מודע למיקום ולזמן',
        desc: 'אם ציינת מיקום או טווח זמן, המנוע מוודא שהמשאלות שמופגשות רלוונטיות גם גיאוגרפית וגם לוח-זמנית.',
      },
      {
        icon: '✨',
        bg: 'linear-gradient(145deg, #fdfaf5, #f2e5cd)',
        title: 'AI שמבין הקשר',
        desc: 'הניתוח מזהה את תחום העניין, הכוונה וסוג האובייקט — כדי להימנע מחיבורים מוטעים בין נושאים שונים.',
      },
      {
        icon: '📬',
        bg: 'linear-gradient(145deg, #edf5f8, #a9d2e2)',
        title: 'יצירת קשר ישירה',
        desc: 'כל משאלה כוללת פרטי קשר. כשנמצאת התאמה — אפשר לפנות ישירות, ללא מתווכים.',
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
    contactTitle: '✦ פרטי קשר — יוצגו עם המשאלה',
    nameLabel: 'שם',
    nameRequired: '*',
    cityLabel: 'ישוב',
    addressLabel: 'כתובת',
    phoneLabel: 'טלפון',
    optional: '(לא חובה)',
    namePlaceholder: 'השם שלך',
    addressPlaceholder: 'רחוב ומספר בית',
    phonePlaceholder: '050-0000000',
    submitBtn: 'שלח את המשאלה',
    submitting: 'שולח...',
    afterSubmit: 'לאחר השליחה, המנוע יחפש התאמות ויעדכן אותך בדף המשאלה',
    errorGeneric: 'אירעה שגיאה. נסה שוב.',
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
    details: 'לחץ לפרטים ←',
    visOpen: 'פתוח',
    visAnon: 'אנונימי',
    visPrivate: 'פרטי',
  },

  wishDetail: {
    pageTitle: 'משאלה — באר המשאלות',
    originalWish: 'המשאלה המקורית',
    contactDetails: 'פרטי קשר',
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
