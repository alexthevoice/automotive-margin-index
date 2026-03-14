export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const encodedTableName = encodeURIComponent(AIRTABLE_TABLE_NAME);
    const fields = ['AMI_Score', 'Score_Marginalita', 'Score_Servizi', 'Score_Stock', 'Score_Produttivita'];
    const fieldParams = fields.map(f => `fields%5B%5D=${f}`).join('&');

    let allRecords = [];
    let offset = null;

    // Paginate through all records
    do {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodedTableName}?${fieldParams}${offset ? `&offset=${offset}` : ''}`;
      const airtableRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      });
      const data = await airtableRes.json();

      if (!airtableRes.ok) {
        console.error('Airtable API error:', JSON.stringify(data));
        return res.status(airtableRes.status).json({ error: data.error?.message || 'Airtable error' });
      }

      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    // Extract scores
    const scores = allRecords
      .map(r => r.fields)
      .filter(f => f.AMI_Score != null) // solo record con score
      .map(f => ({
        ami: f.AMI_Score || 0,
        marginalita: f.Score_Marginalita || 0,
        servizi: f.Score_Servizi || 0,
        stock: f.Score_Stock || 0,
        produttivita: f.Score_Produttivita || 0,
      }));

    return res.status(200).json({
      success: true,
      total: scores.length,
      scores,
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
