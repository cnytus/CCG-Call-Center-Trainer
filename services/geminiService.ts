import { GoogleGenAI, LiveServerMessage, Modality, Type, GenerateContentResponse } from "@google/genai";
import { SimulationConfig, EvaluationResult } from "../types";
import { createAudioBlob, decodeAudioData } from "../utils/audioUtils";

// Constants for Audio
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
  
  // Temporary buffers for real-time transcription
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Generates the system instruction based on the user's configuration.
   */
  private getSystemInstruction(config: SimulationConfig): string {
    return `
      You are a world-class actor roleplaying a customer calling a call center. 
      Do NOT act like an AI. Act exactly like a human customer.
      
      SCENARIO DETAILS:
      - Topic: ${config.scenario}
      - Client/Brand: ${config.clientName || 'General'}
      - Call Type: ${config.callType || 'General'}
      - Language: ${config.language} (Speak ONLY in this language).
      - Difficulty Level: ${config.difficulty}.
      
      CONTEXT & CRITERIA DATA:
      The user has provided the following data (Context and Evaluation Criteria) which you must follow strictly.
      If this data contains specific customer details (Name, Account #), use them.
      If it contains a script or checklist, ensure your behavior triggers those checklist items for the agent to solve.
      
      --- START OF DATA ---
      ${config.customContext}
      ${config.evaluationCriteria !== config.customContext ? config.evaluationCriteria : ''}
      --- END OF DATA ---

      BEHAVIOR GUIDELINES:
      - If difficulty is EASY: Be patient, clear, and polite.
      - If difficulty is MEDIUM: Be normal, ask standard follow-up questions.
      - If difficulty is HARD: Be impatient, interrupt occasionally, or express frustration.
      - Keep your responses concise (spoken conversation style).
      
      YOUR GOAL:
      - Test the agent based on the provided criteria/data.
      - Do not mention the criteria to the agent. Just provide the scenarios that trigger the need for these criteria.
      
      Start the conversation immediately as if the call just connected.
    `;
  }

  /**
   * Connects to the Gemini Live API.
   */
  async connect(
    config: SimulationConfig, 
    onAudioData: (frequencyData: Uint8Array) => void,
    onDisconnect: () => void
  ): Promise<void> {
    this.transcriptionHistory = [];
    this.nextStartTime = 0;

    // Initialize Audio Contexts
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

    // Microphone Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    
    // Processor for Input Audio (Sending to Gemini)
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    // Establish Live Session
    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            const pcmBlob = createAudioBlob(inputData, INPUT_SAMPLE_RATE);
            
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          source.connect(processor);
          processor.connect(this.inputAudioContext!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          await this.handleServerMessage(message, onAudioData);
        },
        onclose: () => {
          console.log("Gemini Live Session Closed");
          onDisconnect();
        },
        onerror: (err) => {
          console.error("Gemini Live Error", err);
          onDisconnect();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        systemInstruction: this.getSystemInstruction(config),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

    this.session = await sessionPromise;
  }

  /**
   * Handles incoming messages (Audio & Transcription).
   */
  private async handleServerMessage(
    message: LiveServerMessage, 
    onAudioVisualizer: (data: Uint8Array) => void
  ) {
    // 1. Handle Transcription
    if (message.serverContent?.outputTranscription) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
    } else if (message.serverContent?.inputTranscription) {
      this.currentInputTranscription += message.serverContent.inputTranscription.text;
    }

    if (message.serverContent?.turnComplete) {
        if (this.currentInputTranscription.trim()) {
            this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription });
            this.currentInputTranscription = '';
        }
        if (this.currentOutputTranscription.trim()) {
            this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription });
            this.currentOutputTranscription = '';
        }
    }

    // 2. Handle Audio Playback
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      // Manage playback timing
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const audioBuffer = await decodeAudioData(
        base64Audio, 
        this.outputAudioContext, 
        OUTPUT_SAMPLE_RATE
      );

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Analyzer for visualization
      const analyser = this.outputAudioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(this.outputAudioContext.destination);

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);

      source.onended = () => {
        this.sources.delete(source);
      };

      // Push visualizer data
      const updateVisualizer = () => {
        if (this.sources.has(source)) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          onAudioVisualizer(dataArray);
          requestAnimationFrame(updateVisualizer);
        }
      };
      updateVisualizer();
    }
  }

  async disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    
    // Stop Microphone
    this.inputAudioContext?.close();
    this.inputAudioContext = null;

    // Stop Playback
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    this.outputAudioContext?.close();
    this.outputAudioContext = null;
  }

  /**
   * Generates a final evaluation report based on the transcript history.
   */
  async generateEvaluation(config: SimulationConfig): Promise<EvaluationResult> {
    // If transcript is empty, return dummy data or error
    if (this.transcriptionHistory.length === 0) {
        // Fallback if session was too short
        return {
            score: 0,
            summary: "Call was too short to evaluate.",
            strengths: [],
            weaknesses: ["No conversation detected."],
            transcription: []
        };
    }

    const conversationText = this.transcriptionHistory
      .map(t => `${t.role.toUpperCase()}: ${t.text}`)
      .join('\n');

    // Include the raw Excel data in the evaluation prompt so it knows the criteria
    const prompt = `
      You are a Quality Assurance Specialist for a call center. 
      Evaluate the following conversation transcript based on the data provided below.
      
      SCENARIO: ${config.scenario}
      LANGUAGE: ${config.language}
      
      CRITERIA & CONTEXT DATA FROM EXCEL:
      ${config.evaluationCriteria}

      TRANSCRIPT:
      ${conversationText}

      Output valid JSON matching this schema:
      {
        "score": number (0-100),
        "summary": string (2-3 sentences),
        "strengths": string[] (3 bullet points),
        "weaknesses": string[] (3 bullet points)
      }
    `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'summary', 'strengths', 'weaknesses']
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    
    return {
      ...json,
      transcription: this.transcriptionHistory
    };
  }
}

export const geminiService = new GeminiService();