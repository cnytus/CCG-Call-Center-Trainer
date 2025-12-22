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
  FRENCH = 'French',
  ITALIAN = 'Italian',
  DUTCH = 'Dutch',
  PORTUGUESE = 'Portuguese',
  RUSSIAN = 'Russian',
  JAPANESE = 'Japanese',
  CHINESE = 'Chinese'
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

export interface CallScenarioPreset {
  id: string;
  title: string;
  description: string;
  client: string;
  context: string;
  criteria: ExternalCriterion[];
  icon: string;
}

export interface SimulationConfig {
  agentName: string;
  scenario: string;
  clientName: string;
  callType: string;
  project: string;
  language: Language;
  difficulty: Difficulty;
  customContext: string; 
  evaluationCriteria: string;
  structuredCriteria?: ExternalCriterion[];
}

export interface CriterionEvaluation {
  id?: string | number;
  name: string;
  score: number;
  maxPoints: number;
  comment: string;
}

export interface EvaluationResult {
  agentName: string;
  totalScore: number;
  summary: string;
  callSummary?: string;
  improvementSuggestions: string[]; // New field for QA Manager advice
  criteriaBreakdown: CriterionEvaluation[];
  transcription: Array<{ role: 'user' | 'model'; text: string }>;
}

export interface CallCenterTrainerProps {
  initialAgentName?: string;
  externalCriteria?: ExternalCriterion[];
  externalClientName?: string;
  externalScenario?: string;
  onSessionComplete?: (result: EvaluationResult) => void;
}