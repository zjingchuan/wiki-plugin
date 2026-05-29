export function tokenize(text) {
    const cleaned = text.toLowerCase().replace(/[^一-鿿\w]/g, " ");
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
    const tokens = [];
    for (const word of words) {
        if (/[一-鿿]/.test(word)) {
            // Chinese: unigrams + bigrams
            for (let i = 0; i < word.length; i++) {
                tokens.push(word[i]);
                if (i < word.length - 1) {
                    tokens.push(word.slice(i, i + 2));
                }
            }
        }
        else if (word.length > 1) {
            tokens.push(word);
        }
    }
    return tokens;
}
export function buildIndex(docs) {
    const tfidfDocs = docs.map((d) => ({
        id: d.id,
        terms: tokenize(d.text),
    }));
    // Compute IDF
    const docCount = tfidfDocs.length;
    const df = new Map();
    for (const doc of tfidfDocs) {
        const seen = new Set(doc.terms);
        for (const term of seen) {
            df.set(term, (df.get(term) || 0) + 1);
        }
    }
    const idf = new Map();
    for (const [term, count] of df) {
        idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
    }
    // Compute TF-IDF vectors
    const vectors = new Map();
    for (const doc of tfidfDocs) {
        const tf = new Map();
        for (const term of doc.terms) {
            tf.set(term, (tf.get(term) || 0) + 1);
        }
        const vec = new Map();
        for (const [term, count] of tf) {
            vec.set(term, (count / doc.terms.length) * (idf.get(term) || 1));
        }
        vectors.set(doc.id, vec);
    }
    return { docs: tfidfDocs, idf, vectors };
}
export function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [term, val] of a) {
        normA += val * val;
        const bVal = b.get(term);
        if (bVal !== undefined)
            dot += val * bVal;
    }
    for (const [, val] of b) {
        normB += val * val;
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
export function queryIndex(index, queryText, topK = 5) {
    const queryTerms = tokenize(queryText);
    const tf = new Map();
    for (const term of queryTerms) {
        tf.set(term, (tf.get(term) || 0) + 1);
    }
    const queryVec = new Map();
    for (const [term, count] of tf) {
        queryVec.set(term, (count / queryTerms.length) * (index.idf.get(term) || 1));
    }
    const scores = [];
    for (const [id, vec] of index.vectors) {
        const score = cosineSimilarity(queryVec, vec);
        if (score > 0) {
            scores.push({ id, score });
        }
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
}
