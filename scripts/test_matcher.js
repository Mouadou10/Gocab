const fs = require('fs');
const path = require('path');

// Load blacklist data
const blacklist = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/national_blacklist.json'), 'utf8'));

// Moroccan Name Harmonizer
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

  // Normalize common prefix attachments (e.g. ELAMRANI -> AMRANI, BENCHEIKH -> CHEIKH if needed, or keep unified)
  // For standard Moroccan name tokens:
  if (t === 'MED' || t === 'MHD' || t === 'MD' || t === 'MOHD' || t === 'SIMOHAMED' || t === 'SIMOHAMMED') {
    return 'MOHAMED';
  }

  // Reduce common double letters
  t = t.replace(/AA/g, 'A');
  t = t.replace(/EE/g, 'E');
  t = t.replace(/II/g, 'I');
  t = t.replace(/OO/g, 'O');
  t = t.replace(/MM/g, 'M');
  t = t.replace(/DD/g, 'D');
  t = t.replace(/SS/g, 'S');
  t = t.replace(/LL/g, 'L');
  t = t.replace(/BB/g, 'B');
  t = t.replace(/TT/g, 'T');
  t = t.replace(/RR/g, 'R');
  t = t.replace(/FF/g, 'F');
  t = t.replace(/KK/g, 'K');
  t = t.replace(/ZZ/g, 'Z');
  t = t.replace(/NN/g, 'N');

  // Transliteration variants: OU <-> U / W
  // e.g. OUALID -> WALID, OUASSIM -> WASSIM
  if (t.startsWith('OU') && t.length > 2) {
    const nextChar = t[2];
    if (['A', 'E', 'I', 'O', 'Y'].includes(nextChar)) {
      t = 'W' + t.slice(2);
    }
  }

  // Common endings
  if (t.endsWith('INE')) {
    t = t.slice(0, -3) + 'IN';
  }
  if (t.endsWith('ANE') && t.length > 4) {
    t = t.slice(0, -3) + 'AN';
  }
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
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
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
  const dist = levenshtein(a, b);
  return (maxLen - dist) / maxLen;
}

// Tokenize and extract canonical signatures
function extractTokens(name) {
  const cleaned = cleanString(name);
  if (!cleaned) return { raw: '', tokens: [], harmonizedTokens: [], canonical: '', harmonizedCanonical: '' };

  const rawTokens = cleaned.split(' ').filter(Boolean);
  
  // Also split any glued Moroccan particles e.g. ELAMRANI -> [EL, AMRANI], BENCHEIKH -> [BEN, CHEIKH], AITSALAH -> [AIT, SALAH]
  const expandedTokens = [];
  for (const t of rawTokens) {
    if (t.startsWith('EL') && t.length > 3) {
      expandedTokens.push('EL');
      expandedTokens.push(t.slice(2));
    } else if (t.startsWith('AL') && t.length > 3) {
      expandedTokens.push('EL');
      expandedTokens.push(t.slice(2));
    } else if (t.startsWith('BEN') && t.length > 4) {
      expandedTokens.push('BEN');
      expandedTokens.push(t.slice(3));
    } else if (t.startsWith('AIT') && t.length > 4) {
      expandedTokens.push('AIT');
      expandedTokens.push(t.slice(3));
    } else if (t.startsWith('ABOU') && t.length > 5) {
      expandedTokens.push('ABOU');
      expandedTokens.push(t.slice(4));
    } else {
      expandedTokens.push(t);
    }
  }

  // Filter out standalone particles when building sorted canonical base for matching
  const significantTokens = expandedTokens.filter(t => !['EL', 'AL', 'BEN', 'IBN', 'AIT', 'ABOU', 'BOU', 'OULD', 'DE'].includes(t));
  const baseTokens = significantTokens.length > 0 ? significantTokens : expandedTokens;

  const harmonized = baseTokens.map(harmonizeToken).filter(Boolean);

  const sortedRaw = [...baseTokens].sort();
  const sortedHarmonized = [...harmonized].sort();

  return {
    raw: cleaned,
    tokens: rawTokens,
    baseTokens,
    harmonizedTokens: harmonized,
    canonical: sortedRaw.join(' '),
    harmonizedCanonical: sortedHarmonized.join(' '),
  };
}

// Pre-index the blacklist
const preindexed = blacklist.map(entry => {
  const sig = extractTokens(entry.fullName);
  return {
    entry,
    sig,
  };
});

function matchNationalBlacklist(queryName, threshold = 0.78) {
  if (!queryName) return null;
  const qSig = extractTokens(queryName);
  if (qSig.baseTokens.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;
  let matchType = 'NONE';

  for (const item of preindexed) {
    const bSig = item.sig;

    // 1. Exact raw string
    if (qSig.raw === bSig.raw) {
      return {
        isBlacklisted: true,
        matchType: 'EXACT',
        score: 1.0,
        matchedEntry: item.entry,
      };
    }

    // 2. Exact sorted tokens (handles word order inversion e.g. ABAZAOUIA JALAL vs JALAL ABAZAOUIA)
    if (qSig.canonical === bSig.canonical) {
      return {
        isBlacklisted: true,
        matchType: 'EXACT',
        score: 1.0,
        matchedEntry: item.entry,
      };
    }

    // 3. Exact harmonized tokens (handles double letters, common transliterations)
    if (qSig.harmonizedCanonical === bSig.harmonizedCanonical) {
      return {
        isBlacklisted: true,
        matchType: 'EXACT',
        score: 0.98,
        matchedEntry: item.entry,
      };
    }

    // 4. Token-by-token matching
    const qTokens = qSig.harmonizedTokens;
    const bTokens = bSig.harmonizedTokens;

    if (qTokens.length === 0 || bTokens.length === 0) continue;

    // Calculate maximum bipartite token matching score
    let totalTokenSim = 0;
    let matchedCount = 0;

    for (const qt of qTokens) {
      let maxSim = 0;
      for (const bt of bTokens) {
        const s = similarity(qt, bt);
        if (s > maxSim) maxSim = s;
      }
      if (maxSim >= 0.75) {
        matchedCount++;
        totalTokenSim += maxSim;
      }
    }

    const minTokenCount = Math.min(qTokens.length, bTokens.length);
    const maxTokenCount = Math.max(qTokens.length, bTokens.length);

    // If all tokens of the smaller set match well with the larger set
    const tokenCoverage = matchedCount / maxTokenCount;
    const avgSim = matchedCount > 0 ? totalTokenSim / matchedCount : 0;
    const compositeScore = (tokenCoverage * 0.6) + (avgSim * 0.4);

    // Also compare the sorted harmonized string directly
    const stringSim = similarity(qSig.harmonizedCanonical, bSig.harmonizedCanonical);
    const overallScore = Math.max(compositeScore, stringSim);

    if (overallScore > highestScore) {
      highestScore = overallScore;
      bestMatch = item.entry;
      if (highestScore >= 0.88) {
        matchType = 'HIGH';
      } else if (highestScore >= threshold) {
        matchType = 'MEDIUM';
      }
    }
  }

  if (highestScore >= threshold && bestMatch) {
    return {
      isBlacklisted: true,
      matchType,
      score: Math.round(highestScore * 100) / 100,
      matchedEntry: bestMatch,
    };
  }

  return null;
}

// Test cases
const testQueries = [
  'ABAZAOUIA JALAL', // exact
  'Jalal Abazaouia', // order reversed + casing
  'Amar Abdelkoudous', // spelling: Amar vs Aamar, Abdelkoudous vs Abdelkoudous
  'KHALID EL AMRANI', // El Amrani Khalid
  'Mohamed Ait Salem', // Ait Salem Rachid vs Ait Salem Mohamed
  'Mohammed Bencheikh', // double m, attached ben
  'Bouchaib Bouzendaga', // reversed
  'YASSIN ABAGH', // missing e
  'Hichame Achlouji', // extra e
  'Salim Alami NonExistentPerson999', // should not match
];

console.log('--- TEST RESULTS ---');
for (const q of testQueries) {
  const res = matchNationalBlacklist(q);
  if (res) {
    console.log(`MATCH [${res.matchType} - ${(res.score*100).toFixed(0)}%]: "${q}" -> "${res.matchedEntry.fullName}" (${res.matchedEntry.city}) - Motif: ${res.matchedEntry.reason}`);
  } else {
    console.log(`NO MATCH: "${q}"`);
  }
}
