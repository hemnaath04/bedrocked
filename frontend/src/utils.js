export function scoreColor(score) {
  // red (high urgency) → amber → green (low urgency)
  if (score >= 50) return [239, 68, 68];    // red
  if (score >= 35) return [245, 158, 11];   // amber
  return [34, 197, 94];                      // green
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
