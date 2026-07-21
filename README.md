# ChatBot

A lightweight desktop chatbot application powered by Ollama.

ChatBot provides a simple local interface for interacting with locally hosted AI models. It runs as a Windows desktop application using Electron and connects directly to your local Ollama server.

## Features

- Desktop application built with Electron
- Local AI inference through Ollama
- Model selection from installed Ollama models
- Streaming responses
- Image support for vision models
- Drag and drop image input
- Clipboard image pasting
- Lightweight interface
- No cloud dependency

## Requirements

### Ollama

Install Ollama:

https://ollama.com/

Make sure Ollama is running:

```bash
ollama serve
```

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
├── chatbot.js         Frontend logic
│
├── main.js            Electron main process
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

### Models are not loading

Make sure Ollama is running:

```bash
ollama serve
```

Check installed models:

```bash
ollama list
```

### Connection errors

Test Ollama:

```bash
curl http://localhost:11434/api/tags
```

If this fails, check that Ollama is installed and running.

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

