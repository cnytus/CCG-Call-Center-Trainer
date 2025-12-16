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
  scoreDifference: number; // e.g., Human gave 8, AI gave 10 = -2
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
  
  // Persistent nodes to prevent Garbage Collection
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  
  // Temporary buffers for real-time transcription
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  // Learning Memory
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
        console.log(`Loaded ${this.learningHistory.length} training examples.`);
      }
    } catch (e) {
      console.error("Failed to load AI training data", e);
    }
  }

  /**
   * Accepts a corrected evaluation from the human QA manager.
   * Compares the original AI result with the Human result and stores significant differences.
   */
  public submitCorrection(original: EvaluationResult, corrected: EvaluationResult) {
    if (!original.criteriaBreakdown || !corrected.criteriaBreakdown) return;

    let learnedSomething = false;

    corrected.criteriaBreakdown.forEach((humanItem) => {
      const aiItem = original.criteriaBreakdown.find(i => i.name === humanItem.name);
      if (!aiItem) return;

      // If score changed or comment changed significantly, record it
      if (aiItem.score !== humanItem.score || aiItem.comment !== humanItem.comment) {
        const example: LearningExample = {
          criterionName: humanItem.name,
          aiComment: aiItem.comment,
          humanComment: humanItem.comment,
          scoreDifference: humanItem.score - aiItem.score,
          timestamp: Date.now()
        };
        
        // Keep history manageable (last 50 corrections)
        this.learningHistory.unshift(example);
        learnedSomething = true;
      }
    });

    if (this.learningHistory.length > 50) {
      this.learningHistory = this.learningHistory.slice(0, 50);
    }

    if (learnedSomething) {
      localStorage.setItem('ai_training_data', JSON.stringify(this.learningHistory));
      console.log("AI has learned from corrections. Total examples:", this.learningHistory.length);
    }
  }

  /**
   * Generates the system instruction based on the user's configuration.
   */
  private getSystemInstruction(config: SimulationConfig): string {
    return `
      You are a world-class actor roleplaying a customer calling a call center. 
      Do NOT act like an AI. Act exactly like a human customer.
      
      SCENARIO DETAILS:
      - Agent Name: ${config.agentName} (You may wish to greet them or use their name if they introduce themselves).
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
   * Analyzes reference audio files (File objects) to extract customer persona.
   */
  async analyzeReferenceCalls(files: File[]): Promise<string> {
    const parts = [];
    parts.push(this.getAnalysisPromptPart());

    for (const file of files) {
      const base64 = await fileToBase64(file);
      parts.push({
        inlineData: { mimeType: file.type || 'audio/mp3', data: base64 }
      });
    }

    return this.executeAnalysis(parts);
  }

  /**
   * Analyzes reference audio from URLs (for pre-loaded presets).
   */
  async analyzePersonaFromUrls(urls: string[]): Promise<string> {
    const parts = [];
    parts.push(this.getAnalysisPromptPart());

    for (const url of urls) {
        try {
            const base64 = await fetchAudioAsBase64(url);
            // Guess mime type based on extension, default to mp3
            const mimeType = url.endsWith('.wav') ? 'audio/wav' : 'audio/mp3';
            parts.push({
                inlineData: { mimeType, data: base64 }
            });
        } catch (e) {
            console.error(`Skipping file ${url}:`, e);
            // Continue with other files if one fails
        }
    }

    if (parts.length <= 1) {
        throw new Error("No valid audio files could be loaded for analysis.");
    }

    return this.executeAnalysis(parts);
  }

  /**
   * Analyzes text transcripts to extract customer persona.
   */
  async analyzePersonaFromText(transcript: string): Promise<string> {
    const prompt = `
      You are an expert Call Center Analyst.
      Below are transcripts of REAL customer calls for DPD Inbound.

      Your task is to extract a "Simulation Profile" so an actor can replicate this customer's behavior.

      Please Identify:
      1. Common Issues (e.g. Express pickup failures, label printing issues, missed pickups).
      2. The Customer Persona (Tone, vocabulary, patience level, typical phrasing).
      3. Key Phrases or specific terminology used (e.g., "Verteilerdepot", "Abholauftrag", "Datenabgleich").

      Combine these into a concise summary titled "LEARNED PATTERNS FROM REAL CALLS".

      TRANSCRIPTS:
      ${transcript}
    `;

     const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || "Could not analyze transcripts.";
  }

  private getAnalysisPromptPart() {
      return {
          text: `You are an expert Call Center Analyst. 
          Please listen to these audio recordings of real customer calls.
          
          Your task is to extract a "Simulation Profile" so an actor can replicate this customer's behavior.
          
          Please Identify:
          1. The specific technical/logistical issue discussed (e.g. "Parcel stuck at depot").
          2. The Customer Persona (Tone, vocabulary, patience level, speed of speech).
          3. Key Phrases or specific terminology the customer used.
          
          Combine these into a concise summary titled "LEARNED PATTERNS FROM REAL AUDIO".`
      };
  }

  private async executeAnalysis(parts: any[]): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
      });
      return response.text || "Could not analyze audio.";
    } catch (e) {
      console.error("Audio analysis failed", e);
      throw new Error("Failed to analyze reference audio files.");
    }
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

    // Explicitly resume contexts to ensure they are active (browsers may suspend them)
    if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
    }
    if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
    }

    // Microphone Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Store nodes in instance to prevent Garbage Collection
    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.audioProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    // Establish Live Session
    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
          
          if (!this.audioProcessor || !this.mediaStreamSource || !this.inputAudioContext) return;

          this.audioProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            const pcmBlob = createAudioBlob(inputData, INPUT_SAMPLE_RATE);
            
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          this.mediaStreamSource.connect(this.audioProcessor);
          this.audioProcessor.connect(this.inputAudioContext.destination);
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
    // Capture any pending transcripts before closing
    if (this.currentInputTranscription.trim()) {
        this.transcriptionHistory.push({ role: 'user', text: this.currentInputTranscription });
        this.currentInputTranscription = '';
    }
    if (this.currentOutputTranscription.trim()) {
        this.transcriptionHistory.push({ role: 'model', text: this.currentOutputTranscription });
        this.currentOutputTranscription = '';
    }

    if (this.session) {
      this.session.close();
      this.session = null;
    }
    
    // Stop Microphone
    if (this.mediaStreamSource && this.audioProcessor) {
        this.mediaStreamSource.disconnect();
        this.audioProcessor.disconnect();
    }
    this.mediaStreamSource = null;
    this.audioProcessor = null;

    if (this.inputAudioContext) {
        if (this.inputAudioContext.state !== 'closed') {
            await this.inputAudioContext.close();
        }
        this.inputAudioContext = null;
    }

    // Stop Playback
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    
    if (this.outputAudioContext) {
        if (this.outputAudioContext.state !== 'closed') {
            await this.outputAudioContext.close();
        }
        this.outputAudioContext = null;
    }
  }

  /**
   * Generates a final evaluation report based on the transcript history.
   */
  async generateEvaluation(config: SimulationConfig): Promise<EvaluationResult> {
    if (this.transcriptionHistory.length === 0) {
        return {
            agentName: config.agentName,
            totalScore: 0,
            summary: "Call was too short to evaluate. No audio transcription was recorded.",
            criteriaBreakdown: [],
            transcription: []
        };
    }

    const conversationText = this.transcriptionHistory
      .map(t => `${t.role === 'user' ? 'AGENT (User)' : 'CUSTOMER (AI)'}: ${t.text}`)
      .join('\n');

    // Format Learning History for the prompt
    let learningContext = "";
    if (this.learningHistory.length > 0) {
        const examples = this.learningHistory.map(ex => 
            `- When evaluating "${ex.criterionName}", a human corrected me previously. \n  My initial thought: "${ex.aiComment}"\n  The Correction: "${ex.humanComment}"\n  Score Adjustment: ${ex.scoreDifference > 0 ? '+' : ''}${ex.scoreDifference} points.`
        ).join('\n');
        
        learningContext = `
        IMPORTANT - LEARNING FROM HUMAN CORRECTIONS:
        I have received feedback from a QA Manager on previous evaluations. Use this feedback to adjust your current evaluation logic:
        ${examples}
        
        If you encounter similar situations in this transcript, apply the logic from the "Correction" above.
        `;
    }

    let criteriaPromptSection = "";
    
    // If strict structured criteria are provided, construct the prompt to enforce exact matching
    if (config.structuredCriteria && config.structuredCriteria.length > 0) {
        const listItems = config.structuredCriteria.map((c, i) => 
            `ITEM ${i+1}: ID="${c.id || i}", Name="${c.name}", Description="${c.description || ''}", MaxPoints=${c.maxPoints}`
        ).join('\n');

        criteriaPromptSection = `
        STRICT EVALUATION REQUIRED:
        You must evaluate the call against the following specific list of criteria items. 
        Your output JSON "criteriaBreakdown" array MUST have exactly ${config.structuredCriteria.length} items, in the exact order listed below.
        
        ${listItems}
        
        For each item, provide a 'score' (0 to MaxPoints) and a 'comment'.
        `;
    } else {
        // Fallback to text-based extraction if no structured object provided
        criteriaPromptSection = `
        EVALUATION CRITERIA (Source Data):
        ${config.evaluationCriteria}
        
        Analyze the text above. Identify every specific criterion mentioned.
        - If the data has point values (e.g. "Greeting (10pts)" or column "Max Points"), use those as 'maxPoints'.
        - If no points are listed, assume 10 points per item.
        `;
    }

    const prompt = `
      TASK: You are an expert Quality Assurance Evaluator for a call center. 
      Your job is to grade the following call transcript based *strictly* on the provided Evaluation Criteria.

      INPUT DATA:
      1. Scenario: ${config.scenario}
      2. Agent Name: ${config.agentName}
      3. Language: ${config.language}
      
      ${criteriaPromptSection}

      TRANSCRIPT OF CALL:
      ${conversationText}

      ${learningContext}

      INSTRUCTIONS:
      1. Evaluate the "TRANSCRIPT" against the criteria.
      2. For EACH criterion, provide:
         - A score (0 up to maxPoints).
         - A specific, constructive comment explaining why points were given or deducted.
      3. Calculate the "totalScore" as a normalized percentage (0-100).
      4. Provide a "summary" of the agent's overall performance (strengths/weaknesses).

      RETURN JSON ONLY matching the defined schema.
    `;

    // Define the schema using the SDK's Schema definitions
    const jsonSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        totalScore: { type: Type.NUMBER, description: "Overall percentage score (0-100)" },
        summary: { type: Type.STRING, description: "Executive summary of the agent's performance" },
        criteriaBreakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The ID of the criterion (if provided)" },
              name: { type: Type.STRING, description: "Name of the criterion (e.g., 'Greeting')" },
              score: { type: Type.NUMBER, description: "Points earned for this criterion" },
              maxPoints: { type: Type.NUMBER, description: "Maximum possible points for this criterion" },
              comment: { type: Type.STRING, description: "Feedback explaining the score" }
            },
            required: ['name', 'score', 'maxPoints', 'comment']
          }
        }
      },
      required: ['totalScore', 'summary', 'criteriaBreakdown']
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema
        }
      });

      const json = JSON.parse(response.text || '{}');
      
      return {
        agentName: config.agentName,
        totalScore: json.totalScore || 0,
        summary: json.summary || "No summary provided.",
        criteriaBreakdown: json.criteriaBreakdown || [],
        transcription: this.transcriptionHistory
      };
    } catch (error) {
      console.error("Evaluation Generation Error:", error);
      // Fallback response in case of API failure
      return {
        agentName: config.agentName,
        totalScore: 0,
        summary: "Error generating evaluation. Please try again.",
        criteriaBreakdown: [],
        transcription: this.transcriptionHistory
      };
    }
  }

  /**
   * Sends a text message to the chatbot.
   */
  async sendChatMessage(
    model: string, 
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>, 
    message: string
  ): Promise<string> {
    try {
      const chat = this.ai.chats.create({
        model: model,
        history: history,
        config: {
            systemInstruction: "You are a helpful AI assistant for a call center agent training app. Keep your answers concise and helpful."
        }
      });
      
      const result = await chat.sendMessage({ message });
      return result.text || "";
    } catch (error) {
      console.error("Chat error:", error);
      return "Sorry, I encountered an error processing your request.";
    }
  }
}

export const geminiService = new GeminiService();