---
title: "SARI: Adaptive Re-Injection for Robust LLM Steering"
tags: ["LLMs", "Interpretability", "Sparse Autoencoders"]
---

A training-free method for steering LLM outputs toward a target concept, using sparse autoencoders as both a monitor and an intervention point — holding feature activations stable across generations of over 1,000 tokens.

**Repo:** [github.com/Sanjiv01/SARI-SAE-Based-Adaptive-Re-Injection-for-LLM-Steering](https://github.com/Sanjiv01/SARI-SAE-Based-Adaptive-Re-Injection-for-LLM-Steering)

---

## What It Does

Most activation-steering methods add a fixed intervention once and hope it survives the rest of generation — but steering effects decay as a model generates more tokens. SARI (SAE-based Adaptive Re-Injection) instead uses a sparse autoencoder to continuously monitor a target feature's activation during generation and re-injects the steering signal whenever it drifts, keeping the intended concept present without retraining the model.

## Key Results

- Designed a **training-free steering method** using sparse autoencoders as both monitor and intervention.
- Held target feature activations **stable across 1,024-token generations** — well beyond where static steering typically decays.
- **Outperformed all 3 baselines** on Alpaca-Eval for concept adherence and fluency simultaneously.

## Approach

- **Monitor:** a sparse autoencoder trained on model activations tracks the strength of a target concept's feature at every generation step.
- **Adaptive re-injection:** rather than a one-shot activation add, the steering vector is re-applied dynamically whenever the monitored feature falls below a target threshold, correcting for drift in real time.
- **Evaluation:** compared against three existing steering baselines on Alpaca-Eval, measured on both concept adherence (did the steering hold?) and fluency (did the text stay coherent?) — the two objectives that are normally in tension for steering methods.
