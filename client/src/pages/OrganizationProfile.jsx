import { useOutletContext } from "react-router-dom";
import { Building2, Mail, ShieldCheck } from "lucide-react";

export default function OrganizationProfile() {
  const { organization } = useOutletContext();
  return (
    <div className="org-page">
      <div className="dashboard-intro"><div><h2>Organisation Profile</h2><p>Verified organisation information attached to your signed-in account.</p></div></div>
      <section className="org-profile-card">
        <div className="org-profile-icon"><Building2 size={25} /></div>
        <p className="eyebrow">ORGANISATION</p>
        <h2>{organization.name}</h2>
        <span className="org-type-pill">{organization.type.replaceAll("_", " ")}</span>
        <dl className="org-detail-list">
          <dt>Organisation ID</dt><dd>{organization.id}</dd>
          <dt>License / registration</dt><dd>{organization.licenseNumber}</dd>
          <dt>Contact email</dt><dd><Mail size={14} /> {organization.contactEmail}</dd>
        </dl>
        <div className="org-info-note"><ShieldCheck size={17} /> Profile editing and team permissions are not available in the current backend; this page is read-only.</div>
      </section>
    </div>
  );
}
