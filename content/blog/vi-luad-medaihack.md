---
title: "How We Won 1st Place at MedAIHack: Detecting Vascular Invasion in Lung Cancer with ACMIL"
date: April 12, 2026
image: content/images/MedAIHack_win.jpeg
tags: [Medical AI, Computational Pathology, Deep Learning, MIL, Hackathon, Lung Cancer]
---

Our team **Breaking Bad** took **1st place in the VI-LUAD track at MedAIHack** after an intense 9-hour sprint. We built a system that predicts microscopic vascular invasion (VI) in lung adenocarcinoma from digitized whole-slide images (WSIs). Here's a deep dive into exactly how we did it.

## The Problem

Vascular invasion - tumor cells invading blood vessels or lymphatic channels - is a major prognostic factor in lung adenocarcinoma. It's associated with higher metastasis rates and worse outcomes. Pathologists detect it manually by examining H&E-stained slides under a microscope, which is subjective and time-consuming.

Our task: given a patient's WSI slides, predict whether they have vascular invasion (VITUMOR) or not (NONVITUMOR). The catch? Each slide can contain 100,000+ x 100,000+ pixels, and each patient can have multiple slides.

## The Dataset

- **709 whole-slide images** from **245 patients**
- **150 NONVITUMOR** patients, **95 VITUMOR** patients (class imbalanced)
- **203 additional NONTUMOR** slides (no tumor at all - guaranteed negatives)
- Features pre-extracted using **UNI2-h** (ViT-Giant), a pathology foundation model, giving us a **(N_patches, 1536)** feature tensor per slide plus **(N_patches, 2)** spatial coordinates

We never touched raw pixels. The entire pipeline operates on pre-extracted patch embeddings, making this a **Multiple Instance Learning (MIL)** problem: classify a "bag" of patch instances without patch-level labels.

## Data Splitting: No Leakage Allowed

We used **5-fold patient-level stratified cross-validation** via scikit-learn's `StratifiedKFold`. Every slide from a patient stays in the same fold - no leakage between train/test.

Within each fold, we carved out a **15% stratified validation split** (using `StratifiedShuffleSplit`) for:
1. **Early stopping** - halt training when val loss plateaus
2. **Temperature scaling** - post-hoc probability calibration

The optional 203 NONTUMOR slides were added to **training only** as extra negatives, never touching val/test.

## Model Architecture: ACMIL

We used **ACMIL (Attention-Challenging Multiple Instance Learning)**, which solves a critical failure mode of standard attention-based MIL: **attention collapse**, where the model fixates on a handful of patches and ignores the rest.

**Paper:** https://link.springer.com/chapter/10.1007/978-3-031-73668-1_8

### The Full Forward Pass

```
UNI2-h features (N, 1536) + 2D Sinusoidal PE (N, 64)
    → Concatenate → (N, 1600)
    → Feature Projection MLP → (N, 512)
    → 5 Gated Attention Branches (with STKIM during training)
    → 5 Branch Slide Embeddings → 5 Branch Logits (each 1x2)
    → Mean across branches → (1, 2)
    → Temperature scaling → Probability clipping → Output
```

### 2D Sinusoidal Positional Encoding

Each patch has (col, row) grid coordinates on the slide. We encode these into a **64-dimensional** vector using the sinusoidal scheme from [Attention Is All You Need](https://arxiv.org/pdf/1706.03762), extended to 2D:

- First 32 dims: sin/cos of column position at different frequencies
- Last 32 dims: sin/cos of row position at different frequencies

This is concatenated with the 1536-dim UNI2-h features, giving the model spatial awareness - critical because VI occurs in specific spatial contexts (near vessel walls).

### Feature Projection

A simple MLP projects the 1600-dim input down to 512:

```
Linear(1600, 512) → LayerNorm → GELU → Dropout(0.25)
```

LayerNorm (not BatchNorm) because patch counts vary per slide. GELU for smoother gradients.

### Multi-Branch Gated Attention

We use **5 independent attention branches**, each with its own gated attention head and classifier. Each branch computes:

1. **Gated Attention** https://arxiv.org/pdf/1802.04712:
   - `V = tanh(W_v @ h)` - content signal
   - `U = sigmoid(W_u @ h)` - gating signal
   - `attention_logits = W_w @ (V * U)` - per-patch scalar scores

2. **Softmax** over patches → attention weights summing to 1

3. **Weighted sum** → single slide embedding (1, 512)

4. **Branch classifier**: `Dropout(0.25) → Linear(512, 2)`

Having 5 branches acts as an implicit ensemble within the model.

### Stochastic Top-K Instance Masking (STKIM)

The key ACMIL innovation. **During training only**, with probability **0.6**, the **top-10** highest-attended patches are masked (set to -inf before softmax). This forces each branch to look beyond the obvious dominant patches and discover diverse discriminative regions.

At inference, STKIM is disabled - all patches get their natural attention weights.

## AEM: Attention Entropy Maximization

On top of ACMIL, we incorporated **AEM (Attention Entropy Maximization)** as an explicit regularization loss.

**Paper:** https://arxiv.org/pdf/2406.15303

While STKIM forces diversity by masking, AEM provides a **continuous gradient signal** that directly pushes attention distributions toward higher entropy:

```
L_AEM = mean( sum( a_i * log(a_i) ) )   # negative entropy, minimized
```

When attention collapses onto few patches → low entropy → high penalty. When attention spreads broadly → high entropy → low penalty. This is especially important for VI detection where invasion features are subtle and distributed.

## Loss Function

Our total loss combines three components:

```
L_total = L_main + 0.5 * L_branch + 0.01 * L_AEM
```

### Patient-Max BCE (L_main)

This directly optimizes for the evaluation metric:

1. For each slide in a patient's bag, compute `P(VITUMOR)` via softmax on raw logits
2. Take `max(P_VITUMOR)` across all slides (if any slide shows VI, the patient has VI)
3. Apply **label smoothing** (0.05): targets become 0.05 / 0.95 instead of 0 / 1
4. Weighted BCE with **auto pos_weight** = n_negative / n_positive (~1.58) to handle class imbalance

### Branch-Wise CE (L_branch)

Standard cross-entropy on each branch's logits independently, with label smoothing. Keeps each branch individually predictive.

### AEM Regularization (L_AEM)

Negative attention entropy averaged across all branches and slides, as described above.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Optimizer | lr=1e-4, weight_decay=1e-4 |
| LR Schedule | eta_min=1e-6 |
| Epochs | 50 max |
| Early Stopping | Patience = 10 epochs |
| Batch Size | 1 patient per step |
| Gradient Clipping | max_norm = 1.0 |
| Label Smoothing | 0.05 |
| Seeds per Fold | 5 (seeds 42–46) |

Each epoch iterates over every patient. For each patient, all their slides are forward-passed, the max P(VITUMOR) is computed, and the combined loss is backpropagated. Gradients are clipped to prevent exploding gradients from variable-length bags.

## Temperature Scaling

After training, we apply **post-hoc temperature scaling** to calibrate probabilities:

1. Cache all validation patients' raw logits
2. Fit a single scalar T using **LBFGS** (100 iterations, strong Wolfe line search) to minimize patient-level log loss on val
3. At inference: `calibrated_logits = logits / T`

Additionally, probabilities are **clipped to [0.02, 0.98]** to bound worst-case log loss from overconfident wrong predictions.

## Ensembling: 25 Models Deep

Our final submission is a **super-ensemble of 25 models**:

- **5 folds** × **5 seeds** = 25 independently trained ACMIL models
- Each with different weight initialization, data order, and STKIM masking patterns
- At inference, all 25 models' probabilities are **averaged**

This was saved as a single `final_ensemble.pth` checkpoint.

## Inference Pipeline

The locked evaluation script calls `model(features)` - but our model needs `coords` too for positional encoding. We solved this with a **torch.load monkey-patch**:

1. Replace `torch.load` with a wrapper that caches `coords` from each .pt file as it's loaded
2. Wrap the ensemble in a `CoordAwareEnsemble` that reads the cached coords and injects them into the forward pass

The locked code never sees the difference.

## Results

**5-Fold Cross-Validation (Per-Patient):**

| Metric | Mean | Std |
|--------|------|-----|
| Log Loss | 0.6972 | 0.0581 |
| AUC | 0.6512 | 0.0453 |
| Accuracy | 0.6000 | 0.0702 |

The primary failure mode was false positives on NONVITUMOR patients - the max-aggregation rule means even one high-confidence slide tips the prediction toward VITUMOR.

## Key Takeaways

1. **Patient-level splitting is non-negotiable** - slide-level splits leak information and inflate metrics
2. **ACMIL + AEM together** combat attention collapse from two angles: masking (STKIM) and entropy regularization (AEM)
3. **Positional encoding matters** - VI is a spatial phenomenon, and giving the model patch coordinates improved focus on vessel-adjacent regions
4. **Ensemble aggressively** - 25 models with seed + fold diversity gave us robust predictions
5. **Calibrate your probabilities** - temperature scaling + clipping directly improves log loss, the leaderboard metric
