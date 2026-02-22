const validationPatterns = [
  /not authenticated/i,
  /unauthoriz/i,
  /must be between/i,
  /is required/i,
  /invalid format/i,
  /cannot bid on own/i,
  /kyc required/i,
  /^only .* can be/i,
  /not found/i,
];

export function shouldReportError(error: Error): boolean {
  const msg = (error.message || "").toLowerCase();
  for (const p of validationPatterns) {
    if (p.test(msg)) return false;
  }
  return true;
}

export function classifyError(error: Error): "validation" | "unexpected" {
  return shouldReportError(error) ? "unexpected" : "validation";
}
