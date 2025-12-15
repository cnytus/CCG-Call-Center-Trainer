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

export interface ExternalCriterion {
  id?: string | number;
  name: string;
  maxPoints: number;
  description?: string;
}

export interface SimulationConfig {
  agentName: string;
  scenario: string;
  clientName?: string;
  callType?: string;
  language: Language;
  difficulty: Difficulty;
  customContext: string; 
  evaluationCriteria: string;
}

export interface CriterionEvaluation {
  name: string;
  score: number;
  maxPoints: number;
  comment: string;
}

export interface EvaluationResult {
  agentName: string;
  totalScore: number;
  summary: string;
  criteriaBreakdown: CriterionEvaluation[];
  transcription: Array<{ role: 'user' | 'model'; text: string }>;
}