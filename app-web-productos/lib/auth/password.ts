export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "Minimo 8 caracteres",
    test: (password) => password.length >= 8,
  },
  {
    id: "lowercase",
    label: "Una letra minuscula",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "Una letra mayuscula",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "Un numero",
    test: (password) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "Un simbolo",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getMissingPasswordRules(password: string) {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

export function isStrongPassword(password: string) {
  return getMissingPasswordRules(password).length === 0;
}

export function getPasswordHelpMessage(password: string) {
  const missingRules = getMissingPasswordRules(password);

  if (missingRules.length === 0) {
    return "";
  }

  return `La contrasena debe incluir: ${missingRules
    .map((rule) => rule.label.toLowerCase())
    .join(", ")}.`;
}
