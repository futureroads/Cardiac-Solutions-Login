import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, OverlayView } from "@react-google-maps/api";
import { Loader2, Play, Pause, Maximize2, Minimize2, MapPin, LogOut, Mic, AlertTriangle, RefreshCw, Activity, X } from "lucide-react";
import { getLedColor, LED_STYLES, useServiceStatuses } from "@/data/serviceStatuses";
import { ReadinessBreakdownModal } from "@/components/ReadinessBreakdownModal";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";
const API_URL = API_BASE;
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6a80" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a3a52" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#06b6d4", weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#2a3a52" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#141c2e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1c2840" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060a14" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const mapOptions = { styles: darkMapStyles, disableDefaultUI: false, zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, minZoom: 4, maxZoom: 18 };
const satelliteMapOptions = { styles: [], disableDefaultUI: false, zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, minZoom: 4, maxZoom: 18, mapTypeId: "hybrid" };
const mapCenter = { lat: 33.5, lng: -86.8 };

export default function StarkDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const [currentTime, setCurrentTime] = useState(new Date());
  const [freshUser, setFreshUser] = useState(user);

  // Voice state (OpenAI Realtime — AEDA)
  const [isListening, setIsListening] = useState(false);    // session active (mic open)
  const [isSpeaking, setIsSpeaking] = useState(false);      // AEDA currently speaking
  const [isHearingUser, setIsHearingUser] = useState(false); // OpenAI server-VAD reports speech
  const [micLevel, setMicLevel] = useState(0);              // local browser mic amplitude 0–100
  const [lastHeardText, setLastHeardText] = useState("");   // Whisper transcript
  const [voiceError, setVoiceError] = useState("");         // visible error status
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const dcRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  // Map state
  const [mapSubs, setMapSubs] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  // Map view mode state: "subscribers" = readiness pins per subscriber,
  // "aeds" = individual AED pins. When in AED mode, `aedSubscriber` filters to
  // a specific subscriber or "all".
  const [mapMode, setMapMode] = useState("subscribers");
  const [aedSubscriber, setAedSubscriber] = useState("all");
  const [aedSubscribersList, setAedSubscribersList] = useState([]);
  const [aedPins, setAedPins] = useState([]);
  const [aedLoading, setAedLoading] = useState(false);
  // Base map style: "dark" (custom styled roadmap) or "satellite" (hybrid imagery)
  const [mapType, setMapType] = useState("dark");
  // Fullscreen toggle for the map panel
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Status data
  const [liveStats, setLiveStats] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [bpData, setBpData] = useState(null);
  const { categories: serviceCategories } = useServiceStatuses(60000);

  // DI state
  const [diPaused, setDiPaused] = useState(false);
  const [showReadinessBreakdown, setShowReadinessBreakdown] = useState(false);

  // Service tickets (from service-tickets API or static)
  const [ticketCounts, setTicketCounts] = useState(null);
  // Readiness data (actual + adjusted from support dashboard-data)
  const [readiness, setReadiness] = useState(null);
  const [readinessHistory, setReadinessHistory] = useState(null);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [supportData, setSupportData] = useState(null);
  // Notifications sent today
  const [notifToday, setNotifToday] = useState(0);
  const [diEvents, setDiEvents] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh user
  useEffect(() => {
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setFreshUser(d); localStorage.setItem("user", JSON.stringify(d)); } })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // AEDA tool: "show_aeds_on_map" — driven by voice commands like
  // "show me where Georgia Power's AEDs are"
  const aliasMapRef = useRef({});
  const handleAedaShowAedsOnMap = useCallback((subscriberName) => {
    const raw = (subscriberName || "").trim();
    const lower = raw.toLowerCase();
    const aliasHit = aliasMapRef.current[lower];
    const aliased = aliasHit || raw;
    const names = (aedSubscribersList || []).map(s => typeof s === "string" ? s : (s?.subscriber || "")).filter(Boolean);
    const exact = names.find(n => n.toLowerCase() === aliased.toLowerCase());
    const partial = !exact && names.find(n => n.toLowerCase().includes(aliased.toLowerCase()) || aliased.toLowerCase().includes(n.toLowerCase()));
    const resolved = exact || partial || (lower === "all" ? "all" : aliased);
    console.log(`[AEDA tool] show_aeds_on_map raw="${raw}" alias="${aliasHit||'(none)'}" -> resolved="${resolved}" (list=${names.length})`);
    setMapMode("aeds");
    setAedSubscriber(resolved);
    setMapFullscreen(true);
    setSelectedId(null);
    setHoveredId(null);
    return { ok: true, resolved_subscriber: resolved, requested: subscriberName };
  }, [aedSubscribersList]);

  // AEDA tool: "find_aeds_near_location" — driven by "are there any AEDs near
  // Waycross, Georgia?" type queries
  const handleAedaFindNearLocation = useCallback(async (location, radiusMiles = 10) => {
    console.log(`[AEDA tool] find_aeds_near_location location="${location}" radius=${radiusMiles}`);
    try {
      const params = new URLSearchParams({ location, radius_miles: String(radiusMiles), limit: "5" });
      const res = await fetch(`${API}/aeda/aeds-near?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const t = await res.text();
        console.error("[AEDA tool] aeds-near HTTP", res.status, t);
        return { ok: false, error: `lookup failed (${res.status})` };
      }
      const data = await res.json();
      console.log("[AEDA tool] aeds-near result:", data);
      if (!data.ok || data.count === 0) {
        return { ok: false, voice_answer: data.voice_answer || `No AEDs found near ${location}.`, count: 0 };
      }
      // Drive the map: switch to AEDs mode, show all subscribers, zoom to query
      setMapMode("aeds");
      setAedSubscriber("all");
      setMapFullscreen(true);
      // Fly the map to the query coords + open the closest AED popup
      const top = data.aeds[0];
      setTimeout(() => {
        try {
          if (mapRef.current && window.google) {
            mapRef.current.panTo({ lat: data.query_lat, lng: data.query_lng });
            mapRef.current.setZoom(11);
          }
        } catch (e) { console.warn("[AEDA tool] map pan failed", e); }
        // The popup key format is `aed-${sentinel_id}-${index}`; defer until aedPins
        // re-loads after subscriber switch. The pinSelector effect below handles it.
        if (top?.sentinel_id) pendingSelectAedRef.current = top.sentinel_id;
      }, 600);
      return {
        ok: true,
        voice_answer: data.voice_answer,
        count: data.count,
        closest: top,
      };
    } catch (e) {
      console.error("[AEDA tool] aeds-near exception:", e);
      return { ok: false, error: e.message || String(e) };
    }
  }, [token]);

  // Pending sentinel ID to auto-select once aedPins are loaded for that area
  const pendingSelectAedRef = useRef(null);
  useEffect(() => {
    const sid = pendingSelectAedRef.current;
    if (!sid || !aedPins?.length) return;
    const idx = aedPins.findIndex(p => p.sentinel_id === sid);
    if (idx >= 0) {
      setSelectedId(`aed-${sid}-${idx}`);
      pendingSelectAedRef.current = null;
    }
  }, [aedPins]);

  // AEDA Realtime Voice (OpenAI Realtime API over WebRTC)
  const stopAeda = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    try {
      pcRef.current?.getSenders()?.forEach((s) => { try { s.track?.stop(); } catch {} });
      pcRef.current?.close();
    } catch {}
    try { micStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
    try { if (audioElRef.current) { audioElRef.current.srcObject = null; audioElRef.current.remove(); } } catch {}
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    pcRef.current = null;
    dcRef.current = null;
    micStreamRef.current = null;
    audioElRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    rafRef.current = null;
    setIsListening(false);
    setIsSpeaking(false);
    setIsHearingUser(false);
    setMicLevel(0);
  }, []);

  const startAeda = useCallback(async () => {
    if (isListening) { stopAeda(); return; }
    setVoiceError("");
    console.log("[AEDA] start: requesting session…");
    let briefingText = "";
    try {
      // 1) Ephemeral session (server-side) — validates OPENAI_API_KEY, returns client_secret + live fleet briefing
      const sessionRes = await fetch(`${API}/realtime/session`, { method: "POST" });
      if (!sessionRes.ok) {
        const t = await sessionRes.text();
        console.error("[AEDA] session error", sessionRes.status, t);
        throw new Error(`session ${sessionRes.status}: ${t.slice(0, 120)}`);
      }
      try {
        const sessionJson = await sessionRes.clone().json();
        briefingText = sessionJson?.aeda_briefing || "";
        if (sessionJson?.aeda_aliases && typeof sessionJson.aeda_aliases === "object") {
          aliasMapRef.current = sessionJson.aeda_aliases;
        }
        console.log("[AEDA] session OK, briefing length:", briefingText.length, "aliases:", Object.keys(aliasMapRef.current || {}).length);
      } catch {}

      // 2) Create WebRTC peer connection + remote audio sink
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      pc.ontrack = (e) => {
        console.log("[AEDA] ontrack: remote audio attached");
        audioEl.srcObject = e.streams[0];
      };
      pc.oniceconnectionstatechange = () => console.log("[AEDA] ICE:", pc.iceConnectionState);
      pc.onconnectionstatechange = () => console.log("[AEDA] PC:", pc.connectionState);

      // 3) Local mic (with echo cancellation so AEDA's output doesn't bleed back in)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micErr) {
        console.error("[AEDA] mic denied/unavailable:", micErr);
        throw new Error(`Mic blocked: ${micErr.name || micErr.message || "permission denied"}`);
      }
      micStreamRef.current = stream;
      const audioTracks = stream.getAudioTracks();
      console.log("[AEDA] mic OK — tracks:", audioTracks.map(t => ({ label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState })));
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      console.log("[AEDA] mic OK, negotiating…");

      // Local mic level meter — drives the visual "HEARING YOU" bars even if
      // OpenAI's server VAD is silent, so we can isolate mic vs. wire issues.
      try {
        const ACtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new ACtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        src.connect(analyser);
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length; // 0–255
          const level = Math.min(100, Math.round((avg / 80) * 100)); // scale to 0–100
          setMicLevel(level);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { console.warn("[AEDA] audio meter init failed", e); }

      // 4) Data channel for realtime events (speech start/stop, etc.)
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        console.log("[AEDA] data channel open — configuring session + sending greeting");
        try {
          // 1) Push proper session config via data channel (REST endpoint silently
          //    drops input_audio_transcription and some VAD params).
          dc.send(JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              input_audio_transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
                interrupt_response: true,
              },
            },
          }));
        } catch (e) { console.error("[AEDA] session.update failed", e); }

        // 1b) Push the live FLEET BRIEFING into conversation history. Long
        // system instructions get treated as "reference" by the realtime
        // model — putting the briefing as a conversation item makes the
        // model treat it as committed context it MUST use.
        if (briefingText) {
          try {
            dc.send(JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{
                  type: "input_text",
                  text: `[OPERATOR BRIEFING — read silently, do not speak this aloud, but use these numbers verbatim when answering any question about fleet status, readiness, percent ready, subscribers, or AED counts. This is the authoritative live data for our session.]\n\n${briefingText}`,
                }],
              },
            }));
            console.log("[AEDA] briefing pushed into conversation context");
          } catch (e) { console.error("[AEDA] briefing push failed", e); }
        }

        // 2) Force AEDA to open with a specific greeting based on local time of day
        try {
          const hour = new Date().getHours();
          const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
          // Greet user by first name unless their username is "stark" (generic test account)
          const username = (freshUser?.username || "").toLowerCase();
          const displayName = (freshUser?.name || freshUser?.username || "").trim();
          const firstName = displayName.split(/\s+/)[0] || "";
          const personalize = username && username !== "stark" && firstName;
          const greeting = personalize
            ? `Good ${partOfDay}, ${firstName}, my name is Aid-uh, how can I help you?`
            : `Good ${partOfDay}, my name is Aid-uh, how can I help you?`;
          dc.send(JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions: `Say exactly this, verbatim, in your natural voice, then stop and wait for the user's question: "${greeting}". Your name is pronounced "AID-uh" (rhymes with "aided"). Always pronounce it that way.`,
            },
          }));
        } catch (e) { console.error("[AEDA] greet send failed", e); }
      };
      dc.onmessage = async (e) => {
        try {
          const evt = JSON.parse(e.data);
          // Firehose log — every event type OpenAI sends us (helps diagnose turn-taking)
          if (evt.type && evt.type !== "response.audio.delta" && evt.type !== "response.audio_transcript.delta" && evt.type !== "response.output_audio.delta") {
            console.log("[AEDA evt]", evt.type, evt);
          }
          // Useful diagnostics for turn-taking
          if (evt.type === "input_audio_buffer.speech_started") {
            console.log("[AEDA] user started speaking");
            setIsHearingUser(true);
          } else if (evt.type === "input_audio_buffer.speech_stopped") {
            console.log("[AEDA] user stopped speaking");
            setIsHearingUser(false);
          } else if (evt.type === "input_audio_buffer.committed") {
            console.log("[AEDA] user turn committed -> expecting response");
            // Safety net: if no response.created arrives within 800ms, force one
            const dcRef2 = dcRef.current;
            setTimeout(() => {
              try {
                if (!isSpeakingRef.current && dcRef2 && dcRef2.readyState === "open") {
                  console.log("[AEDA] no auto-response detected — forcing response.create");
                  dcRef2.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio", "text"] } }));
                }
              } catch {}
            }, 800);
          } else if (evt.type === "conversation.item.input_audio_transcription.completed") {
            const txt = evt.transcript || "";
            console.log("[AEDA] heard user:", txt);
            setLastHeardText(txt);
            // Backup map-trigger: if the operator clearly asked to see a subscriber on the map,
            // fire the handler directly without waiting for AEDA's tool call.
            try {
              const t = txt.toLowerCase();
              // Detect "near <location>" intent first (most specific)
              const nearMatch = t.match(/\b(near|around|by|in|close to)\s+([a-z0-9 ,.'-]{3,80})\??\s*$/i);
              const aedKeyword = /\baeds?\b|\bdefibrillator/i.test(t);
              if (nearMatch && aedKeyword) {
                const loc = nearMatch[2].trim().replace(/\.$/, "");
                console.log(`[AEDA fallback] location intent detected -> "${loc}"`);
                handleAedaFindNearLocation(loc, 10);
              } else {
                const wantsMap = /(show|pull up|find|display|open|where|locate|locations? for)\b.*\b(map|aeds?)\b/i.test(t)
                  || /\b(map|aeds?)\b.*\b(for|of)\b/i.test(t)
                  || /show me where .*(aeds?|map)/i.test(t);
                if (wantsMap) {
                  const knownNames = (aedSubscribersList || []).map(s => typeof s === "string" ? s : (s?.subscriber || "")).filter(Boolean);
                  const aliasEntries = Object.entries(aliasMapRef.current || {});
                  const findMatch = () => {
                    for (const [spoken, canonical] of aliasEntries) {
                      if (t.includes(spoken)) return canonical;
                    }
                    for (const name of knownNames) {
                      if (t.includes(name.toLowerCase())) return name;
                    }
                    return null;
                  };
                  const matched = findMatch();
                  console.log(`[AEDA fallback] map intent detected, knownNames=${knownNames.length}, matched=`, matched);
                  if (matched) {
                    console.log(`[AEDA fallback] triggering map handler for "${matched}"`);
                    handleAedaShowAedsOnMap(matched);
                  }
                }
              }
            } catch (e) { console.warn("[AEDA fallback] match err", e); }
          } else if (evt.type === "response.created") {
            console.log("[AEDA] response.created");
          } else if (evt.type === "response.audio.delta" || evt.type === "output_audio_buffer.started" || evt.type === "response.output_audio.delta") {
            setIsSpeaking(true);
            isSpeakingRef.current = true;
          } else if (evt.type === "response.done" || evt.type === "output_audio_buffer.stopped" || evt.type === "response.audio.done") {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
          } else if (evt.type === "response.function_call_arguments.done") {
            // AEDA invoked a tool — route by name
            const name = evt.name;
            let args = {};
            try { args = JSON.parse(evt.arguments || "{}"); } catch {}
            console.log(`[AEDA tool-call] name=${name} args=`, args, "call_id=", evt.call_id);
            let result = { ok: false, error: "unknown tool" };
            if (name === "show_aeds_on_map") {
              result = handleAedaShowAedsOnMap(args.subscriber || "all");
            } else if (name === "find_aeds_near_location") {
              result = await handleAedaFindNearLocation(args.location || "", args.radius_miles || 10);
            }
            // Return the tool output so AEDA can continue her response
            try {
              const dc2 = dcRef.current;
              if (dc2 && dc2.readyState === "open") {
                dc2.send(JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: evt.call_id,
                    output: JSON.stringify(result),
                  },
                }));
                dc2.send(JSON.stringify({ type: "response.create" }));
              }
            } catch (e) { console.error("[AEDA tool] output send failed", e); }
          } else if (evt.type === "session.updated") {
            console.log("[AEDA] session.updated OK");
          } else if (evt.type === "error") {
            console.error("[AEDA] realtime error event:", evt);
            setVoiceError(`AEDA: ${evt.error?.message || "error"}`);
          }
        } catch (err) { console.error("[AEDA] msg parse err", err); }
      };
      dc.onclose = () => setIsSpeaking(false);

      // 5) SDP offer → backend → OpenAI → SDP answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const negRes = await fetch(`${API}/realtime/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!negRes.ok) {
        const t = await negRes.text();
        console.error("[AEDA] negotiate error", negRes.status, t);
        throw new Error(`negotiate ${negRes.status}: ${t.slice(0, 120)}`);
      }
      const { sdp: answerSdp } = await negRes.json();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setIsListening(true);
      console.log("[AEDA] connected");
    } catch (err) {
      console.error("[AEDA] startAeda failed:", err);
      setVoiceError(err.message || String(err));
      stopAeda();
    }
  }, [isListening, stopAeda, handleAedaShowAedsOnMap, handleAedaFindNearLocation, freshUser]);

  // Clean up on unmount
  useEffect(() => () => stopAeda(), [stopAeda]);

  // Fetch map
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/support/map-locations`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setMapSubs((d.subscribers || []).filter(s => s.has_geocode && s.geocode_lat && s.geocode_lng)); }
      } catch {}
      setMapLoading(false);
    })();
  }, [token]);

  // Fetch Readisys stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status-overview`);
      if (res.ok) { setLiveStats(await res.json()); setStatusError(null); } else setStatusError("API error");
    } catch { setStatusError("Connection failed"); }
    try { const res = await fetch(`${API}/status-overview/expiring-expired-bp`); if (res.ok) setBpData(await res.json()); } catch {}
  }, []);

  useEffect(() => { fetchStats(); const i = setInterval(fetchStats, 300000); return () => clearInterval(i); }, [fetchStats]);

  // Fetch readiness + support data from support dashboard-data
  useEffect(() => {
    const fetchSupportData = async () => {
      try {
        const res = await fetch(`${API}/support/dashboard-data`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setReadiness(d.readiness || null);
          setSupportData(d);
        } else {
          console.warn(`[StarkDashboard] dashboard-data failed: HTTP ${res.status}`);
        }
      } catch (e) {
        console.warn("[StarkDashboard] dashboard-data error:", e);
      }
    };
    fetchSupportData();
    const fetchReadinessHistory = async () => {
      try {
        const res = await fetch(`${API}/support/readiness-history?days=7`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setReadinessHistory(await res.json());
      } catch {}
    };
    fetchReadinessHistory();
    const i = setInterval(fetchSupportData, 300000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch service ticket counts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/service-tickets/counts`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setTicketCounts(await res.json());
      } catch {}
    })();
  }, [token]);

  // Fetch notifications sent today (refresh every 60s)
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await fetch(`${API}/support/notifications-today-count`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setNotifToday(d.count || 0); }
      } catch {}
    };
    fetchNotifCount();
    const i = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch recent email engagement + AED resolution events for the DI feed
  useEffect(() => {
    const fetchDiEvents = async () => {
      try {
        const res = await fetch(`${API}/support/di-events?hours=24`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setDiEvents(d.events || []); }
      } catch {}
    };
    fetchDiEvents();
    const i = setInterval(fetchDiEvents, 60000);
    return () => clearInterval(i);
  }, [token]);

  // ESC closes fullscreen map
  useEffect(() => {
    if (!mapFullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setMapFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapFullscreen]);

  // Re-fit when fullscreen toggles so Google Map adjusts to new size
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const doResize = () => {
      if (!mapRef.current) return;
      window.google.maps.event.trigger(mapRef.current, "resize");
      const c = mapRef.current.getCenter();
      if (c) {
        // Force tile re-render by panning to and from the same point
        mapRef.current.setCenter({ lat: c.lat(), lng: c.lng() });
      }
    };
    // Multiple staged resizes to handle CSS transition + tile load
    const timers = [
      setTimeout(doResize, 50),
      setTimeout(doResize, 250),
      setTimeout(() => { doResize(); fitAll(); }, 600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mapFullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the list of subscribers that have AED geocode data (for the AED mode dropdown)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/map/subscribers-with-aeds`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setAedSubscribersList(d.subscribers || []); }
      } catch {}
    })();
  }, [token]);

  // Fetch AED pins when in AED mode and selection changes
  useEffect(() => {
    if (mapMode !== "aeds") return;
    (async () => {
      setAedLoading(true);
      try {
        const url = aedSubscriber === "all"
          ? `${API}/map/subscriber-aeds`
          : `${API}/map/subscriber-aeds?subscriber=${encodeURIComponent(aedSubscriber)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setAedPins(d.aeds || []); }
        else setAedPins([]);
      } catch { setAedPins([]); }
      setAedLoading(false);
      setSelectedId(null); setHoveredId(null);
    })();
  }, [mapMode, aedSubscriber, token]);

  // Map helpers
  const geoSubs = mapSubs;
  const fitAll = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let added = 0;
    if (mapMode === "subscribers") {
      geoSubs.forEach(s => {
        const lat = parseFloat(s.geocode_lat); const lng = parseFloat(s.geocode_lng);
        if (!isNaN(lat) && !isNaN(lng)) { bounds.extend({ lat, lng }); added++; }
      });
    } else {
      aedPins.forEach(p => {
        const lat = parseFloat(p.latitude); const lng = parseFloat(p.longitude);
        if (!isNaN(lat) && !isNaN(lng)) { bounds.extend({ lat, lng }); added++; }
      });
    }
    if (added > 0) mapRef.current.fitBounds(bounds, 60);
  }, [geoSubs, aedPins, mapMode]);
  useEffect(() => { fitAll(); }, [fitAll]);

  // Stats
  const totals = liveStats?.totals || {};
  const stats = {
    total: totals.total || 0, ready: totals.ready || 0, lost: totals.lost_contact || 0,
    service: totals.not_ready || 0, dispatch: 0, alerts: (totals.lost_contact || 0) + (totals.not_ready || 0),
    pendingNotifs: 48, sentToday: 0, devicesAffected: totals.total || 0,
  };
  const pctReady = totals.percent_ready != null ? Number(totals.percent_ready).toFixed(1) : "—";
  const pctAdjusted = readiness?.pct_ready_adjusted != null ? Number(readiness.pct_ready_adjusted).toFixed(1) : pctReady;
  const pctActual = readiness?.pct_ready != null ? Number(readiness.pct_ready).toFixed(1) : pctReady;

  // Gauge angles: 0% = -90deg (left), 100% = 90deg (right)
  const adjustedVal = readiness?.pct_ready_adjusted ?? totals.percent_ready ?? 0;
  const actualVal = readiness?.pct_ready ?? totals.percent_ready ?? 0;
  const gaugeAngleAdjusted = -90 + (adjustedVal / 100) * 180;
  const gaugeAngleActual = -90 + (actualVal / 100) * 180;

  // Last updated
  const lastUpdated = (() => {
    const ts = liveStats?.completion_time;
    if (!ts) return null;
    try {
      const d = new Date(ts);
      const now = new Date();
      const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      if (d.toDateString() === now.toDateString()) return `Today ${time}`;
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return null; }
  })();

  // DI Recommendations — overview mode
  const diPerms = freshUser?.di_permissions || { expired_bp: "overview", expiring_bp: "overview", camera_battery: "overview", camera_cellular: "overview" };
  const aiRecs = (() => {
    if (!liveStats && !bpData) return [{ type: "SYS", msg: "Loading your Decision Intelligence Overview Messages..." }];
    const items = [];
    const bd = totals.telemetry_distribution?.battery || {};
    const cd = totals.telemetry_distribution?.cellular || {};
    const todayPct = totals.percent_ready;
    const prevPct = totals.prev_percent_ready;
    if (todayPct != null && prevPct != null) {
      const diff = (todayPct - prevPct).toFixed(1);
      const absDiff = Math.abs(diff);
      // Build explanation of what changed
      const todayDsc = totals.detailed_status_counts || {};
      const prevDsc = totals.prev_detailed_status_counts || {};
      const statusLabels = { expired_bp: "Expired B/P", expiring_batt_pads: "Expiring B/P", not_ready: "Not Ready", reposition: "Reposition", not_present: "Not Present", unknown: "Unknown", lost_contact: "Lost Contact" };
      const increases = [];
      const decreases = [];
      for (const [key, label] of Object.entries(statusLabels)) {
        const t = todayDsc[key] || 0;
        const p = prevDsc[key] || 0;
        if (t > p) increases.push(`${label} (${t})`);
        else if (t < p) decreases.push(`${label} (${t})`);
      }
      let reason = "";
      if (todayPct > prevPct) {
        if (decreases.length) reason = ` This is because ${decreases.join(", ")} decreased since yesterday.`;
      } else if (todayPct < prevPct) {
        if (increases.length) reason = ` This is because ${increases.join(", ")} increased since yesterday.`;
      }
      if (todayPct > prevPct) items.push({ type: "INFO", highlight: true, msg: `GOOD JOB! Percent ready improved from ${Number(prevPct).toFixed(1)}% yesterday to ${Number(todayPct).toFixed(1)}% today (+${absDiff}%).${reason}` });
      else if (todayPct < prevPct) items.push({ type: "INFO", msg: `Percent ready slipped from ${Number(prevPct).toFixed(1)}% yesterday to ${Number(todayPct).toFixed(1)}% today (-${absDiff}%).${reason}` });
      else items.push({ type: "INFO", msg: `Percent ready is stable at ${Number(todayPct).toFixed(1)}% (same as yesterday).` });
    }
    // Adjusted ready trend
    const adjToday = readiness?.pct_ready_adjusted;
    const adjPrev = readiness?.prev_pct_ready_adjusted;
    if (adjToday != null && adjPrev != null) {
      const adjDiff = (adjToday - adjPrev).toFixed(1);
      const adjAbsDiff = Math.abs(adjDiff);
      // Explain adjusted change in plain language
      const adjExplain = adjToday > adjPrev
        ? "This improvement reflects fewer unresolved issues that are our responsibility, after accounting for devices where subscribers have already been notified."
        : "This decline may be due to new issues appearing or previously notified devices not yet being resolved by subscribers.";
      if (adjToday > adjPrev) items.push({ type: "INFO", highlight: true, msg: `Adjusted percent ready improved from ${Number(adjPrev).toFixed(1)}% yesterday to ${Number(adjToday).toFixed(1)}% today (+${adjAbsDiff}%). ${adjExplain}` });
      else if (adjToday < adjPrev) items.push({ type: "INFO", msg: `Adjusted percent ready slipped from ${Number(adjPrev).toFixed(1)}% yesterday to ${Number(adjToday).toFixed(1)}% today (-${adjAbsDiff}%). ${adjExplain}` });
      else items.push({ type: "INFO", msg: `Adjusted percent ready is stable at ${Number(adjToday).toFixed(1)}% (same as yesterday).` });
    }
    items.push({ type: "SYS", msg: `SUBSCRIBER NOTIFICATIONS: ${notifToday} email${notifToday !== 1 ? "s" : ""} sent today.` });
    if (diEvents && diEvents.length > 0) {
      diEvents.forEach((ev) => items.push({ type: ev.type || "INFO", msg: ev.msg }));
    }
    if (diPerms.camera_battery === "overview") {
      items.push({ type: "SYS", msg: `POTENTIAL CAMERA BATTERY ISSUES: Less than 25%: ${bd.p0_24 || 0}, Between 25% and 50%: ${bd.p25_49 || 0}` });
    } else if (diPerms.camera_battery === "details") {
      if (bd.p0_24 > 0) items.push({ type: "ACT", msg: `CAMERA BATTERY P0-P24: ${bd.p0_24} devices at critical battery level.` });
      if (bd.p25_49 > 0) items.push({ type: "WARN", msg: `CAMERA BATTERY P25-P49: ${bd.p25_49} devices at low battery level.` });
    }
    if (diPerms.camera_cellular === "overview") {
      const cc = bpData?.totals?.camera_cellular || cd;
      items.push({ type: "SYS", msg: `POTENTIAL CAMERA CELLULAR ISSUES: Low Signal: ${cc.LOW || 0}, Poor Signal: ${cc.BAD || 0}` });
    } else if (diPerms.camera_cellular === "details") {
      const cc = bpData?.totals?.camera_cellular || cd;
      if ((cc.BAD || 0) > 0) items.push({ type: "ACT", msg: `CAMERA CELLULAR BAD: ${cc.BAD} devices with no signal.` });
      if ((cc.LOW || 0) > 0) items.push({ type: "WARN", msg: `CAMERA CELLULAR LOW: ${cc.LOW} devices with weak signal.` });
    }
    if (bpData?.devices) {
      const expired = bpData.devices.filter(d => d.detailed_status === "EXPIRED B/P");
      const expiring = bpData.devices.filter(d => d.detailed_status !== "EXPIRED B/P");
      if (diPerms.expired_bp === "overview") { const c = bpData?.totals?.expired_bp || expired.length; if (c > 0) items.push({ type: "ACT", msg: `EXPIRED B/P OVERVIEW: ${c} devices with expired batteries/pads.` }); }
      else if (diPerms.expired_bp === "details") { expired.forEach(d => items.push({ type: "ACT", msg: `${d.subscriber} - ${d.sentinel_id} - ${d.days_summary}` })); }
      if (diPerms.expiring_bp === "overview") { const c = bpData?.totals?.expiring_batt_pads || expiring.length; if (c > 0) items.push({ type: "WARN", msg: `EXPIRING B/P OVERVIEW: ${c} devices with expiring batteries/pads.` }); }
      else if (diPerms.expiring_bp === "details") { expiring.forEach(d => items.push({ type: "WARN", msg: `${d.subscriber} - ${d.sentinel_id} - ${d.days_summary}` })); }
    }
    // Expired B/P trend
    const prevDsc = totals.prev_detailed_status_counts || {};
    const todayDsc = totals.detailed_status_counts || {};
    const expToday = todayDsc.expired_bp || 0;
    const expPrev = prevDsc.expired_bp;
    if (expPrev != null) {
      const expDiff = expToday - expPrev;
      if (expDiff > 0) items.push({ type: "INFO", msg: `Expired B/P has increased from ${expPrev} yesterday to ${expToday} today (+${expDiff}).` });
      else if (expDiff < 0) items.push({ type: "INFO", msg: `Expired B/P has decreased from ${expPrev} yesterday to ${expToday} today (${expDiff}).` });
      else items.push({ type: "INFO", msg: `Expired B/P is static at ${expToday} (same as yesterday).` });
    }
    // Expiring B/P trend
    const expgToday = todayDsc.expiring_batt_pads || 0;
    const expgPrev = prevDsc.expiring_batt_pads;
    if (expgPrev != null) {
      const expgDiff = expgToday - expgPrev;
      if (expgDiff > 0) items.push({ type: "INFO", msg: `Expiring B/P has increased from ${expgPrev} yesterday to ${expgToday} today (+${expgDiff}).` });
      else if (expgDiff < 0) items.push({ type: "INFO", msg: `Expiring B/P has decreased from ${expgPrev} yesterday to ${expgToday} today (${expgDiff}).` });
      else items.push({ type: "INFO", msg: `Expiring B/P is static at ${expgToday} (same as yesterday).` });
    }
    return items.length > 0 ? items : [{ type: "SYS", msg: "No device alerts at this time." }];
  })();
  const isLoadingDi = !liveStats && !bpData;
  const diList = isLoadingDi ? aiRecs.map((r, i) => ({ ...r, _key: `a-${i}` })) : [...aiRecs.map((r, i) => ({ ...r, _key: `a-${i}` })), { type: "_DIVIDER", msg: "Latest Decision Intelligence Messages", _key: "div" }, ...aiRecs.map((r, i) => ({ ...r, _key: `b-${i}` }))];
  const scrollDur = Math.max(60, diList.length * 3);
  const typeColor = (t) => t === "ACT" ? "text-red-400" : t === "WARN" ? "text-yellow-400" : t === "INFO" ? "text-green-400" : t === "ERR" ? "text-red-500" : "text-cyan-400/80";

  const formatTime = (d) => d.toTimeString().slice(0, 8);
  const formatDate = (d) => { const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"]; const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]; return `${days[d.getDay()]}  ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

  // Notified AED summary
  const dsc = totals.detailed_status_counts || {};
  const actionIssues = (dsc.expired_bp || 0) + (dsc.expiring_batt_pads || 0) + (dsc.not_ready || 0) + (dsc.reposition || 0) + (dsc.not_present || 0) + (dsc.unknown || 0);

  // Ticket status rows
  const tc = ticketCounts || {};
  const ticketRows = [
    { label: "Needs Attention", count: tc.needs_attention ?? stats.alerts, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
    { label: "Open", count: tc.open ?? 0, color: "text-green-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Dispatched", count: tc.dispatched ?? 0, color: "text-green-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Dispatch Acknowledged", count: tc.dispatch_acknowledged ?? 0, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "En Route", count: tc.en_route ?? 0, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { label: "On Site", count: tc.on_site ?? 0, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Completed", count: tc.completed ?? 0, color: "text-cyan-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Confirmed", count: tc.confirmed ?? 0, color: "text-cyan-400", bg: "bg-slate-800/50 border-slate-700/30" },
  ];

  return (
    <div className="jarvis-dash min-h-screen text-cyan-400 font-mono text-[11px] relative" data-testid="stark-dashboard">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none z-0" />

      <div className="grid grid-cols-[210px_1fr_220px] grid-rows-[auto_1fr] gap-[7px] p-[10px] relative z-10 min-h-screen">
        {/* TOP BAR */}
        <div className="col-span-3 flex items-center justify-between px-[18px] py-[7px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)]" style={{ clipPath: "polygon(0 0, 100% 0, 98.5% 100%, 1.5% 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500 animate-logo-pulse">CARDIAC SOLUTIONS</div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">COMMAND CENTER</div>
            </div>
          </div>
          <div className="flex items-center gap-[16px]">
            {(() => { const c = getLedColor(serviceCategories, "external"); const s = LED_STYLES[c]; return (
              <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80" onClick={() => navigate("/outage")}>
                <span className="w-[10px] h-[10px] rounded-full animate-led-flash" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
                <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">EXTERNAL SERVICES</span>
              </div>
            ); })()}
            {(() => { const c = getLedColor(serviceCategories, "internal"); const s = LED_STYLES[c]; return (
              <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80" onClick={() => navigate("/outage")}>
                <span className="w-[10px] h-[10px] rounded-full animate-led-flash-alt" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
                <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">INTERNAL SYSTEMS</span>
              </div>
            ); })()}
          </div>
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            <span>{stats.total.toLocaleString()} AEDs</span><span>|</span>
            <span className="flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-yellow-400 animate-blink-fast" />{stats.alerts} ALERTS</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-[2px]">
              <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
              <div className="font-orbitron text-[10px] tracking-[0.12em] text-cyan-500/65">{formatDate(currentTime)}</div>
            </div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* System Status with Gauge */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors" onClick={() => setShowReadinessBreakdown(true)} data-testid="stark-system-status">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex items-center justify-center gap-2 mt-1 mb-1">
              <span className="inline-block w-[6px] h-[6px] rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)] animate-pulse" />
              <span className="font-orbitron text-[8px] font-bold tracking-[0.2em] text-green-400">STATUS: ONLINE</span>
            </div>
            {/* Gauge */}
            <div className="flex flex-col items-center py-[8px]">
              {!liveStats && statusError ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <span className="font-orbitron text-[8px] text-yellow-400/80 tracking-wider text-center">{statusError}</span>
                  <button onClick={fetchStats} className="font-orbitron text-[7px] px-3 py-1 border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> RETRY</button>
                </div>
              ) : !liveStats ? (
                <div className="flex flex-col items-center gap-2 py-4"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              ) : (
                <>
                  <svg width="160" height="90" viewBox="0 0 160 90" className="mb-1">
                    {/* Background arc: red -> yellow -> green */}
                    <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    <path d="M35 35 A65 65 0 0 1 80 18" fill="none" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    <path d="M80 18 A65 65 0 0 1 145 80" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    {/* Actual needle (thinner, dimmer) */}
                    <line x1="80" y1="80" x2="80" y2="30" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" opacity="0.6"
                      transform={`rotate(${gaugeAngleActual}, 80, 80)`} />
                    {/* Adjusted needle (thicker, bright green) */}
                    <line x1="80" y1="80" x2="80" y2="25" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"
                      transform={`rotate(${gaugeAngleAdjusted}, 80, 80)`} />
                    <circle cx="80" cy="80" r="5" fill="#22c55e" />
                    <circle cx="80" cy="80" r="2.5" fill="white" />
                  </svg>
                  {/* Adjusted (prominent) */}
                  <div className="font-orbitron text-[28px] font-black text-green-400" style={{ textShadow: "0 0 18px rgba(57,255,20,0.5)" }}>{pctAdjusted}%</div>
                  <div className="font-orbitron text-[7px] font-bold text-green-400 tracking-[0.2em]">ADJUSTED READY</div>
                  {/* Actual (smaller, subdued) */}
                  <div className="font-orbitron text-[13px] font-bold text-slate-400 mt-1">{pctActual}%</div>
                  <div className="font-orbitron text-[7px] text-slate-500 tracking-[0.2em]">ACTUAL READY</div>
                  {(() => {
                    const pts = readinessHistory?.points || [];
                    const adjSeries = pts.map(p => p.pct_ready_adjusted).filter(v => v != null);
                    const actSeries = pts.map(p => p.pct_ready).filter(v => v != null);
                    const renderSpark = (series, label, dataTestId) => {
                      const w = 130;
                      const h = 28;
                      const pad = 3;
                      if (!series || series.length === 0) return null;
                      if (series.length === 1) {
                        const v = series[0];
                        return (
                          <div className="flex flex-col items-center mt-1" data-testid={dataTestId}>
                            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
                              <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#38bdf8" strokeDasharray="2 3" strokeWidth="1" opacity="0.4" />
                              <circle cx={w - pad} cy={h / 2} r="2.5" fill="#38bdf8" />
                            </svg>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-0.5">{label} <span className="text-sky-400">{v.toFixed(1)}%</span></div>
                          </div>
                        );
                      }
                      const lo = Math.min(...series);
                      const hi = Math.max(...series);
                      const range = Math.max(0.5, hi - lo);
                      const step = (w - pad * 2) / (series.length - 1);
                      const sPts = series.map((v, i) => {
                        const x = pad + i * step;
                        const y = pad + (1 - (v - lo) / range) * (h - pad * 2);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(" ");
                      const areaPts = `${pad},${h - pad} ${sPts} ${(w - pad).toFixed(1)},${h - pad}`;
                      const net = series[series.length - 1] - series[0];
                      const color = Math.abs(net) < 0.05 ? "#38bdf8" : net > 0 ? "#34d399" : "#f87171";
                      const tooltip = `${series.length}-day: ${series[0].toFixed(1)}% → ${series[series.length - 1].toFixed(1)}% (Δ ${net >= 0 ? "+" : ""}${net.toFixed(1)})`;
                      return (
                        <div className="flex flex-col items-center mt-1" data-testid={dataTestId}>
                          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
                            <title>{tooltip}</title>
                            <polygon points={areaPts} fill={color} opacity="0.14" />
                            <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" points={sPts} />
                            {series.map((v, i) => {
                              const x = pad + i * step;
                              const y = pad + (1 - (v - lo) / range) * (h - pad * 2);
                              const last = i === series.length - 1;
                              return <circle key={i} cx={x} cy={y} r={last ? 2 : 1.2} fill={color} opacity={last ? 1 : 0.55} />;
                            })}
                          </svg>
                          <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-0.5">
                            {label} <span style={{ color }}>{net >= 0 ? "+" : ""}{net.toFixed(1)}</span>
                          </div>
                        </div>
                      );
                    };
                    if (adjSeries.length === 0 && actSeries.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowTrendModal(true); }}
                        className="flex items-start justify-center gap-3 mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                        title="Click to expand 30-day readiness trend"
                        data-testid="stark-trend-expand"
                      >
                        {renderSpark(actSeries, "ACTUAL", "stark-spark-actual")}
                        {renderSpark(adjSeries, "ADJUSTED", "stark-spark-adjusted")}
                      </button>
                    );
                  })()}
                  <div className="font-orbitron text-[9px] text-cyan-400/70 tracking-wider mt-2">{stats.total.toLocaleString()} TOTAL AEDs</div>
                  {lastUpdated && <div className="font-orbitron text-[8px] text-cyan-500/50 tracking-wider mt-1">Last Updated: {lastUpdated}</div>}
                </>
              )}
            </div>
          </div>

          {/* Subscriber Notifications */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="stark-notifications">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Subscriber Notifications</div>
            <div className="grid grid-cols-2 gap-[6px] mt-2">
              <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-white">{supportData?.total_subscribers || 0}</div>
                <div className="text-[7px] text-cyan-500/50 tracking-wider uppercase">Subscribers w/ Issues</div>
              </div>
              <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-white">{readiness?.total_issues || 0}</div>
                <div className="text-[7px] text-cyan-500/50 tracking-wider uppercase">Total Issues</div>
              </div>
              <div className="border border-green-500/20 bg-green-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-green-400">{readiness?.notified_aed_unresolved || 0}</div>
                <div className="text-[7px] text-green-500/50 tracking-wider uppercase">Notified Pending</div>
              </div>
              <div className="border border-amber-500/20 bg-amber-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-amber-400">{notifToday}</div>
                <div className="text-[7px] text-amber-500/50 tracking-wider uppercase">Emails Sent Today</div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* MAP */}
          <div
            className={`panel relative bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden ${mapFullscreen ? "" : "flex-1"}`}
            style={mapFullscreen ? { position: "fixed", inset: 0, zIndex: 9999, width: "100vw", height: "100vh" } : undefined}
            data-testid="stark-map-card">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="absolute top-2 left-3 z-20 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-orbitron text-[9px] text-cyan-400 tracking-wider">{mapMode === "subscribers" ? "SUBSCRIBER MAP" : "AED MAP"}</span>
              <span className="font-orbitron text-[7px] text-slate-500">{mapMode === "subscribers" ? "AED READINESS MONITORING" : `${aedPins.length} DEVICES`}</span>
            </div>

            {/* Prominent view selector - second row so it's clearly visible */}
            <div className="absolute top-[26px] left-3 z-20 flex items-center gap-2 bg-[rgba(0,18,32,0.94)] border border-cyan-500/50 rounded-sm px-2 py-[5px] shadow-lg shadow-cyan-500/20">
              <span className="font-orbitron text-[8px] text-cyan-500/80 tracking-[0.2em] uppercase">View:</span>
              <div className="inline-flex border border-cyan-500/50 rounded-sm overflow-hidden">
                <button data-testid="stark-map-mode-subscribers"
                  onClick={() => { setMapMode("subscribers"); setSelectedId(null); setHoveredId(null); }}
                  className={`font-orbitron text-[10px] font-bold tracking-wider px-3 py-[5px] transition-colors ${mapMode === "subscribers" ? "bg-cyan-500/35 text-cyan-50 shadow-[inset_0_0_8px_rgba(6,182,212,0.5)]" : "text-cyan-400/80 hover:bg-cyan-500/15"}`}>SUBSCRIBERS</button>
                <button data-testid="stark-map-mode-aeds"
                  onClick={() => { setMapMode("aeds"); setSelectedId(null); setHoveredId(null); }}
                  className={`font-orbitron text-[10px] font-bold tracking-wider px-3 py-[5px] border-l border-cyan-500/50 transition-colors ${mapMode === "aeds" ? "bg-cyan-500/35 text-cyan-50 shadow-[inset_0_0_8px_rgba(6,182,212,0.5)]" : "text-cyan-400/80 hover:bg-cyan-500/15"}`}>AEDS</button>
              </div>
              {mapMode === "aeds" && (
                <>
                  <span className="font-orbitron text-[8px] text-cyan-500/80 tracking-[0.2em] uppercase ml-1">Filter:</span>
                  <select data-testid="stark-map-aed-subscriber"
                    value={aedSubscriber}
                    onChange={(e) => setAedSubscriber(e.target.value)}
                    className="font-orbitron text-[10px] font-bold tracking-wider px-2 py-[4px] bg-[rgba(0,18,32,0.95)] border border-cyan-500/50 text-cyan-100 rounded-sm focus:outline-none cursor-pointer hover:bg-cyan-500/10">
                    <option value="all">ALL SUBSCRIBERS</option>
                    {aedSubscribersList.map(s => (
                      <option key={s.subscriber} value={s.subscriber}>{s.subscriber.toUpperCase()} ({s.aed_count})</option>
                    ))}
                  </select>
                </>
              )}
              {/* Base map style toggle */}
              <span className="font-orbitron text-[8px] text-cyan-500/80 tracking-[0.2em] uppercase ml-1">Style:</span>
              <div className="inline-flex border border-cyan-500/50 rounded-sm overflow-hidden">
                <button data-testid="stark-map-style-dark"
                  onClick={() => setMapType("dark")}
                  className={`font-orbitron text-[10px] font-bold tracking-wider px-3 py-[5px] transition-colors ${mapType === "dark" ? "bg-cyan-500/35 text-cyan-50 shadow-[inset_0_0_8px_rgba(6,182,212,0.5)]" : "text-cyan-400/80 hover:bg-cyan-500/15"}`}>MAP</button>
                <button data-testid="stark-map-style-satellite"
                  onClick={() => setMapType("satellite")}
                  className={`font-orbitron text-[10px] font-bold tracking-wider px-3 py-[5px] border-l border-cyan-500/50 transition-colors ${mapType === "satellite" ? "bg-cyan-500/35 text-cyan-50 shadow-[inset_0_0_8px_rgba(6,182,212,0.5)]" : "text-cyan-400/80 hover:bg-cyan-500/15"}`}>SATELLITE</button>
              </div>
            </div>
            <button onClick={fitAll} className="absolute top-2 right-[110px] z-20 font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1" data-testid="stark-fit-all">
              <Maximize2 className="w-3 h-3" /> FIT ALL
            </button>
            <button onClick={() => setMapFullscreen(v => !v)}
              className="absolute top-2 right-3 z-20 font-orbitron text-[7px] px-2 py-1 border border-cyan-500/40 text-cyan-300 rounded-sm hover:bg-cyan-500/15 flex items-center gap-1"
              data-testid="stark-map-fullscreen-toggle"
              title={mapFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}>
              {mapFullscreen ? (<><Minimize2 className="w-3 h-3" /> EXIT FULLSCREEN</>) : (<><Maximize2 className="w-3 h-3" /> FULLSCREEN</>)}
            </button>
            {mapLoading || !isLoaded ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
            ) : (
              <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={mapCenter} zoom={7} options={mapType === "satellite" ? satelliteMapOptions : mapOptions} mapTypeId={mapType === "satellite" ? "hybrid" : "roadmap"} onLoad={(m) => { mapRef.current = m; setTimeout(() => fitAll(), 500); }} onClick={() => { setSelectedId(null); setHoveredId(null); }}>
                {mapMode === "subscribers" && geoSubs.map((sub, i) => {
                  const lat = parseFloat(sub.geocode_lat); const lng = parseFloat(sub.geocode_lng);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  const counts = sub.status_counts || {}; const total = sub.aed_count || 0;
                  const readyPct = total > 0 ? Math.round(((counts.READY || 0) / total) * 100) : 0;
                  const pinColor = readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <Marker key={`sub-${sub.subscriber}-${i}`} position={{ lat, lng }}
                      icon={{ path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", fillColor: pinColor, fillOpacity: 1, strokeColor: "#0a0f1c", strokeWeight: 2, scale: 2.2, anchor: { x: 12, y: 24 } }}
                      onMouseOver={() => { if (selectedId !== `sub-${i}`) setHoveredId(`sub-${i}`); }} onMouseOut={() => setHoveredId(null)}
                      onClick={() => setSelectedId(prev => prev === `sub-${i}` ? null : `sub-${i}`)}
                    >
                      {hoveredId === `sub-${i}` && selectedId !== `sub-${i}` && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-30 })}>
                          <div style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 3, padding: "8px 14px", fontFamily: "Orbitron, monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1 }}>{sub.display_name || sub.subscriber}</div>
                            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{total} AEDs - {readyPct}% Ready</div>
                          </div>
                        </OverlayView>
                      )}
                      {selectedId === `sub-${i}` && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-36 })}>
                          <div style={{ background: "rgba(6,10,20,0.95)", border: "1px solid rgba(6,182,212,0.5)", borderRadius: 4, padding: "10px 16px", fontFamily: "Orbitron, monospace", minWidth: 200, maxWidth: 280 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1, marginBottom: 6 }}>{sub.display_name || sub.subscriber}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{total} AEDs</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444" }}>{readyPct}% READY</span>
                            </div>
                            {Object.entries(counts).filter(([k, v]) => k !== "READY" && k !== "UNCLASSIFIED" && v > 0).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                              <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                                <span>{status}</span><span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 16 }}>{count}</span>
                              </div>
                            ))}
                            {(counts.READY || 0) > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                                <span>READY</span><span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 16 }}>{counts.READY}</span>
                              </div>
                            )}
                          </div>
                        </OverlayView>
                      )}
                    </Marker>
                  );
                })}
                {mapMode === "aeds" && aedPins.map((aed, i) => {
                  const lat = parseFloat(aed.latitude); const lng = parseFloat(aed.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  const key = `aed-${aed.sentinel_id}-${i}`;
                  const status = (aed.status || "UNKNOWN").toUpperCase();
                  const redStatuses = ["NOT READY", "LOST CONTACT", "EXPIRED B/P", "EXPIRED BATT/PADS"];
                  const dotColor = status === "READY" ? "#22c55e"
                    : redStatuses.includes(status) ? "#ef4444"
                    : "#f59e0b";
                  return (
                    <Marker key={key} position={{ lat, lng }}
                      icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: dotColor, fillOpacity: 0.95, strokeColor: "#0a0f1c", strokeWeight: 1.5, scale: 5 }}
                      onMouseOver={() => { if (selectedId !== key) setHoveredId(key); }} onMouseOut={() => setHoveredId(null)}
                      onClick={() => setSelectedId(prev => prev === key ? null : key)}
                    >
                      {hoveredId === key && selectedId !== key && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-14 })}>
                          <div style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 3, padding: "6px 10px", fontFamily: "Orbitron, monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            <div style={{ fontWeight: 700, fontSize: 11, color: "#06b6d4", letterSpacing: 1 }}>{aed.sentinel_id}</div>
                            <div style={{ fontSize: 10, color: dotColor, marginTop: 2, fontWeight: 700 }}>{status}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{aed.site}{aed.building ? ` - ${aed.building}` : ""}</div>
                          </div>
                        </OverlayView>
                      )}
                      {selectedId === key && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-18 })}>
                          <div style={{ background: "rgba(6,10,20,0.95)", border: "1px solid rgba(6,182,212,0.5)", borderRadius: 4, padding: "10px 14px", fontFamily: "Orbitron, monospace", minWidth: 220, maxWidth: 320 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#06b6d4", letterSpacing: 1, marginBottom: 4 }}>{aed.sentinel_id}</div>
                            <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: dotColor, border: `1px solid ${dotColor}`, padding: "2px 8px", borderRadius: 3, marginBottom: 6, letterSpacing: 1 }}>{status}</div>
                            <div style={{ fontSize: 11, color: "#e2e8f0", marginBottom: 2 }}>{aed.subscriber}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>{aed.site}</div>
                            {aed.building && <div style={{ fontSize: 10, color: "#94a3b8" }}>{aed.building}</div>}
                            {aed.placement_location && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>Placement: {aed.placement_location}</div>}
                            {aed.location_group && <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>{aed.location_group}</div>}
                          </div>
                        </OverlayView>
                      )}
                    </Marker>
                  );
                })}
              </GoogleMap>
            )}
          </div>

          {/* DI Feed */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" style={{ height: 180 }} data-testid="stark-di-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="font-orbitron text-[10px] font-bold tracking-[0.3em] text-red-500 text-center mb-1">AI OVERWATCH</div>
            <div className="absolute top-[6px] right-[8px] z-20">
              <button onClick={() => setDiPaused(!diPaused)} className="w-[24px] h-[24px] flex items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20" data-testid="stark-di-toggle">
                {diPaused ? <Play className="w-3 h-3 text-cyan-400" /> : <Pause className="w-3 h-3 text-cyan-400" />}
              </button>
            </div>
            <div className="overflow-hidden" style={{ height: 140 }}>
              <div className="space-y-[4px]" style={{ animation: diPaused ? "none" : `diScroll ${scrollDur}s linear infinite` }}>
                {diList.map((rec) => rec.type === "_DIVIDER" ? (
                  <div key={rec._key} className="flex items-center gap-2 my-3">
                    <div className="flex-1 border-t border-cyan-500/20" />
                    <span className="font-orbitron text-[7px] text-cyan-500/40 tracking-wider whitespace-nowrap">{rec.msg}</span>
                    <div className="flex-1 border-t border-cyan-500/20" />
                  </div>
                ) : (
                  <div key={rec._key} className={`flex gap-2 items-start py-[3px] ${rec.highlight ? "good-job-row" : ""}`} data-testid={rec.highlight ? "di-highlight" : undefined}>
                    <span className={`font-orbitron text-[8px] font-bold tracking-wider flex-shrink-0 mt-[1px] px-[4px] py-[1px] rounded-sm ${rec.type === "ACT" ? "bg-orange-500/20 text-orange-400" : rec.type === "WARN" ? "bg-yellow-500/20 text-yellow-400" : rec.type === "INFO" ? "bg-green-500/20 text-green-400" : "bg-cyan-500/20 text-cyan-400"}`}>{rec.type}</span>
                    <span className="text-[11px] text-slate-200/90 leading-tight font-mono">{rec.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* Service Tickets */}
          <div onClick={() => navigate("/service-tickets")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors" data-testid="stark-service-tickets">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="flex flex-col gap-[4px] mt-2">
              {ticketRows.map((row, i) => (
                <div key={i} className={`flex items-center justify-between px-[10px] py-[8px] border rounded-sm ${row.bg}`}>
                  <span className="text-[11px] text-slate-200/90">{row.label}</span>
                  <span className={`font-orbitron text-[14px] font-black ${row.color}`}>{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Query */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="stark-voice-query">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Voice Query</div>
            <div className="flex items-center justify-center gap-[10px] py-[8px]">
              <div className="flex items-end gap-[2px] h-[18px]" data-testid="stark-voice-meter">
                {[0,1,2,3,4,5,6,7,8,9].map((i) => {
                  // Each bar lights progressively as mic level climbs 0-100
                  const activeThreshold = (i + 1) * 10; // 10, 20, 30, …, 100
                  const active = micLevel >= activeThreshold;
                  const color = !isListening ? "bg-cyan-500/30"
                    : active ? (micLevel > 40 ? "bg-green-400" : "bg-yellow-400")
                    : "bg-cyan-500/20";
                  return (
                    <div
                      key={i}
                      className={`w-[3px] rounded-sm transition-colors duration-75 ${color}`}
                      style={{ height: 4 + i * 1.5 }}
                    />
                  );
                })}
              </div>
              <button onClick={startAeda} data-testid="stark-voice-mic-btn" title={isListening ? "End AEDA session" : "Start AEDA voice session"} className={`w-[36px] h-[36px] rounded-full border flex items-center justify-center transition-all ${
                micLevel > 20 ? "border-green-400 bg-green-500/10 shadow-[0_0_16px_rgba(74,222,128,0.55)]" :
                isListening ? "border-red-500 bg-red-500/10 animate-mic-pulse" :
                "border-cyan-500/50 bg-[rgba(0,40,70,0.8)] hover:border-cyan-400 hover:shadow-[0_0_16px_rgba(0,212,255,0.35)]"
              }`}>
                <Mic className={`w-[14px] h-[14px] ${micLevel > 20 ? "text-green-400" : isListening ? "text-red-500" : "text-cyan-400"}`} />
              </button>
              <div className={`font-orbitron text-[7px] font-bold tracking-[0.18em] ${
                micLevel > 20 ? "text-green-400 animate-blink" :
                isListening ? "text-red-500 animate-blink" :
                "text-cyan-500/60"
              }`} data-testid="stark-voice-status">
                {micLevel > 20 ? "HEARING YOU" : isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "READY"}
              </div>
            </div>
            {isListening ? (
              <div className="px-[10px] pb-[4px] flex items-center gap-[6px]">
                <div className="text-[8px] text-cyan-500/70 font-mono tracking-wider">MIC</div>
                <div className="flex-1 h-[3px] bg-cyan-900/40 rounded overflow-hidden">
                  <div className={`h-full transition-all duration-75 ${micLevel > 40 ? "bg-green-400" : micLevel > 10 ? "bg-yellow-400" : "bg-cyan-500/40"}`} style={{ width: `${micLevel}%` }} />
                </div>
                <div className="text-[8px] text-cyan-300/80 font-mono w-[24px] text-right">{micLevel}</div>
              </div>
            ) : null}
            {lastHeardText ? (
              <div className="px-[10px] pb-[4px] text-[9px] text-green-300/80 font-mono truncate" title={lastHeardText} data-testid="stark-voice-heard">
                &ldquo;{lastHeardText}&rdquo;
              </div>
            ) : null}
            {voiceError ? (
              <div className="px-[10px] pb-[6px] text-[9px] text-red-400 font-mono break-words" data-testid="stark-voice-error" title={voiceError}>
                {voiceError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes diScroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        @keyframes led-flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-led-flash { animation: led-flash 1.4s ease-in-out infinite; }
        .animate-led-flash-alt { animation: led-flash 1.4s ease-in-out infinite 0.7s; }
      `}</style>

      {showReadinessBreakdown && <ReadinessBreakdownModal onClose={() => setShowReadinessBreakdown(false)} onDataLoaded={(r) => setReadiness(r)} />}
      {showTrendModal && <ReadinessTrendModal token={token} onClose={() => setShowTrendModal(false)} />}
    </div>
  );
}

function ReadinessTrendModal({ token, onClose }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [hover, setHover] = useState(null); // index of hovered point
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/support/readiness-history?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && !cancelled) setData(await res.json());
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [days, token]);

  const points = data?.points || [];
  const W = 1100;
  const H = 360;
  const padL = 50, padR = 20, padT = 30, padB = 60;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allVals = points.flatMap(p => [p.pct_ready, p.pct_ready_adjusted]).filter(v => v != null);
  const lo = allVals.length ? Math.floor(Math.min(...allVals) - 2) : 0;
  const hi = allVals.length ? Math.ceil(Math.max(...allVals) + 2) : 100;
  const range = Math.max(1, hi - lo);
  const xAt = (i) => points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW;
  const yAt = (v) => padT + (1 - (v - lo) / range) * innerH;

  const buildLine = (key) => points.map((p, i) => p[key] != null ? `${xAt(i)},${yAt(p[key])}` : null).filter(Boolean).join(" ");
  const adjLine = buildLine("pct_ready_adjusted");
  const actLine = buildLine("pct_ready");

  const yTicks = [];
  for (let i = 0; i <= 4; i++) yTicks.push(lo + (range * i) / 4);

  const fmtDate = (s) => {
    if (!s) return "";
    const [, m, d] = s.split("-");
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };
  const xTickEvery = points.length <= 14 ? 1 : points.length <= 30 ? 3 : 5;

  const hoverPt = hover != null && points[hover] ? points[hover] : null;
  const netAdj = points.length >= 2 && points[0].pct_ready_adjusted != null && points[points.length - 1].pct_ready_adjusted != null
    ? points[points.length - 1].pct_ready_adjusted - points[0].pct_ready_adjusted : null;
  const netAct = points.length >= 2 && points[0].pct_ready != null && points[points.length - 1].pct_ready != null
    ? points[points.length - 1].pct_ready - points[0].pct_ready : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-[1240px] max-h-[94vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="trend-modal">
        <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-orbitron text-sm tracking-wider text-cyan-400">READINESS TREND — {days} DAYS</div>
              <div className="font-orbitron text-[8px] text-slate-500 tracking-wider">ADJUSTED vs ACTUAL · daily snapshots · hover any day for details</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 60].map(n => (
              <button
                key={n}
                onClick={() => setDays(n)}
                className={`font-orbitron text-[9px] px-2 py-1 rounded-sm border ${days === n ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}
                data-testid={`trend-days-${n}`}
              >
                {n}D
              </button>
            ))}
            <button onClick={onClose} className="text-slate-500 hover:text-white ml-2"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="border-b border-slate-800/60 px-5 py-3 grid grid-cols-4 gap-3 bg-slate-950/40">
          <div className="text-center">
            <div className="font-orbitron text-2xl font-black text-emerald-400">{points.length ? `${(points[points.length - 1].pct_ready_adjusted ?? 0).toFixed(1)}%` : "—"}</div>
            <div className="font-orbitron text-[8px] tracking-wider text-slate-500 uppercase mt-0.5">CURRENT ADJUSTED</div>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-2xl font-black text-slate-300">{points.length ? `${(points[points.length - 1].pct_ready ?? 0).toFixed(1)}%` : "—"}</div>
            <div className="font-orbitron text-[8px] tracking-wider text-slate-500 uppercase mt-0.5">CURRENT ACTUAL</div>
          </div>
          <div className="text-center">
            <div className={`font-orbitron text-2xl font-black ${netAdj == null ? "text-slate-600" : Math.abs(netAdj) < 0.05 ? "text-sky-400" : netAdj > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {netAdj == null ? "—" : `${netAdj >= 0 ? "+" : ""}${netAdj.toFixed(1)}`}
            </div>
            <div className="font-orbitron text-[8px] tracking-wider text-slate-500 uppercase mt-0.5">{days}-DAY ADJ Δ</div>
          </div>
          <div className="text-center">
            <div className={`font-orbitron text-2xl font-black ${netAct == null ? "text-slate-600" : Math.abs(netAct) < 0.05 ? "text-sky-400" : netAct > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {netAct == null ? "—" : `${netAct >= 0 ? "+" : ""}${netAct.toFixed(1)}`}
            </div>
            <div className="font-orbitron text-[8px] tracking-wider text-slate-500 uppercase mt-0.5">{days}-DAY ACT Δ</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : points.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-orbitron text-[11px]">NO DATA YET FOR THE SELECTED WINDOW</div>
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "440px" }} onMouseLeave={() => setHover(null)}>
                {yTicks.map((tv, i) => (
                  <g key={i}>
                    <line x1={padL} y1={yAt(tv)} x2={W - padR} y2={yAt(tv)} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 4" />
                    <text x={padL - 8} y={yAt(tv) + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="Orbitron, monospace">{tv.toFixed(0)}%</text>
                  </g>
                ))}
                {points.map((p, i) => i % xTickEvery === 0 ? (
                  <g key={i}>
                    <line x1={xAt(i)} y1={padT + innerH} x2={xAt(i)} y2={padT + innerH + 4} stroke="#475569" strokeWidth="0.5" />
                    <text x={xAt(i)} y={padT + innerH + 16} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Orbitron, monospace">{fmtDate(p.date)}</text>
                  </g>
                ) : null)}
                {actLine && <polyline fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" points={actLine} />}
                {adjLine && <polyline fill="none" stroke="#22c55e" strokeWidth="2.2" points={adjLine} />}
                {points.map((p, i) => (
                  <g key={i}>
                    {p.pct_ready != null && <circle cx={xAt(i)} cy={yAt(p.pct_ready)} r="2" fill="#94a3b8" />}
                    {p.pct_ready_adjusted != null && <circle cx={xAt(i)} cy={yAt(p.pct_ready_adjusted)} r="2.5" fill="#22c55e" />}
                    <rect x={xAt(i) - innerW / points.length / 2} y={padT} width={Math.max(8, innerW / points.length)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: "crosshair" }} />
                  </g>
                ))}
                {hover != null && points[hover] && (
                  <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + innerH} stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
                )}
                {/* Legend */}
                <g transform={`translate(${padL + 6}, ${padT + 6})`}>
                  <rect width="180" height="38" fill="#020617" stroke="#1e293b" strokeWidth="0.5" rx="2" opacity="0.92" />
                  <line x1="10" y1="14" x2="30" y2="14" stroke="#22c55e" strokeWidth="2.2" />
                  <text x="36" y="17" fill="#22c55e" fontSize="10" fontFamily="Orbitron, monospace">ADJUSTED %</text>
                  <line x1="10" y1="28" x2="30" y2="28" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                  <text x="36" y="31" fill="#94a3b8" fontSize="10" fontFamily="Orbitron, monospace">ACTUAL %</text>
                </g>
              </svg>

              {/* Hover panel */}
              <div className="mt-3 grid grid-cols-5 gap-3 text-center">
                {hoverPt ? (
                  <>
                    <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-sm p-2">
                      <div className="font-orbitron text-[9px] text-cyan-400">{fmtDate(hoverPt.date)} · {hoverPt.date.slice(0, 4)}</div>
                      <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-1">SELECTED DAY</div>
                    </div>
                    <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-sm p-2">
                      <div className="font-orbitron text-base font-bold text-emerald-400">{hoverPt.pct_ready_adjusted != null ? `${hoverPt.pct_ready_adjusted.toFixed(1)}%` : "—"}</div>
                      <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-1">ADJUSTED</div>
                    </div>
                    <div className="border border-slate-500/30 bg-slate-500/5 rounded-sm p-2">
                      <div className="font-orbitron text-base font-bold text-slate-300">{hoverPt.pct_ready != null ? `${hoverPt.pct_ready.toFixed(1)}%` : "—"}</div>
                      <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-1">ACTUAL</div>
                    </div>
                    <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-sm p-2">
                      <div className="font-orbitron text-base font-bold text-cyan-400">{hoverPt.notified_count || 0}</div>
                      <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-1">AEDs NOTIFIED</div>
                    </div>
                    <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-sm p-2">
                      <div className="font-orbitron text-base font-bold text-emerald-400">{hoverPt.resolved_count || 0}</div>
                      <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mt-1">AEDs RESOLVED</div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-5 text-center font-orbitron text-[10px] text-slate-500 tracking-wider py-3">HOVER ANY DAY ON THE CHART TO SEE DETAILS</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
