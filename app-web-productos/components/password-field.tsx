"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import {
  PASSWORD_RULES,
  getMissingPasswordRules,
} from "../lib/auth/password";

type PasswordFieldProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  showRules?: boolean;
};

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
  required = true,
  autoComplete,
  showRules = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const missingRuleIds = new Set(
    getMissingPasswordRules(value).map((rule) => rule.id)
  );

  return (
    <div>
      <label htmlFor={id} className="mb-2 block small-label">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          autoComplete={autoComplete}
          className="app-input pr-14"
          placeholder={placeholder}
        />

        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-xl p-2 text-[var(--muted)] transition hover:bg-white"
          aria-label={visible ? "Ocultar contrasena" : "Ver contrasena"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {showRules && (
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
          {PASSWORD_RULES.map((rule) => {
            const passed = value.length > 0 && !missingRuleIds.has(rule.id);

            return (
              <div
                key={rule.id}
                className={`rounded-xl px-3 py-2 ${
                  passed ? "bg-emerald-50 text-emerald-700" : "bg-[#eef2f7]"
                }`}
              >
                {passed ? "✓" : "•"} {rule.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
