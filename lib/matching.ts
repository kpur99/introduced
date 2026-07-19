// ============================================================
// Compatibility scoring
//
// Philosophy: dealbreakers are hard filters (fail = 0, excluded entirely).
// Everything else is a weighted soft score from 0-100. Tune WEIGHTS as
// you learn which categories actually predict good matches.
// ============================================================

export type IntakeProfile = {
  user_id: string;
  relationship_goal: string;
  timeline: string;
  values: Record<string, string>;
  lifestyle: Record<string, string>;
  personality: Record<string, string>;
  interests: string[];
  dealbreakers: Record<string, boolean | string>;
};

const WEIGHTS = {
  relationship_goal: 25, // wanting the same thing out of this matters most
  values: 25,
  lifestyle: 25,
  personality: 15,
  interests: 10,
};

export type ScoreResult = {
  score: number; // 0-100, or 0 if hard-filtered
  breakdown: Record<string, { score: number; note: string }>;
  hardFiltered: boolean;
  hardFilterReason?: string;
};

function textSimilarity(a?: string, b?: string): number {
  if (!a || !b || a === "unknown" || b === "unknown") return 0.5; // neutral if unknown
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0.3;
}

function jaccard(a: string[] = [], b: string[] = []): number {
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  if (setA.size === 0 || setB.size === 0) return 0.5;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function checkDealbreakers(
  a: IntakeProfile,
  b: IntakeProfile
): { violated: boolean; reason?: string } {
  // Example hard filters — expand as your dealbreaker vocabulary grows.
  if (a.dealbreakers?.must_want_kids && b.lifestyle?.kids_wanted === "no") {
    return { violated: true, reason: "A requires wanting kids; B doesn't want kids" };
  }
  if (b.dealbreakers?.must_want_kids && a.lifestyle?.kids_wanted === "no") {
    return { violated: true, reason: "B requires wanting kids; A doesn't want kids" };
  }
  if (a.dealbreakers?.no_smokers && b.lifestyle?.smoking === "yes") {
    return { violated: true, reason: "A won't date smokers; B smokes" };
  }
  if (b.dealbreakers?.no_smokers && a.lifestyle?.smoking === "yes") {
    return { violated: true, reason: "B won't date smokers; A smokes" };
  }
  return { violated: false };
}

export function scoreCompatibility(a: IntakeProfile, b: IntakeProfile): ScoreResult {
  const dealbreakerCheck = checkDealbreakers(a, b);
  if (dealbreakerCheck.violated) {
    return { score: 0, breakdown: {}, hardFiltered: true, hardFilterReason: dealbreakerCheck.reason };
  }

  const breakdown: Record<string, { score: number; note: string }> = {};

  const goalScore = textSimilarity(a.relationship_goal, b.relationship_goal) * 100;
  breakdown.relationship_goal = { score: goalScore, note: `${a.relationship_goal} vs ${b.relationship_goal}` };

  const valueKeys = new Set([...Object.keys(a.values ?? {}), ...Object.keys(b.values ?? {})]);
  const valueScores = [...valueKeys].map((k) => textSimilarity(a.values?.[k], b.values?.[k]));
  const valuesScore = valueScores.length
    ? (valueScores.reduce((s, v) => s + v, 0) / valueScores.length) * 100
    : 50;
  breakdown.values = { score: valuesScore, note: `Compared ${valueKeys.size} value dimensions` };

  const lifestyleKeys = new Set([...Object.keys(a.lifestyle ?? {}), ...Object.keys(b.lifestyle ?? {})]);
  const lifestyleScores = [...lifestyleKeys].map((k) => textSimilarity(a.lifestyle?.[k], b.lifestyle?.[k]));
  const lifestyleScore = lifestyleScores.length
    ? (lifestyleScores.reduce((s, v) => s + v, 0) / lifestyleScores.length) * 100
    : 50;
  breakdown.lifestyle = { score: lifestyleScore, note: `Compared ${lifestyleKeys.size} lifestyle dimensions` };

  const personalityKeys = new Set([...Object.keys(a.personality ?? {}), ...Object.keys(b.personality ?? {})]);
  const personalityScores = [...personalityKeys].map((k) => textSimilarity(a.personality?.[k], b.personality?.[k]));
  const personalityScore = personalityScores.length
    ? (personalityScores.reduce((s, v) => s + v, 0) / personalityScores.length) * 100
    : 50;
  breakdown.personality = { score: personalityScore, note: `Compared ${personalityKeys.size} personality traits` };

  const interestsScore = jaccard(a.interests, b.interests) * 100;
  breakdown.interests = { score: interestsScore, note: `Shared interests overlap` };

  const totalWeight = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  const weightedScore =
    (goalScore * WEIGHTS.relationship_goal +
      valuesScore * WEIGHTS.values +
      lifestyleScore * WEIGHTS.lifestyle +
      personalityScore * WEIGHTS.personality +
      interestsScore * WEIGHTS.interests) /
    totalWeight;

  return {
    score: Math.round(weightedScore),
    breakdown,
    hardFiltered: false,
  };
}
