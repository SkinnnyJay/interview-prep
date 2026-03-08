/**
 * Text Ranking and Scoring Algorithms
 *
 * This module implements various algorithms for ranking and scoring text documents
 * based on relevance to search queries. These are fundamental to search engines
 * and information retrieval systems.
 *
 * Algorithms implemented:
 * - TF-IDF (Term Frequency-Inverse Document Frequency)
 * - BM25 (Best Matching 25)
 * - Cosine Similarity
 * - Custom scoring functions
 */

import { SearchableItem, BM25Config, TFIDFConfig } from "../types";

export class RankingAlgorithms {
  /**
   * TF-IDF (Term Frequency-Inverse Document Frequency)
   *
   * Why: Classic information retrieval algorithm that balances term frequency with rarity
   * When: Document ranking, keyword extraction, content similarity
   * Formula: TF(t,d) * IDF(t) where IDF(t) = log(N / df(t))
   */
  static calculateTFIDF(
    documents: SearchableItem[],
    query: string,
    config: TFIDFConfig = {
      useLogNormalization: true,
      useSublinearScaling: false,
      smoothIdf: true,
    }
  ): Array<{ item: SearchableItem; score: number; termScores: Record<string, number> }> {
    // Tokenize query
    const queryTerms = this.tokenize(query.toLowerCase());
    if (queryTerms.length === 0) return [];

    // Build document term frequencies
    const documentTerms = documents.map((doc) => {
      const text = this.extractText(doc).toLowerCase();
      const _terms = this.tokenize(text);
      return { doc, terms: _terms, termFreq: this.calculateTermFrequency(_terms) };
    });

    // Calculate document frequencies for each term
    const documentFrequencies = this.calculateDocumentFrequencies(
      documentTerms.map((d) => d.terms)
    );
    const totalDocuments = documents.length;

    const results: Array<{
      item: SearchableItem;
      score: number;
      termScores: Record<string, number>;
    }> = [];

    for (const { doc, termFreq } of documentTerms) {
      let totalScore = 0;
      const termScores: Record<string, number> = {};

      for (const queryTerm of queryTerms) {
        const tf = termFreq[queryTerm] || 0;
        if (tf === 0) continue;

        // Calculate TF component
        let tfComponent: number;
        if (config.useLogNormalization) {
          tfComponent = Math.log(1 + tf);
        } else if (config.useSublinearScaling) {
          tfComponent = 1 + Math.log(tf);
        } else {
          tfComponent = tf;
        }

        // Calculate IDF component
        const df = documentFrequencies[queryTerm] || 0;
        let idfComponent: number;

        if (config.smoothIdf) {
          idfComponent = Math.log(totalDocuments / (1 + df)) + 1;
        } else {
          idfComponent = Math.log(totalDocuments / Math.max(1, df));
        }

        const tfidfScore = tfComponent * idfComponent;
        termScores[queryTerm] = tfidfScore;
        totalScore += tfidfScore;
      }

      if (totalScore > 0) {
        results.push({ item: doc, score: totalScore, termScores });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * BM25 (Best Matching 25)
   *
   * Why: Improved version of TF-IDF that handles term frequency saturation better
   * When: Modern search engines, better ranking than TF-IDF for most cases
   * Formula: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * |d|/avgdl))
   */
  static calculateBM25(
    documents: SearchableItem[],
    query: string,
    config: BM25Config = {
      k1: 1.2, // Controls term frequency saturation
      b: 0.75, // Controls length normalization
    }
  ): Array<{ item: SearchableItem; score: number; termScores: Record<string, number> }> {
    const queryTerms = this.tokenize(query.toLowerCase());
    if (queryTerms.length === 0) return [];

    // Prepare document data
    const documentData = documents.map((doc) => {
      const text = this.extractText(doc).toLowerCase();
      const _terms = this.tokenize(text);
      return {
        doc,
        terms: _terms,
        length: _terms.length,
        termFreq: this.calculateTermFrequency(_terms),
      };
    });

    // Calculate average document length
    const avgDocLength =
      config.avgDocLength ||
      documentData.reduce((sum, d) => sum + d.length, 0) / documentData.length;

    // Calculate document frequencies
    const documentFrequencies = this.calculateDocumentFrequencies(documentData.map((d) => d.terms));
    const totalDocuments = documents.length;

    const results: Array<{
      item: SearchableItem;
      score: number;
      termScores: Record<string, number>;
    }> = [];

    for (const { doc, length, termFreq } of documentData) {
      let totalScore = 0;
      const termScores: Record<string, number> = {};

      for (const queryTerm of queryTerms) {
        const tf = termFreq[queryTerm] || 0;
        if (tf === 0) continue;

        // Calculate IDF component
        const df = documentFrequencies[queryTerm] || 0;
        const rawIdf = Math.log((totalDocuments - df + 0.5) / (df + 0.5));
        const idf = Math.max(0.001, rawIdf);

        // Calculate BM25 score for this term
        const numerator = tf * (config.k1 + 1);
        const denominator = tf + config.k1 * (1 - config.b + config.b * (length / avgDocLength));
        const bm25Score = idf * (numerator / denominator);

        termScores[queryTerm] = bm25Score;
        totalScore += bm25Score;
      }

      if (totalScore > 0) {
        results.push({ item: doc, score: totalScore, termScores });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Cosine Similarity with TF-IDF Vectors
   *
   * Why: Measures angle between query and document vectors, good for similarity
   * When: Document similarity, clustering, recommendation systems
   */
  static calculateCosineSimilarity(
    documents: SearchableItem[],
    query: string
  ): Array<{ item: SearchableItem; score: number }> {
    const queryTerms = this.tokenize(query.toLowerCase());
    if (queryTerms.length === 0) return [];

    // Build vocabulary from all documents and query
    const vocabulary = new Set<string>();
    const documentTerms = documents.map((doc) => {
      const text = this.extractText(doc).toLowerCase();
      const terms = this.tokenize(text);
      terms.forEach((term) => vocabulary.add(term));
      return { doc, terms };
    });

    queryTerms.forEach((term) => vocabulary.add(term));
    const vocabArray = Array.from(vocabulary);

    // Calculate document frequencies for IDF
    const allTerms = documentTerms.map((d) => d.terms);
    const documentFrequencies = this.calculateDocumentFrequencies(allTerms);
    const totalDocuments = documents.length;

    // Create TF-IDF vector for query
    const queryTermFreq = this.calculateTermFrequency(queryTerms);
    const queryVector = vocabArray.map((term) => {
      const tf = queryTermFreq[term] || 0;
      if (tf === 0) return 0;

      const df = documentFrequencies[term] || 0;
      const idf = Math.log(totalDocuments / Math.max(1, df));
      return tf * idf;
    });

    const results: Array<{ item: SearchableItem; score: number }> = [];

    for (const { doc, terms } of documentTerms) {
      const termFreq = this.calculateTermFrequency(terms);

      // Create TF-IDF vector for document
      const docVector = vocabArray.map((term) => {
        const tf = termFreq[term] || 0;
        if (tf === 0) return 0;

        const df = documentFrequencies[term] || 0;
        const idf = Math.log(totalDocuments / Math.max(1, df));
        return tf * idf;
      });

      // Calculate cosine similarity
      const similarity = this.cosineSimilarityVectors(queryVector, docVector);

      if (similarity > 0) {
        results.push({ item: doc, score: similarity });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Custom Scoring Function
   *
   * Why: Combine multiple signals for more sophisticated ranking
   * When: You need domain-specific ranking that considers multiple factors
   */
  static customScore(
    documents: SearchableItem[],
    query: string,
    weights: {
      textRelevance: number;
      titleBoost: number;
      recencyBoost: number;
      popularityBoost: number;
    } = {
      textRelevance: 0.7,
      titleBoost: 0.2,
      recencyBoost: 0.05,
      popularityBoost: 0.05,
    }
  ): Array<{ item: SearchableItem; score: number; components: Record<string, number> }> {
    const queryTerms = this.tokenize(query.toLowerCase());
    if (queryTerms.length === 0) return [];

    // Get BM25 scores for text relevance
    const bm25Results = this.calculateBM25(documents, query);
    const bm25Map = new Map(bm25Results.map((r) => [r.item.id, r.score]));

    // Normalize BM25 scores
    const maxBM25 = Math.max(...bm25Results.map((r) => r.score));

    const results: Array<{
      item: SearchableItem;
      score: number;
      components: Record<string, number>;
    }> = [];

    for (const doc of documents) {
      const components: Record<string, number> = {};

      // Text relevance (normalized BM25)
      const bm25Score = bm25Map.get(doc.id) || 0;
      components.textRelevance = maxBM25 > 0 ? bm25Score / maxBM25 : 0;

      // Title boost (if query terms appear in title)
      components.titleBoost = this.calculateTitleBoost(doc.title, queryTerms);

      // Recency boost (newer documents get higher scores)
      const createdAt: Date =
        (doc as unknown as { createdAt?: Date }).createdAt instanceof Date
          ? (doc as unknown as { createdAt?: Date }).createdAt!
          : new Date();
      components.recencyBoost = this.calculateRecencyBoost(createdAt);

      // Popularity boost (based on metadata if available)
      components.popularityBoost = this.calculatePopularityBoost(doc.metadata);

      // Calculate weighted final score
      const finalScore =
        components.textRelevance * weights.textRelevance +
        components.titleBoost * weights.titleBoost +
        components.recencyBoost * weights.recencyBoost +
        components.popularityBoost * weights.popularityBoost;

      if (finalScore > 0) {
        results.push({ item: doc, score: finalScore, components });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Helper Methods
   */

  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  private static extractText(doc: SearchableItem): string {
    return [doc.title, doc.description || "", doc.content || "", (doc.tags || []).join(" ")].join(
      " "
    );
  }

  private static calculateTermFrequency(terms: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const term of terms) {
      freq[term] = (freq[term] || 0) + 1;
    }
    return freq;
  }

  private static calculateDocumentFrequencies(documentTerms: string[][]): Record<string, number> {
    const df: Record<string, number> = {};

    for (const terms of documentTerms) {
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        df[term] = (df[term] || 0) + 1;
      }
    }

    return df;
  }

  private static cosineSimilarityVectors(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    const cosine = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
    // Clamp small floating point drift
    if (cosine > 0.999999) return 1.0;
    return cosine;
  }

  private static calculateTitleBoost(title: string, queryTerms: string[]): number {
    const titleTerms = this.tokenize(title.toLowerCase());
    const titleTermSet = new Set(titleTerms);

    let matches = 0;
    for (const queryTerm of queryTerms) {
      if (titleTermSet.has(queryTerm)) {
        matches++;
      }
    }

    return queryTerms.length > 0 ? matches / queryTerms.length : 0;
  }

  private static calculateRecencyBoost(createdAt: Date): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: newer documents get higher scores
    return Math.exp(-ageInDays / 365); // Half-life of 1 year
  }

  private static calculatePopularityBoost(metadata?: Record<string, unknown>): number {
    if (!metadata) return 0;

    // Example: use view count, likes, or other popularity signals
    const views = Number(metadata.views) || 0;
    const likes = Number(metadata.likes) || 0;
    const shares = Number(metadata.shares) || 0;

    // Simple popularity score (could be more sophisticated)
    const popularityScore = Math.log(1 + views + likes * 2 + shares * 3);

    // Normalize to 0-1 range (assuming max popularity score of ~10)
    return Math.min(1, popularityScore / 10);
  }
}
