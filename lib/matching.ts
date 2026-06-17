import type { JobAnalysis } from "@/lib/jd-analysis";
import { proofPoints, type ProofPoint } from "@/lib/persona";

function scoreProofPoint(proofPoint: ProofPoint, analysis: JobAnalysis) {
  const searchable = [
    analysis.roleSummary,
    analysis.roleType,
    analysis.seniority,
    ...analysis.companyPriorities,
    ...analysis.technicalRequirements,
    ...analysis.businessGoals,
    ...analysis.likelyPainPoints,
    ...analysis.keywordsToMirror,
  ]
    .join(" ")
    .toLowerCase();

  return proofPoint.keywords.reduce((score, keyword) => {
    return searchable.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
}

export function selectProofPoints(analysis: JobAnalysis, max = 4) {
  const ranked = proofPoints
    .map((proofPoint) => ({
      ...proofPoint,
      score: scoreProofPoint(proofPoint, analysis),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.filter((item) => item.score > 0).slice(0, max);

  if (selected.length >= 2) return selected;

  return ranked.slice(0, max);
}
