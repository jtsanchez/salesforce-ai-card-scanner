import { useState, useRef, useCallback } from "react";

const STEPS = ["Scan", "Review", "Upload"];

const SF_MCP_SERVERS = [
  { name: "salesforce-sobject-all", url: "https://api.salesforce.com/platform/mcp/v1/platform/sobject-all" },
];

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round" />
    </svg>
  );
}

export default function BusinessCardScanner() {
  const [step, setStep] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [imageName, setImageName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    title: "",
    company: "",
    phone: "",
    email: "",
  });
  const fileRef = useRef();
  const dragRef = useRef(false);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, etc.)");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Full = e.target.result;
      const base64 = base64Full.split(",")[1];
      const mediaType = file.type;
      setImageData({ base64, mediaType, preview: base64Full });
      setImageName(file.name);
      await extractFields(base64, mediaType);
    };
    reader.readAsDataURL(file);
  }, []);

  const extractFields = async (base64, mediaType) => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text: `Extract these fields from this business card image. Return ONLY a JSON object with these exact keys, no markdown, no backticks, no extra text:
{"firstName": "", "lastName": "", "title": "", "company": "", "phone": "", "email": ""}
If a field is not found, leave it as an empty string. "title" means job title (e.g. CEO, VP of Sales, Director). For phone, include the country code if visible.`,
                },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      const text = data.content?.map((c) => c.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setFields({
        firstName: parsed.firstName || "",
        lastName: parsed.lastName || "",
        title: parsed.title || "",
        company: parsed.company || "",
        phone: parsed.phone || "",
        email: parsed.email || "",
      });
      setStep(1);
    } catch (err) {
      setError("Could not extract fields. Check the image quality and try again.");
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };

  const uploadToSalesforce = async () => {
    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      const companyKeyword = fields.company.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/).slice(0, 2).join(" ");
      const prompt = `Sync a Contact to Salesforce with these details:
- First Name: ${fields.firstName}
- Last Name: ${fields.lastName}
- Title: ${fields.title}
- Account (Company): ${fields.company}
- Phone: ${fields.phone}
- Email: ${fields.email}

IMPORTANT — follow these steps in order:

1. FUZZY ACCOUNT SEARCH: Use the "find" tool (SOSL) to search for Accounts matching "${companyKeyword}". This handles typos, abbreviations, and case differences. If SOSL returns nothing, use SOQL: SELECT Id, Name FROM Account WHERE Name LIKE '%${companyKeyword}%' LIMIT 5

2. MATCH DECISION: If one or more Accounts come back, pick the one whose name is closest to "${fields.company}" and use its Id.

3. NO MATCH: If nothing comes back, create a new Account named "${fields.company}".

4. CHECK FOR EXISTING CONTACT: Before creating, search for an existing Contact: SELECT Id, FirstName, LastName, Title, Phone, Email FROM Contact WHERE FirstName = '${fields.firstName}' AND LastName = '${fields.lastName}' AND AccountId = '<AccountId from step 2 or 3>' LIMIT 1

5a. IF CONTACT EXISTS: Update the existing Contact with any fields that have changed or are missing (Title, Phone, Email). Use the update tool with the existing Contact Id.

5b. IF NO EXISTING CONTACT: Create a new Contact linked to the AccountId from step 2 or 3. If you get a DUPLICATES_DETECTED error, check the duplicate's AccountId. If it matches the same Account, update that existing Contact. If it's a DIFFERENT Account, this is a different person who happens to share the same name — retry the create with the duplicate rule allowed (the error response includes "allowSave": true, so re-create with the header "Sforce-Auto-Assign: FALSE" or pass the duplicate rule header to force save).

Return whether the Contact was CREATED or UPDATED, the Contact Id, and the Account name used.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
          mcp_servers: SF_MCP_SERVERS.map((s) => ({
            type: "url",
            url: s.url,
            name: s.name.toLowerCase().replace(/\s+/g, "-"),
          })),
        }),
      });
      const data = await res.json();
      const textParts = data.content?.filter((c) => c.type === "text").map((c) => c.text) || [];
      const toolResults = data.content?.filter((c) => c.type === "mcp_tool_result").map((c) => c.content?.[0]?.text || JSON.stringify(c.content)) || [];
      
      const fullResponse = [...textParts, ...toolResults].join("\n");
      
      if (fullResponse) {
        setUploadResult({ success: true, message: fullResponse });
        setStep(2);
      } else {
        setUploadResult({ success: false, message: "No response received from Salesforce. Check your MCP connection." });
        setStep(2);
      }
    } catch (err) {
      setUploadResult({ success: false, message: err.message });
      setStep(2);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setImageData(null);
    setImageName("");
    setFields({ firstName: "", lastName: "", title: "", company: "", phone: "", email: "" });
    setUploadResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragRef.current = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const fieldLabels = [
    { key: "firstName", label: "First Name", icon: "👤" },
    { key: "lastName", label: "Last Name", icon: "👤" },
    { key: "title", label: "Title", icon: "💼" },
    { key: "company", label: "Company", icon: "🏢" },
    { key: "phone", label: "Phone", icon: "📞" },
    { key: "email", label: "Email", icon: "✉️" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: "#e2e8f0",
      padding: "32px 16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            marginBottom: 16, fontSize: 26,
          }}>📇</div>
          <h1 style={{
            fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>CardSync</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "6px 0 0", fontWeight: 500 }}>
            Scan a business card → push to Salesforce
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
                  background: i <= step ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "#1e293b",
                  border: i <= step ? "none" : "1.5px solid #334155",
                  color: i <= step ? "#fff" : "#475569",
                  transition: "all 0.3s",
                }}>{i < step ? "✓" : i + 1}</div>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: i <= step ? "#e2e8f0" : "#475569",
                  transition: "color 0.3s",
                }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 40, height: 1.5, margin: "0 12px",
                  background: i < step ? "#3b82f6" : "#334155",
                  borderRadius: 1, transition: "background 0.3s",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: "#1e293b", borderRadius: 20,
          border: "1px solid #334155", overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
          animation: "fadeUp 0.4s ease-out",
        }}>
          {/* Step 0: Upload */}
          {step === 0 && !extracting && (
            <div style={{ padding: 32 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); dragRef.current = true; }}
                onDragLeave={() => { dragRef.current = false; }}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed #334155", borderRadius: 16, padding: "48px 24px",
                  textAlign: "center", cursor: "pointer",
                  background: imageData ? "none" : "#0f172a",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#0f172a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.background = imageData ? "none" : "#0f172a"; }}
              >
                {imageData ? (
                  <img src={imageData.preview} alt="Card" style={{
                    maxWidth: "100%", maxHeight: 220, borderRadius: 10, objectFit: "contain",
                  }} />
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>📷</div>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "#e2e8f0" }}>
                      Drop a business card image here
                    </p>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                      or tap to browse — PNG, JPG, HEIC
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* Extracting state */}
          {extracting && (
            <div style={{ padding: "64px 32px", textAlign: "center" }}>
              {imageData && (
                <img src={imageData.preview} alt="Scanning" style={{
                  maxWidth: "80%", maxHeight: 160, borderRadius: 10, objectFit: "contain",
                  marginBottom: 24, opacity: 0.6, animation: "pulse 1.5s ease-in-out infinite",
                }} />
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#94a3b8" }}>
                <Spinner />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Reading card with AI…</span>
              </div>
            </div>
          )}

          {/* Step 1: Review */}
          {step === 1 && (
            <div style={{ animation: "fadeUp 0.35s ease-out" }}>
              {imageData && (
                <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "center" }}>
                  <img src={imageData.preview} alt="Scanned" style={{
                    maxWidth: "100%", maxHeight: 140, borderRadius: 10, objectFit: "contain", opacity: 0.85,
                  }} />
                </div>
              )}
              <div style={{ padding: "20px 24px 28px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verify extracted fields
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {fieldLabels.map(({ key, label, icon }) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 5 }}>
                        {icon} {label}
                      </label>
                      <input
                        type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                        value={fields[key]}
                        onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        style={{
                          width: "100%", boxSizing: "border-box", padding: "10px 14px",
                          background: "#0f172a", border: "1.5px solid #334155", borderRadius: 10,
                          color: "#e2e8f0", fontSize: 14, fontFamily: "inherit",
                          outline: "none", transition: "border-color 0.2s",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#334155"; }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={reset} style={{
                    flex: 1, padding: "12px 0", borderRadius: 10, border: "1.5px solid #334155",
                    background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Rescan</button>
                  <button
                    onClick={uploadToSalesforce}
                    disabled={uploading || !fields.lastName}
                    style={{
                      flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
                      background: !fields.lastName ? "#334155" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      color: "#fff", fontSize: 14, fontWeight: 600, cursor: fields.lastName ? "pointer" : "not-allowed",
                      fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: uploading ? 0.7 : 1,
                    }}
                  >
                    {uploading ? <><Spinner /> Pushing to Salesforce…</> : "Push to Salesforce ☁️"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Result */}
          {step === 2 && (
            <div style={{ padding: "40px 28px", textAlign: "center", animation: "fadeUp 0.35s ease-out" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", margin: "0 auto 18px",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                background: uploadResult?.success
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #ef4444, #dc2626)",
              }}>
                {uploadResult?.success ? "✓" : "✕"}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
                {uploadResult?.success ? "Contact synced" : "Upload issue"}
              </h2>
              <div style={{
                fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 20,
                maxHeight: 180, overflowY: "auto", textAlign: "left",
                background: "#0f172a", borderRadius: 10, padding: 16,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {uploadResult?.message}
              </div>

              {/* Summary card */}
              <div style={{
                background: "#0f172a", borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 20,
                border: "1px solid #334155",
              }}>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", fontWeight: 600 }}>CONTACT DETAILS</p>
                {fieldLabels.map(({ key, label }) => fields[key] && (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1e293b" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{fields[key]}</span>
                  </div>
                ))}
              </div>

              <button onClick={reset} style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                Scan another card
              </button>
            </div>
          )}
        </div>

        {/* Error toast */}
        {error && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 12,
            background: "#7f1d1d", border: "1px solid #991b1b",
            fontSize: 13, color: "#fca5a5", textAlign: "center",
            animation: "fadeUp 0.3s ease-out",
          }}>
            {error}
          </div>
        )}

        {/* Footer info */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 24, lineHeight: 1.6 }}>
          Powered by Claude AI · Syncs to Salesforce via MCP
        </p>
      </div>
    </div>
  );
}
