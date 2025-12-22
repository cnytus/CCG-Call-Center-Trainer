import { CallScenarioPreset } from '../types';
import { DPD_STANDARD_INBOUND_CRITERIA } from './dpd_criteria';

export const TRAINING_PRESETS: CallScenarioPreset[] = [
  {
    id: 'scenario-dpd-standard',
    title: 'DPD Standard: Status & Pickup',
    client: 'DPD',
    description: 'Official DPD Inbound training based on real transcripts (Status inquiries and Pickup issues).',
    icon: '📦',
    context: `
      CUSTOMER PERSONA: Can be one of the following based on random choice:
      1. Frau Gärtner: Inquiry about a "Verladefehler" (loading error) for packet 0132... Oldenburg.
      2. M Textilservice: Inquiry about two packets delayed in a "Verteilerdepot" (distribution center).
      3. Herr Schafte (Tamascha, Hamburg): Complaint about a missed pickup. Very frustrated as it happened twice last week.
      
      BEHAVIOR: You are a regular business or private customer. You expect professional handling, address verification, and clear solutions.
    `,
    criteria: DPD_STANDARD_INBOUND_CRITERIA
  },
  {
    id: 'scenario 1',
    title: 'Billing & Overcharge Dispute',
    client: 'EcoStream Utilities',
    description: 'A customer noticed a double-charge on their bank statement for the last month.',
    icon: '💳',
    context: `
      CUSTOMER PERSONA: Alex Rivera.
      ACCOUNT NO: UT-88219.
      PROBLEM: You were charged $145.00 twice on the 1st of the month. 
      You are moderately annoyed because you have an automatic mortgage payment coming up and need the funds released.
      BEHAVIOR: You want a refund timeline and a confirmation email. If the agent offers "credit for next month", you should reject it and insist on a cash refund.
    `,
    criteria: [
      { id: 'c1', name: 'Professional Greeting', maxPoints: 10, description: 'Used proper brand name and identified self.' },
      { id: 'c2', name: 'Identity Verification', maxPoints: 10, description: 'Asked for Account Number and verified name.' },
      { id: 'c3', name: 'Empathy & Apology', maxPoints: 20, description: 'Acknowledged the inconvenience of double-billing.' },
      { id: 'c4', name: 'Resolution Logic', maxPoints: 40, description: 'Correctly identified the refund process vs credit.' },
      { id: 'c5', name: 'Call Closing', maxPoints: 20, description: 'Summarized the action and confirmed contact info.' }
    ]
  },
  {
    id: 'scenario 2',
    title: 'Technical Support (Login Failure)',
    client: 'CloudWare CRM',
    description: 'A business user is locked out of their account during an important sales meeting.',
    icon: '🔐',
    context: `
      CUSTOMER PERSONA: Jordan Smith.
      COMPANY: Zenith Sales.
      PROBLEM: You are getting a "User Not Found" error even though you have used this email (jordan@zenith.com) for 2 years.
      BEHAVIOR: You are in a RUSH. You are literally in a meeting and need to show a demo. 
      You might get impatient if the agent is too slow with standard "have you cleared your cache" questions.
    `,
    criteria: [
      { id: 's2-1', name: 'Urgency Management', maxPoints: 20, description: 'Recognized the customer is in a meeting.' },
      { id: 's2-2', name: 'Troubleshooting Efficiency', maxPoints: 30, description: 'Avoided redundant basic questions.' },
      { id: 's2-3', name: 'Tone Consistency', maxPoints: 20, description: 'Stayed calm under pressure.' },
      { id: 's2-4', name: 'Next Steps', maxPoints: 30, description: 'Provided a clear path if instant fix fails.' }
    ]
  },
  {
    id: 'scenario 3',
    title: 'Product Complaint (Damaged Item)',
    client: 'LuxHome Decor',
    description: 'A high-end crystal vase arrived shattered in the box.',
    icon: '📦',
    context: `
      CUSTOMER PERSONA: Mrs. Sterling.
      ORDER NO: LX-99120.
      PROBLEM: You ordered the "Arctic Bloom" Crystal Vase ($450). It arrived yesterday, but when you opened it, it was in pieces. 
      BEHAVIOR: You are very disappointed. This was a gift for a wedding tomorrow. 
      You want a replacement sent via NEXT DAY delivery, not standard shipping.
    `,
    criteria: [
      { id: 's3-1', name: 'Active Listening', maxPoints: 20, description: 'Let the customer finish describing the damage.' },
      { id: 's3-2', name: 'Ownership', maxPoints: 20, description: 'Took responsibility for the poor packaging.' },
      { id: 's3-3', name: 'Policy Execution', maxPoints: 40, description: 'Handled the replacement request and shipping upgrade.' },
      { id: 's3-4', name: 'Closing Confirmation', maxPoints: 20, description: 'Confirmed the new tracking info would be sent.' }
    ]
  },
  {
    id: 'scenario 4',
    title: 'Cargo & Logistics Inquiry',
    client: 'SwiftLink Express',
    description: 'A general inquiry about sending cargo, checking prices, or tracking a shipment.',
    icon: '🚛',
    context: `
      CUSTOMER PERSONA: A small business owner or private individual.
      PROBLEM: You need help with a cargo-related task. This could be:
      1. Asking for a price quote for a heavy pallet (e.g., 500kg of machinery) from Berlin to New York.
      2. Tracking a delayed shipment of electronics that was supposed to arrive two days ago.
      3. Inquiring about customs documentation for an international shipment.
      BEHAVIOR: Be curious but firm. If the price is too high, ask for a "economy" option. If the package is late, demand an explanation.
    `,
    criteria: [
      { id: 's4-1', name: 'Accuracy of Information', maxPoints: 30, description: 'Provided correct shipping types or quote logic.' },
      { id: 's4-2', name: 'Product Knowledge', maxPoints: 20, description: 'Explained weight/dimension limits or customs basics.' },
      { id: 's4-3', name: 'Customer Service Skills', maxPoints: 20, description: 'Maintained a helpful and professional tone.' },
      { id: 's4-4', name: 'Follow-up / Call Wrap', maxPoints: 30, description: 'Confirmed tracking number or sent quote email.' }
    ]
  },
  {
    id: 'scenario 5',
    title: 'Urgent Cargo Pickup Arrangement',
    client: 'Titan Logistics',
    description: 'A customer needs to arrange an immediate pickup for high-value machinery parts.',
    icon: '🏗️',
    context: `
      CUSTOMER PERSONA: Mr. Henderson from 'Tech Parts Inc'.
      PICKUP ADDRESS: 124 Industrial Way, Block B, Warehouse 4.
      PACKAGE DETAILS: 5 large crates, total weight approximately 450kg.
      REQUIREMENT: Must be picked up by 4:00 PM today for overnight shipping.
      BEHAVIOR: You are professional but very firm on the deadline. You specifically need confirmation that the truck will have a lift gate because you don't have a loading dock at this site.
    `,
    criteria: [
      { id: 's5-1', name: 'Logistics Accuracy', maxPoints: 25, description: 'Verified address and confirmed package dimensions/weight.' },
      { id: 's5-2', name: 'Special Equipment Handling', maxPoints: 25, description: 'Identified and confirmed the need for a lift gate.' },
      { id: 's5-3', name: 'Deadline Commitment', maxPoints: 25, description: 'Clearly addressed the 4:00 PM deadline and confirmed feasibility.' },
      { id: 's5-4', name: 'Tone & Professionalism', maxPoints: 25, description: 'Maintained authority while being helpful to a stressed customer.' }
    ]
  }
];
