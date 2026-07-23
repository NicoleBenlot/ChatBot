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

# 2. Starting Ollama

You don't need to do anything here — ChatBot handles it for you.

When you open ChatBot:

1. It checks that Ollama is installed
2. It checks if the Ollama server is already running
3. If it isn't, ChatBot starts it in the background automatically
4. A loading screen shows the current status until the server is ready

You'll no longer need to open a separate Command Prompt window and run `ollama serve` yourself.

When you close ChatBot, it also shuts down the Ollama server — but only the one it started. If Ollama was already running before you opened ChatBot, it's left alone.

If the loading screen shows an error (for example, Ollama isn't installed), install or fix Ollama and click **Retry** — no need to restart the app.

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
2. Wait for the loading screen to confirm the Ollama server is running
3. Wait for models to load in the dropdown
4. Select a model
5. Start chatting

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

## ChatBot is stuck on the loading screen or shows an error

ChatBot tries to start Ollama for you automatically, and the loading text tells you what it's doing at each step. If it shows an error:

- Confirm Ollama is installed and on your system `PATH`:

```bash
ollama --version
```

- Click **Retry** on the loading screen once it's fixed — you don't need to restart ChatBot.

If you'd rather check things manually:

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

Suitable for lightweight models and CPU-only inference.

Recommended:

- 8GB RAM or more
- Modern CPU

Models:


phi3
llama3.2:3b


---

## Recommended Experience

For faster responses and larger models.

Recommended:

- 16GB+ RAM (varies depending on model size)
- Dedicated GPU recommended

Models:


llama3.2:3b
qwen2.5


---

## Vision AI

Image understanding models require additional resources.

Recommended:

- Dedicated GPU
- 8GB+ VRAM recommended

---

# Privacy

ChatBot runs locally using Ollama.

Your:

- conversations
- prompts
- images

remain on your computer unless you manually configure ChatBot to connect to an external service.

No cloud account is required, and your data is not sent anywhere as its run on your local machine.