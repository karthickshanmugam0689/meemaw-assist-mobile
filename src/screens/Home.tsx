import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { ChatBubble } from "../components/ChatBubble";
import { ComposeBar, type ComposeMode } from "../components/ComposeBar";
import { AnnotatedImage } from "../components/AnnotatedImage";
import { RelatedPill } from "../components/RelatedPill";
import { SearchChip } from "../components/SearchChip";
import {
  hasOpenAIKey,
  openaiTranscribe,
  openaiVision,
  type ChatMessage,
  type Region,
} from "../lib/openai";
import { chatWithMode, type EngineMode } from "../lib/engine";
import { speak, stopSpeaking } from "../lib/tts";
import { resizeToJpegBase64 } from "../lib/image";
import { getLanguage, languageSystemMessage } from "../lib/languages";
import { LanguageProvider, tFor } from "../lib/i18n";
import { canEmbed, embed } from "../lib/embeddings";
import {
  appendTurn,
  findConversation,
  loadConversations,
  makeId,
  photoUri,
  savePhoto,
  searchTurns,
  startConversation,
  type Conversation,
  type ConversationTurn,
  type SearchHit,
  type StoredImage,
} from "../lib/memory";
import { SettingsPanel } from "./Settings";
import { HistoryScreen } from "./History";
import { VoiceModeScreen, type VoiceState } from "./VoiceMode";
import { waitForSilence } from "../lib/vad";

type UIMessage = ChatMessage & {
  image?: { url: string; regions: Region[] };
  related?: { query: string; score: number; conversationId: string };
  /** Set only on fresh turns where the model actually ran a web search.
   *  Not persisted — when a conversation reopens from History, the chip
   *  doesn't re-appear. */
  searchQuery?: string;
};

type InputMode = "voice" | "text";
type Panel = "chat" | "settings" | "history" | "voice";
type Snapshot = { activeConvId: string | null; messages: UIMessage[] };

export function Home() {
  const [composeMode, setComposeMode] = useState<ComposeMode>("idle");
  const [engineMode, setEngineMode] = useState<EngineMode>("auto");
  const [language, setLanguage] = useState<string>("auto");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [messages, setMessages] = useState<UIMessage[]>(() => [
    { role: "assistant", content: tFor("auto")("opening") },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [kbHeight, setKbHeight] = useState(0);
  const [visitingFrom, setVisitingFrom] = useState<Snapshot | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceLastUser, setVoiceLastUser] = useState<string | null>(null);
  const [voiceLastReply, setVoiceLastReply] = useState<string | null>(null);
  const voiceCancelRef = useRef(false);
  const voiceTapStopRef = useRef(false);
  /** Consecutive empty/silent turns in voice mode. Resets on any real speech.
   *  Two in a row = user is gone → exit gracefully. */
  const silentTurnsRef = useRef(0);
  const messagesRef = useRef<UIMessage[]>([]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const ttsHandleRef = useRef<{ stop: () => void } | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const activeConvIdRef = useRef<string | null>(null);
  /** Once a recall pill has been shown for the current active conversation,
   *  suppress future pills in the same thread to reduce UI noise. Reset
   *  whenever the active conversation changes (new, open-from-history). */
  const hasShownPillRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
    conversationsRef.current = loadConversations();
    // Start a fresh conversation on every app launch so the History view
    // stays clean — old conversations are preserved in storage.
  }, []);

  // Track keyboard height so we can manually push the compose bar above it.
  // KeyboardAvoidingView is unreliable on Android when edgeToEdgeEnabled is on.
  //
  // Complex IMEs (Hindi/Tamil/Arabic suggestion strips, Japanese kana picker)
  // under-report their height in keyboardDidShow, so we add a safety buffer.
  // The cost is a small empty strip above simple keyboards; the alternative
  // is a text box hidden behind the keyboard, which we never want.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const BUFFER = Platform.OS === "android" ? 32 : 0;
    const subs = [
      Keyboard.addListener(showEvent, (e) => {
        setKbHeight(e.endCoordinates.height + BUFFER);
        // Also snap the latest message into view in case the chip/card is
        // taller than the viewport shrinkage.
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }),
      Keyboard.addListener(hideEvent, () => setKbHeight(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages, composeMode]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const speakIfVoiceNow = useCallback(
    async (text: string, spoken: boolean) => {
      if (!spoken) {
        setComposeMode("idle");
        return;
      }
      ttsHandleRef.current?.stop();
      setComposeMode("speaking");
      const handle = speak(text, getLanguage(language).ttsCode);
      ttsHandleRef.current = handle;
      try {
        await handle.done;
      } finally {
        if (ttsHandleRef.current === handle) ttsHandleRef.current = null;
        setComposeMode("idle");
      }
    },
    [language]
  );

  /** Search past conversations for a semantically similar query. Silent on any error. */
  const recall = useCallback(async (query: string): Promise<SearchHit[]> => {
    if (!canEmbed() || conversationsRef.current.length === 0) return [];
    try {
      const { embedding, source } = await embed(query);
      return searchTurns(conversationsRef.current, embedding, source, {
        topK: 2,
        minScore: 0.75,
        excludeConversationId: activeConvIdRef.current ?? undefined,
      });
    } catch (err) {
      console.warn("recall failed", err);
      return [];
    }
  }, []);

  /** Ensure we have an active conversation; create one lazily on first turn. */
  const ensureActiveConversation = useCallback((): string => {
    if (activeConvIdRef.current) return activeConvIdRef.current;
    const conv = startConversation();
    activeConvIdRef.current = conv.id;
    conversationsRef.current = loadConversations();
    return conv.id;
  }, []);

  /** Reconstruct UI messages from a stored conversation. */
  const materialize = useCallback((conv: Conversation): UIMessage[] => {
    const out: UIMessage[] = [{ role: "assistant", content: tFor(language)("opening") }];
    for (const t of conv.turns) {
      out.push({ role: "user", content: t.query });
      if (t.image) {
        out.push({
          role: "assistant",
          content: t.reply,
          image: {
            url: photoUri(t.image.fileName),
            regions: t.image.regions,
          },
        });
      } else {
        out.push({ role: "assistant", content: t.reply });
      }
    }
    return out;
  }, [language]);

  /** Open a conversation by ID as the new active conversation. */
  const openConversation = useCallback(
    (convId: string) => {
      const conv = findConversation(convId);
      if (!conv) return;
      activeConvIdRef.current = conv.id;
      hasShownPillRef.current = false;
      setMessages(materialize(conv));
      setPendingImage(null);
      setError(null);
      setPanel("chat");
    },
    [materialize]
  );

  /** Visit a past conversation (e.g. from the Related pill) while
   *  remembering where to return. New messages while visiting DO append
   *  to the visited thread — but the back banner snaps you back to where
   *  you were one tap away. */
  const visitConversation = useCallback(
    (convId: string) => {
      if (!activeConvIdRef.current && messages.length <= 1) {
        // Nothing meaningful to come back to; just open it.
        openConversation(convId);
        return;
      }
      // Save a snapshot only the first time we visit in this hop, so
      // re-tapping another pill while visiting still returns all the way home.
      if (!visitingFrom) {
        setVisitingFrom({
          activeConvId: activeConvIdRef.current,
          messages,
        });
      }
      const conv = findConversation(convId);
      if (!conv) return;
      activeConvIdRef.current = conv.id;
      hasShownPillRef.current = true; // don't show more pills while visiting
      setMessages(materialize(conv));
      setPendingImage(null);
      setError(null);
      setPanel("chat");
    },
    [messages, visitingFrom, materialize, openConversation]
  );

  const returnFromVisit = useCallback(() => {
    if (!visitingFrom) return;
    activeConvIdRef.current = visitingFrom.activeConvId;
    setMessages(visitingFrom.messages);
    setVisitingFrom(null);
    // Reset so a fresh pill can appear in the original thread if warranted.
    hasShownPillRef.current = false;
    setPendingImage(null);
    setError(null);
  }, [visitingFrom]);

  /** Embed + append a turn to the active conversation. Optional image
   *  metadata is stored as-is (we don't embed the image content itself —
   *  only the query text). */
  const remember = useCallback(
    async (
      query: string,
      reply: string,
      image?: StoredImage
    ) => {
      if (!canEmbed()) return;
      const convId = ensureActiveConversation();
      try {
        const { embedding, source } = await embed(query);
        const turn: ConversationTurn = {
          id: makeId(),
          query,
          reply,
          timestamp: Date.now(),
          embedding,
          source,
          dim: embedding.length,
          ...(image ? { image } : {}),
        };
        appendTurn(convId, turn);
        conversationsRef.current = loadConversations();
      } catch (err) {
        console.warn("remember failed", err);
      }
    },
    [ensureActiveConversation]
  );

  /** Send a typed or transcribed user message. Includes memory recall + persistence. */
  const respond = useCallback(
    async (userText: string, opts: { spoken: boolean }) => {
      setError(null);
      setInputMode(opts.spoken ? "voice" : "text");

      // 1) recall similar past queries BEFORE we call the LLM.
      //    Only surface (and inject) if we haven't already shown a pill
      //    in this conversation — once per thread is enough.
      const hits = hasShownPillRef.current ? [] : await recall(userText);
      const top = hits[0];

      // 2) build the outgoing history, injecting top-1 hint if present
      const historyForLLM: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userText },
      ];
      if (top) {
        historyForLLM.splice(historyForLLM.length - 1, 0, {
          role: "system",
          content: `Earlier the user asked: "${top.turn.query}". You said: "${top.turn.reply}". If this new question is essentially the same, remind them of what worked. If it's different, answer fresh.`,
        });
      }
      // Pin the reply language if the user has chosen one explicitly.
      const langMsg = languageSystemMessage(language);
      if (langMsg) {
        historyForLLM.unshift({ role: "system", content: langMsg });
      }

      const next: UIMessage[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setComposeMode("thinking");

      try {
        const { reply, searchQuery } = await chatWithMode(historyForLLM, engineMode);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: reply,
            related: top
              ? {
                  query: top.turn.query,
                  score: top.score,
                  conversationId: top.conversationId,
                }
              : undefined,
            ...(searchQuery ? { searchQuery } : {}),
          },
        ]);
        if (top) hasShownPillRef.current = true;
        // 3) store this Q/A so future queries can recall it
        remember(userText, reply);
        await speakIfVoiceNow(reply, opts.spoken);
      } catch (e) {
        setComposeMode("idle");
        setError(e instanceof Error ? e.message : "unknown error");
      }
    },
    [messages, engineMode, recall, remember, speakIfVoiceNow]
  );

  const handleMic = useCallback(async () => {
    ttsHandleRef.current?.stop();
    ttsHandleRef.current = null;

    if (composeMode === "speaking") {
      stopSpeaking();
      setComposeMode("idle");
      return;
    }

    if (composeMode === "idle") {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setError(tFor(language)("micPermission"));
          return;
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
        setComposeMode("listening");
      } catch (e) {
        setError(e instanceof Error ? e.message : "mic error");
      }
      return;
    }

    if (composeMode === "listening") {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        setComposeMode("thinking");
        if (!uri) {
          setComposeMode("idle");
          return;
        }
        if (!hasOpenAIKey()) {
          throw new Error(
            "Voice input needs an OpenAI key. Type instead, or set EXPO_PUBLIC_OPENAI_API_KEY."
          );
        }
        const transcript = await openaiTranscribe(uri);
        if (!transcript.trim()) {
          setComposeMode("idle");
          return;
        }
        await respond(transcript, { spoken: true });
      } catch (e) {
        setComposeMode("idle");
        setError(e instanceof Error ? e.message : "transcription failed");
      }
    }
  }, [composeMode, recorder, respond]);

  /** Run one voice turn end-to-end: record (with VAD), transcribe, reply, speak.
   *  Shares every side-effect (memory, recall, search, nearby) with the text
   *  path by building the same history the chat path uses. */
  const doVoiceTurn = useCallback(async (): Promise<boolean> => {
    if (voiceCancelRef.current) return false;
    if (!hasOpenAIKey()) {
      setError(
        "Voice mode needs an OpenAI key for transcription. Type instead, or set EXPO_PUBLIC_OPENAI_API_KEY."
      );
      return false;
    }

    // 1. Listen
    setVoiceState("listening");
    voiceTapStopRef.current = false;

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic error");
      return false;
    }

    // Run VAD and tap-to-stop in parallel.
    const vadPromise = waitForSilence(recorder, voiceCancelRef, {
      silenceThreshold: -38,
      silenceMs: 1500,
      maxMs: 15000,
      preSpeechTimeoutMs: 8000,
    });
    const tapPromise = (async () => {
      while (!voiceCancelRef.current && !voiceTapStopRef.current) {
        await new Promise((r) => setTimeout(r, 80));
      }
      return voiceCancelRef.current ? "cancelled" : "tap";
    })();
    const result = await Promise.race([vadPromise, tapPromise]);

    try {
      await recorder.stop();
    } catch {}
    if (voiceCancelRef.current || result === "cancelled") return false;

    const uri = recorder.uri;
    if (!uri) return true; // skip silently

    // 2. Transcribe
    setVoiceState("thinking");
    let transcript = "";
    try {
      transcript = await openaiTranscribe(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "transcription failed");
      return false;
    }
    if (!transcript.trim()) {
      silentTurnsRef.current += 1;
      // Two silent turns in a row ≈ 16 s of no speech → the user has wandered off.
      if (silentTurnsRef.current >= 2) {
        voiceCancelRef.current = true;
        setPanel("chat");
        return false;
      }
      return !voiceCancelRef.current;
    }
    // Real speech — clear the silence counter.
    silentTurnsRef.current = 0;
    if (voiceCancelRef.current) return true;

    // 3. Add user message + call chat engine (reusing full memory/recall path)
    const currentMessages = messagesRef.current;
    const hits = hasShownPillRef.current ? [] : await recall(transcript);
    const top = hits[0];

    const historyForLLM: ChatMessage[] = [
      ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: transcript },
    ];
    if (top) {
      historyForLLM.splice(historyForLLM.length - 1, 0, {
        role: "system",
        content: `Earlier the user asked: "${top.turn.query}". You said: "${top.turn.reply}". If this new question is essentially the same, remind them of what worked. If it's different, answer fresh.`,
      });
    }
    const langMsg = languageSystemMessage(language);
    if (langMsg) historyForLLM.unshift({ role: "system", content: langMsg });

    setVoiceLastUser(transcript);
    setInputMode("voice");
    setMessages((m) => [...m, { role: "user", content: transcript }]);

    let reply = "";
    let searchQuery: string | undefined;
    let sessionDone = false;
    try {
      const res = await chatWithMode(historyForLLM, engineMode);
      reply = res.reply;
      searchQuery = res.searchQuery;
      sessionDone = !!res.sessionDone;
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      return false;
    }
    if (voiceCancelRef.current) return false;

    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: reply,
        related: top
          ? {
              query: top.turn.query,
              score: top.score,
              conversationId: top.conversationId,
            }
          : undefined,
        ...(searchQuery ? { searchQuery } : {}),
      },
    ]);
    if (top) hasShownPillRef.current = true;
    remember(transcript, reply);
    setVoiceLastReply(reply);

    // 4. Speak — tap-to-interrupt re-uses voiceTapStopRef
    setVoiceState("speaking");
    voiceTapStopRef.current = false;
    ttsHandleRef.current?.stop();
    const handle = speak(reply, getLanguage(language).ttsCode);
    ttsHandleRef.current = handle;
    const ttsDone = handle.done;
    // If user taps circle during speaking, stop TTS and move on to listen
    const tapInterrupt = (async () => {
      while (!voiceCancelRef.current && !voiceTapStopRef.current) {
        await new Promise((r) => setTimeout(r, 80));
      }
      if (voiceTapStopRef.current) handle.stop();
    })();
    await Promise.race([ttsDone, tapInterrupt]);
    if (ttsHandleRef.current === handle) ttsHandleRef.current = null;

    // If the model decided the conversation is done, tell the loop to exit
    // (the farewell has already been spoken above).
    if (sessionDone) {
      voiceCancelRef.current = true;
      setPanel("chat");
      return false;
    }
    return true;
  }, [recorder, language, engineMode, recall, remember]);

  /** Voice-mode loop: starts when panel becomes "voice", stops on exit. */
  useEffect(() => {
    if (panel !== "voice") return;
    voiceCancelRef.current = false;
    silentTurnsRef.current = 0;
    setVoiceState("idle");
    setVoiceLastUser(null);
    setVoiceLastReply(null);

    let active = true;
    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError(
          "Microphone permission is needed for voice mode. Allow access in phone Settings → Apps → Meemaw."
        );
        setPanel("chat");
        return;
      }
      while (active && !voiceCancelRef.current && panel === "voice") {
        const ok = await doVoiceTurn();
        if (!ok) break;
      }
      setVoiceState("idle");
    })();

    return () => {
      active = false;
      voiceCancelRef.current = true;
      try {
        ttsHandleRef.current?.stop();
      } catch {}
      try {
        recorder.stop().catch(() => {});
      } catch {}
    };
  }, [panel, doVoiceTurn, recorder]);

  const handleCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(tFor(language)("cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset?.uri) setPendingImage(asset.uri);
  }, []);

  const handleSendText = useCallback(
    async (text: string) => {
      setError(null);
      if (pendingImage) {
        const description = text.trim() || "What am I looking at?";
        const imageUri = pendingImage;
        setPendingImage(null);
        setInputMode("text");
        setMessages((m) => [
          ...m,
          { role: "user", content: `📷 ${description}` },
        ]);
        setComposeMode("thinking");
        try {
          if (!hasOpenAIKey()) {
            throw new Error(
              "Vision needs an OpenAI key. Set EXPO_PUBLIC_OPENAI_API_KEY to enable it."
            );
          }
          const { uri: resizedUri, base64 } = await resizeToJpegBase64(imageUri);
          const contextHistory: ChatMessage[] = [
            ...messages
              .filter((m) => !m.image)
              .slice(-6)
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: description },
          ];
          const vision = await openaiVision(base64, contextHistory);

          // Persist the resized image into Paths.document/photos/ so it
          // survives app restarts and can be shown when this conversation
          // is reopened from History.
          const photoId = makeId();
          let persistedUri = resizedUri;
          let storedImage: StoredImage | undefined;
          try {
            const fileName = savePhoto(resizedUri, photoId);
            persistedUri = photoUri(fileName);
            storedImage = { fileName, regions: vision.regions };
          } catch (err) {
            console.warn("photo persist failed", err);
          }

          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: vision.explanation,
              image: { url: persistedUri, regions: vision.regions },
            },
            ...(vision.followup
              ? [{ role: "assistant" as const, content: vision.followup }]
              : []),
          ]);
          remember(`📷 ${description}`, vision.explanation, storedImage);
          setComposeMode("idle");
        } catch (e) {
          setComposeMode("idle");
          setError(e instanceof Error ? e.message : "vision failed");
        }
        return;
      }
      await respond(text, { spoken: false });
    },
    [pendingImage, messages, respond, remember]
  );

  if (panel === "settings") {
    return (
      <SettingsPanel
        mode={engineMode}
        onModeChange={setEngineMode}
        language={language}
        onLanguageChange={setLanguage}
        onClose={() => setPanel("chat")}
      />
    );
  }

  if (panel === "voice") {
    return (
      <LanguageProvider value={language}>
        <VoiceModeScreen
          state={voiceState}
          lastUserMessage={voiceLastUser}
          lastReply={voiceLastReply}
          onTapCircle={() => {
            voiceTapStopRef.current = true;
          }}
          onExit={() => {
            voiceCancelRef.current = true;
            setPanel("chat");
          }}
        />
      </LanguageProvider>
    );
  }

  if (panel === "history") {
    return (
      <HistoryScreen
        onClose={() => setPanel("chat")}
        onStartNew={() => {
          activeConvIdRef.current = null;
          hasShownPillRef.current = false;
          setVisitingFrom(null);
          setMessages([{ role: "assistant", content: tFor(language)("opening") }]);
          setPendingImage(null);
          setError(null);
          setPanel("chat");
        }}
        onOpen={(convId) => {
          setVisitingFrom(null);
          openConversation(convId);
        }}
      />
    );
  }

  return (
    <LanguageProvider value={language}>
    <View style={[styles.root, { paddingBottom: kbHeight }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setPanel("settings")}
          hitSlop={6}
          style={({ pressed }) => [styles.titleRow, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <View>
            <Text style={styles.title}>Meemaw</Text>
            <View style={styles.subtitleRow}>
              <Text style={styles.langChip}>
                🌍 {getLanguage(language).nativeName}
              </Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.headerBtns}>
          <Pressable
            onPress={() => {
              // Stop any in-flight tap-mode recording first.
              try { recorder.stop().catch(() => {}); } catch {}
              ttsHandleRef.current?.stop();
              ttsHandleRef.current = null;
              setPanel("voice");
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.talkBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.talkBtnText}>{tFor(language)("talkBtn")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              activeConvIdRef.current = null;
              hasShownPillRef.current = false;
              setVisitingFrom(null);
              setMessages([{ role: "assistant", content: tFor(language)("opening") }]);
              setPendingImage(null);
              setError(null);
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
          <Pressable
            onPress={() => setPanel("history")}
            hitSlop={8}
            style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.menuText}>🕒</Text>
          </Pressable>
        </View>
      </View>

      {visitingFrom ? (
        <Pressable
          onPress={returnFromVisit}
          style={({ pressed }) => [
            styles.backBanner,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.backBannerText}>{tFor(language)("backToCurrent")}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}
      >
        {messages.map((m, i) => (
          <View key={i}>
            {m.related ? (
              <RelatedPill
                query={m.related.query}
                score={m.related.score}
                onPress={() => visitConversation(m.related!.conversationId)}
              />
            ) : null}
            <ChatBubble
              role={m.role as "user" | "assistant"}
              text={m.content}
            />
            {m.searchQuery ? <SearchChip query={m.searchQuery} /> : null}
            {m.image ? (
              <View style={{ marginTop: 6, marginBottom: 8, marginHorizontal: 4 }}>
                <AnnotatedImage src={m.image.url} regions={m.image.regions} />
              </View>
            ) : null}
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {composeMode === "thinking" ? (
          <Text style={styles.hint}>{tFor(language)("thinking")}</Text>
        ) : null}
      </ScrollView>

      <ComposeBar
        mode={composeMode}
        pendingImage={pendingImage}
        onClearImage={() => setPendingImage(null)}
        onSendText={handleSendText}
        onMicPress={handleMic}
        onCameraPress={handleCamera}
      />
    </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fffbf5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1e9d8",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "white", fontWeight: "800", fontSize: 18 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b" },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  langChip: {
    fontSize: 11,
    color: "#475569",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  headerBtns: { flexDirection: "row", gap: 8 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuText: { fontSize: 18, color: "#475569", lineHeight: 20 },
  newBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  newBtnText: { color: "white", fontSize: 14, fontWeight: "700" },
  talkBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
  },
  talkBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
  chat: { flex: 1 },
  error: { color: "#dc2626", textAlign: "center", marginTop: 10, paddingHorizontal: 12 },
  hint: { color: "#94a3b8", textAlign: "center", marginTop: 6, fontStyle: "italic" },
  backBanner: {
    backgroundColor: "#dbeafe",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBannerText: { color: "#1e40af", fontSize: 14, fontWeight: "700" },
});
