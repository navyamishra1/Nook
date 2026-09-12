# Nook Recommendation Evaluation Report

## 1. Objective
The objective of this evaluation is to determine whether Nook's multi-signal **Hybrid Recommendation Engine** (combining TF-IDF content similarity, recency/progress-weighted category affinity, active reading context, author behavior, target duration proximity, and Maximal Marginal Relevance diversity reranking) provides superior discovery performance and recommendation quality compared to an independent **Category-Frequency Popularity Baseline** under a reproducible offline simulation.

---

## 2. Dataset
- **Catalog Corpus**: Nook 105-book verified public-domain seed dataset (`data/seed/books.json`).
- **Eligible Candidate Pool**: 105 hostable public-domain classics with complete metadata (titles, authors, publication years, genre taxonomies, word counts, estimated reading durations, and cover configs).
- **Evaluation Units**: 8 distinct, multi-book reading sessions spanning distinct reader genre affinities (Gothic & Horror, Science Fiction & Speculative, Classic Mystery & Detective, Regency Romance & Manners, Philosophy & Moral Contemplation, Perilous Adventure, Victorian Epics, and Broad Exploration Across Shelves).

---

## 3. Evaluation Protocol
- **Methodology**: Chronological Leave-One-Out (LOO) Offline Holdout.
- **Simulation**:
  1. For each reader history with $N \ge 4$ sequentially explored books, the earliest $N - 1$ books are assigned to the training history.
  2. The $N$-th (most recent) book is held out as the ground-truth target item ($y$).
  3. The recommendation engine generates Top-$K$ recommendations from the training history state alone.
  4. The generated recommendations are evaluated against the held-out ground truth item $y$ for $K \in \{1, 3, 5, 10\}$.
- **Data Leakage Invariant**: The held-out item $y$ is strictly masked from the user profile calculation, active book similarity, author affinity accumulation, and length tracking.

---

## 4. Ground Truth Definition
Under offline holdout simulation, ground truth relevance is defined as:
$$\text{Relevance}(b) = \begin{cases} 1 & \text{if } b \in \text{HeldOutItems} \\ 0 & \text{otherwise} \end{cases}$$
Because offline logs reflect actual subsequent reading selections made by the reader, a recommendation is considered a success ("hit") if the engine ranks the user's subsequently chosen book within the Top-$K$ recommendations.

---

## 5. Baseline Definition
- **System**: **Category-Frequency Popularity Baseline** (`runBaselineRecommender`).
- **Mechanism**:
  1. Counts category frequencies across the user's training history.
  2. Excludes completed books and the current active reading book.
  3. Scores each candidate book in the catalog by the sum of matching category frequencies in the user's training history.
  4. Ranks candidates deterministically by score descending, publication year ascending, and title ascending.
- **Independence**: The baseline does not use TF-IDF vector cosine similarity, square-root frequency dampening, author affinity, word count proximity, or MMR diversity reranking.

---

## 6. Evaluation Metrics
The evaluation computes 5 core offline information retrieval metrics across $K \in \{1, 3, 5, 10\}$:

1. **Precision@K**:
   $$\text{Precision@K} = \frac{|\text{Recommended}_K \cap \text{HeldOut}|}{K}$$

2. **Recall@K**:
   $$\text{Recall@K} = \frac{|\text{Recommended}_K \cap \text{HeldOut}|}{|\text{HeldOut}|}$$

3. **Hit Rate@K**:
   $$\text{Hit Rate@K} = \mathbb{I}(|\text{Recommended}_K \cap \text{HeldOut}| > 0)$$

4. **Catalog Coverage**:
   $$\text{Coverage@K} = \frac{|\bigcup_{u} \text{Recommended}_{K, u}|}{|\text{Eligible Catalog}|}$$

5. **Intra-List Recommendation Diversity**:
   $$\text{Diversity}(R_K) = \frac{2}{K(K-1)} \sum_{i < j} \left(1 - \frac{|C_i \cap C_j|}{|C_i \cup C_j|}\right)$$
   Where $C_i$ denotes the set of categories for book $r_i$.

---

## 7. Empirical Results

### Hybrid vs. Baseline Comparison Table

| Metric | K | Baseline | Nook Hybrid | Difference | Relative Lift (%) |
|:---|---:|---:|---:|---:|---:|
| **Precision** | 1 | 0.2500 | 0.2500 | +0.0000 | +0.00% |
| **Recall** | 1 | 0.2500 | 0.2500 | +0.0000 | +0.00% |
| **Hit Rate** | 1 | 0.2500 | 0.2500 | +0.0000 | +0.00% |
| **Catalog Coverage** | 1 | 7.62% | 7.62% | +0.0000 | +0.00% |
| **Intra-List Diversity** | 1 | 1.0000 | 1.0000 | +0.0000 | +0.00% |
| | | | | | |
| **Precision** | 3 | 0.1250 | **0.2500** | **+0.1250** | **+100.00%** |
| **Recall** | 3 | 0.3750 | **0.7500** | **+0.3750** | **+100.00%** |
| **Hit Rate** | 3 | 0.3750 | **0.7500** | **+0.3750** | **+100.00%** |
| **Catalog Coverage** | 3 | 20.95% | **21.90%** | **+0.95%** | **+4.53%** |
| **Intra-List Diversity** | 3 | 0.3714 | **0.6120** | **+0.2406** | **+64.78%** |
| | | | | | |
| **Precision** | 5 | 0.1000 | **0.1500** | **+0.0500** | **+50.00%** |
| **Recall** | 5 | 0.5000 | **0.7500** | **+0.2500** | **+50.00%** |
| **Hit Rate** | 5 | 0.5000 | **0.7500** | **+0.2500** | **+50.00%** |
| **Catalog Coverage** | 5 | 32.38% | **33.33%** | **+0.95%** | **+2.93%** |
| **Intra-List Diversity** | 5 | 0.4378 | **0.6597** | **+0.2219** | **+50.69%** |
| | | | | | |
| **Precision** | 10 | 0.0750 | 0.0750 | +0.0000 | +0.00% |
| **Recall** | 10 | 0.7500 | 0.7500 | +0.0000 | +0.00% |
| **Hit Rate** | 10 | 0.7500 | 0.7500 | +0.0000 | +0.00% |
| **Catalog Coverage** | 10 | **57.14%** | 52.38% | -4.76% | -8.33% |
| **Intra-List Diversity** | 10 | 0.5550 | **0.6863** | **+0.1313** | **+23.66%** |

---

## 8. Analysis & Key Insights

1. **Top-3 and Top-5 Discovery Superiority**:
   - At $K = 3$, the Hybrid engine achieves a **+100.00% lift in Hit Rate (0.7500 vs 0.3750)** and **+100.00% lift in Precision (0.2500 vs 0.1250)** over the category baseline.
   - At $K = 5$ (Nook's default UI card count for *"Picked For You"*), the Hybrid engine achieves **0.7500 Hit Rate (75% of held-out books discovered)** compared to 0.5000 for the baseline (**+50.00% relative lift**).

2. **Significantly Higher Recommendation Diversity**:
   - Across all cutoffs ($K=3, 5, 10$), the Hybrid engine exhibits significantly higher intra-list diversity (**0.6597 vs 0.4378 at $K=5$, a +50.69% increase**).
   - This validates that Maximal Marginal Relevance (MMR) effectively penalizes categorical redundancy and prevents recommendation list monotony without degrading precision.

3. **Catalog Coverage Dynamics**:
   - At Top-3 and Top-5, the Hybrid engine covers a slightly larger fraction of the catalog than the popularity baseline (33.33% vs 32.38%).
   - At $K=10$, the category baseline reaches 57.14% coverage by blindly ranking ties alphabetically, whereas the Hybrid engine focuses recommendations on semantically relevant neighborhood clusters.

---

## 9. Cold-Start Evaluation (Zero History)
- **Hybrid Starter Count**: Exactly 5 curated pillar books (*Frankenstein*, *The War of the Worlds*, *Treasure Island*, *A Study in Scarlet*, *Meditations*).
- **Hybrid Cold-Start Diversity**: **0.8210** (spanning Gothic, Sci-Fi, Adventure, Detective, and Philosophy).
- **Baseline Cold-Start Diversity**: 0.7162.
- **Stability**: 100% deterministic across repeated calls.

---

## 10. Data Leakage & Invariance Verification
- **Holdout Masking**: Zero data leakage detected. Held-out test books were verified to be strictly excluded from user training vectors, category profiles, and historical comparisons.
- **Input Immutability**: Verified that neither the catalog, reading history, nor candidate pools were mutated during evaluation passes.
- **Recommender Invariance**: Confirmed that recommender scoring algorithms, TF-IDF weights, and MMR penalty factors were unchanged and frozen.

---

## 11. Limitations
1. **Offline Proxy Limitation**: Offline holdout evaluation measures retrospective hit rate on historical reading sequences. It does not measure real-time reader serendipity or unrecorded exploratory reading.
2. **Catalog Scale**: The evaluation is conducted on Nook's verified 105-book public-domain collection. Performance on multi-thousand or multi-million book commercial catalogs would require scalable ANN vector indexing (e.g. HNSW/IVF).
3. **No Explicit Negative Feedback**: Nook tracks exploration and completion rather than explicit 1-star ratings; implicit completion serves as positive signal.

---

## 12. Reproducibility
The complete evaluation can be deterministically reproduced at any time via:
```bash
node scratch/run_recommendation_evaluation.js
```
The machine-readable results will be written to `docs/recommendation-evaluation-results.json`.
