export type Locale = "en" | "zh" | "es" | "ja";

const countryLocales: Record<string, Locale> = {
  CN: "zh", HK: "zh", MO: "zh", TW: "zh",
  JP: "ja",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
};

export function detectLocale(country: string | null, acceptLanguage: string | null): Locale {
  if (country && countryLocales[country.toUpperCase()]) return countryLocales[country.toUpperCase()];
  const language = (acceptLanguage ?? "").toLowerCase();
  if (language.startsWith("zh")) return "zh";
  if (language.startsWith("ja")) return "ja";
  if (language.startsWith("es")) return "es";
  return "en";
}

export const copy = {
  en: {
    navHow: "How it works", navPrivacy: "Privacy", navSignIn: "Sign in",
    eyebrow: "YOUR DAYS, SEEN DIFFERENTLY",
    heroA: "Make your time", heroB: "feel like your own.",
    intro: "A quiet place to see the life ahead, keep the moments behind, and remember what deserves your attention today.",
    begin: "Begin my LifeScale", private: "Private by design", noAds: "No ads. No public feed.",
    remaining: "days to shape", today: "Today is worth keeping", add: "Keep this moment",
    valueTitle: "Not a countdown. A way back to what matters.",
    valueText: "LifeScale turns an abstract lifetime into a gentle daily compass — without pressure, comparison, or noise.",
    v1: "See the time ahead", v1d: "Set your own horizon and watch each day become visible, not frightening.",
    v2: "Keep a private life archive", v2d: "Save small joys, hard-won lessons, people, places, photos and words.",
    v3: "Carry it with you", v3d: "Your account and records are ready to follow you to iOS and Android.",
    quote: "A life feels longer when you can see what filled it.",
    footer: "Made for a more intentional life.",
  },
  zh: {
    navHow: "如何使用", navPrivacy: "隐私", navSignIn: "登录",
    eyebrow: "换一种方式，看见你的每一天",
    heroA: "把余生，", heroB: "活成自己的作品。",
    intro: "看见未来的时间，收藏走过的光，也记得今天真正值得在意的事。这里安静、私密，只属于你。",
    begin: "开启我的人生刻度", private: "隐私优先", noAds: "没有广告，没有公开动态",
    remaining: "天，等待被你赋予意义", today: "今天，也值得被记住", add: "收藏这一刻",
    valueTitle: "不是倒数生命，而是重新看见时间。",
    valueText: "人生刻度把抽象的一生，变成温柔的每日提醒——不制造焦虑，不与任何人比较。",
    v1: "看见前方的时间", v1d: "由你设定人生刻度，让每一天变得清晰，而不是令人害怕。",
    v2: "留下私密的人生档案", v2d: "收藏喜悦、教训、重要的人、去过的地方，以及想记住的话。",
    v3: "随身陪伴", v3d: "同一账号和记录，将来可无缝延续到 iOS 与 Android。",
    quote: "当你看见生命里装过什么，时间就不再只是流逝。",
    footer: "为更有意识的人生而做。",
  },
  es: {
    navHow: "Cómo funciona", navPrivacy: "Privacidad", navSignIn: "Entrar",
    eyebrow: "MIRA TUS DÍAS DE OTRA MANERA",
    heroA: "Haz que tu tiempo", heroB: "se sienta verdaderamente tuyo.",
    intro: "Un lugar tranquilo para ver la vida que queda, guardar lo vivido y recordar qué merece tu atención hoy.",
    begin: "Comenzar mi LifeScale", private: "Privado desde el diseño", noAds: "Sin anuncios ni red pública",
    remaining: "días por construir", today: "Hoy merece quedarse", add: "Guardar este momento",
    valueTitle: "No es una cuenta atrás. Es volver a lo que importa.",
    valueText: "LifeScale convierte una vida abstracta en una brújula diaria y amable, sin presión ni comparación.",
    v1: "Mira el tiempo que viene", v1d: "Elige tu horizonte y haz visible cada día, sin miedo.",
    v2: "Crea un archivo privado", v2d: "Guarda alegrías, aprendizajes, personas, lugares, fotos y palabras.",
    v3: "Llévalo contigo", v3d: "Tu cuenta y tus recuerdos podrán acompañarte en iOS y Android.",
    quote: "La vida se siente más larga cuando ves todo lo que la llenó.",
    footer: "Creado para vivir con más intención.",
  },
  ja: {
    navHow: "使い方", navPrivacy: "プライバシー", navSignIn: "ログイン",
    eyebrow: "毎日を、違う角度から見つめる",
    heroA: "残りの時間を、", heroB: "自分らしい作品に。",
    intro: "これからの時間を見つめ、歩んできた瞬間を残し、今日大切にしたいことを思い出す静かな場所。",
    begin: "LifeScaleを始める", private: "プライバシーを最優先", noAds: "広告も公開フィードもありません",
    remaining: "日を、自分らしく形づくる", today: "今日も、残す価値がある", add: "この瞬間を残す",
    valueTitle: "命を数えるのではなく、大切なものに戻るために。",
    valueText: "LifeScaleは、抽象的な人生を、プレッシャーや比較のない穏やかな日々の羅針盤に変えます。",
    v1: "これからの時間を見る", v1d: "自分で決めた地平線まで、一日一日を怖がらずに見える形へ。",
    v2: "自分だけの人生記録", v2d: "小さな喜び、学び、人、場所、写真、言葉を静かに残せます。",
    v3: "いつもそばに", v3d: "同じアカウントと記録を、将来iOSやAndroidでも使えます。",
    quote: "何で満たされていたかが見えると、人生はもっと長く感じられる。",
    footer: "意志のある人生のために。",
  },
} satisfies Record<Locale, Record<string, string>>;
