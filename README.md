# ChatBot

A lightweight desktop chatbot application powered by Ollama.

ChatBot provides a simple local interface for interacting with locally hosted AI models. It runs as a Windows desktop application using Electron and connects directly to your local Ollama server.

## Features

- Desktop application built with Electron
- Local AI inference through Ollama
- **Automatically starts and stops the Ollama server** — no need to run `ollama serve` manually
- Model selection from installed Ollama models
- Streaming responses
- Image support for vision models
- Drag and drop image input
- Clipboard image pasting
- Lightweight interface
- No cloud dependency

## Requirements

### Ollama

Install Ollama and make sure it's available on your system `PATH`:

https://ollama.com/

You do **not** need to run `ollama serve` yourself. When ChatBot launches, it:

1. Checks that `ollama` is installed
2. Checks if the Ollama server is already running
3. If not, starts `ollama serve` in the background and waits for it to come up
4. Shows a loading screen with status text the whole time (with a Retry button if something goes wrong)

When you close ChatBot, it shuts down the Ollama server it started for you — **only if it started it**. If Ollama was already running before you opened ChatBot (e.g. you started it yourself, or another app is using it), ChatBot leaves it running and won't kill it on exit.

Download a model:

```bash
ollama pull llama3.2
```

For image support, install a vision model:

```bash
ollama pull llava
```

## Installation

### Running from source

Install Node.js:

https://nodejs.org/

Clone the repository:

```bash
git clone <repository-url>
cd ChatBot
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

## Building the Windows Application

Build the executable:

```bash
npm run build
```

The output will be generated in:

```
dist/
```

Depending on the configuration, the build will create:

- Windows installer (`Setup.exe`)
- Portable executable (`.exe`)

## Project Structure

```
ChatBot/
│
├── chatbot.html       Main interface
├── chatbot.css        Application styling
├── chatbot.js         Frontend chat logic
├── loading.js         Loading screen logic (listens for Ollama status)
│
├── main.js            Electron main process (manages the Ollama server lifecycle)
├── preload.js         Secure bridge between main process and renderer
├── package.json       Project configuration
│
└── dist/              Build output
```

## Configuration

The default Ollama endpoint is:

```
http://localhost:11434
```

The endpoint can be changed from the settings menu inside the application.

## Troubleshooting

### App is stuck on the loading screen

ChatBot shows what it's doing (checking for Ollama, starting the server, waiting for it to respond). If it errors out, a **Retry** button appears. Common causes:

- Ollama isn't installed, or isn't on your system `PATH`
- Something else is already using port `11434` and isn't actually Ollama

Check installed models directly:

```bash
ollama list
```

### Models are not loading (app is open)

Check installed models:

```bash
ollama list
```

If none are installed, pull one:

```bash
ollama pull llama3.2
```

### Connection errors

Test Ollama:

```bash
curl http://localhost:11434/api/tags
```

If this fails while ChatBot is open, something's blocking the connection (firewall, custom `OLLAMA_HOST`, etc.) — check the URL in ChatBot's settings panel.

## Technology Stack

- Electron
- Node.js
- HTML
- CSS
- JavaScript
- Ollama API

## User Guide

For installation instructions, model setup, and troubleshooting:

See:

```
USER_GUIDE.md
```