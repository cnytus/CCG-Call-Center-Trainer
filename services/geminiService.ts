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
    return `
      ROLE: You are EXCLUSIVELY the CUSTOMER calling ${config.clientName} support. 
      
      STRICT OPERATIONAL RULES:
      1. NEVER ACT AS THE AGENT: You are the person calling with a problem or inquiry.
      2. LISTEN BEFORE TALKING: Allow the agent to finish their sentence. Wait for a natural pause before responding. Do not interrupt unless extremely frustrated.
      3. NO NARRATION: Never provide text descriptions of your actions (e.g., *Sighs* or "Customer said...").
      4. NO INLINE SUMMARIES: Never summarize what you just said. Just speak your dialogue.
      5. NO META-TALK: Never discuss the training or evaluation during the call. Stay in character 100%.
      6. LANGUAGE: Speak ONLY in ${config.language}.
      
      SCENARIO CONTEXT:
      - Client: ${config.clientName}
      - Project: ${config.project}
      - Call Type: ${config.callType}
      - Difficulty: ${config.difficulty}
      - Context: ${config.customContext || config.scenario}
      
      BEHAVIOR:
      Act like a real human. If the agent is helpful, be cooperative. If the agent is rude or fails to follow protocol (based on ${config.difficulty}), respond with appropriate human emotion.
      
      Begin the call now as the CUSTOMER.
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

          if (message.serverContent?.interrupted) {
            this.sources.forEach(s => { try { s.stop(); } catch(e){} });
            this.sources.clear();
            this.nextStartTime = 0;
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
    if (this.currentInputTranscription.trim()) this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription.trim() });
    if (this.currentOutputTranscription.trim()) this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription.trim() });
    
    if (this.session) {
      try { this.session.close(); } catch (e) {}
    }
    if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
    if (this.audioProcessor) this.audioProcessor.disconnect();
    this.sources.forEach(s => { try { s.stop(); } catch(e){} });
    this.sources.clear();
  }

  async generateEvaluation(config: SimulationConfig): Promise<EvaluationResult> {
    const transcriptText = this.transcriptionHistory
      .map(t => `${t.role === 'user' ? 'AGENT' : 'CUSTOMER'}: ${t.text}`)
      .join('\n');

    const prompt = `
      PERSONA: Expert Call Center QA Manager for ${config.clientName}.
      TASK: Evaluate the Agent's performance based on the transcript below and the defined criteria.
      
      EVALUATION CRITERIA:
      ${config.structuredCriteria?.map(c => `- ${c.name} (Max ${c.maxPoints}): ${c.description}`).join('\n') || config.evaluationCriteria}

      TRANSCRIPT:
      ${transcriptText || "No audible conversation recorded."}

      REQUIRED OUTPUT FIELDS (JSON):
      1. callSummary: A brief 2-sentence summary of the interaction.
      2. summary: Overall summary of the agent's performance and tone.
      3. improvementSuggestions: List of 3-5 actionable coaching tips.
      4. totalScore: A percentage (0-100) based on weighted criteria.
      5. criteriaBreakdown: Detailed list of each criterion with earned score and specific feedback comment.

      Ensure your feedback is professional and constructive.
    `;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        totalScore: { type: Type.NUMBER },
        summary: { type: Type.STRING },
        callSummary: { type: Type.STRING },
        improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        config: { responseMimeType: 'application/json', responseSchema: schema }
      });

      const data = JSON.parse(response.text || '{}');
      return {
        agentName: config.agentName,
        ...data,
        transcription: [...this.transcriptionHistory]
      };
    } catch (e) {
      console.error("Evaluation generation failed:", e);
      return {
        agentName: config.agentName,
        totalScore: 0,
        summary: "Error generating automated evaluation. Please review transcript manually.",
        callSummary: "Interaction summary unavailable.",
        improvementSuggestions: ["Check system logs for evaluation errors."],
        criteriaBreakdown: [],
        transcription: this.transcriptionHistory
      };
    }
  }

  async submitCorrection(original: EvaluationResult, corrected: EvaluationResult): Promise<void> {
    console.log("Saving human correction to training set...");
    // In a real app, this would be an API call to store data for fine-tuning
  }

  async sendChatMessage(model: string, history: any[], message: string): Promise<string> {
    const chat = this.ai.chats.create({ model, history });
    const result = await chat.sendMessage({ message });
    return result.text || "";
  }
}
export const geminiService = new GeminiService();