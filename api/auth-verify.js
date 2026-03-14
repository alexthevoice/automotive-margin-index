export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { AIRTABLE_TOKEN, AIRTABLE_DEALER_BASE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_DEALER_BASE_ID) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email e codice richiesti' });

    const normalizedEmail = email.trim().toLowerCase();

    // Find dealer by email
    const filterFormula = encodeURIComponent(`LOWER({Email}) = "${normalizedEmail}"`);
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_DEALER_BASE_ID}/Dealer?filterByFormula=${filterFormula}&maxRecords=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const searchData = await searchRes.json();

    if (!searchRes.ok || !searchData.records || searchData.records.length === 0) {
      return res.status(404).json({ error: 'Dealer non trovato' });
    }

    const dealer = searchData.records[0];
    const fields = dealer.fields;

    // Verify OTP
    if (!fields.OTP_Code || fields.OTP_Code !== code.trim()) {
      return res.status(401).json({ error: 'Codice non valido' });
    }

    // Check expiry
    if (fields.OTP_Expiry) {
      const expiry = new Date(fields.OTP_Expiry);
      if (Date.now() > expiry.getTime()) {
        return res.status(401).json({ error: 'Codice scaduto. Richiedi un nuovo codice.' });
      }
    }

    // Clear OTP after successful verification
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_DEALER_BASE_ID}/Dealer/${dealer.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { OTP_Code: '', OTP_Expiry: '' }
      }),
    });

    const creditiTotali = fields.Crediti_Totali || 0;
    const creditiUsati = fields.Crediti_Usati || 0;
    const creditiRimanenti = creditiTotali - creditiUsati;

    return res.status(200).json({
      success: true,
      dealer: {
        id: dealer.id,
        nome: fields.Nome || '',
        email: normalizedEmail,
        provincia: fields.Provincia || '',
        tipologia: fields.Tipologia || '',
        numero_sedi: fields.Numero_Sedi || '',
        referente: fields.Referente || '',
        telefono: fields.Telefono || '',
        crediti_totali: creditiTotali,
        crediti_usati: creditiUsati,
        crediti_rimanenti: creditiRimanenti,
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}
