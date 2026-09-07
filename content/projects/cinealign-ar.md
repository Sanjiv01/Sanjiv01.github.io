---
title: "Identity-Centric Autoregressive Multi-Shot Video Generation"
tags: ["Diffusion Models", "Autoregressive Modeling", "Video Generation"]
---

A conversion of a full-sequence video diffusion model into an autoregressive, causally-masked generator — built to keep a character's identity consistent across multiple shots while cutting inference cost sharply.

**Repo:** [github.com/Sanjiv01/CineAlign-AR](https://github.com/Sanjiv01/CineAlign-AR)

---

## What It Does

Full-sequence diffusion models generate strong single shots, but multi-shot video — the same character across cuts — tends to drift in identity from one shot to the next, and generating the whole sequence at once is expensive. CineAlign-AR reworks a full-sequence diffusion model into an autoregressive generator with causal masking and KV caching, generating shots in sequence while conditioning each one on the identity established by the shots before it.

## Key Results

- Improved cross-shot identity retention by **28% (ArcFace)** compared to the base full-sequence model.
- Cut inference time by **50%** and VRAM usage by **42%** by moving to autoregressive generation.
- Preserved generation quality while making multi-shot generation causal instead of full-sequence.

## Approach

- **Autoregressive conversion:** the base full-sequence diffusion model is restructured to generate shots sequentially, with **causal masking** ensuring each shot only attends to previously generated context.
- **KV caching:** reuses key/value states across shots instead of recomputing them, which is what drives the inference-time and VRAM savings.
- **Identity conditioning:** each new shot is conditioned on the identity signal from prior shots, measured quantitatively with **ArcFace** face-embedding similarity across shots.
