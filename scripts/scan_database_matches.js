const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const url = 'https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ';

const adapter = new PrismaLibSql({ url, authToken });
const prisma = new PrismaClient({ adapter });

const blacklist = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/national_blacklist.json'), 'utf8'));

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanString(str) {
  if (!str) return '';
  return stripDiacritics(str)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function harmonizeToken(token) {
  if (!token) return '';
  let t = token.toUpperCase();
  if (t === 'MED' || t === 'MHD' || t === 'MD' || t === 'MOHD' || t === 'SIMOHAMED' || t === 'SIMOHAMMED') {
    return 'MOHAMED';
  }
  t = t.replace(/AA/g, 'A').replace(/EE/g, 'E').replace(/II/g, 'I').replace(/OO/g, 'O')
       .replace(/MM/g, 'M').replace(/DD/g, 'D').replace(/SS/g, 'S').replace(/LL/g, 'L')
       .replace(/BB/g, 'B').replace(/TT/g, 'T').replace(/RR/g, 'R').replace(/FF/g, 'F')
       .replace(/KK/g, 'K').replace(/ZZ/g, 'Z').replace(/NN/g, 'N');
  if (t.startsWith('OU') && t.length > 2 && ['A', 'E', 'I', 'O', 'Y'].includes(t[2])) {
    t = 'W' + t.slice(2);
  }
  if (t.endsWith('INE')) t = t.slice(0, -3) + 'IN';
  if (t.endsWith('ANE') && t.length > 4) t = t.slice(0, -3) + 'AN';
  if (t.endsWith('E') && t.length > 4 && !['E', 'I', 'O', 'U'].includes(t[t.length - 2])) {
    t = t.slice(0, -1);
  }
  return t;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val = (a[i - 1] === b[j - 1]) ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshtein(a, b)) / maxLen;
}

function extractTokens(name) {
  const cleaned = cleanString(name);
  if (!cleaned) return { raw: '', baseTokens: [], harmonizedTokens: [], canonical: '', harmonizedCanonical: '' };
  const rawTokens = cleaned.split(' ').filter(Boolean);
  const expandedTokens = [];
  for (const t of rawTokens) {
    if ((t.startsWith('EL') || t.startsWith('AL')) && t.length > 3) {
      expandedTokens.push('EL');
      expandedTokens.push(t.slice(2));
    } else if (t.startsWith('BEN') && t.length > 4) {
      expandedTokens.push('BEN');
      expandedTokens.push(t.slice(3));
    } else if (t.startsWith('AIT') && t.length > 4) {
      expandedTokens.push('AIT');
      expandedTokens.push(t.slice(3));
    } else {
      expandedTokens.push(t);
    }
  }
  const significantTokens = expandedTokens.filter(t => !['EL', 'AL', 'BEN', 'IBN', 'AIT', 'ABOU', 'BOU', 'OULD'].includes(t));
  const baseTokens = significantTokens.length > 0 ? significantTokens : expandedTokens;
  const harmonized = baseTokens.map(harmonizeToken).filter(Boolean);
  return {
    raw: cleaned,
    baseTokens,
    harmonizedTokens: harmonized,
    canonical: [...baseTokens].sort().join(' '),
    harmonizedCanonical: [...harmonized].sort().join(' '),
  };
}

const preindexed = blacklist.map(entry => ({ entry, sig: extractTokens(entry.fullName) }));

function matchName(name) {
  if (!name || name.trim().length < 3) return null;
  const qSig = extractTokens(name);
  if (qSig.baseTokens.length === 0) return null;

  // If candidate has only 1 significant word, don't match unless exact
  const isSingleToken = qSig.baseTokens.length < 2;

  let bestMatch = null;
  let highestScore = 0;
  let matchType = 'NONE';

  for (const item of preindexed) {
    const bSig = item.sig;
    
    // Exact raw string
    if (qSig.raw === bSig.raw) {
      return { matchType: 'EXACT', score: 1.0, entry: item.entry };
    }
    // Exact canonical (order reversed e.g. ABAZAOUIA JALAL vs JALAL ABAZAOUIA)
    if (qSig.canonical === bSig.canonical) {
      return { matchType: 'EXACT', score: 1.0, entry: item.entry };
    }
    // Exact harmonized canonical
    if (qSig.harmonizedCanonical === bSig.harmonizedCanonical) {
      return { matchType: 'EXACT', score: 0.98, entry: item.entry };
    }

    if (isSingleToken) {
      continue; // Skip fuzzy match if only 1 word given (prevents generic first name false-positives)
    }

    const qTokens = qSig.harmonizedTokens;
    const bTokens = bSig.harmonizedTokens;
    if (qTokens.length === 0 || bTokens.length === 0) continue;

    // Both words must find a pairing with similarity >= 0.78
    const usedB = new Set();
    let pairScores = [];

    for (const qt of qTokens) {
      let bestSim = 0;
      let bestBIdx = -1;
      for (let bi = 0; bi < bTokens.length; bi++) {
        if (usedB.has(bi)) continue;
        const sim = similarity(qt, bTokens[bi]);
        if (sim > bestSim) {
          bestSim = sim;
          bestBIdx = bi;
        }
      }
      if (bestSim >= 0.78 && bestBIdx !== -1) {
        usedB.add(bestBIdx);
        pairScores.push(bestSim);
      }
    }

    // Require that at least 2 tokens matched, AND at least 80% of candidate's tokens matched
    if (pairScores.length >= 2 && (pairScores.length / qTokens.length) >= 0.8) {
      const avgPairScore = pairScores.reduce((a, b) => a + b, 0) / pairScores.length;
      const coverage = pairScores.length / Math.max(qTokens.length, bTokens.length);
      const overallScore = (avgPairScore * 0.7) + (coverage * 0.3);

      if (overallScore > highestScore) {
        highestScore = overallScore;
        bestMatch = item.entry;
        if (overallScore >= 0.90) {
          matchType = 'HIGH';
        } else if (overallScore >= 0.82) {
          matchType = 'MEDIUM';
        }
      }
    }
  }

  if (highestScore >= 0.82 && bestMatch) {
    return {
      matchType,
      score: Math.round(highestScore * 100) / 100,
      entry: bestMatch,
    };
  }
  return null;
}

async function main() {
  const [drivers, leads] = await Promise.all([
    prisma.driverProfile.findMany({
      select: { id: true, fullName: true, phoneSanitized: true, cinNumber: true, isRedFlagged: true }
    }),
    prisma.lead.findMany({
      select: { id: true, raw_name: true, sanitized_phone: true, board_column: true }
    })
  ]);

  console.log(`Auditing ${drivers.length} drivers and ${leads.length} leads against National Blacklist...`);

  const matchedDrivers = [];
  for (const d of drivers) {
    const match = matchName(d.fullName);
    if (match) {
      matchedDrivers.push({ driver: d, match });
    }
  }

  const matchedLeads = [];
  for (const l of leads) {
    const match = matchName(l.raw_name);
    if (match) {
      matchedLeads.push({ lead: l, match });
    }
  }

  console.log(`\n🚨 FOUND ${matchedDrivers.length} MATCHED DRIVERS ON NATIONAL BLACKLIST:`);
  for (const m of matchedDrivers) {
    console.log(`  - DRIVER: "${m.driver.fullName}" (CIN: ${m.driver.cinNumber})`);
    console.log(`    -> MATCHED LIST: "${m.match.entry.fullName}" [${m.match.matchType} - ${(m.match.score*100).toFixed(0)}%]`);
    console.log(`    -> VILLE: ${m.match.entry.city} | DATE: ${m.match.entry.date} | MOTIF: ${m.match.entry.reason}\n`);
  }

  console.log(`🚨 FOUND ${matchedLeads.length} MATCHED LEADS ON NATIONAL BLACKLIST:`);
  for (const m of matchedLeads.slice(0, 15)) {
    console.log(`  - LEAD: "${m.lead.raw_name}" (Phone: ${m.lead.sanitized_phone}, Column: ${m.lead.board_column})`);
    console.log(`    -> MATCHED LIST: "${m.match.entry.fullName}" [${m.match.matchType} - ${(m.match.score*100).toFixed(0)}%]`);
    console.log(`    -> VILLE: ${m.match.entry.city} | MOTIF: ${m.match.entry.reason}\n`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
