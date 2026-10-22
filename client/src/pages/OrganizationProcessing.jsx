import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest } from "../services/api";

const blankMaterial = () => ({ materialType: "", quantity: "", unit: "kg", condition: "RECYCLABLE" });

const date = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function OrganizationProcessing() {
  const [devices, setDevices] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [materials, setMaterials] = useState([blankMaterial()]);
  const [recoveryRemarks, setRecoveryRemarks] = useState("");
  const [disposal, setDisposal] = useState({
    wasteDescription: "", quantity: "", unit: "kg",
    disposalMethod: "AUTHORIZED_TREATMENT", hazardous: true,
    facilityName: "", disposalDate: "", remarks: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("recovery");
  const recoveryIdempotencyKey = useRef("");
  const disposalIdempotencyKey = useRef("");

  const load = useCallback(async () => {
    try {
      const data = await apiRequest("/organization-portal/inventory");
      const inventory = data.devices || [];
      setDevices(inventory);
      setSelectedId((current) =>
        inventory.some((device) => device.id === current) ? current : inventory[0]?.id || ""
      );
      setError("");
    } catch (err) {
      setError(err.message || "Could not load processing inventory and history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    let active = true;
    const device = devices.find((item) => item.id === selectedId);
    if (device) {
      void Promise.resolve().then(async () => {
        try {
          const [recoveryData, disposalData] = await Promise.all([
            apiRequest(`/devices/${device.id}/material-recovery`),
            apiRequest(`/devices/${device.id}/disposal`),
          ]);
          if (!active) return;
          setRecoveries((recoveryData.recoveries || []).map((record) => ({ ...record, device })));
          setDisposals((disposalData.disposals || []).map((record) => ({ ...record, device })));
        } catch (err) {
          if (active) setError(err.message || "Could not load processing history.");
        }
      });
    }
    return () => { active = false; };
  }, [devices, selectedId]);
  const selected = useMemo(() => devices.find((device) => device.id === selectedId), [devices, selectedId]);
  const selectedEligible = ["UNDER_INSPECTION", "MATERIAL_RECOVERY"].includes(selected?.currentStatus);

  function updateMaterial(index, field, value) {
    recoveryIdempotencyKey.current = "";
    setMaterials((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    ));
  }

  function updateDisposal(field, value) {
    disposalIdempotencyKey.current = "";
    setDisposal((current) => ({ ...current, [field]: value }));
  }

  async function saveRecovery(event) {
    event.preventDefault();
    if (!selected || !selectedEligible || !window.confirm(`Record recovery materials for ${selected.brand} ${selected.model}?`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      recoveryIdempotencyKey.current ||= crypto.randomUUID();
      await apiRequest(`/devices/${selected.id}/material-recovery`, {
        method: "POST",
        headers: { "Idempotency-Key": recoveryIdempotencyKey.current },
        body: JSON.stringify({
          remarks: recoveryRemarks,
          materials: materials.map((item) => ({ ...item, quantity: Number(item.quantity) })),
        }),
      });
      setNotice("Material recovery saved and appended to the lifecycle ledger.");
      setMaterials([blankMaterial()]);
      setRecoveryRemarks("");
      recoveryIdempotencyKey.current = "";
      await load();
    } catch (err) {
      setError(err.message || "Could not record material recovery.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDisposal(event) {
    event.preventDefault();
    if (!selected || !selectedEligible || !window.confirm(`Record this waste stream for ${selected.brand} ${selected.model}?`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      disposalIdempotencyKey.current ||= crypto.randomUUID();
      await apiRequest(`/devices/${selected.id}/disposal`, {
        method: "POST",
        headers: { "Idempotency-Key": disposalIdempotencyKey.current },
        body: JSON.stringify({
          ...disposal,
          quantity: Number(disposal.quantity),
          disposalDate: new Date(disposal.disposalDate).toISOString(),
        }),
      });
      setNotice("Disposal stream saved. Overall device status is unchanged.");
      disposalIdempotencyKey.current = "";
      setDisposal((current) => ({ ...current, wasteDescription: "", quantity: "", facilityName: "", remarks: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Could not record disposal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="org-page">
      <div className="dashboard-intro"><div><h2>Material Recovery And Disposal</h2><p>Record recovered output separately from each remaining waste stream.</p></div><button className="refresh-button" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw size={16} /> Refresh</button></div>
      {error && <div className="error-banner" role="alert"><p>{error}</p><button onClick={load}>Try again</button></div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}
      {loading && !devices.length ? <div className="org-loading">Loading eligible devices...</div> : !devices.length ? (
        <div className="empty-state org-empty-card"><h3>No eligible devices in custody</h3><p>Devices must be received and inspected before their recovery or waste streams can be recorded.</p></div>
      ) : <>
        <section className="org-device-picker">
          <label>Device in custody<select value={selectedId} onChange={(event) => { recoveryIdempotencyKey.current = ""; disposalIdempotencyKey.current = ""; setSelectedId(event.target.value); }}>{devices.map((device) => <option value={device.id} key={device.id}>{device.brand} {device.model} · {device.category?.name} · {device.currentStatus.replaceAll("_", " ")}</option>)}</select></label>
          {selected && <div className="org-selected-device"><span>{selected.category?.name || "Electronic device"}</span><strong>{selected.brand} {selected.model}</strong><small>{selected.id}</small><span className="status-pill">{selected.currentStatus.replaceAll("_", " ")}</span></div>}
        </section>
        <div className="org-tabs" role="tablist" aria-label="Processing modules">
          <button role="tab" aria-selected={tab === "recovery"} className={tab === "recovery" ? "selected" : ""} onClick={() => setTab("recovery")}>Material recovery</button>
          <button role="tab" aria-selected={tab === "disposal"} className={tab === "disposal" ? "selected" : ""} onClick={() => setTab("disposal")}>Waste disposal</button>
          <button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "selected" : ""} onClick={() => setTab("history")}>Processing history</button>
        </div>
        {tab === "recovery" && !selectedEligible && <div className="org-info-note">Recovery and disposal entry is available for devices currently in inspection or material recovery.</div>}
        {tab === "recovery" && selectedEligible && <section className="org-form-card">
          <h3>Start a recovery operation</h3><p>Enter each material as a separate line. The device status remains supplied by the lifecycle API.</p>
          <form onSubmit={saveRecovery}>
            <div className="org-material-list">{materials.map((item, index) => <div className="org-material-row" key={index}>
              <label>Material<input required maxLength={100} placeholder="Copper" value={item.materialType} onChange={(event) => updateMaterial(index, "materialType", event.target.value)} /></label>
              <label>Quantity<input required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateMaterial(index, "quantity", event.target.value)} /></label>
              <label>Unit<select value={item.unit} onChange={(event) => updateMaterial(index, "unit", event.target.value)}><option>kg</option><option>g</option><option>pieces</option><option>litres</option></select></label>
              <label>Condition<select value={item.condition} onChange={(event) => updateMaterial(index, "condition", event.target.value)}><option value="REUSABLE">Reusable</option><option value="RECYCLABLE">Recyclable</option><option value="OTHER">Other</option></select></label>
              {materials.length > 1 && <button type="button" className="icon-action reject" aria-label="Remove material" onClick={() => { recoveryIdempotencyKey.current = ""; setMaterials((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}><Trash2 size={15} /></button>}
            </div>)}</div>
            <button type="button" className="secondary-button" onClick={() => { recoveryIdempotencyKey.current = ""; setMaterials((current) => [...current, blankMaterial()]); }} disabled={materials.length >= 50}><Plus size={15} /> Add material</button>
            <label className="org-standalone-label">Remarks<textarea maxLength={2000} value={recoveryRemarks} onChange={(event) => { recoveryIdempotencyKey.current = ""; setRecoveryRemarks(event.target.value); }} placeholder="Optional notes about dismantling and sorting" /></label>
            <button className="submit-button" disabled={saving}>{saving ? "Saving..." : "Confirm recovery operation"}</button>
          </form>
        </section>}
        {tab === "disposal" && selectedEligible && <section className="org-form-card">
          <h3>Record a waste stream</h3><p>Each waste stream is a separate record. Recording one does not mark the entire device disposed.</p>
          <form className="org-form-grid" onSubmit={saveDisposal}>
            <label className="org-form-full">Waste description<input required maxLength={500} value={disposal.wasteDescription} onChange={(event) => updateDisposal("wasteDescription", event.target.value)} placeholder="Damaged lithium-ion battery" /></label>
            <label>Quantity<input required type="number" min="0.001" step="0.001" value={disposal.quantity} onChange={(event) => updateDisposal("quantity", event.target.value)} /></label>
            <label>Unit<select value={disposal.unit} onChange={(event) => updateDisposal("unit", event.target.value)}><option>kg</option><option>g</option><option>pieces</option><option>litres</option></select></label>
            <label>Disposal method<select value={disposal.disposalMethod} onChange={(event) => updateDisposal("disposalMethod", event.target.value)}><option value="AUTHORIZED_TREATMENT">Authorized treatment</option><option value="RECYCLING">Recycling</option><option value="LANDFILL">Landfill</option><option value="INCINERATION">Incineration</option><option value="OTHER">Other</option></select></label>
            <label className="org-checkbox"><input type="checkbox" checked={disposal.hazardous} onChange={(event) => { disposalIdempotencyKey.current = ""; setDisposal((current) => ({ ...current, hazardous: event.target.checked, disposalMethod: event.target.checked ? "AUTHORIZED_TREATMENT" : current.disposalMethod })); }} /> Hazardous waste</label>
            <label className="org-form-full">Receiving facility{disposal.hazardous ? " (required)" : ""}<input required={disposal.hazardous} maxLength={200} value={disposal.facilityName} onChange={(event) => updateDisposal("facilityName", event.target.value)} placeholder="Authorized treatment facility" /></label>
            <label>Disposal date<input required type="datetime-local" value={disposal.disposalDate} onChange={(event) => updateDisposal("disposalDate", event.target.value)} /></label>
            <label className="org-form-full">Remarks<textarea maxLength={2000} value={disposal.remarks} onChange={(event) => updateDisposal("remarks", event.target.value)} /></label>
            <button className="submit-button" disabled={saving}>{saving ? "Saving..." : "Confirm disposal record"}</button>
          </form>
        </section>}
        {tab === "disposal" && !selectedEligible && <div className="org-info-note">Disposal entry is available for devices currently in inspection or material recovery.</div>}
        {tab === "history" && <section className="org-dashboard-grid">
          <div className="dashboard-section"><h2>Recovery operations</h2>{recoveries.filter((record) => record.deviceId === selectedId).length ? recoveries.filter((record) => record.deviceId === selectedId).map((record) => <article className="org-history-card" key={record.id}><strong>{date(record.recoveredAt)}</strong><p>{record.remarks || "No remarks"}</p><ul>{record.materials.map((material) => <li key={material.id}>{material.material.name} · {Number(material.quantity)} {material.unit} · {material.condition.toLowerCase()}</li>)}</ul></article>) : <p>No recovery operations recorded.</p>}</div>
          <div className="dashboard-section"><h2>Disposal records</h2>{disposals.filter((record) => record.deviceId === selectedId).length ? disposals.filter((record) => record.deviceId === selectedId).map((record) => <article className="org-history-card" key={record.id}><strong>{record.wasteDescription}</strong><p>{Number(record.quantity)} {record.unit} · {record.disposalMethod.replaceAll("_", " ")}</p><p>{record.hazardous ? "Hazardous" : "Non-hazardous"} · {record.facilityName || "No facility supplied"}</p><small>{date(record.disposalDate)}</small></article>) : <p>No disposal records.</p>}</div>
        </section>}
      </>}
    </div>
  );
}
