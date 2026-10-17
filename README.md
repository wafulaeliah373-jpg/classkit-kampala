# ClassKit Kampala

ClassKit Kampala turns a class, subject, topic, and lesson length into an editable lesson outline, quick practice sheet, and answer key. It is designed as a small offline-first demo for teachers; generated material is a draft to review and adapt, not a claim of official curriculum alignment.

## Run it

The built-in sample generator works without an account or internet. To try the local AI path, follow the setup below.

## Optional local AI

1. Install Ollama for Windows from the [official download page](https://ollama.com/download).
2. Open PowerShell and download/start the example model (about 1.9 GB):

```powershell
ollama run qwen2.5:3b
```

3. After the model loads, open a second Command Prompt and run:

```cmd
cd "C:\Users\lenovo\Documents\ChatGPT\kampala leafe letes\classkit-kampala"
node server.mjs
```

4. Open `http://localhost:8000`, enable **Use an Ollama model**, and generate. Keep the server window open while using ClassKit. The local server proxies requests to Ollama, avoiding browser cross-origin restrictions. Lesson prompts go to Ollama on this computer, not to a hosted AI service.

## Use the demo

The app opens with a Primary 6 mathematics example on adding fractions. Edit the topic and context, generate the draft, click into the text to revise it, then print or download a Word-compatible document. The answer key is included in the export; remove it before sharing a learner copy.

## Scope and next step

The built-in generator is a structured example, not a general AI model. The next useful step is to sit with one Kampala teacher, review a lesson against their scheme of work, and revise the examples and workflow based on their feedback.
