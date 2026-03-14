export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { AIRTABLE_TOKEN, AIRTABLE_DEALER_BASE_ID, RESEND_API_KEY } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_DEALER_BASE_ID || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email richiesta' });

    const normalizedEmail = email.trim().toLowerCase();

    // Find dealer by email in Airtable
    const filterFormula = encodeURIComponent(`LOWER({Email}) = "${normalizedEmail}"`);
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_DEALER_BASE_ID}/Dealer?filterByFormula=${filterFormula}&maxRecords=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      console.error('Airtable search error:', JSON.stringify(searchData));
      return res.status(500).json({ error: 'Errore ricerca dealer' });
    }

    if (!searchData.records || searchData.records.length === 0) {
      return res.status(404).json({ error: 'Email non trovata. Registrati prima sullo Stock Performance Index oppure contatta il tuo consulente.' });
    }

    const dealerRecord = searchData.records[0];
    const dealerId = dealerRecord.id;

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Save OTP to Airtable
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_DEALER_BASE_ID}/Dealer/${dealerId}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          OTP_Code: otpCode,
          OTP_Expiry: otpExpiry,
        }
      }),
    });

    if (!updateRes.ok) {
      console.error('Airtable update error');
      return res.status(500).json({ error: 'Errore salvataggio codice' });
    }

    // Send OTP via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Automotive Margin Index <noreply@alessandrotasso.it>',
        to: [normalizedEmail],
        subject: 'Il tuo codice di accesso — Automotive Margin Index™',
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #133256; color: #ffffff; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #E8A838; color: #133256; font-weight: 900; font-size: 14px; padding: 10px 16px; border-radius: 8px; letter-spacing: 1px;">AMI</div>
            </div>
            <h1 style="font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 8px; color: #ffffff;">Automotive Margin Index™</h1>
            <p style="font-size: 14px; color: #8899AA; text-align: center; margin: 0 0 28px;">Il tuo codice di accesso</p>
            <div style="background: #1A3D66; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #E8A838;">${otpCode}</div>
            </div>
            <p style="font-size: 13px; color: #8899AA; text-align: center; margin: 0 0 4px;">Il codice scade tra 10 minuti.</p>
            <p style="font-size: 13px; color: #8899AA; text-align: center; margin: 0;">Se non hai richiesto questo codice, ignora questa email.</p>
            <hr style="border: none; border-top: 1px solid #2A5585; margin: 28px 0 16px;" />
            <p style="font-size: 11px; color: #5A7088; text-align: center; margin: 0;">info@alessandrotasso.it</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const emailErr = await emailRes.json();
      console.error('Resend error:', JSON.stringify(emailErr));
      return res.status(500).json({ error: 'Errore invio email' });
    }

    return res.status(200).json({
      success: true,
      message: 'Codice inviato',
      dealerName: dealerRecord.fields.Nome || '',
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}
