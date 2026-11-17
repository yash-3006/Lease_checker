const PROMPT = `You are a careful tenant-side reviewer of residential rental leases. Read the attached lease and identify risks for the tenant: unusual or one-sided clauses, hidden or excessive fees, deposit terms, auto-renewal, early termination penalties, rent increase terms, landlord entry rights, maintenance/repair burdens shifted to tenant, liability waivers, subletting limits, eviction/notice terms, utilities, and missing protections.

Respond with ONLY valid JSON in exactly this shape:
{"overall_risk":"low|medium|high","summary":"2-3 sentence plain-English summary",
"key_terms":{"monthly_rent":"","security_deposit":"","lease_term":"","notice_to_vacate":"","late_fee":""},
"flags":[{"severity":"high|medium|low","title":"short title","clause":"short verbatim excerpt under 25 words, or empty","why":"why it is risky in plain English","suggestion":"what to ask for or change"}]}
Use "Not stated" for missing key terms. Order flags from most to least severe. If the document does not look like a lease, set overall_risk to "low", explain in summary, and return an empty flags array.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  try {
    const { pdf } = req.body || {};
    if (!pdf) return res.status(400).json({ error: 'No PDF received.' });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'application/pdf', data: pdf } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error?.message || 'Gemini request failed.' });
    const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(clean));
  } catch (e) {
    return res.status(500).json({ error: 'Could not analyze this PDF. ' + e.message });
  }
}
