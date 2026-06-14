export function scoreColor(score) {
  // red (high urgency) → amber → green (low urgency)
  if (score >= 50) return [216, 54, 42];     // red  (#d8362a)
  if (score >= 35) return [224, 138, 22];    // amber (#e08a16)
  return [47, 158, 84];                       // green (#2f9e54)
}

export function scoreLabel(score) {
  if (score >= 50) return "High Priority";
  if (score >= 35) return "Medium Priority";
  return "Low Priority";
}

export function scoreClass(score) {
  if (score >= 50) return "high";
  if (score >= 35) return "medium";
  return "low";
}
