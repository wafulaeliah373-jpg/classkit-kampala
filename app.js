const form = document.querySelector('#lesson-form');
const lesson = document.querySelector('#lesson');
const statusBox = document.querySelector('#status');
const createButton = document.querySelector('.create-button');
const printButton = document.querySelector('#print-btn');
const downloadButton = document.querySelector('#download-btn');
const aiToggle = document.querySelector('#use-ai');
const modelOptions = document.querySelector('#model-options');

aiToggle.addEventListener('change', () => { modelOptions.hidden = !aiToggle.checked; });
printButton.addEventListener('click', () => window.print());
downloadButton.addEventListener('click', downloadLesson);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = {
    subject: document.querySelector('#subject').value,
    level: document.querySelector('#class-level').value,
    duration: Number(document.querySelector('#duration').value),
    topic: document.querySelector('#topic').value.trim(),
    context: document.querySelector('#context').value.trim(),
  };
  setLoading(true, aiToggle.checked ? 'Asking your local model to prepare a draft…' : 'Putting your lesson together…');
  let draft;
  let fallbackNotice = '';
  try {
    if (aiToggle.checked) {
      try { draft = await generateWithOllama(data); }
      catch (error) {
        if (!(error instanceof TypeError)) throw error;
        draft = makeDraft(data);
        fallbackNotice = 'Ollama could not be reached, so this is a built-in sample draft. To use local AI, start Ollama, then run `node server.mjs` from the ClassKit folder and open http://localhost:8000.';
      }
    } else draft = makeDraft(data);
    lesson.innerHTML = renderDraft(draft, data);
    lesson.hidden = false;
    document.querySelector('#result-foot').hidden = false;
    statusBox.className = fallbackNotice ? 'status notice' : 'status';
    statusBox.textContent = fallbackNotice;
    statusBox.hidden = !fallbackNotice;
    printButton.disabled = false;
    downloadButton.disabled = false;
    document.querySelector('#result-subtitle').textContent = fallbackNotice ? 'Built-in sample draft · review before teaching' : (aiToggle.checked ? 'Drafted with your local model · review before teaching' : 'A ready-to-edit starting point · sample draft');
  } catch (error) {
    statusBox.className = 'status error';
    statusBox.textContent = error.message;
    statusBox.hidden = false;
  } finally { setLoading(false); }
});

function setLoading(active, message = '') {
  createButton.disabled = active;
  createButton.querySelector('span:first-child').textContent = active ? 'Working…' : 'Make my lesson';
  if (active) { statusBox.hidden = false; statusBox.className = 'status loading'; statusBox.textContent = message; lesson.hidden = true; }
}

function makeDraft({ subject, level, duration, topic, context }) {
  const local = context ? `Use ${context} as a familiar example where it fits.` : 'Invite learners to suggest an everyday example from home, school, or the market.';
  const isFractions = /fraction/i.test(topic);
  const example = isFractions ? 'A fruit seller cuts a watermelon into 8 equal pieces. A family buys 3/8 in the morning and 2/8 later. How much did they buy altogether? (3/8 + 2/8 = 5/8)' : `Ask learners to describe one real-life example of ${topic.toLowerCase()} they have seen at home or school.`;
  return {
    title: topic,
    objective: `By the end of this ${duration}-minute lesson, learners should be able to explain ${topic.toLowerCase()} in their own words and solve related practice questions.`,
    materials: 'Chalkboard, chalk, exercise books, and locally available objects or drawings.',
    warmup: `Begin with a 5-minute conversation: what do learners already know about ${topic.toLowerCase()}? Record two or three ideas on the board. ${local}`,
    teach: `Explain the key idea in small steps. Model one example on the board, thinking aloud as you work. Ask learners to explain why each step makes sense. Example: ${example}`,
    practice: `Work through one example together, then let learners try a similar question in pairs. Invite two pairs to share their method. Check understanding with a quick thumbs-up / sideways / down.` ,
    close: 'Ask learners to write one thing they learned and one question they still have. Use their answers to plan the next lesson.',
    questions: isFractions ? [
      '1. A mango is cut into 6 equal parts. What fraction is one part?',
      '2. Add: 2/7 + 3/7 = ___',
      '3. Add: 1/4 + 2/4 = ___',
      '4. Sarah uses 2/8 of a bag of flour, then 3/8 more. What fraction did she use?',
      '5. Explain why the denominator stays the same when adding fractions with equal denominators.'
    ] : [
      `1. In your own words, what does ${topic.toLowerCase()} mean?`,
      `2. Give one example of ${topic.toLowerCase()} from everyday life.`,
      `3. Solve a simple problem about ${topic.toLowerCase()} and show your steps.`,
      '4. Explain your answer to a partner.',
      '5. Write one question you would like to ask about this topic.'
    ],
    answers: isFractions ? ['1. 1/6', '2. 5/7', '3. 3/4', '4. 5/8', '5. Because the parts are the same size; we count the parts being added.'] : ['1–4. Answers will vary; look for a clear explanation and working.', '5. Learner response.'],
    subject, level, duration
  };
}

async function generateWithOllama(data) {
  let response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ model: document.querySelector('#model-name').value.trim() || 'qwen2.5:3b', stream: false, format: 'json',
        prompt: `Create a practical ${data.duration}-minute ${data.level} ${data.subject} lesson about "${data.topic}" for a Ugandan classroom. Context: ${data.context || 'use familiar everyday examples'}. Return only JSON with keys title, objective, materials, warmup, teach, practice, close, questions (array of 5 strings), answers (array of answer strings). Use age-appropriate language. Do not claim official curriculum alignment. Include an answer key.` })
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Ollama took longer than 90 seconds to respond. Try again after the model has loaded, or turn off local AI to use the built-in draft.');
    throw new TypeError('The ClassKit local server could not be reached. Start it with "node server.mjs" and open http://localhost:8000.');
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error || ''; } catch { /* use the generic response below */ }
    throw new Error(detail || `Ollama returned ${response.status}. Check that your model is installed (for example: ollama pull qwen2.5:3b).`);
  }
  const result = await response.json();
  try { return { ...JSON.parse(result.response), subject: data.subject, level: data.level, duration: data.duration }; }
  catch { throw new Error('The local model did not return a usable lesson. Try again or use the built-in draft.'); }
}

function renderDraft(d, data) {
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list = (items) => (Array.isArray(items) ? items : []).map(item => `<li>${safe(item)}</li>`).join('');
  const minutes = Number(d.duration) || data.duration;
  const warm = Math.max(3, Math.round(minutes * .15));
  const explore = Math.round(minutes * .4);
  const practice = Math.round(minutes * .35);
  const close = Math.max(2, minutes - warm - explore - practice);
  return `<h2>${safe(d.title || data.topic)}</h2><p class="lesson-meta">${safe(d.subject || data.subject)} · ${safe(d.level || data.level)} · ${Number(d.duration) || data.duration} minutes</p>
    <div class="callout"><b>Learning goal</b><p>${safe(d.objective)}</p></div>
    <h3>What you'll need</h3><p>${safe(d.materials)}</p>
    <h3>1 · Start together <span style="font-weight:400;color:#89958b">(${warm} min)</span></h3><p>${safe(d.warmup)}</p>
    <h3>2 · Explore the idea <span style="font-weight:400;color:#89958b">(${explore} min)</span></h3><p>${safe(d.teach)}</p>
    <h3>3 · Try it together <span style="font-weight:400;color:#89958b">(${practice} min)</span></h3><p>${safe(d.practice)}</p>
    <h3>4 · Wrap up <span style="font-weight:400;color:#89958b">(${close} min)</span></h3><p>${safe(d.close)}</p>
    <h3>Quick practice</h3><ol>${list(d.questions)}</ol>
    <div class="answer-key"><h3>Teacher answer key · remove before sharing</h3><ol>${list(d.answers)}</ol></div>
    <p style="font-size:10px;color:#8a958c;margin-top:18px">Draft for teacher review. Adapt examples and check suitability for your learners before use.</p>`;
}

function downloadLesson() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ClassKit lesson</title><style>body{font:12pt Arial,sans-serif;max-width:760px;margin:50px auto;line-height:1.55;color:#263a32}h2{font-size:24pt}h3{color:#315b4f;margin-top:24px}.lesson-meta{color:#68766f;border-bottom:1px solid #ddd;padding-bottom:12px}.callout{background:#f1f4e8;padding:12px}li{margin:5px 0}</style></head><body>${lesson.innerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'classkit-lesson.doc'; a.click(); URL.revokeObjectURL(url);
}
