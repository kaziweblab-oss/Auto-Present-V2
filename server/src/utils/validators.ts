export const validateSession = (sessionStr: string | undefined) => {
  if (!sessionStr) return false;
  const regex = /^(\d{4})-(\d{2})$/;
  const match = sessionStr.match(regex);

  if (!match || !match[1] || !match[2]) return false;

  const startYear = parseInt(match[1], 10);
  const endDigits = parseInt(match[2], 10);
  const expectedEndDigits = (startYear + 1) % 100;

  return endDigits === expectedEndDigits;
};
