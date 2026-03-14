import { useState, useEffect, useRef } from "react";

const VERSION = "1.107";

const STEPS = [
  { id: 0, label: "Anagrafica", icon: "◆" },
  { id: 1, label: "Marginalità", icon: "◈" },
  { id: 2, label: "Servizi F&I", icon: "◇" },
  { id: 3, label: "Stock & Produttività", icon: "▣" },
  { id: 4, label: "Autovalutazione", icon: "◎" },
];

const WEIGHTS = { marginalita: 0.35, servizi: 0.30, stock: 0.20, produttivita: 0.15 };

const CLASSI = [
  { min: 0, max: 39, label: "Zona Critica", color: "#D44040", bg: "rgba(212,64,64,0.08)", emoji: "▼" },
  { min: 40, max: 59, label: "Sopravvivenza", color: "#E8923F", bg: "rgba(232,146,63,0.08)", emoji: "◆" },
  { min: 60, max: 74, label: "Buona Gestione", color: "#E8A838", bg: "rgba(232,168,56,0.08)", emoji: "◈" },
  { min: 75, max: 89, label: "Alta Performance", color: "#4DAF6A", bg: "rgba(77,175,106,0.08)", emoji: "▲" },
  { min: 90, max: 100, label: "Benchmark Leader", color: "#E8A838", bg: "rgba(232,168,56,0.12)", emoji: "★" },
];

const PROVINCE = [
  "Agrigento","Alessandria","Ancona","Aosta","Arezzo","Ascoli Piceno","Asti","Avellino","Bari","Barletta-Andria-Trani",
  "Belluno","Benevento","Bergamo","Biella","Bologna","Bolzano","Brescia","Brindisi","Cagliari","Caltanissetta",
  "Campobasso","Caserta","Catania","Catanzaro","Chieti","Como","Cosenza","Cremona","Crotone","Cuneo",
  "Enna","Fermo","Ferrara","Firenze","Foggia","Forlì-Cesena","Frosinone","Genova","Gorizia","Grosseto",
  "Imperia","Isernia","L'Aquila","La Spezia","Latina","Lecce","Lecco","Livorno","Lodi","Lucca",
  "Macerata","Mantova","Massa-Carrara","Matera","Messina","Milano","Modena","Monza e Brianza","Napoli","Novara",
  "Nuoro","Oristano","Padova","Palermo","Parma","Pavia","Perugia","Pesaro e Urbino","Pescara","Piacenza",
  "Pisa","Pistoia","Pordenone","Potenza","Prato","Ragusa","Ravenna","Reggio Calabria","Reggio Emilia","Rieti",
  "Rimini","Roma","Rovigo","Salerno","Sassari","Savona","Siena","Siracusa","Sondrio","Sud Sardegna",
  "Taranto","Teramo","Terni","Torino","Trapani","Trento","Treviso","Trieste","Udine","Varese",
  "Venezia","Verbano-Cusio-Ossola","Vercelli","Verona","Vibo Valentia","Vicenza","Viterbo"
];

const PERDITA_OPTIONS = [
  "Margine veicolo troppo basso",
  "Bassa penetrazione F&I",
  "Stock troppo alto / lento",
  "Costi struttura eccessivi",
  "Forza vendita poco produttiva",
  "Mancanza di processi strutturati",
  "Pressione sui prezzi dal mercato",
  "Garanzie e post-vendita",
];

const C = {
  bg: '#133256', bgLight: '#1A3D66', bgCard: '#1F4775', border: '#2A5585', borderLight: '#356294',
  gold: '#E8A838', white: '#FFFFFF', textPrimary: '#FFFFFF', textSecondary: '#8899AA', textMuted: '#5A7088',
  cardBg: '#FFFFFF', cardText: '#1A2A42', cardTextLight: '#5A7088', inputBg: '#F2F4F7', inputBorder: '#D8DDE4',
};

/* ═══════════════════════════════════════
   SCORING ENGINE
   ═══════════════════════════════════════ */

function normalize(value, min, max, positive) {
  const clamped = Math.max(min, Math.min(max, value));
  const raw = (clamped - min) / (max - min);
  return positive ? raw * 100 : (1 - raw) * 100;
}

function getClasse(score) {
  return CLASSI.find(c => score >= c.min && score <= c.max) || CLASSI[0];
}

function calculateScores(data) {
  // Marginalità (peso 35%) — valori in € per veicolo
  const margineVeicolo = parseFloat(data.margine_veicolo) || 0;
  const margineServizi = parseFloat(data.margine_servizi) || 0;
  const margineTotale = margineVeicolo + margineServizi;

  const s_mv = normalize(margineVeicolo, 200, 2000, true);
  const s_ms = normalize(margineServizi, 200, 2500, true);
  const s_mt = normalize(margineTotale, 500, 5000, true);
  const score_marginalita = s_mv * 0.30 + s_ms * 0.30 + s_mt * 0.40;

  // Servizi F&I (peso 30%) — penetrazione %
  const s_fin = normalize(parseFloat(data.penetrazione_fin) || 0, 10, 80, true);
  const s_ass = normalize(parseFloat(data.penetrazione_ass) || 0, 5, 80, true);
  const s_gar = normalize(parseFloat(data.penetrazione_gar) || 0, 5, 50, true);
  const score_servizi = s_fin * 0.40 + s_ass * 0.40 + s_gar * 0.20;

  // Stock (peso 20%)
  const s_gs = normalize(parseFloat(data.giorni_stock) || 60, 15, 120, false);
  const volume = parseFloat(data.volume_vendite) || 1;
  const stockMedio = parseFloat(data.stock_medio) || 1;
  const rotazione = volume / Math.max(stockMedio, 1);
  const s_rot = normalize(rotazione, 2, 12, true);
  const score_stock = s_gs * 0.55 + s_rot * 0.45;

  // Produttività (peso 15%)
  const venditori = parseFloat(data.venditori) || 1;
  const vpv = volume / Math.max(venditori, 1);
  const s_vpv = normalize(vpv, 50, 300, true);
  const addetti = parseFloat(data.addetti) || 1;
  const efficienza = volume / Math.max(addetti, 1);
  const s_eff = normalize(efficienza, 10, 100, true);
  const score_produttivita = s_vpv * 0.70 + s_eff * 0.30;

  // AMI finale
  const ami = score_marginalita * WEIGHTS.marginalita + score_servizi * WEIGHTS.servizi + score_stock * WEIGHTS.stock + score_produttivita * WEIGHTS.produttivita;

  return {
    score_marginalita: Math.round(score_marginalita),
    score_servizi: Math.round(score_servizi),
    score_stock: Math.round(score_stock),
    score_produttivita: Math.round(score_produttivita),
    ami: Math.round(ami),
    margineTotale,
    details: {
      s_mv: Math.round(s_mv), s_ms: Math.round(s_ms), s_mt: Math.round(s_mt),
      s_fin: Math.round(s_fin), s_ass: Math.round(s_ass), s_gar: Math.round(s_gar),
      s_gs: Math.round(s_gs), s_rot: Math.round(s_rot),
      s_vpv: Math.round(s_vpv), s_eff: Math.round(s_eff),
      vpv: Math.round(vpv * 10) / 10,
      rotazione: Math.round(rotazione * 10) / 10,
    }
  };
}

function getInsights(scores, data) {
  const insights = [];
  const { score_marginalita: sm, score_servizi: ss, score_stock: sst, score_produttivita: sp } = scores;

  if (sm < 40) insights.push({ area: "Marginalità", type: "critical", text: "Marginalità sul ferro e sui servizi significativamente sotto la media di mercato. Priorità immediata: revisione pricing e mix prodotto F&I." });
  else if (sm < 60) insights.push({ area: "Marginalità", type: "warning", text: "Margini in zona di sopravvivenza. Esistono spazi concreti di miglioramento sulla marginalità servizi e sul margine medio per veicolo." });
  else if (sm < 75) insights.push({ area: "Marginalità", type: "good", text: "Buona gestione dei margini. Per salire di livello, focus su incremento penetrazione servizi ad alto margine." });
  else insights.push({ area: "Marginalità", type: "excellent", text: "Marginalità sopra la media di mercato. Pricing e mix prodotto ben calibrati." });

  if (ss < 40) insights.push({ area: "Servizi F&I", type: "critical", text: "Penetrazione servizi molto bassa. Area di massima dispersione margine. Intervento strutturato genera risultati rapidi." });
  else if (ss < 60) insights.push({ area: "Servizi F&I", type: "warning", text: "Penetrazione servizi sotto il potenziale. Ogni punto percentuale recuperato genera margine incrementale immediato." });
  else if (ss < 75) insights.push({ area: "Servizi F&I", type: "good", text: "Buona penetrazione complessiva. Verificare bilanciamento tra finanziamenti, assicurazioni e garanzie." });
  else insights.push({ area: "Servizi F&I", type: "excellent", text: "Penetrazione servizi ai vertici del benchmark. Processo commerciale F&I efficace e strutturato." });

  if (sst < 40) insights.push({ area: "Stock", type: "critical", text: "Gestione stock critica: giorni giacenza elevati e capitale immobilizzato. Revisione immediata della politica acquisti." });
  else if (sst < 60) insights.push({ area: "Stock", type: "warning", text: "Stock gestibile ma migliorabile. Ridurre giorni medi giacenza libererebbe liquidità e ridurrebbe costi finanziari." });
  else if (sst < 75) insights.push({ area: "Stock", type: "good", text: "Buona rotazione stock. Per ottimizzare, valutare micro-aggiustamenti sulla composizione parco veicoli." });
  else insights.push({ area: "Stock", type: "excellent", text: "Gestione stock eccellente. Rotazione e giacenza ai livelli delle migliori concessionarie del benchmark." });

  if (sp < 40) insights.push({ area: "Produttività", type: "critical", text: "Produttività forza vendita sotto i livelli sostenibili. Valutare dimensionamento team e processi commerciali." });
  else if (sp < 60) insights.push({ area: "Produttività", type: "warning", text: "Produttività migliorabile. Ogni venditore dovrebbe gestire volume più alto per sostenibilità." });
  else if (sp < 75) insights.push({ area: "Produttività", type: "good", text: "Produttività nella norma. Margini di miglioramento attraverso formazione e ottimizzazione processi." });
  else insights.push({ area: "Produttività", type: "excellent", text: "Team commerciale altamente produttivo. Rapporto veicoli/venditore sopra la media di mercato." });

  const selfEval = parseInt(data.autovalutazione) || 3;
  const realScore = scores.ami;
  let gap = "";
  if (selfEval <= 2 && realScore >= 60) gap = "La vostra percezione è più severa del dato oggettivo. La realtà è migliore di come la vedete.";
  else if (selfEval >= 4 && realScore < 60) gap = "Attenzione: la percezione interna è più ottimistica del dato reale. Questo gap merita una riflessione.";
  else if (Math.abs(selfEval - 3) <= 1 && Math.abs(realScore - 60) <= 15) gap = "La vostra autovalutazione è sostanzialmente allineata al dato oggettivo.";

  return { insights, gap };
}

/* ═══════════════════════════════════════
   AIRTABLE SUBMISSION
   ═══════════════════════════════════════ */

async function submitToAirtable(data, scores) {
  const classe = getClasse(scores.ami);
  const payload = {
    Ragione_Sociale: data.ragione_sociale,
    Provincia: data.provincia,
    Tipologia: data.tipologia,
    Volume_Vendite: parseInt(data.volume_vendite) || 0,
    Sedi: parseInt(data.sedi) || 0,
    Venditori: parseInt(data.venditori) || 0,
    Addetti: parseInt(data.addetti) || 0,
    Margine_Veicolo: parseFloat(data.margine_veicolo) || 0,
    Margine_Servizi: parseFloat(data.margine_servizi) || 0,
    // Margine_Totale è formula su Airtable, non lo inviamo
    Penetrazione_Fin: parseFloat(data.penetrazione_fin) || 0,
    Penetrazione_Ass: parseFloat(data.penetrazione_ass) || 0,
    Penetrazione_Gar: parseFloat(data.penetrazione_gar) || 0,
    Giorni_Stock: parseInt(data.giorni_stock) || 0,
    Stock_Medio: parseInt(data.stock_medio) || 0,
    Valore_Stock: parseInt(data.valore_stock) || 0,
    Autovalutazione: parseInt(data.autovalutazione) || 3,
    Perdita_Margine: data.perdita_margine.join(", "),
    Score_Marginalita: scores.score_marginalita,
    Score_Servizi: scores.score_servizi,
    Score_Stock: scores.score_stock,
    Score_Produttivita: scores.score_produttivita,
    AMI_Score: scores.ami,
    Classe_Direzionale: classe.label,
    Data_Compilazione: new Date().toISOString().split('T')[0],
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Errore invio dati');
    return { success: true };
  } catch (err) {
    console.error('Airtable submission error:', err);
    return { success: false, error: err.message };
  }
}

/* ═══════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════ */

function Footer() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', position: 'fixed', bottom: 0, left: 0, right: 0, fontSize: 11, color: C.textMuted, fontFamily: "'DM Sans',sans-serif", background: C.bg, zIndex: 10 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>ver {VERSION}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>✉</span> info@alessandrotasso.it
      </span>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: C.bg, letterSpacing: 1 }}>AMI</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, letterSpacing: 1, textTransform: 'uppercase' }}>Automotive Margin Index™</div>
    </div>
  );
}

function ProgressBar({ current, steps }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ height: 3, background: C.bgCard, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', background: C.gold, borderRadius: 2, width: `${((current + 1) / steps.length) * 100}%`, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: i <= current ? C.gold : C.textMuted, fontSize: 9, transition: 'color 0.3s' }}>
            <span>{s.icon}</span><span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InputField({ label, hint, value, onChange, type = "text", suffix, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.cardText, marginBottom: 4, display: 'block' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: C.cardTextLight, marginBottom: 6 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""} style={{ flex: 1, padding: '11px 14px', background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.cardText, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
        {suffix && <span style={{ fontSize: 12, color: C.cardTextLight, minWidth: 36 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({ label, hint, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.cardText, marginBottom: 4, display: 'block' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: C.cardTextLight, marginBottom: 6 }}>{hint}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '11px 14px', background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.cardText, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
        <option value="">Seleziona...</option>
        {options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
      </select>
    </div>
  );
}

/* ═══════════════════════════════════════
   FORM STEPS
   ═══════════════════════════════════════ */

function StepAnagrafica({ data, updateField }) {
  return (<div>
    <InputField label="Ragione sociale" value={data.ragione_sociale} onChange={v => updateField('ragione_sociale', v)} placeholder="Es. Auto Group S.r.l." />
    <SelectField label="Provincia" value={data.provincia} onChange={v => updateField('provincia', v)} options={PROVINCE} />
    <SelectField label="Tipologia concessionaria" value={data.tipologia} onChange={v => updateField('tipologia', v)} options={[{ value: "Dealer Ufficiale", label: "Dealer Ufficiale" }, { value: "Multimarca", label: "Multimarca" }]} />
    <InputField label="Volume annuo vendite" hint="Totale veicoli venduti nell'ultimo anno" value={data.volume_vendite} onChange={v => updateField('volume_vendite', v)} type="number" suffix="unità" placeholder="800" />
    <InputField label="Numero sedi operative" value={data.sedi} onChange={v => updateField('sedi', v)} type="number" placeholder="2" />
    <InputField label="Numero venditori" hint="Solo forza vendita attiva" value={data.venditori} onChange={v => updateField('venditori', v)} type="number" placeholder="8" />
    <InputField label="Totale addetti" hint="Tutto il personale" value={data.addetti} onChange={v => updateField('addetti', v)} type="number" placeholder="25" />
  </div>);
}

function StepMarginalita({ data, updateField }) {
  return (<div>
    <div style={{ fontSize: 13, color: C.cardTextLight, lineHeight: 1.6, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${C.inputBorder}` }}>
      Inserite i dati di marginalità media per veicolo venduto. Se non avete il dato esatto, una stima ragionevole è sufficiente.
    </div>
    <InputField
      label="Margine medio sul ferro per veicolo"
      hint="Quanto guadagnate in media sulla vendita del veicolo (ferro), al netto dei costi diretti"
      value={data.margine_veicolo}
      onChange={v => updateField('margine_veicolo', v)}
      type="number"
      suffix="€"
      placeholder="800"
    />
    <InputField
      label="Margine medio servizi F&I per veicolo"
      hint="Ricavo medio per veicolo da finanziamenti, assicurazioni e garanzie"
      value={data.margine_servizi}
      onChange={v => updateField('margine_servizi', v)}
      type="number"
      suffix="€"
      placeholder="450"
    />
    <div style={{ background: C.inputBg, borderRadius: 8, padding: '12px 16px', marginTop: 4 }}>
      <div style={{ fontSize: 11, color: C.cardTextLight, lineHeight: 1.5 }}>
        <strong style={{ color: C.cardText }}>Nota:</strong> Il margine totale per veicolo verrà calcolato automaticamente come somma del margine sul ferro e del margine servizi F&I.
      </div>
    </div>
  </div>);
}

function StepServizi({ data, updateField }) {
  return (<div>
    <div style={{ fontSize: 13, color: C.cardTextLight, lineHeight: 1.6, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${C.inputBorder}` }}>
      Percentuale di veicoli venduti su cui è stato attivato il relativo servizio F&I.
    </div>
    <InputField
      label="Penetrazione finanziamenti"
      hint="% veicoli venduti con finanziamento attivato"
      value={data.penetrazione_fin}
      onChange={v => updateField('penetrazione_fin', v)}
      type="number"
      suffix="%"
      placeholder="55"
    />
    <InputField
      label="Penetrazione assicurazioni"
      hint="% veicoli venduti con polizza furto/incendio o kasko"
      value={data.penetrazione_ass}
      onChange={v => updateField('penetrazione_ass', v)}
      type="number"
      suffix="%"
      placeholder="30"
    />
    <InputField
      label="Penetrazione garanzie aggiuntive"
      hint="% veicoli venduti con garanzia guasti meccanici aggiuntiva (solo garanzie con durata da 24 mesi in su)"
      value={data.penetrazione_gar}
      onChange={v => updateField('penetrazione_gar', v)}
      type="number"
      suffix="%"
      placeholder="25"
    />
  </div>);
}

function StepStock({ data, updateField }) {
  return (<div>
    <div style={{ fontSize: 13, color: C.cardTextLight, lineHeight: 1.6, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${C.inputBorder}` }}>
      I dati sullo stock indicano l'efficienza del capitale investito e la velocità di rotazione.
    </div>
    <InputField label="Giorni medi di giacenza" hint="Tempo medio permanenza veicolo in stock" value={data.giorni_stock} onChange={v => updateField('giorni_stock', v)} type="number" suffix="giorni" placeholder="65" />
    <InputField label="Unità in stock medio" hint="Numero medio veicoli presenti in stock" value={data.stock_medio} onChange={v => updateField('stock_medio', v)} type="number" suffix="unità" placeholder="120" />
    <InputField label="Valore stock medio" hint="Valore economico medio del parco veicoli in stock" value={data.valore_stock} onChange={v => updateField('valore_stock', v)} type="number" suffix="€" placeholder="2400000" />
  </div>);
}

function StepAutovalutazione({ data, updateField, togglePerdita }) {
  return (<div>
    <div style={{ fontSize: 13, color: C.cardTextLight, lineHeight: 1.6, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${C.inputBorder}` }}>
      Queste domande confrontano la vostra percezione con il dato oggettivo del benchmark.
    </div>
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.cardText, marginBottom: 4, display: 'block' }}>Come valutereste oggi la vostra marginalità?</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => updateField('autovalutazione', String(n))} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
            background: parseInt(data.autovalutazione) === n ? C.gold : C.inputBg,
            color: parseInt(data.autovalutazione) === n ? C.bg : C.cardTextLight,
            border: `1px solid ${parseInt(data.autovalutazione) === n ? C.gold : C.inputBorder}`,
          }}>
            {n}<span style={{ fontSize: 8, marginTop: 3, fontWeight: 500 }}>{["Critica", "Bassa", "Media", "Buona", "Eccellente"][n - 1]}</span>
          </button>
        ))}
      </div>
    </div>
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.cardText, marginBottom: 4, display: 'block' }}>Dove pensate di perdere più margine?</label>
      <div style={{ fontSize: 11, color: C.cardTextLight, marginBottom: 8 }}>Selezionate una o più voci</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PERDITA_OPTIONS.map(opt => (
          <button key={opt} onClick={() => togglePerdita(opt)} style={{
            display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.2s',
            background: data.perdita_margine.includes(opt) ? `${C.gold}18` : C.inputBg,
            border: `1px solid ${data.perdita_margine.includes(opt) ? C.gold : C.inputBorder}`,
            color: data.perdita_margine.includes(opt) ? C.cardText : C.cardTextLight,
          }}>
            <span style={{ marginRight: 8, fontSize: 11, color: C.gold }}>{data.perdita_margine.includes(opt) ? '◆' : '◇'}</span>{opt}
          </button>
        ))}
      </div>
    </div>
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.cardText, marginBottom: 4, display: 'block' }}>Consensi</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: C.cardTextLight, cursor: 'pointer', lineHeight: 1.5 }}>
          <input type="checkbox" checked={data.consenso_anonimo} onChange={e => updateField('consenso_anonimo', e.target.checked)} style={{ marginTop: 2, accentColor: C.gold }} />
          <span>Acconsento che i dati vengano utilizzati in forma anonima per il benchmark</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: C.cardTextLight, cursor: 'pointer', lineHeight: 1.5 }}>
          <input type="checkbox" checked={data.consenso_risultati} onChange={e => updateField('consenso_risultati', e.target.checked)} style={{ marginTop: 2, accentColor: C.gold }} />
          <span>Autorizzo la restituzione dei risultati in forma riservata</span>
        </label>
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════
   RESULTS DASHBOARD
   ═══════════════════════════════════════ */

function ResultsDashboard({ scores, insights, data, animate, onReset, containerRef, airtableStatus }) {
  const classe = getClasse(scores.ami);
  const tc = { critical: '#D44040', warning: '#E8923F', good: '#E8A838', excellent: '#4DAF6A' };
  const tl = { critical: 'CRITICO', warning: 'ATTENZIONE', good: 'POSITIVO', excellent: 'ECCELLENTE' };

  const fmtEuro = (v) => `€ ${parseInt(v).toLocaleString('it-IT')}`;

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: C.bg, color: C.white, fontFamily: "'DM Sans','Helvetica Neue',sans-serif", overflowY: 'auto', paddingBottom: 56 }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 20px 20px' }}>
        <Header />

        {airtableStatus && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 12,
            background: airtableStatus === 'success' ? 'rgba(77,175,106,0.1)' : airtableStatus === 'error' ? 'rgba(212,64,64,0.1)' : 'rgba(232,168,56,0.1)',
            color: airtableStatus === 'success' ? '#4DAF6A' : airtableStatus === 'error' ? '#D44040' : C.gold,
            border: `1px solid ${airtableStatus === 'success' ? 'rgba(77,175,106,0.3)' : airtableStatus === 'error' ? 'rgba(212,64,64,0.3)' : 'rgba(232,168,56,0.3)'}`,
          }}>
            {airtableStatus === 'success' && '✓ Dati salvati correttamente'}
            {airtableStatus === 'sending' && '◌ Salvataggio in corso...'}
            {airtableStatus === 'error' && '✗ Errore nel salvataggio (i risultati sono comunque visibili)'}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white }}>{data.ragione_sociale}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Analisi del {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>

        {/* Main Score */}
        <div style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.gold, fontWeight: 600, marginBottom: 12 }}>AUTOMOTIVE MARGIN INDEX™</div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, color: classe.color, opacity: animate ? 1 : 0, transform: animate ? 'scale(1)' : 'scale(0.85)', transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}>{scores.ami}</div>
          <div style={{ fontSize: 16, color: C.textMuted, marginBottom: 12 }}>/100</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 20, background: classe.bg, color: classe.color, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{classe.emoji} {classe.label}</div>
          <div style={{ marginTop: 20 }}>
            <div style={{ height: 8, background: C.bgCard, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: classe.color, width: animate ? `${scores.ami}%` : '0%', transition: 'width 1.2s ease-out 0.3s', position: 'relative', zIndex: 1 }} />
              {CLASSI.map((c, i) => (<div key={i} style={{ position: 'absolute', left: `${c.min}%`, width: `${c.max - c.min + 1}%`, height: '100%', borderRight: i < CLASSI.length - 1 ? `1px solid ${C.border}` : 'none', top: 0 }} />))}
            </div>
            <div style={{ display: 'flex', marginTop: 4 }}>{CLASSI.map((c, i) => (<span key={i} style={{ fontSize: 7, color: C.textMuted, flex: 1, textAlign: 'center', letterSpacing: 0.3 }}>{c.label}</span>))}</div>
          </div>
        </div>

        {/* 4 Areas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: "Marginalità", score: scores.score_marginalita, weight: "35%", icon: "◆" },
            { label: "Servizi F&I", score: scores.score_servizi, weight: "30%", icon: "◈" },
            { label: "Stock", score: scores.score_stock, weight: "20%", icon: "◇" },
            { label: "Produttività", score: scores.score_produttivita, weight: "15%", icon: "▣" },
          ].map((area, i) => {
            const ac = getClasse(area.score);
            return (
              <div key={i} style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ color: C.gold, fontSize: 12 }}>{area.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, flex: 1 }}>{area.label}</span>
                  <span style={{ fontSize: 9, color: C.textMuted }}>peso {area.weight}</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: ac.color, lineHeight: 1, marginBottom: 8, opacity: animate ? 1 : 0, transition: `opacity 0.6s ease ${0.4 + i * 0.15}s` }}>{area.score}</div>
                <div style={{ height: 4, background: C.bgCard, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, background: ac.color, width: animate ? `${area.score}%` : '0%', transition: `width 1s ease ${0.5 + i * 0.15}s` }} /></div>
                <div style={{ fontSize: 9, color: ac.color, marginTop: 6, letterSpacing: 0.5 }}>{ac.label}</div>
              </div>
            );
          })}
        </div>

        {/* KPI Detail */}
        <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>Dettaglio KPI</div>
        <div style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
          {[
            { label: "Margine sul ferro", score: scores.details.s_mv, value: fmtEuro(data.margine_veicolo) },
            { label: "Margine servizi F&I", score: scores.details.s_ms, value: fmtEuro(data.margine_servizi) },
            { label: "Margine totale/veicolo", score: scores.details.s_mt, value: fmtEuro(scores.margineTotale) },
            { label: "Penetraz. finanz.", score: scores.details.s_fin, value: `${data.penetrazione_fin}%` },
            { label: "Penetraz. assic.", score: scores.details.s_ass, value: `${data.penetrazione_ass}%` },
            { label: "Penetraz. garanzie", score: scores.details.s_gar, value: `${data.penetrazione_gar}%` },
            { label: "Giorni giacenza", score: scores.details.s_gs, value: `${data.giorni_stock} gg` },
            { label: "Rotazione stock", score: scores.details.s_rot, value: `${scores.details.rotazione}x` },
            { label: "Veicoli/venditore", score: scores.details.s_vpv, value: `${scores.details.vpv}` },
            { label: "Efficienza org.", score: scores.details.s_eff, value: `${Math.round((parseFloat(data.volume_vendite) || 0) / (parseFloat(data.addetti) || 1) * 10) / 10}` },
          ].map((kpi, i) => { const kc = getClasse(kpi.score); return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 90px auto', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{kpi.label}</div>
              <div style={{ fontSize: 12, color: C.white, fontWeight: 600, textAlign: 'right', minWidth: 56 }}>{kpi.value}</div>
              <div style={{ height: 4, background: C.bgCard, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, background: kc.color, width: `${kpi.score}%` }} /></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: kc.color, textAlign: 'right', minWidth: 28 }}>{kpi.score}</div>
            </div>); })}
        </div>

        {/* Insights */}
        <div style={{ fontSize: 10, letterSpacing: 2.5, color: C.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>Diagnosi Direzionale</div>
        {insights.insights.map((ins, i) => (
          <div key={i} style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tc[ins.type]}`, borderRadius: '0 10px 10px 0', padding: '16px 18px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 4, background: `${tc[ins.type]}18`, color: tc[ins.type] }}>{tl[ins.type]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{ins.area}</span>
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{ins.text}</div>
          </div>
        ))}

        {insights.gap && (
          <div style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginTop: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.gold, marginBottom: 8 }}>PERCEZIONE VS REALTÀ</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{insights.gap}</div>
          </div>
        )}

        {data.perdita_margine.length > 0 && (
          <div style={{ background: C.bgLight, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginTop: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.gold, marginBottom: 8 }}>AREE DI PERDITA PERCEPITE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{data.perdita_margine.map((p, i) => (<span key={i} style={{ fontSize: 11, color: C.gold, background: `${C.gold}15`, padding: '4px 10px', borderRadius: 6 }}>{p}</span>))}</div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: `${C.gold}0C`, border: `1px solid ${C.gold}30`, borderRadius: 14, padding: '28px 24px', marginTop: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.gold, marginBottom: 8 }}>PROSSIMO PASSO</div>
          <div style={{ fontSize: 16, color: C.white, marginBottom: 8, fontWeight: 700 }}>Trasforma questo benchmark in un piano d'azione</div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>Una giornata di allineamento direzionale per analizzare i risultati, identificare le leve prioritarie e definire un piano operativo di miglioramento.</div>
          <a href="https://alessandrotasso.it/appuntamento-automotive" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '14px 32px', background: C.gold, border: 'none', borderRadius: 8, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3, textDecoration: 'none' }}>Richiedi una consulenza →</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28, marginBottom: 20 }}>
          <button onClick={onReset} style={{ padding: '12px 20px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Nuova compilazione</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════ */

export default function App() {
  const [currentStep, setCurrentStep] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [animateScore, setAnimateScore] = useState(false);
  const [airtableStatus, setAirtableStatus] = useState(null);
  const [data, setData] = useState({
    ragione_sociale: "", provincia: "", tipologia: "", volume_vendite: "", sedi: "", venditori: "", addetti: "",
    margine_veicolo: "", margine_servizi: "",
    penetrazione_fin: "", penetrazione_ass: "", penetrazione_gar: "",
    giorni_stock: "", stock_medio: "", valore_stock: "",
    autovalutazione: "3", perdita_margine: [], consenso_anonimo: false, consenso_risultati: false,
  });
  const [scores, setScores] = useState(null);
  const [insights, setInsights] = useState(null);
  const containerRef = useRef(null);

  const updateField = (f, v) => setData(p => ({ ...p, [f]: v }));
  const togglePerdita = (opt) => setData(p => ({ ...p, perdita_margine: p.perdita_margine.includes(opt) ? p.perdita_margine.filter(o => o !== opt) : [...p.perdita_margine, opt] }));

  const handleSubmit = async () => {
    const s = calculateScores(data);
    const i = getInsights(s, data);
    setScores(s);
    setInsights(i);
    setShowResults(true);
    setAirtableStatus('sending');
    setTimeout(() => setAnimateScore(true), 300);
    const result = await submitToAirtable(data, s);
    setAirtableStatus(result.success ? 'success' : 'error');
  };

  const handleReset = () => {
    setCurrentStep(-1); setShowResults(false); setAnimateScore(false); setAirtableStatus(null);
    setScores(null); setInsights(null);
    setData({ ragione_sociale: "", provincia: "", tipologia: "", volume_vendite: "", sedi: "", venditori: "", addetti: "", margine_veicolo: "", margine_servizi: "", penetrazione_fin: "", penetrazione_ass: "", penetrazione_gar: "", giorni_stock: "", stock_medio: "", valore_stock: "", autovalutazione: "3", perdita_margine: [], consenso_anonimo: false, consenso_risultati: false });
  };

  useEffect(() => { if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' }); }, [currentStep, showResults]);

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.ragione_sociale && data.provincia && data.tipologia && data.volume_vendite && data.venditori && data.addetti;
      case 1: return data.margine_veicolo && data.margine_servizi;
      case 2: return data.penetrazione_fin && data.penetrazione_ass && data.penetrazione_gar;
      case 3: return data.giorni_stock && data.stock_medio;
      case 4: return data.consenso_anonimo && data.consenso_risultati;
      default: return true;
    }
  };

  // ── RESULTS ──
  if (showResults && scores && insights) return (<><ResultsDashboard scores={scores} insights={insights} data={data} animate={animateScore} onReset={handleReset} containerRef={containerRef} airtableStatus={airtableStatus} /><Footer /></>);

  // ── LANDING ──
  if (currentStep === -1) return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: C.bg, color: C.white, fontFamily: "'DM Sans','Helvetica Neue',sans-serif", overflowY: 'auto', paddingBottom: 56 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 20px', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: C.gold, fontSize: 18, fontWeight: 900, color: C.bg, letterSpacing: 2, marginBottom: 20 }}>AMI</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, color: C.white, margin: '0 0 16px', letterSpacing: -0.5 }}>Automotive Margin Index™</h1>
        <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>Misura la salute economica della tua concessionaria: scopri dove stai performando, dove perdi margine e cosa fare per migliorare.</p>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32, lineHeight: 1.5 }}>Compila il questionario direzionale per ottenere il tuo score, benchmark e diagnosi personalizzata.</p>
        <div style={{ background: C.cardBg, borderRadius: 14, padding: '32px 28px', textAlign: 'left', color: C.cardText }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.cardText, margin: '0 0 6px' }}>Inizia l'analisi</h2>
          <p style={{ fontSize: 14, color: C.cardTextLight, lineHeight: 1.5, margin: 0 }}>Compila il questionario in 5 minuti per ricevere il tuo Automotive Margin Index™ e il benchmark direzionale.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {[["◆", "Score sintetico 0–100 sulla tua marginalità complessiva"], ["◈", "Benchmark anonimo con il mercato automotive italiano"], ["◇", "Diagnosi direzionale su 4 aree chiave"], ["▣", "Insight operativi per migliorare la performance"]].map(([icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                <span style={{ color: C.gold, fontSize: 14, marginTop: 1 }}>{icon}</span>
                <span style={{ fontSize: 13, color: C.cardText, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setCurrentStep(0)} style={{ padding: '16px 40px', background: C.gold, border: 'none', borderRadius: 10, color: C.bg, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.5, marginTop: 24, width: '100%' }}>Avvia il questionario</button>
          <div style={{ marginTop: 16, fontSize: 12, color: C.cardTextLight, textAlign: 'center' }}>Compilazione: ~5 minuti · Dati trattati in forma anonima e riservata</div>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── FORM STEPS ──
  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: C.bg, color: C.white, fontFamily: "'DM Sans','Helvetica Neue',sans-serif", overflowY: 'auto', paddingBottom: 56 }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 20px 20px' }}>
        <Header />
        <ProgressBar current={currentStep} steps={STEPS} />
        <div style={{ background: C.cardBg, borderRadius: 14, padding: '28px 24px', marginBottom: 16, color: C.cardText }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <span style={{ fontSize: 22, color: C.gold }}>{STEPS[currentStep].icon}</span>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: C.gold, textTransform: 'uppercase', marginBottom: 2, fontWeight: 600 }}>STEP {currentStep + 1} DI 5</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.cardText }}>{STEPS[currentStep].label}</div>
            </div>
          </div>
          {currentStep === 0 && <StepAnagrafica data={data} updateField={updateField} />}
          {currentStep === 1 && <StepMarginalita data={data} updateField={updateField} />}
          {currentStep === 2 && <StepServizi data={data} updateField={updateField} />}
          {currentStep === 3 && <StepStock data={data} updateField={updateField} />}
          {currentStep === 4 && <StepAutovalutazione data={data} updateField={updateField} togglePerdita={togglePerdita} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button style={{ padding: '12px 20px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0}>← Indietro</button>
          {currentStep < 4 ? (
            <button style={{ padding: '12px 28px', background: C.gold, border: 'none', borderRadius: 8, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3, opacity: canProceed() ? 1 : 0.4 }} onClick={() => canProceed() && setCurrentStep(s => s + 1)} disabled={!canProceed()}>Avanti →</button>
          ) : (
            <button style={{ padding: '12px 28px', background: C.gold, border: 'none', borderRadius: 8, color: C.bg, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3, opacity: canProceed() ? 1 : 0.4 }} onClick={() => canProceed() && handleSubmit()} disabled={!canProceed()}>Calcola il tuo Index →</button>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
