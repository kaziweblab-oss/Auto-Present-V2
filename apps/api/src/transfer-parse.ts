// Roll/registration extraction from official notice text (pure, tested).
export function extractRolls(text: string): string[] {
  const out = new Set<string>();
  const rollRe = /\b\d{5,7}\b/g;
  let m: RegExpExecArray | null;
  while ((m = rollRe.exec(text)) !== null) out.add(m[0]);
  return [...out];
}

export function extractRegistrations(text: string): string[] {
  const out = new Set<string>();
  const regRe = /\b(?:reg(?:istration)?[\s:.-]*)?(\d{6,12})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regRe.exec(text)) !== null) out.add(m[1]);
  return [...out];
}
