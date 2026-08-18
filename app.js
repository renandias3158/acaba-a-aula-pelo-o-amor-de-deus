
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function config(){
  return {
    key: sessionStorage.getItem("gemini_key") || "",
    model: localStorage.getItem("gemini_model") || "gemini-3.6-flash"
  };
}

function saveConfig(){
  const key = $("apiKey").value.trim();
  if(!key) return setStatus("Gemini: chave ausente");
  sessionStorage.setItem("gemini_key", key);
  localStorage.setItem("gemini_model", $("model").value.trim() || "gemini-3.6-flash");
  $("apiKey").value = "";
  setStatus("Gemini: configurado nesta sessão");
}

function clearConfig(){
  sessionStorage.removeItem("gemini_key");
  localStorage.removeItem("gemini_model");
  setStatus("Gemini: não configurado");
}

function setStatus(text){ $("status").textContent = text; }

function start(){
  if(config().key) setStatus("Gemini: configurado nesta sessão");
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.target).classList.add("active");
    });
  });
  renderDashboard();
}
start();

async function gemini(prompt){
  const {key, model} = config();
  if(!key) throw new Error("Configure a GEMINI_API_KEY no campo de configuração.");

  const response = await fetch(
    `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-goog-api-key":key
      },
      body:JSON.stringify({
        contents:[{parts:[{text:prompt}]}],
        generationConfig:{
          temperature:0.2,
          maxOutputTokens:1200
        }
      })
    }
  );

  const data = await response.json();
  if(!response.ok) throw new Error(data?.error?.message || "Erro na API Gemini.");
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
}

function resultText(text){
  return `<div class="box"><pre>${esc(text)}</pre></div>`;
}

async function runCuradoria(){
  const out = $("curadoriaResult");
  out.innerHTML = "<div class='box'>Analisando...</div>";
  try{
    const text = await gemini(`
Você é o módulo CURADORIA DE TERMOS de uma plataforma educacional do IFPE.
Não invente experiências. Transforme apenas o que foi fornecido em linguagem
profissional.

PROJETO:
${$("projeto").value}

TECNOLOGIAS:
${$("tecnologias").value}

VAGA:
${$("vagaCuradoria").value || "não informada"}

Responda em português com:
1. resumo profissional
2. competências demonstradas
3. palavras-chave
4. evidências do projeto
5. sugestão para currículo
6. aderência estimada à vaga, se houver.
`);
    out.innerHTML = resultText(text);
  }catch(e){out.innerHTML=resultText("ERRO: "+e.message)}
}

async function runColetiva(){
  const out = $("coletivaResult");
  out.innerHTML = "<div class='box'>Processando relato...</div>";
  try{
    const text = await gemini(`
Você é o módulo INTELIGÊNCIA COLETIVA.
Extraia conhecimento reutilizável de um relato de processo seletivo.
Não exponha dados pessoais e não invente informações.

CARGO:
${$("cargoColetiva").value}

RELATO:
${$("relatoColetiva").value}

Retorne:
- temas cobrados
- tecnologias
- perguntas frequentes
- dificuldades
- recomendações
- nível de dificuldade.
`);
    out.innerHTML=resultText(text);
  }catch(e){out.innerHTML=resultText("ERRO: "+e.message)}
}

async function generateInterview(){
  const out = $("entrevistaResult");
  out.innerHTML="<div class='box'>Montando preparação...</div>";
  try{
    const text=await gemini(`
Você é o módulo DESTRAVE DA ENTREVISTA.
Analise esta vaga.

${$("vagaEntrevista").value}

Gere:
1. cargo provável
2. competências
3. tecnologias
4. 8 perguntas, misturando técnicas e comportamentais
5. plano objetivo de estudo.
`);
    out.innerHTML=resultText(text);
  }catch(e){out.innerHTML=resultText("ERRO: "+e.message)}
}

async function evaluateAnswer(){
  const out=$("avaliacaoResult");
  out.innerHTML="<div class='box'>Avaliando...</div>";
  try{
    const text=await gemini(`
Você é um avaliador de entrevista.
Não invente experiência.

PERGUNTA:
${$("pergunta").value}

RESPOSTA:
${$("resposta").value}

Avalie de 0 a 100 considerando:
clareza, aderência, evidência concreta, domínio técnico quando aplicável,
comunicação e estrutura.

Retorne:
- nota
- pontos fortes
- pontos a melhorar
- feedback
- como melhorar a resposta.
`);
    out.innerHTML=resultText(text);
  }catch(e){out.innerHTML=resultText("ERRO: "+e.message)}
}

/* -------------------------
   EIXO 4: localStorage
------------------------- */
function alumni(){
  try{return JSON.parse(localStorage.getItem("ifpe_egressos") || "[]")}catch{return[]}
}

function saveAlumni(){
  const list=alumni();
  list.push({
    nome:$("nomeEgresso").value,
    curso:$("cursoEgresso").value,
    ano:$("anoEgresso").value,
    cargo:$("cargoEgresso").value,
    empresa:$("empresaEgresso").value,
    area:$("areaEgresso").value,
    tecnologias:$("techEgresso").value,
    tempo:Number($("tempoEgresso").value)||null,
    trabalhaNaArea:$("areaCheck").checked
  });
  localStorage.setItem("ifpe_egressos",JSON.stringify(list));
  renderDashboard();
}

function renderDashboard(){
  const list=alumni();
  const total=list.length;
  const area=list.filter(x=>x.trabalhaNaArea).length;
  const tempos=list.filter(x=>x.tempo!==null).map(x=>x.tempo);
  const media=tempos.length ? (tempos.reduce((a,b)=>a+b,0)/tempos.length).toFixed(1) : "−";
  const cargos={};
  const techs={};

  list.forEach(x=>{
    if(x.cargo) cargos[x.cargo]=(cargos[x.cargo]||0)+1;
    (x.tecnologias||"").split(",").map(t=>t.trim()).filter(Boolean)
      .forEach(t=>techs[t]=(techs[t]||0)+1);
  });

  const ranking=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,6);

  $("dashboard").innerHTML=`
    <div class="panel">
      <h3>Painel local</h3>
      <div class="kpis">
        <div class="kpi"><strong>${total}</strong>Egressos</div>
        <div class="kpi"><strong>${total?Math.round(area/total*100):0}%</strong>Na área</div>
        <div class="kpi"><strong>${media}</strong>Meses até 1º emprego</div>
      </div>
    </div>
    <div class="grid two">
      <div class="panel"><h3>Cargos</h3>${ranking(cargos).map(x=>`<div>${esc(x[0])} <b>(${x[1]})</b></div>`).join("")||"<p class='muted'>Sem dados.</p>"}</div>
      <div class="panel"><h3>Tecnologias</h3>${ranking(techs).map(x=>`<div>${esc(x[0])} <b>(${x[1]})</b></div>`).join("")||"<p class='muted'>Sem dados.</p>"}</div>
    </div>`;
}
