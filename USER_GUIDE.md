# ChatBot User Guide

## Overview

ChatBot is a desktop application that allows you to chat with local AI models using Ollama.

All AI processing happens locally on your computer. Your conversations and files are not uploaded to external servers.

---

# Installation

## 1. Install Ollama

Download Ollama:

https://ollama.com/

Install it normally.

Verify installation:

```bash
ollama --version
```

---

# 2. Start Ollama

Before using ChatBot, start the Ollama server.

Open Command Prompt:

```bash
ollama serve
```

Keep this window running.

---

# 3. Installing AI Models

ChatBot does not include AI models.

Models must be downloaded separately.

Models can require several gigabytes of storage.

Browse available models:

https://ollama.com/library

---

## Install a model

Use:

```bash
ollama pull MODEL_NAME
```

Example:

```bash
ollama pull llama3.2
```

After installation, restart ChatBot if the model does not appear.

---

# Recommended Models

## General Chat

Install:

```bash
ollama pull llama3.2
```

Good for:

- General questions
- Writing
- Coding
- Daily conversations


## Lightweight Models

For slower computers:

```bash
ollama pull phi3
```

Good for:

- Low RAM systems
- Faster responses


## Vision Models

Vision models allow ChatBot to understand images.

Install:

```bash
ollama pull llava
```

Other options:

```bash
ollama pull moondream
```

```bash
ollama pull minicpm-v
```

---

# Managing Models

## View installed models

```bash
ollama list
```

Example:

```
NAME          SIZE
llama3.2      2GB
llava         5GB
```

---

## Remove a model

```bash
ollama rm MODEL_NAME
```

Example:

```bash
ollama rm llama3.2
```

---

# Using ChatBot

## Selecting a model

1. Open ChatBot
2. Wait for models to load
3. Select a model from the dropdown
4. Start chatting

---

# Sending Images

Vision models support image input.

You can:

- Drag images into the chat box
- Paste images from your clipboard

Examples of vision models:

- llava
- moondream
- minicpm-v

---

# Troubleshooting

## ChatBot cannot connect to Ollama

Check that Ollama is running:

```bash
ollama serve
```

Test the API:

```bash
curl http://localhost:11434/api/tags
```

---

## No models appear

Check installed models:

```bash
ollama list
```

If none are installed:

```bash
ollama pull llama3.2
```

Restart ChatBot.

---

## Slow responses

Performance depends on:

- GPU
- RAM
- Model size
- Context length

Smaller models are faster.

Try:

```bash
ollama pull llama3.2:3b
```

or:

```bash
ollama pull phi3
```

---

# Updating Models

Update a model:

```bash
ollama pull MODEL_NAME
```

Example:

```bash
ollama pull llama3.2
```

---

# Hardware Recommendations

## Basic Usage

Recommended:

- 8GB RAM
- CPU inference

Models:

```
phi3
llama3.2:3b
```

---

## Recommended Experience

Recommended:

- 16GB RAM
- Dedicated GPU

Models:

```
llama3.2
mistral
llava
```

---

## Vision AI

Recommended:

- Dedicated GPU
- 8GB+ VRAM

---

# Privacy

ChatBot runs locally.

Your:

- conversations
- prompts
- images

remain on your computer unless you manually connect to an external service.