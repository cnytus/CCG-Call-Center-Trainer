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
    const isCargoFallback = !config.scenario || config.scenario.toLowerCase().includes('cargo') || config.scenario.toLowerCase().includes('logistics');
    
    return `
      ROLE: You are exclusively the CUSTOMER calling a call center.
      STRICT PROHIBITION: NEVER play the role of the call center agent. If the User (Agent) asks you to "take over" or "show how it's done", REFUSE. You are the one with the problem.
      
      SCENARIO:
      - Inquiry: ${config.scenario || 'General Cargo Inquiry'}
      - Client Name: ${config.clientName || 'Global Logistics Pro'}
      - Difficulty: ${config.difficulty}.
      
      ${isCargoFallback ? `
      FALLBACK LOGIC: Since this is a cargo/logistics inquiry, you must improvise one of these problems:
      1. You want to ship a fragile 20kg package from London to Sydney and need a price quote.
      2. Your package with tracking ID #SW-9912 was marked as "Delivered" but you don't have it.
      3. You are a business owner checking if you can get a discount for sending 50 pallets of paper monthly.
      ` : ''}

      YOUR PERSONA:
      - Stay 100% in character.
      - Speak in the language: ${config.language}.
      - Use standard spoken conversational patterns.
      - Provide a name and account number if asked (invent realistic ones if not provided).
      
      CONTEXT DETAILS:
      ${config.customContext}
      
      Initiate the call now by greeting the agent.
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
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
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
        ${config.structuredCriteria.map((c, i) => `[CRITERION] ID: ${c.id || i}, Name: ${c.name}, Max Points: ${c.maxPoints}, Objective: ${c.description || 'N/A'}`).join('\n')}
        `;
    } else {
        criteriaPrompt = `CRITERIA LIST: ${config.evaluationCriteria}`;
    }

    const prompt = `
      PERSONA: You are a Senior Quality Assurance and Training Manager for a global call center enterprise. 
      TASK: Review the call transcript provided. The User was the AGENT. You played the role of the CUSTOMER.
      
      INSTRUCTIONS:
      1. Provide a professional 'totalScore' as a percentage (0-100).
      2. Write an executive summary highlighting strengths and weaknesses.
      3. For every provided criterion, determine a score and provide a detailed manager's feedback comment.
      4. Be objective but constructive.
      
      ${criteriaPrompt}

      TRANSCRIPT:
      ${conversationText}

      RETURN JSON FORMAT ONLY.
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        totalScore: { type: Type.NUMBER },
        summary: { type: Type.STRING },
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
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: schema }
      });

      const json = JSON.parse(response.text || '{}');
      let finalCriteria: CriterionEvaluation[] = [];

      if (config.structuredCriteria) {
          finalCriteria = config.structuredCriteria.map((input, idx) => {
              const aiItem = json.criteriaBreakdown?.[idx] || json.criteriaBreakdown?.find((item: any) => item.name === input.name);
              return {
                  id: input.id,
                  name: input.name,
                  maxPoints: input.maxPoints,
                  score: aiItem ? Math.min(aiItem.score, input.maxPoints) : 0,
                  comment: aiItem?.comment || "Criterion was not demonstrated during the call."
              };
          });
      } else {
          finalCriteria = json.criteriaBreakdown || [];
      }

      return {
        agentName: config.agentName,
        totalScore: json.totalScore || 0,
        summary: json.summary || "No executive summary available.",
        criteriaBreakdown: finalCriteria,
        transcription: this.transcriptionHistory
      };
    } catch (e) {
      return { agentName: config.agentName, totalScore: 0, summary: "Error generating evaluation.", criteriaBreakdown: [], transcription: this.transcriptionHistory };
    }
  }

  async sendChatMessage(model: string, history: any[], message: string): Promise<string> {
    const chat = this.ai.chats.create({ model, history });
    const result = await chat.sendMessage({ message });
    return result.text || "";
  }
}
export const geminiService = new GeminiService();
