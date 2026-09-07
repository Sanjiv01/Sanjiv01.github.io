---
title: "Multisensor Spatial Reasoning"
tags: ["Vision-Language Models", "PEFT", "Sensor Fusion", "LoRA/DoRA"]
---

A vision-language fine-tuning pipeline that teaches Qwen3-VL-4B to reason about 3D spatial relationships from camera and LiDAR data, raising NuScenes spatial QA accuracy from 39.96% to 90.37%.

**Repo:** [github.com/Sanjiv01/multisensor-spatial-reasoning](https://github.com/Sanjiv01/multisensor-spatial-reasoning)

---

## What It Does

Spatial reasoning — "is the pedestrian to the left of the car?", "how far is the cyclist?" — is a hard failure mode for general-purpose VLMs. This project fine-tunes Qwen3-VL-4B specifically for it, and fuses camera and LiDAR streams so the model can ground its answers in real 3D geometry instead of guessing from a single 2D image.

## Key Results

- Raised NuScenes spatial QA accuracy from **39.96% to 90.37%** by fine-tuning Qwen3-VL-4B with **rsLoRA + DoRA (r=8)**.
- Built a **camera-LiDAR fusion pipeline** that beat every unimodal baseline on 4 of 5 tasks.
- Generalizes zero-shot to **Waymo, Argoverse 2, and KITTI** — not just the NuScenes training distribution.

## Approach

- **Base model:** Qwen3-VL-4B, adapted with rank-stabilized LoRA combined with DoRA (r=8) rather than full fine-tuning, keeping training lightweight while recovering most of full fine-tuning's accuracy.
- **Sensor fusion:** camera and LiDAR point-cloud features are fused before being passed to the language model, so spatial answers are grounded in metric 3D structure rather than monocular depth cues alone.
- **Evaluation:** benchmarked across five spatial reasoning task types on NuScenes, then stress-tested on three out-of-distribution autonomous-driving datasets to check the fusion approach — not just the fine-tune — actually generalizes.
