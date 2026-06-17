import { prisma } from "@/lib/prisma";

export async function getCampaignExport(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      resume: true,
      jobDescription: true,
      contacts: {
        include: { draft: true },
        orderBy: { createdAt: "asc" },
      },
      generationLogs: { orderBy: { createdAt: "desc" } },
      deliveryLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!campaign) throw new Error("Campaign not found.");

  return campaign;
}
