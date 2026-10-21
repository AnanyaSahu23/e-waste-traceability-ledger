import { Building2, UserRound } from "lucide-react";

export default function AccountTypeSwitch({ value, onChange }) {
  return (
    <div className="account-type-switch" role="group" aria-label="Account type">
      <button
        type="button"
        className={value === "individual" ? "selected" : ""}
        aria-pressed={value === "individual"}
        onClick={() => onChange("individual")}
      >
        <UserRound size={16} />
        Individual
      </button>
      <button
        type="button"
        className={value === "organization" ? "selected" : ""}
        aria-pressed={value === "organization"}
        onClick={() => onChange("organization")}
      >
        <Building2 size={16} />
        Organization
      </button>
    </div>
  );
}
