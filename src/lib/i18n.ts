import { createContext, useContext } from "react";

/** All static strings the user sees during normal chat flow. Keep this small
 *  and stable — every key here needs a translation in every supported
 *  language (or gracefully falls back to English). */
export type StringKey =
  | "subtitle"
  | "opening"
  | "thinking"
  | "typeOrTap"
  | "listening"
  | "describePhoto"
  | "iRemember"
  | "lookedItUp"
  | "findNearby"
  | "usesLocation"
  | "nearPlace"
  | "backToCurrent"
  | "youLabel"
  | "cameraPermission"
  | "micPermission"
  | "talkBtn"
  | "voiceModeTitle"
  | "voiceListening"
  | "voiceThinking"
  | "voiceSpeaking"
  | "voiceTapToStop"
  | "voiceExit"
  | "voiceSaySomething";

type Dict = Record<StringKey, string>;

/** English is the source of truth. Every other language is a full override;
 *  missing keys fall through to English. `{product}` / `{place}` are
 *  substituted at runtime. */
const EN: Dict = {
  subtitle: "Tech help that actually helps",
  opening:
    "Hello! I'm Meemaw. Tell me what's going wrong, or tap the camera button to show me a picture.",
  thinking: "Meemaw is thinking…",
  typeOrTap: "Type, or tap the mic to talk",
  listening: "Listening…",
  describePhoto: "What do you want to know about this?",
  iRemember: "I remember a similar question",
  lookedItUp: "Looked it up",
  findNearby: "Find a {product} nearby",
  usesLocation: "Uses your phone's location",
  nearPlace: "Near {place}",
  backToCurrent: "← Back to your current conversation",
  youLabel: "You",
  cameraPermission: "Camera permission is needed to take a picture.",
  micPermission:
    "Microphone permission is needed to talk. Tap the mic again after allowing access in phone Settings → Apps → Meemaw.",
  talkBtn: "🎙 Talk",
  voiceModeTitle: "Voice mode",
  voiceListening: "I'm listening…",
  voiceThinking: "Thinking…",
  voiceSpeaking: "Meemaw is speaking…",
  voiceTapToStop: "Tap the circle to stop",
  voiceExit: "Exit voice mode",
  voiceSaySomething: "Say something, Meemaw is listening",
};

const TRANSLATIONS: Record<string, Partial<Dict>> = {
  en: EN,
  es: {
    subtitle: "Ayuda con la tecnología que de verdad ayuda",
    opening:
      "¡Hola! Soy Meemaw. Dime qué está pasando, o toca el botón de la cámara para enseñarme una foto.",
    thinking: "Meemaw está pensando…",
    typeOrTap: "Escribe, o pulsa el micrófono para hablar",
    listening: "Escuchando…",
    describePhoto: "¿Qué quieres saber sobre esto?",
    iRemember: "Recuerdo una pregunta parecida",
    lookedItUp: "Lo busqué",
    findNearby: "Encontrar {product} cerca",
    usesLocation: "Usa la ubicación de tu teléfono",
    nearPlace: "Cerca de {place}",
    backToCurrent: "← Volver a tu conversación actual",
    youLabel: "Tú",
    cameraPermission: "Se necesita permiso de cámara para sacar una foto.",
    micPermission:
      "Se necesita permiso de micrófono para hablar. Toca el micrófono otra vez después de permitirlo en Ajustes → Apps → Meemaw.",
    talkBtn: "🎙 Hablar",
    voiceModeTitle: "Modo voz",
    voiceListening: "Te escucho…",
    voiceThinking: "Pensando…",
    voiceSpeaking: "Meemaw está hablando…",
    voiceTapToStop: "Toca el círculo para parar",
    voiceExit: "Salir del modo voz",
    voiceSaySomething: "Dime algo, Meemaw te escucha",
  },
  fr: {
    subtitle: "Une aide technique qui aide vraiment",
    opening:
      "Bonjour ! Je suis Meemaw. Dites-moi ce qui ne va pas, ou touchez le bouton caméra pour me montrer une photo.",
    thinking: "Meemaw réfléchit…",
    typeOrTap: "Écrivez, ou touchez le micro pour parler",
    listening: "J'écoute…",
    describePhoto: "Que voulez-vous savoir à ce sujet ?",
    iRemember: "Je me souviens d'une question similaire",
    lookedItUp: "J'ai cherché",
    findNearby: "Trouver un {product} à proximité",
    usesLocation: "Utilise la position de votre téléphone",
    nearPlace: "Près de {place}",
    backToCurrent: "← Retour à votre conversation actuelle",
    youLabel: "Vous",
    cameraPermission: "L'accès à la caméra est nécessaire pour prendre une photo.",
    micPermission:
      "L'accès au micro est nécessaire pour parler. Touchez le micro à nouveau après avoir autorisé l'accès dans Réglages → Apps → Meemaw.",
  },
  de: {
    subtitle: "Technik-Hilfe, die wirklich hilft",
    opening:
      "Hallo! Ich bin Meemaw. Sag mir, was nicht klappt, oder tippe auf die Kamera, um mir ein Bild zu zeigen.",
    thinking: "Meemaw denkt nach…",
    typeOrTap: "Tippe, oder drücke das Mikrofon zum Sprechen",
    listening: "Ich höre zu…",
    describePhoto: "Was möchtest du darüber wissen?",
    iRemember: "Ich erinnere mich an eine ähnliche Frage",
    lookedItUp: "Nachgeschlagen",
    findNearby: "{product} in der Nähe finden",
    usesLocation: "Nutzt den Standort deines Telefons",
    nearPlace: "In der Nähe von {place}",
    backToCurrent: "← Zurück zum aktuellen Gespräch",
    youLabel: "Du",
    cameraPermission: "Für ein Foto wird die Kamera-Erlaubnis gebraucht.",
    micPermission:
      "Für das Sprechen wird das Mikrofon gebraucht. Tippe erneut aufs Mikro, nachdem du den Zugriff in Einstellungen → Apps → Meemaw erlaubt hast.",
    talkBtn: "🎙 Sprechen",
    voiceModeTitle: "Sprachmodus",
    voiceListening: "Ich höre zu…",
    voiceThinking: "Denke nach…",
    voiceSpeaking: "Meemaw spricht…",
    voiceTapToStop: "Tippe auf den Kreis zum Stoppen",
    voiceExit: "Sprachmodus beenden",
    voiceSaySomething: "Sag etwas, Meemaw hört zu",
  },
  it: {
    subtitle: "Aiuto tecnologico che aiuta davvero",
    opening:
      "Ciao! Sono Meemaw. Dimmi cosa non va, o tocca la fotocamera per mostrarmi una foto.",
    thinking: "Meemaw sta pensando…",
    typeOrTap: "Scrivi, o tocca il microfono per parlare",
    listening: "Ascolto…",
    describePhoto: "Cosa vuoi sapere su questo?",
    iRemember: "Ricordo una domanda simile",
    lookedItUp: "Ho cercato",
    findNearby: "Trova un {product} vicino",
    usesLocation: "Usa la posizione del tuo telefono",
    nearPlace: "Vicino a {place}",
    backToCurrent: "← Torna alla conversazione attuale",
    youLabel: "Tu",
    cameraPermission: "Serve il permesso della fotocamera per fare una foto.",
    micPermission:
      "Serve il permesso del microfono per parlare. Tocca di nuovo il microfono dopo aver concesso l'accesso in Impostazioni → App → Meemaw.",
  },
  pt: {
    subtitle: "Ajuda tecnológica que ajuda de verdade",
    opening:
      "Olá! Sou a Meemaw. Diga-me o que está a correr mal, ou toque no botão da câmara para me mostrar uma foto.",
    thinking: "Meemaw está a pensar…",
    typeOrTap: "Escreva, ou toque no microfone para falar",
    listening: "A ouvir…",
    describePhoto: "O que quer saber sobre isto?",
    iRemember: "Lembro-me de uma pergunta parecida",
    lookedItUp: "Pesquisei",
    findNearby: "Encontrar um {product} perto",
    usesLocation: "Usa a localização do seu telemóvel",
    nearPlace: "Perto de {place}",
    backToCurrent: "← Voltar à conversa atual",
    youLabel: "Você",
    cameraPermission: "É preciso permissão da câmara para tirar uma foto.",
    micPermission:
      "É preciso permissão do microfone para falar. Toque no microfone de novo depois de permitir em Definições → Apps → Meemaw.",
  },
  hi: {
    subtitle: "तकनीक की मदद जो सच में काम आती है",
    opening:
      "नमस्ते! मैं मीमॉ हूँ। बताइए क्या दिक्कत है, या मुझे तस्वीर दिखाने के लिए कैमरे का बटन दबाइए।",
    thinking: "मीमॉ सोच रही है…",
    typeOrTap: "लिखिए, या बोलने के लिए माइक दबाइए",
    listening: "सुन रही हूँ…",
    describePhoto: "आप इसके बारे में क्या जानना चाहते हैं?",
    iRemember: "मुझे एक ऐसा ही सवाल याद है",
    lookedItUp: "ढूँढ़ लिया",
    findNearby: "पास में {product} ढूँढ़ें",
    usesLocation: "आपके फ़ोन का स्थान इस्तेमाल करता है",
    nearPlace: "{place} के पास",
    backToCurrent: "← अपनी बातचीत पर वापस जाएँ",
    youLabel: "आप",
    cameraPermission: "तस्वीर लेने के लिए कैमरे की अनुमति चाहिए।",
    micPermission:
      "बोलने के लिए माइक की अनुमति चाहिए। फ़ोन Settings → Apps → Meemaw में अनुमति देने के बाद फिर से माइक दबाइए।",
  },
  ta: {
    subtitle: "உண்மையிலேயே உதவும் தொழில்நுட்ப உதவி",
    opening:
      "வணக்கம்! நான் மீமௌ. என்ன பிரச்சினை என்று சொல்லுங்கள், அல்லது படம் காட்ட கேமரா பொத்தானை அழுத்துங்கள்.",
    thinking: "மீமௌ யோசிக்கிறாள்…",
    typeOrTap: "எழுதுங்கள், அல்லது பேச மைக்கை அழுத்துங்கள்",
    listening: "கேட்கிறேன்…",
    describePhoto: "இதைப் பற்றி என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?",
    iRemember: "இதுபோன்ற ஒரு கேள்வியை நினைவில் வைத்திருக்கிறேன்",
    lookedItUp: "தேடிப் பார்த்தேன்",
    findNearby: "அருகில் {product} கண்டுபிடிக்கவும்",
    usesLocation: "உங்கள் தொலைபேசியின் இடத்தைப் பயன்படுத்துகிறது",
    nearPlace: "{place} அருகில்",
    backToCurrent: "← உங்கள் தற்போதைய உரையாடலுக்குத் திரும்பு",
    youLabel: "நீங்கள்",
    cameraPermission: "படம் எடுக்க கேமரா அனுமதி தேவை.",
    micPermission:
      "பேச மைக்ரோஃபோன் அனுமதி தேவை. Settings → Apps → Meemaw-இல் அனுமதி வழங்கிய பிறகு மீண்டும் மைக்கை அழுத்துங்கள்.",
  },
  sk: {
    subtitle: "Technická pomoc, ktorá naozaj pomáha",
    opening:
      "Ahoj! Som Meemaw. Povedz mi, čo sa deje, alebo klikni na tlačidlo fotoaparátu a ukáž mi obrázok.",
    thinking: "Meemaw rozmýšľa…",
    typeOrTap: "Napíš, alebo klikni na mikrofón a hovor",
    listening: "Počúvam…",
    describePhoto: "Čo by si chcel o tomto vedieť?",
    iRemember: "Pamätám si podobnú otázku",
    lookedItUp: "Pozrela som sa",
    findNearby: "Nájsť {product} v okolí",
    usesLocation: "Použije polohu tvojho telefónu",
    nearPlace: "Blízko {place}",
    backToCurrent: "← Späť k aktuálnej konverzácii",
    youLabel: "Ty",
    cameraPermission: "Na odfotenie je potrebné povolenie fotoaparátu.",
    micPermission:
      "Na rozprávanie je potrebné povolenie mikrofónu. Klikni na mikrofón znova po udelení povolenia v Nastavenia → Aplikácie → Meemaw.",
    talkBtn: "🎙 Hovor",
    voiceModeTitle: "Hlasový režim",
    voiceListening: "Počúvam…",
    voiceThinking: "Rozmýšľam…",
    voiceSpeaking: "Meemaw hovorí…",
    voiceTapToStop: "Klikni na krúžok pre zastavenie",
    voiceExit: "Ukončiť hlasový režim",
    voiceSaySomething: "Povedz niečo, Meemaw počúva",
  },
  zh: {
    subtitle: "真正有用的科技帮助",
    opening: "你好！我是Meemaw。告诉我哪里不对劲，或者点击相机按钮给我看一张照片。",
    thinking: "Meemaw正在想…",
    typeOrTap: "输入文字，或点击麦克风说话",
    listening: "正在听…",
    describePhoto: "你想知道关于这个的什么？",
    iRemember: "我记得一个类似的问题",
    lookedItUp: "查了一下",
    findNearby: "在附近找{product}",
    usesLocation: "使用你手机的位置",
    nearPlace: "靠近{place}",
    backToCurrent: "← 返回当前对话",
    youLabel: "你",
    cameraPermission: "需要相机权限才能拍照。",
    micPermission:
      "需要麦克风权限才能说话。在手机设置 → 应用 → Meemaw 中允许访问后，再次点击麦克风。",
  },
  ja: {
    subtitle: "本当に役立つテクノロジーのお手伝い",
    opening:
      "こんにちは！Meemawです。何が起こっているか教えてね、または写真を見せるにはカメラボタンを押してください。",
    thinking: "Meemawが考えています…",
    typeOrTap: "入力するか、マイクをタップして話してね",
    listening: "聞いています…",
    describePhoto: "これについて何を知りたい？",
    iRemember: "似た質問を覚えているよ",
    lookedItUp: "調べてみたよ",
    findNearby: "近くの{product}を探す",
    usesLocation: "電話の位置情報を使います",
    nearPlace: "{place}の近く",
    backToCurrent: "← 現在の会話に戻る",
    youLabel: "あなた",
    cameraPermission: "写真を撮るにはカメラの許可が必要です。",
    micPermission:
      "話すにはマイクの許可が必要です。設定 → アプリ → Meemaw でアクセスを許可してから、もう一度マイクをタップしてください。",
  },
  ar: {
    subtitle: "مساعدة تقنية تُساعد فعلاً",
    opening:
      "مرحباً! أنا ميماو. أخبرني ما الذي لا يعمل، أو اضغط على زر الكاميرا لتريني صورة.",
    thinking: "ميماو تفكر…",
    typeOrTap: "اكتب، أو اضغط على الميكروفون للتحدث",
    listening: "أنا أستمع…",
    describePhoto: "ماذا تريد أن تعرف عن هذا؟",
    iRemember: "أتذكر سؤالاً مشابهاً",
    lookedItUp: "بحثت عنه",
    findNearby: "ابحث عن {product} قريباً",
    usesLocation: "يستخدم موقع هاتفك",
    nearPlace: "بالقرب من {place}",
    backToCurrent: "← العودة إلى محادثتك الحالية",
    youLabel: "أنت",
    cameraPermission: "الكاميرا بحاجة إلى إذن لالتقاط صورة.",
    micPermission:
      "الميكروفون بحاجة إلى إذن للتحدث. اضغط على الميكروفون مرة أخرى بعد السماح بالوصول في الإعدادات → التطبيقات → Meemaw.",
  },
};

type Vars = Record<string, string | number>;

export function translate(
  key: StringKey,
  language: string,
  vars?: Vars
): string {
  const lang = TRANSLATIONS[language] ?? {};
  let s = lang[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

const LanguageCtx = createContext<string>("en");

export const LanguageProvider = LanguageCtx.Provider;

/** Hook: returns a translator bound to the current language. */
export function useT() {
  const lang = useContext(LanguageCtx);
  return (key: StringKey, vars?: Vars): string => translate(key, lang, vars);
}

/** Same translator without React, when you need to translate outside a component. */
export function tFor(language: string) {
  return (key: StringKey, vars?: Vars) => translate(key, language, vars);
}
