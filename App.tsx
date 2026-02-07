import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Upload, 
  Globe, 
  AlertTriangle, 
  FileText, 
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2,
  Package,
  ArrowLeft,
  XCircle,
  RefreshCw,
  History as HistoryIcon,
  Trash2,
  Clock,
  Mic,
  BarChart3,
  FileSearch,
  MapPin,
  Lock,
  ArrowRight,
  Stamp,
  FileCheck2,
  DollarSign,
  Compass,
  Cpu,
  BrainCircuit,
  Verified,
  Zap,
  UserCheck,
  Headphones,
  Sparkles,
  Link2,
  Quote,
  ChevronDown,
  Check,
  Image as ImageIcon,
  Maximize2,
  Info,
  Share2,
  TrendingUp,
  Activity,
  FileWarning,
  LibraryBig,
  Scale,
  Gavel,
  ShieldAlert,
  Flame,
  Globe2,
  Newspaper,
  Rss,
  Radio,
  Calculator,
  Wallet,
  Truck,
  Percent,
  MessageSquare,
  User,
  ZapOff,
  ShieldHalf
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { analyzeProductCompliance } from './services/geminiService';
import { AnalysisState, ComplianceData, HistoryItem } from './types';
import RiskMeter from './components/RiskMeter';
import LabelGenerator from './components/LabelGenerator';

// Dialogue Log Entry Type
interface LogEntry {
  id: string;
  role: 'user' | 'advisor';
  text: string;
}

// Audio En/Decoding Utils
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. 'Swaziland')", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Holy See", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe",
  "European Union (EU)", "ASEAN Region", "BRICS Nations", "Mercosur"
].sort();

const HISTORY_KEY = 'global_compliance_history_v3';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function App() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
  const [selectedCountry, setSelectedCountry] = useState("Germany");
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  
  // Live Agent States
  const [isLiveAgentActive, setIsLiveAgentActive] = useState(false);
  const [dialogueLog, setDialogueLog] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [watchdogAlert, setWatchdogAlert] = useState<string | null>(null);
  const [isWatchdogLoading, setIsWatchdogLoading] = useState(false);
  const [tensionReport, setTensionReport] = useState<string | null>(null);
  const [tensionSources, setTensionSources] = useState<{title: string, uri: string}[]>([]);
  const [isTensionLoading, setIsTensionLoading] = useState(false);
  
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    data: null
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [progressStep, setProgressStep] = useState(0);

  // Live API Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  useEffect(() => {
    const storedHistory = localStorage.getItem(HISTORY_KEY);
    if (storedHistory) {
      try { setHistory(JSON.parse(storedHistory)); } catch (e) { console.error(e); }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#report=')) {
        try {
          const encodedData = hash.replace('#report=', '');
          const decodedStr = decodeURIComponent(escape(atob(encodedData)));
          const sharedObj = JSON.parse(decodedStr);
          
          const EXPIRY_DAYS = 7;
          const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
          
          if (Date.now() - sharedObj.timestamp > expiryMs) {
            alert("This shared report link has expired (7-day limit).");
            window.location.hash = '';
            return;
          }

          setAnalysis({
            isLoading: false,
            error: null,
            data: sharedObj.data
          });
          setImage(sharedObj.image || null);
          setActiveTab('analyze');
          window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {
          console.error("Failed to parse shared report:", e);
        }
      }
    };

    handleHash();

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-scroll the dialogue log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [dialogueLog]);

  const saveToHistory = useCallback((newItem: HistoryItem) => {
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startLiveAgent = async () => {
    try {
      setIsLiveAgentActive(true);
      setDialogueLog([{ id: 'init', role: 'advisor', text: 'Initializing secure connection to Global Trade Network...' }]);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setDialogueLog(prev => [...prev, { id: 'ready', role: 'advisor', text: 'Connection established. How can I assist with your compliance strategy today?' }]);
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle User Transcription (Real-time input)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setDialogueLog(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user' && !message.serverContent?.turnComplete) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                }
                return [...prev, { id: Date.now().toString(), role: 'user', text }];
              });
            }

            // Handle Advisor Transcription (Real-time output)
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setDialogueLog(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'advisor' && !message.serverContent?.turnComplete) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                }
                return [...prev, { id: Date.now().toString(), role: 'advisor', text }];
              });
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtxRef.current, 24000, 1);
              const source = outputAudioCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioCtxRef.current.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: stopLiveAgent,
          onclose: () => setIsLiveAgentActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {}, // Added real-time user transcription
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are an elite Global Trade Advisor. Be concise, professional, and authoritative. Provide real-time regulatory guidance. Speak as if you are in a secure boardroom environment.'
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setIsLiveAgentActive(false);
    }
  };

  const stopLiveAgent = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
    if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
    if (sessionRef.current) sessionRef.current.close();
    setIsLiveAgentActive(false);
  };

  const handleWatchdogCheck = async () => {
    if (!analysis.data) return;
    setIsWatchdogLoading(true);
    setWatchdogAlert(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Latest trade updates for ${analysis.data.productName} in ${analysis.data.country} for 2026. Explicitly search for ANY new restrictions, law changes, or added trade barriers that occurred in the last 48 hours. Provide a bulleted list of actual news snippets if available.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      setWatchdogAlert(res.text || "No new changes detected today.");
    } catch (e) {
      setWatchdogAlert("Could not reach real-time news server.");
    } finally {
      setIsWatchdogLoading(false);
    }
  };

  const handleTensionCheck = async () => {
    if (!analysis.data) return;
    setIsTensionLoading(true);
    setTensionReport(null);
    setTensionSources([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      // Using Gemini 3 Pro for deep geopolitical reasoning
      const res = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Search for 2026 geopolitical trade tensions, sanctions, and political friction currently affecting ${analysis.data.productName} and general trade between global hubs and ${analysis.data.country}. Focus on trade wars, supply chain risks, and political instability. Provide a detailed professional intelligence briefing.`,
        config: { 
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });
      setTensionReport(res.text || "No significant geopolitical frictions detected for this specific trade vector.");
      
      const sources = res.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => ({
          title: chunk.web?.title || "Intelligence Source",
          uri: chunk.web?.uri || "#"
        })) || [];
      setTensionSources(sources);
    } catch (e) {
      setTensionReport("Tension monitor offline. Unable to reach global intelligence nodes.");
    } finally {
      setIsTensionLoading(false);
    }
  };

  const validateAndProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalysis(prev => ({ ...prev, error: "Unsupported file type. Please upload an image (JPG, PNG, etc)." }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAnalysis(prev => ({ ...prev, error: "File too large. Maximum size is 5MB." }));
      return;
    }

    setIsProcessingFile(true);
    setAnalysis(prev => ({ ...prev, error: null }));
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      setAnalysis(prev => ({ ...prev, error: "Failed to read file. Please try again." }));
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const runAnalysis = async () => {
    if (!image) return;
    setAnalysis({ isLoading: true, error: null, data: null });
    setTensionReport(null);
    setWatchdogAlert(null);
    setProgressStep(0);
    const timer = setInterval(() => {
      setProgressStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 2000);

    try {
      const result = await analyzeProductCompliance(image, selectedCountry, userQuery);
      setAnalysis({ isLoading: false, error: null, data: result });
      saveToHistory({ id: crypto.randomUUID(), timestamp: Date.now(), image, data: result });
    } catch (err: any) {
      setAnalysis({ isLoading: false, error: err.message, data: null });
    } finally {
      clearInterval(timer);
    }
  };

  const reset = () => {
    setImage(null);
    setUserQuery("");
    setWatchdogAlert(null);
    setTensionReport(null);
    setAnalysis({ isLoading: false, error: null, data: null });
  };

  const filteredCountries = ALL_COUNTRIES.filter(country => 
    country.toLowerCase().includes(countrySearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* ADVISOR CONVERSATION LOG SIDEBAR */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] z-[60] glass-card border-l border-white/10 transition-transform duration-500 ease-in-out shadow-2xl flex flex-col ${isLiveAgentActive ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Headphones className="text-[#E2B859]" size={20} />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Advisor Conversation</h3>
              <p className="text-[10px] text-slate-500 font-medium">Real-time Regulatory Session</p>
            </div>
          </div>
          <button onClick={stopLiveAgent} className="text-slate-500 hover:text-white transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <div ref={logContainerRef} className="flex-1 overflow-y-auto premium-scroll p-6 space-y-6 bg-[#0F1117]/50">
          {dialogueLog.map((entry) => (
            <div key={entry.id} className={`flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${entry.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2">
                {entry.role === 'advisor' && <div className="bg-[#E2B859]/10 p-1 rounded-md"><Sparkles size={12} className="text-[#E2B859]" /></div>}
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                  {entry.role === 'user' ? 'Direct Input' : 'Advisor Protocol'}
                </span>
                {entry.role === 'user' && <div className="bg-white/5 p-1 rounded-md"><User size={12} className="text-slate-400" /></div>}
              </div>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${entry.role === 'user' ? 'bg-[#E2B859] text-[#0F1117] font-semibold rounded-tr-none' : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none shadow-sm'}`}>
                {entry.text}
              </div>
            </div>
          ))}
          {dialogueLog.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <MessageSquare size={40} className="mb-4 text-slate-500" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Awaiting interaction...</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-white/5">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#0F1117] rounded-xl border border-white/5">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Monitoring Active</span>
          </div>
        </div>
      </div>

      <nav className="glass-card sticky top-0 z-50 px-6 py-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
              <div className="bg-[#E2B859] p-2 rounded-xl transition-transform group-hover:scale-105 shadow-lg shadow-[#E2B859]/10">
                <ShieldCheck className="text-[#0F1117]" size={22} />
              </div>
              <span className="text-xl font-semibold tracking-tight">GlobalCompliance</span>
            </div>
            <div className="hidden md:flex gap-2">
              <button onClick={() => setActiveTab('analyze')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'analyze' ? 'bg-[#E2B859] text-[#0F1117]' : 'text-slate-400 hover:text-white'}`}>Analyze</button>
              <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-[#E2B859] text-[#0F1117]' : 'text-slate-400 hover:text-white'}`}>Records</button>
            </div>
          </div>
          <button 
            onClick={isLiveAgentActive ? stopLiveAgent : startLiveAgent}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all border ${isLiveAgentActive ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
          >
            {isLiveAgentActive ? <Headphones size={14} /> : <UserCheck size={14} />}
            {isLiveAgentActive ? 'Advisor Link Active' : 'Strategic Advisor'}
          </button>
        </div>
      </nav>

      {selectedGalleryImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F1117]/95 backdrop-blur-md p-6" onClick={() => setSelectedGalleryImage(null)}>
          <img src={selectedGalleryImage} className="max-w-full max-h-full rounded-2xl shadow-2xl" alt="Preview" />
          <button className="absolute top-8 right-8 text-white/60 hover:text-white"><XCircle size={32} /></button>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        {activeTab === 'analyze' ? (
          <>
            {!analysis.data && !analysis.isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E2B859]/10 border border-[#E2B859]/20 rounded-full">
                    <Sparkles size={12} className="text-[#E2B859]" />
                    <span className="text-[10px] text-[#E2B859] font-bold uppercase tracking-wider">Professional Assistant</span>
                  </div>
                  <h1 className="text-6xl font-bold leading-tight">Export with <span className="text-[#E2B859]">Confidence.</span></h1>
                  <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                    Instantly identify product regulations, estimated costs, and market suitability using our advanced analysis engine.
                  </p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                      <Globe size={16} className="text-[#E2B859]" />
                      <span className="text-sm font-medium">All Global Markets</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                      <FileCheck2 size={16} className="text-[#E2B859]" />
                      <span className="text-sm font-medium">2026 Readiness</span>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
                  <div className="space-y-8">
                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-4 block">Target Market</label>
                      <div className="relative" ref={dropdownRef}>
                        <div 
                          onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                          className="w-full bg-white/5 border border-white/10 text-white rounded-2xl px-6 py-4 cursor-pointer hover:bg-white/10 transition-all flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Globe className="text-[#E2B859]" size={20} />
                            <span>{selectedCountry}</span>
                          </div>
                          <ChevronDown size={20} className={`text-slate-500 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isCountryDropdownOpen && (
                          <div className="absolute top-[110%] left-0 w-full z-[100] glass-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 border-b border-white/5 bg-slate-900/50">
                              <input 
                                autoFocus
                                type="text" 
                                placeholder="Find a country..."
                                className="w-full bg-transparent border-none outline-none text-white text-sm"
                                value={countrySearchTerm}
                                onChange={(e) => setCountrySearchTerm(e.target.value)}
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto premium-scroll py-2">
                              {filteredCountries.map(country => (
                                <div 
                                  key={country}
                                  onClick={() => { setSelectedCountry(country); setIsCountryDropdownOpen(false); setCountrySearchTerm(""); }}
                                  className={`px-6 py-3 text-sm hover:bg-[#E2B859]/10 cursor-pointer flex items-center justify-between ${selectedCountry === country ? 'text-[#E2B859] bg-[#E2B859]/5' : 'text-slate-400'}`}
                                >
                                  {country}
                                  {selectedCountry === country && <Check size={14} />}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-4 block">Product Image</label>
                      {!image ? (
                        <div 
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all bg-white/5 group cursor-pointer relative overflow-hidden flex flex-col items-center justify-center min-h-[160px] ${isDragging ? 'border-[#E2B859] bg-[#E2B859]/5 scale-[1.02]' : 'border-white/10 hover:border-[#E2B859]/50'}`}
                        >
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          
                          {isProcessingFile ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="text-[#E2B859] animate-spin" size={32} />
                              <p className="text-xs font-semibold text-slate-400">Processing file...</p>
                            </div>
                          ) : (
                            <>
                              <Upload className={`mx-auto mb-4 transition-all ${isDragging ? 'text-[#E2B859] scale-110' : 'text-slate-500 group-hover:text-[#E2B859]'}`} size={32} />
                              <p className="text-sm font-semibold text-white">Drag & drop or click to upload</p>
                              <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-widest">JPG, PNG, WebP up to 5MB</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 h-48 group shadow-xl">
                          <img src={image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Upload" />
                          <div className="absolute inset-0 bg-[#0F1117]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <button onClick={() => setImage(null)} className="bg-red-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-red-600 transition-colors flex items-center gap-2">
                              <XCircle size={14} /> REPLACE IMAGE
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-300 mb-4 block">Additional Details (Optional)</label>
                      <textarea value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="e.g. Help me understand customs for these electronics..." className="w-full bg-white/5 border border-white/10 text-white rounded-2xl p-4 text-sm focus:ring-1 focus:ring-[#E2B859] outline-none resize-none h-24 transition-all" />
                    </div>

                    <button 
                      disabled={!image} 
                      onClick={runAnalysis} 
                      className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${image ? "bg-[#E2B859] text-[#0F1117] hover:scale-[1.01] shadow-xl shadow-[#E2B859]/10" : "bg-white/5 text-slate-500 cursor-not-allowed"}`}
                    >
                      <Search size={18} /> Run Compliance Check
                    </button>
                  </div>
                </div>
              </div>
            ) : analysis.isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-500">
                <div className="relative mb-12">
                  <div className="w-24 h-24 rounded-full border-2 border-[#E2B859]/20 animate-pulse"></div>
                  <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#E2B859] animate-spin" size={40} />
                </div>
                <h2 className="text-4xl font-bold mb-4">Building Your Report</h2>
                <p className="text-slate-500 text-lg mb-8">Checking 2026 regulations and calculating costs...</p>
                <div className="w-full max-w-md h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E2B859] transition-all duration-700" style={{ width: `${(progressStep + 1) * 25}%` }}></div>
                </div>
              </div>
            ) : (
              /* DASHBOARD */
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                  <div>
                    <button onClick={reset} className="flex items-center gap-2 text-slate-500 hover:text-[#E2B859] transition-all text-xs font-semibold mb-4">
                      <ArrowLeft size={16} /> START NEW CHECK
                    </button>
                    <div className="flex items-center gap-4">
                      <h2 className="text-5xl font-bold">{analysis.data!.productName}</h2>
                      <span className="px-3 py-1 bg-[#E2B859]/10 text-[#E2B859] rounded-full text-[10px] font-bold uppercase tracking-wider">Verified 2026</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={handleWatchdogCheck} 
                      disabled={isWatchdogLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 rounded-2xl text-xs font-semibold text-slate-300 hover:text-[#E2B859] transition-all border border-white/10"
                    >
                      {isWatchdogLoading ? <RefreshCw className="animate-spin" size={14} /> : <Newspaper size={14} />}
                      Regulatory Watch
                    </button>
                    <button 
                      onClick={handleTensionCheck} 
                      disabled={isTensionLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 rounded-2xl text-xs font-semibold text-slate-300 hover:text-red-400 transition-all border border-white/10"
                    >
                      {isTensionLoading ? <RefreshCw className="animate-spin" size={14} /> : <TrendingUp size={14} />}
                      Live Trade Tensions
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* FINANCIALS SECTION */}
                  <div className="glass-card rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                      <Calculator size={200} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-400 mb-6 flex items-center gap-2">
                      <Calculator size={16} className="text-[#E2B859]" /> Financials
                    </h3>
                    
                    <div className="space-y-6 relative z-10">
                      <div className="pb-6 border-b border-white/5">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Estimated Landing Total</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white tracking-tight">
                            {analysis.data!.financials.currency} {analysis.data!.financials.totalLandingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs group/item">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Wallet size={12} className="group-hover/item:text-[#E2B859] transition-colors" />
                            <span>Base Unit Price</span>
                          </div>
                          <span className="font-semibold text-slate-200">
                            {analysis.data!.financials.currency} {analysis.data!.financials.basePriceEstimate.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs group/item">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Truck size={12} className="group-hover/item:text-[#E2B859] transition-colors" />
                            <span>Logistic Costs</span>
                          </div>
                          <span className="font-semibold text-slate-200">
                            {analysis.data!.financials.currency} {analysis.data!.financials.shippingEstimate.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs group/item">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Percent size={12} className="group-hover/item:text-red-400 transition-colors" />
                            <span>Tariff Impact ({analysis.data!.financials.tariffRate})</span>
                          </div>
                          <span className="font-semibold text-red-400">
                            + {analysis.data!.financials.currency} {Math.round(analysis.data!.financials.totalLandingCost - (analysis.data!.financials.basePriceEstimate + analysis.data!.financials.shippingEstimate)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          <span>FX Rate: {analysis.data!.financials.exchangeRate}</span>
                          <span className="text-[#E2B859]/60">2026 Forecast</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-3xl p-8">
                    <h3 className="text-sm font-semibold text-slate-400 mb-6 flex items-center gap-2">
                      <Compass size={16} className="text-[#E2B859]" /> Market Suitability
                    </h3>
                    <div className={`text-[10px] font-bold px-3 py-1 rounded-full inline-block mb-4 ${analysis.data!.culturalCheck.status === 'Compliant' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {analysis.data!.culturalCheck.status.toUpperCase()}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">{analysis.data!.culturalCheck.analysis}</p>
                    <ul className="space-y-2">
                      {analysis.data!.culturalCheck.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-400"><Check size={14} className="text-[#E2B859] shrink-0" /> {r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* ENHANCED GEOPOLITICAL RISK MATRIX */}
                  <div className="glass-card rounded-3xl p-8 flex flex-col relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                      <ShieldHalf size={200} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-400 mb-6 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-[#E2B859]" /> Geopolitical Risk Matrix
                    </h3>
                    
                    <div className="flex-1 relative z-10">
                      <RiskMeter score={analysis.data!.riskScore} />
                    </div>

                    {/* Granular Risk Factors Section */}
                    {analysis.data?.riskFactors && analysis.data.riskFactors.length > 0 && (
                      <div className="mt-8 space-y-3 relative z-10">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Real-Time Indicators</h4>
                        {analysis.data.riskFactors.map((factor, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                            <div className={`shrink-0 w-2 h-2 rounded-full mt-1 ${factor.impact === 'High' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : factor.impact === 'Medium' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}></div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-white">{factor.factor}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${factor.impact === 'High' ? 'bg-red-500/10 text-red-400' : factor.impact === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{factor.impact}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{factor.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="mt-6 p-4 bg-[#0F1117] rounded-2xl border border-white/5 relative z-10 shadow-inner">
                      <h4 className="text-[10px] font-bold text-[#E2B859] uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Gavel size={12} /> Strategic Synthesis
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4 italic font-medium">
                        "{analysis.data!.riskAnalysis}"
                      </p>
                      
                      {!tensionReport && (
                        <button 
                          onClick={handleTensionCheck}
                          disabled={isTensionLoading}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-[#E2B859]/10 border border-[#E2B859]/20 rounded-xl text-[10px] font-bold text-[#E2B859] hover:bg-[#E2B859]/20 transition-all uppercase tracking-widest shadow-lg shadow-[#E2B859]/5"
                        >
                          {isTensionLoading ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                          {isTensionLoading ? 'Probing Intel...' : 'In-Depth Friction Briefing'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* REGULATORY WATCH SECTION */}
                {watchdogAlert && (
                  <div className="glass-card rounded-[2rem] p-8 border-[#E2B859]/20 bg-[#E2B859]/5 animate-in slide-in-from-top-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Radio size={120} className="text-[#E2B859]" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-[#E2B859]">
                        <Newspaper size={24} /> Regulatory Watch
                      </h3>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <p className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">
                          {watchdogAlert}
                        </p>
                      </div>
                      <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        <Radio size={12} className="text-[#E2B859] animate-pulse" /> Live Grounded Data Feed • Verification Active
                      </div>
                    </div>
                  </div>
                )}

                {/* TENSION REPORT SECTION (ENHANCED) */}
                {tensionReport && (
                  <div className="glass-card rounded-[2rem] p-8 border-red-500/10 bg-red-500/5 animate-in slide-in-from-top-4">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                      <div>
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-3 text-red-400">
                          <Activity size={24} /> Geopolitical Friction Report
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Deep Intelligence Briefing • 2026 Ready</p>
                      </div>
                      <button 
                        onClick={handleTensionCheck}
                        disabled={isTensionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-widest"
                      >
                        {isTensionLoading ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Recalibrate
                      </button>
                    </div>
                    
                    <div className="prose prose-invert prose-sm max-w-none mb-10">
                      <p className="text-sm text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                        {tensionReport}
                      </p>
                    </div>

                    {/* Grounded Sources for Tensions */}
                    {tensionSources.length > 0 && (
                      <div className="pt-6 border-t border-white/5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Link2 size={12} /> Underlying Intel Nodes
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {tensionSources.slice(0, 4).map((source, i) => (
                            <a 
                              key={i} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:border-red-500/30 transition-all group"
                            >
                              <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px] group-hover:text-white transition-colors">{source.title}</span>
                              <ExternalLink size={10} className="text-slate-600 group-hover:text-red-400" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold pt-4 border-t border-white/5">
                      <ShieldCheck size={12} className="text-red-500" /> Probed by Gemini 3 Pro • Real-time Grounding Active
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-card rounded-3xl p-8">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <Stamp className="text-[#E2B859]" size={24} /> Mandatory Certifications
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {analysis.data!.exportCertifications.map((cert, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                          <CheckCircle2 size={18} className="text-emerald-500" />
                          <span className="text-sm font-semibold">{cert}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <LabelGenerator 
                    data={analysis.data!} 
                    image={image || undefined}
                    onRegenerate={runAnalysis} 
                  />
                </div>

                <div className="glass-card rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                    <Scale className="text-[#E2B859]" size={24} /> 2026 Import Regulations
                  </h3>
                  <ul className="space-y-4">
                    {analysis.data!.importRegulations.map((reg, i) => (
                      <li key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="bg-[#E2B859]/10 p-2 rounded-lg h-fit">
                          <FileText size={16} className="text-[#E2B859]" />
                        </div>
                        <span className="text-sm text-slate-300 leading-relaxed font-medium">{reg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="glass-card rounded-3xl p-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <LibraryBig className="text-[#E2B859]" size={24} /> Intelligence & Data Sources
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">Grounded Verification</span>
                  </div>
                  {analysis.data!.sources.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analysis.data!.sources.map((source, i) => (
                        <a 
                          key={i} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex flex-col p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-[#E2B859]/40 hover:bg-[#E2B859]/5 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-bold text-slate-300 line-clamp-2 leading-snug group-hover:text-white transition-colors">{source.title}</span>
                            <ExternalLink size={14} className="text-slate-600 shrink-0 group-hover:text-[#E2B859] transition-colors" />
                          </div>
                          <span className="text-[10px] text-slate-500 truncate font-medium group-hover:text-slate-400 transition-colors">{source.uri}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-8 border border-white/5 rounded-2xl bg-white/5 text-slate-500">
                      <FileWarning size={20} />
                      <p className="text-sm font-medium">No direct reference links provided. Analysis based on core 2026 intelligence training data.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 glass-card rounded-3xl p-8">
                    <h3 className="text-sm font-semibold text-slate-400 mb-6 flex items-center gap-2">
                      <ImageIcon size={16} className="text-[#E2B859]" /> Visual Signature
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div onClick={() => setSelectedGalleryImage(image)} className="aspect-square rounded-2xl overflow-hidden border border-[#E2B859]/30 cursor-pointer hover:scale-[1.03] transition-transform">
                        <img src={image!} className="w-full h-full object-cover" alt="Product" />
                      </div>
                      {history.filter(h => h.image !== image).slice(0, 1).map(h => (
                        <div key={h.id} onClick={() => setSelectedGalleryImage(h.image)} className="aspect-square rounded-2xl overflow-hidden border border-white/10 cursor-pointer hover:scale-[1.03] transition-transform">
                          <img src={h.image} className="w-full h-full object-cover grayscale" alt="History" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-2 glass-card rounded-3xl p-8">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <BrainCircuit className="text-[#E2B859]" size={24} /> Analysis Reasoning Path
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {analysis.data!.thoughtSignature.map((step, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-xs font-bold text-[#E2B859]">{i+1}</span>
                          <span className="text-sm text-slate-300 font-medium">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Records View */
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div>
                <h1 className="text-5xl font-bold mb-2">Saved Reports</h1>
                <p className="text-slate-500 font-medium">Your recent compliance history</p>
              </div>
              {history.length > 0 && (
                <button onClick={() => { if(confirm("Clear all history?")) { setHistory([]); localStorage.removeItem(HISTORY_KEY); } }} className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 px-4 py-2 rounded-xl bg-red-400/5 transition-all">
                  <Trash2 size={16} /> Delete All
                </button>
              )}
            </div>
            
            {history.length === 0 ? (
               <div className="text-center py-40">
                 <HistoryIcon className="mx-auto text-slate-800 mb-6" size={64} strokeWidth={1} />
                 <h3 className="text-2xl font-bold text-white mb-8">No reports yet</h3>
                 <button onClick={() => setActiveTab('analyze')} className="bg-[#E2B859] text-[#0F1117] px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105">New Analysis</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {history.map((item) => (
                  <div key={item.id} onClick={() => { setImage(item.image); setAnalysis({ isLoading: false, error: null, data: item.data }); setActiveTab('analyze'); }} className="glass-card rounded-[2rem] p-6 cursor-pointer hover:bg-white/5 transition-all group">
                    <div className="flex gap-6">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-white/5 shadow-lg"><img src={item.image} className="w-full h-full object-cover" alt="" /></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold truncate mb-1">{item.data.productName}</h4>
                        <p className="text-[#E2B859] text-xs font-bold uppercase tracking-wider mb-2">{item.data.country}</p>
                        <p className="text-slate-500 text-[10px] font-semibold">{new Date(item.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-20 border-t border-white/5 text-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-xs font-medium text-slate-500 tracking-wider">2026 GLOBAL COMPLIANCE PARTNER</p>
      </footer>

      {analysis.error && (
        <div className="fixed bottom-12 right-12 max-w-lg w-full glass-card border-l-4 border-l-red-500 p-8 rounded-r-2xl shadow-2xl flex items-start gap-6 animate-in slide-in-from-right-8 duration-500 z-[110]">
          <div className="bg-red-500/10 text-red-500 p-3 rounded-xl shrink-0"><AlertTriangle size={24} /></div>
          <div className="flex-1">
            <h4 className="text-white font-bold text-base mb-1">Attention Required</h4>
            <p className="text-slate-400 text-xs leading-relaxed">{analysis.error}</p>
            <div className="mt-4">
              <button onClick={() => setAnalysis(prev => ({ ...prev, error: null }))} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Dismiss Alert</button>
            </div>
          </div>
          <button onClick={() => setAnalysis(prev => ({ ...prev, error: null }))} className="text-slate-600 hover:text-white transition-colors shrink-0"><XCircle size={20} /></button>
        </div>
      )}
    </div>
  );
}

export default App;