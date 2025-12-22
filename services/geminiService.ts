import { GoogleGenAI, LiveServerMessage, Modality, Type, GenerateContentResponse, Schema } from "@google/genai";
import { SimulationConfig, EvaluationResult, CriterionEvaluation } from "../types";
import { createAudioBlob, decodeAudioData } from "../utils/audioUtils";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

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

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getSystemInstruction(config: SimulationConfig): string {
    const isCargoFallback = !config.scenario || 
                             config.scenario.toLowerCase().includes('cargo') || 
                             config.scenario.toLowerCase().includes('logistics') ||
                             config.scenario === 'General Inquiry';
    
    return `
      ROLE: You are EXCLUSIVELY a CUSTOMER calling ${config.clientName} support.
      
      STRICT CHARACTER RULES:
      1. YOU ARE THE CUSTOMER: Never act as an agent, trainer, or assistant.
      2. AUDIO ONLY: You communicate ONLY via spoken voice.
      3. NO TEXT SUMMARIES: Do not provide a text summary of your speech. Do not describe your own actions in text.
      4. NO INLINE FEEDBACK: Do not tell the agent they are doing well or poorly during the call. Stay in your role even if they make mistakes.
      5. NO NARRATION: Do not say things like "The customer looks at his watch" or "The customer sounds angry". Just BE the customer.
      
      SCENARIO DETAILS:
      - Client: ${config.clientName}
      - Project: ${config.project}
      - Call Type: ${config.callType}
      - Language: ${config.language} (STRICT: All your speech must be in this language).
      - Context: ${config.customContext || config.scenario}
      
      Your goal is to have your issue resolved. If the agent is helpful, proceed to a solution. If they are incompetent or rude (based on difficulty: ${config.difficulty}), express frustration naturally.
      
      Begin the interaction now as the CUSTOMER.
    `;
  }

  async connect(config: SimulationConfig, onAudioData: (frequencyData: Uint8Array) => void, onDisconnect: () => void): Promise<void> {
    this.transcriptionHistory = [];
    this.nextStartTime = 0;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

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
          if (message.serverContent?.outputTranscription) {
            this.currentOutputTranscription += message.serverContent.outputTranscription.text;
          } else if (message.serverContent?.inputTranscription) {
            this.currentInputTranscription += message.serverContent.inputTranscription.text;
          }
          
          if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription.trim()) {
              this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription.trim() });
            }
            if (this.currentOutputTranscription.trim()) {
              this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription.trim() });
            }
            this.currentInputTranscription = '';
            this.currentOutputTranscription = '';
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(base64Audio, this.outputAudioContext, OUTPUT_SAMPLE_RATE);
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            const analyser = this.outputAudioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyser.connect(this.outputAudioContext.destination);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);
            source.onended = () => this.sources.delete(source);
            
            const updateVisualizer = () => {
              if (this.sources.has(source)) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                onAudioData(dataArray);
                requestAnimationFrame(updateVisualizer);
              }
            };
            updateVisualizer();
          }
        },
        onclose: () => onDisconnect(),
        onerror: (e) => { console.error("Live API Error:", e); onDisconnect(); }
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
    // Final flush of transcription
    if (this.currentInputTranscription.trim()) this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription.trim() });
    if (this.currentOutputTranscription.trim()) this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription.trim() });
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';

    if (this.session) {
      try { this.session.close(); } catch (e) {}
    }
    if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
    if (this.audioProcessor) this.audioProcessor.disconnect();
    this.sources.forEach(s => { try { s.stop(); } catch(e){} });
    this.sources.clear();
  }

  async generateEvaluation(config: SimulationConfig): Promise<EvaluationResult> {
    const transcriptText = this.transcriptionHistory.length > 0 
      ? this.transcriptionHistory.map(t => `${t.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${t.text}`).join('\n')
      : "No conversation occurred.";

    const prompt = `
      PERSONA: Senior Call Center Quality Assurance and Training Manager.
      CLIENT: ${config.clientName}
      PROJECT: ${config.project}
      CALL TYPE: ${config.callType}

      TASK: Perform a detailed audit of the provided call transcript. 
      You must evaluate the AGENT's performance based strictly on the EVALUATION CRITERIA below.

      EVALUATION CRITERIA:
      ${config.structuredCriteria?.map(c => `- ${c.name} (Max Points: ${c.maxPoints}): ${c.description}`).join('\n') || config.evaluationCriteria}

      TRANSCRIPT TO AUDIT:
      ${transcriptText}

      OUTPUT REQUIREMENTS:
      1. CALL_SUMMARY: A professional 2-3 sentence overview of the customer's request and the agent's resolution.
      2. MANAGER_FEEDBACK: A summary of the agent's soft skills and technical accuracy.
      3. IMPROVEMENT_SUGGESTIONS: 3-5 high-impact coaching points for the agent's professional development.
      4. CRITERIA_SCORING: A numerical score for EACH criterion listed above. You must justify every point deduction in the comment field.

      Return the result in JSON format only.
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        totalScore: { type: Type.NUMBER, description: "Normalized total score percentage (0-100)." },
        summary: { type: Type.STRING, description: "Professional manager feedback." },
        callSummary: { type: Type.STRING, description: "Brief summary of the call context." },
        improvementSuggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific actionable coaching points."
        },
        criteriaBreakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              score: { type: Type.NUMBER },
              maxPoints: { type: Type.NUMBER },
              comment: { type: Type.STRING }
            },
            required: ['name', 'score', 'maxPoints', 'comment']
          }
        }
      },
      required: ['totalScore', 'summary', 'callSummary', 'improvementSuggestions', 'criteriaBreakdown']
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          responseMimeType: 'application/json', 
          responseSchema: schema
        }
      });

      const json = JSON.parse(response.text || '{}');
      
      return {
        agentName: config.agentName,
        totalScore: json.totalScore || 0,
        summary: json.summary || "Evaluation completed.",
        callSummary: json.callSummary || "Interaction documented.",
        improvementSuggestions: json.improvementSuggestions || [],
        criteriaBreakdown: json.criteriaBreakdown || [],
        transcription: [...this.transcriptionHistory]
      };
    } catch (e) {
      console.error("Evaluation Error:", e);
      // Fallback result so the UI still displays the transcript at minimum
      return {
        agentName: config.agentName,
        totalScore: 0,
        summary: "An error occurred during automated evaluation. Please review the transcript manually.",
        callSummary: "System error during evaluation processing.",
        improvementSuggestions: ["Review the manual transcript for coaching opportunities."],
        criteriaBreakdown: config.structuredCriteria?.map(c => ({
          name: c.name,
          score: 0,
          maxPoints: c.maxPoints,
          comment: "Error: Manual review required."
        })) || [],
        transcription: [...this.transcriptionHistory]
      };
    }
  }

  async submitCorrection(original: EvaluationResult, corrected: EvaluationResult): Promise<void> {
    console.log("Human feedback saved.");
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async sendChatMessage(model: string, history: any[], message: string): Promise<string> {
    const chat = this.ai.chats.create({ model, history });
    const result = await chat.sendMessage({ message });
    return result.text || "";
  }
}
export const geminiService = new GeminiService();