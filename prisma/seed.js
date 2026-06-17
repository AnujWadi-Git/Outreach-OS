const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ownerEmail = process.env.OWNER_EMAIL || "awadi@asu.edu";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: "Anuj Wadi" },
    create: {
      email: ownerEmail,
      name: "Anuj Wadi",
      role: "OWNER",
    },
  });

  const existing = await prisma.campaign.findFirst({
    where: { userId: user.id, name: "Demo AI Systems Recruiter Outreach" },
  });

  if (existing) {
    console.log("Seed data already exists.");
    return;
  }

  const rawJobDescription = `Senior AI Engineer
Company: Northstar Robotics

We are building LLM-powered workflow automation for field robotics operations. The team needs someone who can design RAG systems, agentic orchestration, backend APIs, and production deployment workflows. Experience with computer vision, Python, FastAPI, cloud systems, and product-minded iteration is strongly preferred.`;

  const rawContacts = `Maya Chen <maya.chen@northstarrobotics.example>
Lead Technical Recruiter
Northstar Robotics

Jordan Patel jordan.patel@northstarrobotics.example, Talent Partner, Northstar Robotics`;

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      name: "Demo AI Systems Recruiter Outreach",
      mode: "DRAFT",
      status: "GENERATED",
      rawJobDescription,
      rawContacts,
      parsedContacts: {
        count: 2,
        validCount: 2,
        invalidCount: 0,
      },
      generatedContent: {
        fixedFormat: [
          "Recipient",
          "Subject line options",
          "Main email",
          "Follow-up email",
          "Hook summary",
          "Status",
        ],
      },
      jobDescription: {
        create: {
          rawText: rawJobDescription,
          companyName: "Northstar Robotics",
          roleType: "AI Engineer",
          seniority: "Senior",
          analysis: {
            roleSummary:
              "Senior AI engineer for LLM-powered automation in robotics operations.",
            keySkills: ["LLM apps", "RAG", "agents", "FastAPI", "computer vision"],
            painPoints: [
              "moving AI prototypes into reliable production workflows",
              "connecting robotics context with business automation needs",
            ],
            businessOutcomes: [
              "faster field operations",
              "more reliable knowledge retrieval",
            ],
          },
        },
      },
      contacts: {
        create: [
          {
            fullName: "Maya Chen",
            email: "maya.chen@northstarrobotics.example",
            title: "Lead Technical Recruiter",
            company: "Northstar Robotics",
            sourceText:
              "Maya Chen <maya.chen@northstarrobotics.example> Lead Technical Recruiter Northstar Robotics",
            confidence: 0.95,
            isValid: true,
            status: "GENERATED",
            generatedContent: {
              subjectLineOptions: [
                "AI systems builder for Northstar Robotics",
                "RAG, agents, and robotics workflow automation",
                "Interest in Senior AI Engineer role",
              ],
            },
          },
          {
            fullName: "Jordan Patel",
            email: "jordan.patel@northstarrobotics.example",
            title: "Talent Partner",
            company: "Northstar Robotics",
            sourceText:
              "Jordan Patel jordan.patel@northstarrobotics.example, Talent Partner, Northstar Robotics",
            confidence: 0.9,
            isValid: true,
            status: "GENERATED",
            generatedContent: {
              subjectLineOptions: [
                "AI systems builder for Northstar Robotics",
                "Robotics + LLM workflow automation background",
                "Senior AI Engineer outreach",
              ],
            },
          },
        ],
      },
    },
    include: { contacts: true },
  });

  await Promise.all(
    campaign.contacts.map((contact, index) =>
      prisma.draft.create({
        data: {
          campaignId: campaign.id,
          contactId: contact.id,
          recipient: contact.email,
          subjectOptions: [
            "AI systems builder for Northstar Robotics",
            "RAG, agents, and robotics workflow automation",
            "Interest in Senior AI Engineer role",
          ],
          selectedSubject:
            index === 0
              ? "AI systems builder for Northstar Robotics"
              : "Robotics + LLM workflow automation background",
          body: `Hi ${contact.fullName?.split(" ")[0] || "there"},

I came across Northstar Robotics' Senior AI Engineer role and wanted to reach out directly. My background sits right at the intersection of LLM applications, backend systems, robotics, and workflow automation, which seems closely aligned with the work your team is doing around field operations.

I am finishing my MS in Robotics and Autonomous Systems at Arizona State University, with a focus on AI, and have been building systems across RAG, agents, FastAPI backends, computer vision, and cloud deployment. What stood out to me is the practical production angle: not just exploring AI, but turning it into reliable workflows that help teams move faster.

I attached my resume for context. If this role is still active, I would be glad to share how my AI systems and automation experience could be useful for Northstar's team.

Best,
Anuj Wadi`,
          followUp: `Hi ${contact.fullName?.split(" ")[0] || "there"},

Just wanted to follow up on my note about the Senior AI Engineer role at Northstar Robotics. The blend of LLM systems, robotics workflows, and production backend work is very aligned with the kind of AI systems I have been building.

Happy to send more context or speak if the team is still reviewing candidates.

Best,
Anuj`,
          hookSummary:
            "Connects Anuj's robotics AI background with Northstar's need for production LLM automation in field operations.",
          confidence: 0.88,
          reasons: [
            "Matches LLM applications and RAG requirements",
            "Connects robotics degree with company domain",
            "Emphasizes production workflow automation",
          ],
          status: "GENERATED",
        },
      })
    )
  );

  console.log("Seeded Outreach OS demo data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
