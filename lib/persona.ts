export const candidateProfile = {
  name: "Anuj Wadi",
  location: "Tempe, Arizona",
  education:
    "MS Robotics & Autonomous Systems (AI), Arizona State University, May 2026",
  workAuthorization: "F-1 STEM OPT EAD",
  portfolio: "anujwadi.com",
  linkedIn: "linkedin.com/in/anujwadi",
  email: "awadi@asu.edu",
  phone: "+1 (707) 977-0567",
  positioning: [
    "AI Engineer",
    "Software Engineer",
    "AI Systems Builder",
    "Full-Stack AI Developer",
    "Automation-Focused Engineer",
    "Product-Minded Builder",
  ],
  coreTechnicalAreas: [
    "LLM applications",
    "RAG systems",
    "AI agents",
    "Multimodal AI",
    "FastAPI",
    "Backend systems",
    "APIs",
    "Cloud deployment",
    "Workflow automation",
    "Machine learning",
    "Computer vision",
    "Robotics",
  ],
};

export const outreachStyleRules = [
  "Warm and direct",
  "Professionally conversational",
  "Human sounding",
  "Genuine interest",
  "Practical impact focused",
  "Confident but not arrogant",
  "Paragraph-based",
  "Concise",
  "Usually 150-220 words",
  "No obvious AI tone",
  "No startup-bro wording",
  "No bullet-heavy email body",
  "No fake enthusiasm",
  "No generic template language",
];

export const fixedOutputSections = [
  "Recipient",
  "Subject line options",
  "Main email",
  "Follow-up email",
  "Hook summary",
  "Status",
];

export type ProofPoint = {
  id: string;
  label: string;
  detail: string;
  keywords: string[];
};

export const proofPoints: ProofPoint[] = [
  {
    id: "llm-rag-agents",
    label: "LLM applications, RAG, and agents",
    detail:
      "Builds applied LLM systems that connect retrieval, reasoning, APIs, and workflow automation into usable products.",
    keywords: [
      "llm",
      "language model",
      "rag",
      "retrieval",
      "agent",
      "agents",
      "generative ai",
      "prompt",
      "automation",
    ],
  },
  {
    id: "backend-apis",
    label: "FastAPI and backend systems",
    detail:
      "Comfortable turning AI workflows into reliable backend services, API layers, and deployable systems.",
    keywords: [
      "fastapi",
      "backend",
      "api",
      "apis",
      "python",
      "service",
      "microservice",
      "cloud",
      "deployment",
    ],
  },
  {
    id: "robotics-ai",
    label: "Robotics and autonomous systems AI",
    detail:
      "Graduate training in robotics and autonomous systems with an AI focus, useful for roles that combine perception, autonomy, and applied ML.",
    keywords: [
      "robotics",
      "autonomous",
      "computer vision",
      "perception",
      "sensor",
      "planning",
      "ml",
      "machine learning",
    ],
  },
  {
    id: "multimodal-ai",
    label: "Multimodal AI and computer vision",
    detail:
      "Can work across text, image, and vision-heavy AI problems where models need to interpret real-world context.",
    keywords: [
      "multimodal",
      "vision",
      "image",
      "computer vision",
      "opencv",
      "video",
      "perception",
    ],
  },
  {
    id: "product-minded-builder",
    label: "Product-minded builder",
    detail:
      "Focuses on practical impact, fast iteration, and turning technical capability into tools people can actually use.",
    keywords: [
      "product",
      "user",
      "customer",
      "workflow",
      "business",
      "impact",
      "automation",
      "prototype",
    ],
  },
];
