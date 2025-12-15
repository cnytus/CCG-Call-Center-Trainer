export enum DefaultScenario {
  CARGO_ISSUE = 'Cargo/Logistics Issue',
  LEAD_GENERATION = 'Lead Generation/Sales',
  TECHNICAL_SUPPORT = 'Technical Support',
  BILLING_DISPUTE = 'Billing Dispute'
}

export enum Language {
  ENGLISH = 'English',
  GERMAN = 'German',
  TURKISH = 'Turkish',
  SPANISH = 'Spanish',
  FRENCH = 'French'
}

export enum Difficulty {
  EASY = 'Easy (Patient Customer)',
  MEDIUM = 'Medium (Standard)',
  HARD = 'Hard (Frustrated/Busy Customer)'
}

export interface SimulationConfig {
  scenario: string; // Changed from enum to string to support dynamic Excel tabs
  clientName?: string;
  callType?: string;
  language: Language;
  difficulty: Difficulty;
  customContext: string; 
  evaluationCriteria: string;
}

export interface EvaluationResult {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  transcription: Array<{ role: 'user' | 'model'; text: string }>;
}