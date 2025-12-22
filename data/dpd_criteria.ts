import { ExternalCriterion } from '../types';

export const DPD_STANDARD_INBOUND_CRITERIA: ExternalCriterion[] = [
  { 
    name: 'Korrekte Begrüßung / Meldeformel', 
    maxPoints: 1, 
    description: 'Meldet sich mit: "Schönen guten Tag, mein Name ist [Name], wie darf / kann ich Ihnen weiterhelfen?"' 
  },
  { 
    name: 'Namentliche Ansprache', 
    maxPoints: 2, 
    description: 'Den Kunden 2-3 Mal namentlich ansprechen (sofern Name bekannt).' 
  },
  { 
    name: 'Höflichkeit', 
    maxPoints: 1, 
    description: 'Verwendung von Zauberwörtern: bitte, gerne, danke, selbstverständlich.' 
  },
  { 
    name: 'Tonalität & Lächeln', 
    maxPoints: 1, 
    description: 'Motivierte Tonalität, Lächeln in der Stimme.' 
  },
  { 
    name: 'Aktives Zuhören', 
    maxPoints: 1, 
    description: 'Signalisieren von Aufmerksamkeit durch Zuhörsignale (mhm, ja, verstehe).' 
  },
  { 
    name: 'Kunden ausreden lassen', 
    maxPoints: 1, 
    description: 'Kein Unterbrechen des Kunden, besonders bei Emotionen.' 
  },
  { 
    name: 'Pausen überbrücken', 
    maxPoints: 1, 
    description: 'Stille vermeiden und erklären, was gerade getan wird.' 
  },
  { 
    name: 'Datenschutz (Datenabgleich)', 
    maxPoints: 2, 
    description: 'Abgleich von Abhol-/Rechnungsadresse oder Empfängerdaten.' 
  },
  { 
    name: 'Kundennutzen ("für Sie")', 
    maxPoints: 1, 
    description: 'Verwendung der Formulierung "für Sie" im Gespräch.' 
  },
  { 
    name: 'Reizwörter vermeiden', 
    maxPoints: 1, 
    description: 'Vermeidung von Wörtern wie "Nein", "müssen", "Problem", "aber".' 
  },
  { 
    name: 'Positives Formulieren', 
    maxPoints: 1, 
    description: 'Sprechen über das, was möglich ist, nicht über das, was nicht geht.' 
  },
  { 
    name: 'Befehlsfreies Formulieren', 
    maxPoints: 1, 
    description: 'Verwendung von Bitten statt Befehlen ("Darf ich Sie bitten..." statt "Sie müssen...").' 
  },
  { 
    name: 'Notwendige Detailfragen', 
    maxPoints: 1, 
    description: 'Gezielte Fragen (z.B. Paketanzahl, Abholzeiten).' 
  },
  { 
    name: 'Jargon & Internas vermeiden', 
    maxPoints: 1, 
    description: 'Verzicht auf Begriffe wie "Ausrollung", stattdessen kundennahe Sprache.' 
  },
  { 
    name: 'Prozesskonformität', 
    maxPoints: 1, 
    description: 'Handeln nach vorgegebenen DPD-Prozessen.' 
  },
  { 
    name: 'Kompetenz & Richtigkeit', 
    maxPoints: 1, 
    description: 'Bereitstellung korrekter und sachlich richtiger Informationen.' 
  },
  { 
    name: 'Lösung anbieten / erklären', 
    maxPoints: 1, 
    description: 'Lösungsweg verständlich für den Kunden erklären.' 
  },
  { 
    name: 'Höfliche Verabschiedung', 
    maxPoints: 1, 
    description: 'Dank für das Gespräch, namentliche Verabschiedung, "Tschüss/Auf Wiederhören".' 
  }
];
