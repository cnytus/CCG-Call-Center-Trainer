import { GoogleGenAI, LiveServerMessage, Modality, Type, GenerateContentResponse, Schema } from "@google/genai";
import { SimulationConfig, EvaluationResult, CriterionEvaluation } from "../types";
import { createAudioBlob, decodeAudioData, fileToBase64, fetchAudioAsBase64 } from "../utils/audioUtils";

// Constants for Audio
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

interface LearningExample {
  criterionName: string;
  aiComment: string;
  humanComment: string;
  scoreDifference: number;
  timestamp: number;
}

export class GeminiService {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private transcriptionHistory: Array<{ role: 'user' | 'model'; text: string }> = [];
  
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  
  private currentInputTranscription = '';
  private currentOutputTranscription = '';
  private learningHistory: LearningExample[] = [];

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.loadLearningHistory();
  }

  private loadLearningHistory() {
    try {
      const stored = localStorage.getItem('ai_training_data');
      if (stored) {
        this.learningHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load AI training data", e);
    }
  }

  public submitCorrection(original: EvaluationResult, corrected: EvaluationResult) {
    if (!original.criteriaBreakdown || !corrected.criteriaBreakdown) return;
    let learnedSomething = false;

    corrected.criteriaBreakdown.forEach((humanItem) => {
      const aiItem = original.criteriaBreakdown.find(i => i.name === humanItem.name);
      if (!aiItem) return;

      if (aiItem.score !== humanItem.score || aiItem.comment !== humanItem.comment) {
        this.learningHistory.unshift({
          criterionName: humanItem.name,
          aiComment: aiItem.comment,
          humanComment: humanItem.comment,
          scoreDifference: humanItem.score - aiItem.score,
          timestamp: Date.now()
        });
        learnedSomething = true;
      }
    });

    if (this.learningHistory.length > 50) this.learningHistory = this.learningHistory.slice(0, 50);
    if (learnedSomething) localStorage.setItem('ai_training_data', JSON.stringify(this.learningHistory));
  }

  private getSystemInstruction(config: SimulationConfig): string {
    return `
      ROLE: You are the CUSTOMER calling a call center.
      CRITICAL RULE: You MUST ONLY play the role of the CUSTOMER. NEVER play the role of the call center agent. 
      The person speaking to you (the User) is the AGENT. You are the one with the problem or inquiry.
      
      SCENARIO:
      - Your Name: (Pick a realistic name or use one from context)
      - Calling for: ${config.clientName || 'General Service'}
      - Problem: ${config.scenario}
      - Language: ${config.language} (Speak ONLY this language)
      - Persona: ${config.difficulty}. 

      BEHAVIOR:
      - You are a real human. If the agent greets you, state your problem.
      - If the agent asks for your name or account number, provide it (invent it if not in context).
      - If the agent is incompetent, get frustrated (based on difficulty).
      - If the agent is helpful, be polite.
      - DO NOT explain that you are an AI. Stay in character until the call ends.
      
      CONTEXT FOR YOUR PROBLEM:
      ${config.customContext}
      
      Begin the call now.
    `;
  }

  async connect(config: SimulationConfig, onAudioData: (frequencyData: Uint8Array) => void, onDisconnect: () => void): Promise<void> {
    this.transcriptionHistory = [];
    this.nextStartTime = 0;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.audioProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          if (!this.audioProcessor || !this.mediaStreamSource || !this.inputAudioContext) return;
          this.audioProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: createAudioBlob(inputData, INPUT_SAMPLE_RATE) });
            });
          };
          this.mediaStreamSource.connect(this.audioProcessor);
          this.audioProcessor.connect(this.inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) this.currentOutputTranscription += message.serverContent.outputTranscription.text;
          else if (message.serverContent?.inputTranscription) this.currentInputTranscription += message.serverContent.inputTranscription.text;
          if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription.trim()) this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription });
            if (this.currentOutputTranscription.trim()) this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription });
            this.currentInputTranscription = ''; this.currentOutputTranscription = '';
          }
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(base64Audio, this.outputAudioContext, OUTPUT_SAMPLE_RATE);
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            const analyser = this.outputAudioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser); analyser.connect(this.outputAudioContext.destination);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration; this.sources.add(source);
            source.onended = () => this.sources.delete(source);
            const updateVisualizer = () => {
              if (this.sources.has(source)) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray); onAudioVisualizer(dataArray);
                requestAnimationFrame(updateVisualizer);
              }
            };
            const onAudioVisualizer = onAudioData;
            updateVisualizer();
          }
        },
        onclose: () => onDisconnect(),
        onerror: () => onDisconnect()
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: this.getSystemInstruction(config),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
    this.session = await sessionPromise;
  }

  async disconnect() {
    if (this.currentInputTranscription.trim()) this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription });
    if (this.currentOutputTranscription.trim()) this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription });
    this.currentInputTranscription = ''; this.currentOutputTranscription = '';
    if (this.session) this.session.close();
    if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
    if (this.audioProcessor) this.audioProcessor.disconnect();
    this.sources.forEach(s => s.stop());
    this.sources.clear();
  }

  async generateEvaluation(config: SimulationConfig): Promise<EvaluationResult> {
    const conversationText = this.transcriptionHistory
      .map(t => `${t.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${t.text}`).join('\n');

    let criteriaPrompt = "";
    if (config.structuredCriteria) {
        criteriaPrompt = `
        STRICT EVALUATION CRITERIA:
        ${config.structuredCriteria.map((c, i) => `[CRITERION ${i}] ID: ${c.id || i}, Name: ${c.name}, Max Points: ${c.maxPoints}, Goal: ${c.description || 'N/A'}`).join('\n')}
        `;
    } else {
        criteriaPrompt = `CRITERIA LIST: ${config.evaluationCriteria}`;
    }

    const prompt = `
      PERSONA: You are a Senior Quality Assurance and Training Manager with 20 years of experience in call center operations.
      TASK: Conduct a formal performance review of the following call transcript. 
      The User played the role of the AGENT. You previously played the role of the CUSTOMER.

      EVALUATION STANDARDS:
      - Be objective, professional, and thorough.
      - Grade the agent against the specific criteria provided below.
      - For each item, provide a score (0 to Max) and a detailed manager comment explaining the reasoning.
      
      ${criteriaPrompt}

      TRANSCRIPT OF THE CALL:
      ${conversationText}

      INSTRUCTIONS:
      1. Analyze the transcript for evidence of meeting each criterion.
      2. If a criterion was not addressed, explain why in the comment and give 0 points.
      3. Return your final evaluation in the requested JSON format.
      4. Ensure "totalScore" is a percentage (0-100) based on total points earned vs total points possible.
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        totalScore: { type: Type.NUMBER, description: "Normalized percentage score 0-100" },
        summary: { type: Type.STRING, description: "Professional summary from the Training Manager" },
        criteriaBreakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              score: { type: Type.NUMBER },
              maxPoints: { type: Type.NUMBER },
              comment: { type: Type.STRING }
            },
            required: ['name', 'score', 'maxPoints', 'comment']
          }
        }
      },
      required: ['totalScore', 'summary', 'criteriaBreakdown']
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Using Pro for high-quality evaluation reasoning
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: schema }
      });

      const json = JSON.parse(response.text || '{}');
      let finalCriteria: CriterionEvaluation[] = [];

      // Ensure we return the EXACT structure the user provided
      if (config.structuredCriteria) {
          finalCriteria = config.structuredCriteria.map((input, idx) => {
              const aiItem = json.criteriaBreakdown?.[idx] || json.criteriaBreakdown?.find((item: any) => item.name === input.name);
              return {
                  id: input.id,
                  name: input.name,
                  maxPoints: input.maxPoints,
                  score: aiItem ? Math.min(aiItem.score, input.maxPoints) : 0,
                  comment: aiItem?.comment || "Criterion not satisfied or not attempted during the conversation."
              };
          });
      } else {
          finalCriteria = json.criteriaBreakdown || [];
      }

      return {
        agentName: config.agentName,
        totalScore: json.totalScore || 0,
        summary: json.summary || "No executive summary provided.",
        criteriaBreakdown: finalCriteria,
        transcription: this.transcriptionHistory
      };
    } catch (e) {
      console.error("Eval Error:", e);
      return { agentName: config.agentName, totalScore: 0, summary: "Technical error during evaluation generation.", criteriaBreakdown: [], transcription: this.transcriptionHistory };
    }
  }

  async analyzeReferenceCalls(files: File[]): Promise<string> {
    const parts: any[] = [{ text: "Extract a customer behavioral profile and persona from these audio samples for a roleplay simulation." }];
    for (const f of files) parts.push({ inlineData: { mimeType: f.type || 'audio/mp3', data: await fileToBase64(f) } });
    const res = await this.ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts } });
    return res.text || "";
  }

  async analyzePersonaFromUrls(urls: string[]): Promise<string> {
    const parts: any[] = [{ text: "Extract simulation profile from audio urls." }];
    for (const u of urls) parts.push({ inlineData: { mimeType: 'audio/mp3', data: await fetchAudioAsBase64(u) } });
    const res = await this.ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts } });
    return res.text || "";
  }

  async analyzePersonaFromText(transcript: string): Promise<string> {
     const res = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract customer behavior profile and pain points from these transcripts to use for roleplay training:\n${transcript}`,
      });
      return res.text || "";
  }

  async sendChatMessage(model: string, history: any[], message: string): Promise<string> {
    const chat = this.ai.chats.create({ model, history });
    const result = await chat.sendMessage({ message });
    return result.text || "";
  }
}
export const geminiService = new GeminiService();