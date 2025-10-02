/* Data model: 8 stages – each stage has a key, title, and short questions.
   Questions use a 0..4 scale.
   Stage-level scoring stored in `stageScores`.
   Final mapping: choose subtype/manifestation based on which stage(s) are highest.
*/

// state
let currentStage = 0;
const stageScores = new Array(stages.length).fill(0);
const stageMax = stages.map(s => s.qs.length * 4);
let answers = {}; // answers[stageKey] = [val,...]

function createStageHTML(i, s){
  const container = document.createElement('div');
  container.className = 'stage';
  container.id = 'stage-'+i;

  const title = document.createElement('h3');
  title.textContent = s.title;
  container.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'muted';
  desc.style.marginBottom = '8px';
  desc.textContent = s.descr;
  container.appendChild(desc);

  // questions
  s.qs.forEach((q, qi) => {
    const qdiv = document.createElement('div');
    qdiv.className = 'question';
    qdiv.dataset.qIndex = qi;

    const qtext = document.createElement('div');
    qtext.textContent = (qi+1) + '. ' + q;
    qdiv.appendChild(qtext);

    const opts = document.createElement('div');
    opts.className = 'opts';
    // options 0..4
    for(let val=0; val<=4; val++){
      const b = document.createElement('div');
      b.className = 'opt';
      b.dataset.value = val;
      b.innerHTML = `<strong>${val}</strong><div class="muted" style="font-size:12px">${val===0? 'Never' : val===1? 'Rarely' : val===2? 'Sometimes' : val===3? 'Often' : 'Very Often'}</div>`;
      b.onclick = () => selectAnswer(s.key, qi, val, b);
      opts.appendChild(b);
    }
    qdiv.appendChild(opts);
    container.appendChild(qdiv);
  });

  const controls = document.createElement('div');
  controls.className = 'controls';
  const back = document.createElement('button'); back.className = 'ghost'; back.textContent = 'Back';
  back.onclick = prevStage;
  const next = document.createElement('button'); next.className = 'primary'; next.textContent = 'Next';
  next.onclick = () => nextStage(true);
  controls.appendChild(back);
  controls.appendChild(next);
  container.appendChild(controls);

  return container;
}

function mountQuiz(){
  const area = document.getElementById('quizArea');
  area.innerHTML = '';
  stages.forEach((s,i) => {
    const st = createStageHTML(i,s);
    area.appendChild(st);
  });
  showStage(0);
  updateProgress();
  
}

function showStage(i){
  const all = document.querySelectorAll('.stage');
  all.forEach((el, idx) => {
    el.classList.toggle('active', idx===i);
  });
  currentStage = i;
  document.getElementById('stageLabel').textContent = `Stage ${i+1} / ${stages.length}`;
  updateScoreLabel();
  // show/hide final card
  document.getElementById('finalCard').style.display = 'none';
  document.getElementById('quizContainer').style.display = 'block';
  updateProgress();
}

function selectAnswer(stageKey, qIndex, val, element){
  answers[stageKey] = answers[stageKey] || [];
  answers[stageKey][qIndex] = val;
  // flip selected style for that question
  const qDiv = element.closest('.question');
  qDiv.querySelectorAll('.opt').forEach(op => op.classList.remove('selected'));
  element.classList.add('selected');
  // compute stage score
  const sIndex = stages.findIndex(s => s.key===stageKey);
  const arr = answers[stageKey] || [];
  const sum = arr.reduce((a,b)=>a+(typeof b==='number'?b:0),0);
  stageScores[sIndex] = sum;
  updateScoreLabel();
}

function updateScoreLabel(){
  const total = stageScores.reduce((a,b)=>a+b,0);
  document.getElementById('scoreLabel').textContent = `Total points: ${total}`;
}

function updateProgress(){
  const completed = Object.keys(answers).length; // rough
  const pct = Math.round(((currentStage)/ (stages.length)) * 100);
  document.getElementById('progressBar').style.width = `${Math.round(((currentStage+1)/stages.length)*100)}%`;
}

function prevStage(){
  if(currentStage>0) showStage(currentStage-1);
}

function nextStage(requireComplete){
  const s = stages[currentStage];
  const a = answers[s.key] || [];
  const unanswered = s.qs.some((q, qi) => typeof a[qi] !== 'number');
  if(requireComplete && unanswered){
    if(!confirm('Some questions are unanswered in this stage. Continue anyway?')) return;
  }
  if(currentStage < stages.length -1){
    showStage(currentStage+1);
  } else {
    // finished
    finishAssessment();
  }
}

/* After all stages: aggregate and infer probability and subtype */
function finishAssessment(){
  // ensure every stage has at least zeros
  stages.forEach((s,i) => { answers[s.key] = answers[s.key] || new Array(s.qs.length).fill(0); stageScores[i] = answers[s.key].reduce((a,b)=>a+(typeof b==='number'?b:0),0); });

  const totalPoints = stageScores.reduce((a,b)=>a+b,0);
  const maxTotal = stageMax.reduce((a,b)=>a+b,0);
  const percent = Math.round((totalPoints / maxTotal) * 100);

  // Determine which areas are relatively high (>= 60% of that stage)
  const highAreas = [];
  stages.forEach((s,i)=>{
    const score = stageScores[i];
    const pct = Math.round((score / stageMax[i]) * 100);
    if(pct >= 60) highAreas.push({key:s.key,title:s.title,pct});
  });

  // Simple mapping to subtype/manifestation suggestions
  let subtype = 'Mixed/Unspecified';
  if(highAreas.find(a=>a.key==='female') && highAreas.find(a=>a.key==='masking')) subtype = 'Female-presenting autism (masking common)';
  else if(highAreas.find(a=>a.key==='social') && highAreas.find(a=>a.key==='rrb')) subtype = 'Autism with classic social & RRB features';
  else if(highAreas.find(a=>a.key==='exec') && highAreas.find(a=>a.key==='sensory')) subtype = 'Autism with prominent ADHD / executive function features';
  else if(highAreas.find(a=>a.key==='sensory')) subtype = 'Sensory-dominant presentation (sensory processing differences)';
  else if(highAreas.find(a=>a.key==='burnout')) subtype = 'Autistic burnout / high masking-related exhaustion';

  // Probability guidance (screening heuristic, not a diagnostic probability)
  let probabilityLabel = 'Low likelihood';
  if(percent >= 70) probabilityLabel = 'High likelihood – consider professional assessment';
  else if(percent >= 40) probabilityLabel = 'Moderate likelihood – monitor and consider seeking professional input';
  else probabilityLabel = 'Low likelihood – traits present but below common thresholds';

  // Build result HTML
  const resEl = document.getElementById('finalSummary');
  resEl.innerHTML = `
    <div><span class="badge">Score</span> ${totalPoints} / ${maxTotal} (${percent}%)</div>
    <div style="margin-top:10px"><strong>Screening interpretation:</strong> ${probabilityLabel}</div>
    <div style="margin-top:8px"><strong>Suggested match:</strong> ${subtype}</div>
    <div style="margin-top:12px">
      <strong>High scoring areas:</strong>
      <ul>
        ${highAreas.length? highAreas.map(h=>`<li>${h.title} – ${h.pct}% of that area</li>`).join('') : '<li>None reached 60% in a specific area</li>'}
      </ul>
    </div>
    <div style="margin-top:12px" class="muted">
      <strong>Important:</strong> This tool is a screening aid only. A full clinical assessment uses developmental history, informant reports, observational tools (e.g., ADOS-2), and considers differential diagnoses and co-occurring conditions. See resources for next steps. :contentReference[oaicite:0]{index=0}
    </div>
  `;

  // show final results
  document.getElementById('quizContainer').style.display = 'none';
  document.getElementById('finalCard').style.display = 'block';
  // store final for download
  window.latestReport = { totalPoints, maxTotal, percent, probabilityLabel, subtype, highAreas, stageScores, stageMax, answers };
}

/* small utility: download a basic JSON report */
function downloadReport(){
  if(!window.latestReport){ alert('Complete the assessment first.'); return; }
  const data = window.latestReport;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'autism-screening-report.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* show / nav helpers */
function showSection(id){
  // map ids used by nav -> element ids
  const map = {
    about: 'about',
    quiz: 'quizContainer',
    resources: 'resources',
    guidance: 'guidance'
  };
  // hide/show sections
  Object.values(map).forEach(secId => {
    const el = document.getElementById(secId);
    if(!el) return;
    el.style.display = (map[id] === secId) ? 'block' : 'none';
  });

  // nav active style: prefer data-section attribute; fallback to matching onclick text
  document.querySelectorAll('nav .nav-btn').forEach(btn=>{
    const ds = btn.getAttribute('data-section') || '';
    const matches = ds === id || (btn.getAttribute('onclick')||'').includes(`'${id}'`);
    btn.classList.toggle('active', matches);
    btn.setAttribute('aria-pressed', matches ? 'true' : 'false');
  });

  // nice UX: scroll to top of main wrap
  window.scrollTo({top:0, behavior:'smooth'});

  // Keep quiz/final visibility logic intact:
  if(id === 'quiz'){
    document.getElementById('finalCard').style.display = 'none';
    document.getElementById('quizContainer').style.display = 'block';
  }
}


/* restart */
function restart(){
  currentStage = 0;
  answers = {};
  stageScores.fill(0);
  // clear UI selections
  document.querySelectorAll('.opt').forEach(el => el.classList.remove('selected'));
  showStage(0);
  document.getElementById('finalCard').style.display = 'none';
  document.getElementById('quizContainer').style.display = 'block';
  updateScoreLabel();
}

function saveProgress(){
  try{
    const payload = { answers, stageScores, currentStage };
    localStorage.setItem('womenAutism.v1', JSON.stringify(payload));
  }catch(e){ console.warn('save failed', e) }
}

function loadProgress(){
  try{
    const raw = localStorage.getItem('womenAutism.v1');
    if(!raw) return false;
    const p = JSON.parse(raw);
    answers = p.answers || {};
    stageScores.splice(0, stageScores.length, ...(p.stageScores || stageScores));
    currentStage = p.currentStage || 0;
    // restore selected UI
    Object.keys(answers).forEach(stageKey=>{
      const arr = answers[stageKey];
      arr.forEach((val, qi)=>{
        const stageIndex = stages.findIndex(s=>s.key===stageKey);
        const stageEl = document.getElementById('stage-'+stageIndex);
        if(!stageEl) return;
        const qDiv = stageEl.querySelector(`.question[data-q-index="${qi}"]`) || stageEl.querySelectorAll('.question')[qi];
        if(!qDiv) return;
        const opt = qDiv.querySelector(`.opt[data-value="${val}"]`);
        if(opt) opt.classList.add('selected');
      });
    });
    updateScoreLabel(); updateProgress();
    return true;
  }catch(e){ console.warn('load failed', e); return false; }
}


window.onload = () => {
  mountQuiz();
  showSection('about');
};

// keyboard + native event support for bite blocks
document.addEventListener('click', (e)=>{
  const b = e.target.closest('.about-block .bite');
  if(!b) return;
  b.classList.toggle('open');
});