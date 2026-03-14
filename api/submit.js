export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, AIRTABLE_DEALER_BASE_ID } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME || !AIRTABLE_DEALER_BASE_ID) {
    console.error('Missing Airtable environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const data = req.body;
    const dealerId = data._dealer_id;

    // ── STEP 1: Check dealer credits ──
    if (!dealerId) {
      return res.status(400).json({ error: 'Dealer non autenticato' });
    }

    const dealerUrl = `https://api.airtable.com/v0/${AIRTABLE_DEALER_BASE_ID}/Dealer/${dealerId}`;
    const dealerRes = await fetch(dealerUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const dealerData = await dealerRes.json();

    if (!dealerRes.ok) {
      console.error('Dealer fetch error:', JSON.stringify(dealerData));
      return res.status(500).json({ error: 'Errore verifica crediti' });
    }

    const crediti_rimanenti = dealerData.fields?.Crediti_Rimanenti || 0;
    const crediti_usati = dealerData.fields?.Crediti_Usati || 0;

    if (crediti_rimanenti < 100) {
      return res.status(403).json({
        error: 'Crediti insufficienti. Servono 100 crediti per il questionario.',
        crediti_rimanenti,
      });
    }

    // ── STEP 2: Save questionnaire to Data table ──
    const airtablePayload = {
      records: [
        {
          fields: {
            Ragione_Sociale: data.Ragione_Sociale || '',
            Provincia: data.Provincia || '',
            Tipologia: data.Tipologia || '',
            Volume_Vendite: data.Volume_Vendite || 0,
            Sedi: data.Sedi || 0,
            Venditori: data.Venditori || 0,
            Addetti: data.Addetti || 0,
            Margine_Veicolo: data.Margine_Veicolo || 0,
            Margine_Servizi: data.Margine_Servizi || 0,
            Penetrazione_Fin: data.Penetrazione_Fin || 0,
            Penetrazione_Ass: data.Penetrazione_Ass || 0,
            Penetrazione_Gar: data.Penetrazione_Gar || 0,
            Giorni_Stock: data.Giorni_Stock || 0,
            Stock_Medio: data.Stock_Medio || 0,
            Valore_Stock: data.Valore_Stock || 0,
            Autovalutazione: data.Autovalutazione || 3,
            Perdita_Margine: data.Perdita_Margine || [],
            Score_Marginalita: data.Score_Marginalita || 0,
            Score_Servizi: data.Score_Servizi || 0,
            Score_Stock: data.Score_Stock || 0,
            Score_Produttivita: data.Score_Produttivita || 0,
            AMI_Score: data.AMI_Score || 0,
            Classe_Direzionale: data.Classe_Direzionale || '',
            Data_Compilazione: data.Data_Compilazione || new Date().toISOString().split('T')[0],
          }
        }
      ]
    };

    const encodedTableName = encodeURIComponent(AIRTABLE_TABLE_NAME);
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodedTableName}`;

    const airtableRes = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(airtablePayload),
    });

    const airtableData = await airtableRes.json();

    if (!airtableRes.ok) {
      console.error('Airtable API error:', JSON.stringify(airtableData));
      return res.status(airtableRes.status).json({
        error: airtableData.error?.message || 'Airtable API error',
      });
    }

    // ── STEP 3: Deduct 100 credits (increment Crediti_Usati) ──
    const newCrediti_Usati = crediti_usati + 100;

    await fetch(dealerUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { Crediti_Usati: newCrediti_Usati }
      }),
    });

    return res.status(200).json({
      success: true,
      recordId: airtableData.records?.[0]?.id,
      crediti_rimanenti: crediti_rimanenti - 100,
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
