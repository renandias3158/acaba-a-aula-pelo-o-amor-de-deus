const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_OUTPUT_TOKENS = 8192;


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));


/*
 * Mantém quebras de linha e espaços da resposta da IA
 * sem permitir que a IA injete HTML diretamente na página.
 */
function resultText(text, options = {}) {

  const {
    warning = "",
    error = false
  } = options;

  const safeText = esc(text);

  const warningHtml = warning
    ? `
      <div class="ai-warning">
        ${esc(warning)}
      </div>
    `
    : "";

  return `
    <div class="box ai-box ${error ? "ai-error" : ""}">

      <div class="ai-response">
        <pre>${safeText}</pre>
      </div>

      ${warningHtml}

    </div>
  `;
}


/*
 * Estado visual dos botões enquanto a IA está processando.
 */
function setButtonLoading(button, loading, loadingText = "Processando...") {

  if (!button) return;

  if (loading) {

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = loadingText;

  } else {

    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}


/*
 * Mostra o status da conexão/configuração.
 */
function setStatus(text) {
  $("status").textContent = text;
}


/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

function config() {

  return {
    key:
      sessionStorage.getItem("gemini_key") || "",

    model:
      localStorage.getItem("gemini_model") || DEFAULT_MODEL
  };
}


function saveConfig() {

  const key = $("apiKey").value.trim();

  const model =
    $("model").value.trim() || DEFAULT_MODEL;

  if (!key) {
    setStatus("Gemini: chave ausente");
    return;
  }

  sessionStorage.setItem(
    "gemini_key",
    key
  );

  localStorage.setItem(
    "gemini_model",
    model
  );

  $("apiKey").value = "";

  setStatus(
    `Gemini: configurado (${model})`
  );
}


function clearConfig() {

  sessionStorage.removeItem(
    "gemini_key"
  );

  localStorage.removeItem(
    "gemini_model"
  );

  setStatus(
    "Gemini: não configurado"
  );
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

function start() {

  const currentConfig = config();

  if (currentConfig.key) {

    setStatus(
      `Gemini: configurado (${currentConfig.model})`
    );

  } else {

    setStatus(
      "Gemini: não configurado"
    );
  }


  /*
   * Mantém o modelo salvo no campo visual.
   */
  $("model").value =
    currentConfig.model;


  /*
   * Configuração das abas.
   */
  document
    .querySelectorAll(".tab")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab")
            .forEach(tab =>
              tab.classList.remove("active")
            );

          document
            .querySelectorAll(".screen")
            .forEach(screen =>
              screen.classList.remove("active")
            );

          button.classList.add("active");

          const target =
            $(button.dataset.target);

          if (target) {
            target.classList.add("active");
          }

        }
      );

    });


  /*
   * Carrega o painel local.
   */
  renderDashboard();
}


start();


/* =========================================================
   GEMINI API
   ========================================================= */

/*
 * Faz a chamada ao Gemini.
 *
 * CORREÇÕES PRINCIPAIS:
 *
 * 1. maxOutputTokens aumentou de 1200 para 8192.
 *
 * 2. temperature foi removido.
 *
 * 3. finishReason agora é verificado.
 *
 * 4. Todos os parts[].text são reunidos.
 *
 * 5. Respostas vazias agora geram erro explícito.
 */

async function gemini(prompt) {

  const { key, model } = config();

  if (!key) {
    throw new Error(
      "Configure a GEMINI_API_KEY no campo de configuração."
    );
  }


  if (!model) {
    throw new Error(
      "O modelo Gemini não foi configurado."
    );
  }


  const response = await fetch(
    `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key
      },

      body: JSON.stringify({

        contents: [
          {
            role: "user",

            parts: [
              {
                text: prompt.trim()
              }
            ]
          }
        ],

        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS
        }

      })
    }
  );


  /*
   * A API pode retornar JSON de erro.
   */
  let data;

  try {

    data = await response.json();

  } catch {

    throw new Error(
      `A API retornou uma resposta inválida (HTTP ${response.status}).`
    );
  }


  /*
   * Erros HTTP.
   */
  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `Erro na API Gemini (HTTP ${response.status}).`
    );
  }


  /*
   * Verificação da existência dos candidatos.
   */
  const candidate =
    data?.candidates?.[0];

  if (!candidate) {

    const promptFeedback =
      data?.promptFeedback;

    if (promptFeedback) {

      throw new Error(
        `A API não retornou uma resposta. Motivo do prompt: ${JSON.stringify(promptFeedback)}`
      );

    }

    throw new Error(
      "A API Gemini não retornou nenhum candidato de resposta."
    );
  }


  /*
   * Motivo pelo qual a geração terminou.
   */
  const finishReason =
    candidate.finishReason || "";


  /*
   * Junta TODOS os pedaços de texto.
   *
   * Isso é importante porque a resposta pode
   * chegar dividida em vários parts.
   */
  const text =
    candidate?.content?.parts
      ?.map(part => part?.text || "")
      .join("")
      .trim() || "";


  /*
   * Caso a resposta tenha sido interrompida
   * pelo limite de tokens.
   */
  if (finishReason === "MAX_TOKENS") {

    return {
      text,
      truncated: true,
      finishReason
    };
  }


  /*
   * Outros motivos que normalmente significam
   * que não houve uma resposta utilizável.
   */
  if (
    finishReason === "SAFETY" ||
    finishReason === "BLOCKLIST" ||
    finishReason === "PROHIBITED_CONTENT" ||
    finishReason === "RECITATION" ||
    finishReason === "LANGUAGE"
  ) {

    throw new Error(
      `A geração foi interrompida pelo Gemini. Motivo: ${finishReason}.`
    );
  }


  /*
   * Resposta vazia.
   */
  if (!text) {

    throw new Error(
      `A IA não retornou texto. Motivo: ${
        finishReason || "desconhecido"
      }`
    );
  }


  return {
    text,
    truncated: false,
    finishReason
  };
}


/* =========================================================
   CURADORIA
   ========================================================= */

async function runCuradoria() {

  const out =
    $("curadoriaResult");

  const button =
    document.querySelector(
      '#curadoria button.primary'
    );


  out.innerHTML =
    "<div class='box loading-box'>Analisando...</div>";


  setButtonLoading(
    button,
    true,
    "Analisando..."
  );


  try {

    const result =
      await gemini(`

Você é o módulo CURADORIA DE TERMOS de uma plataforma educacional do IFPE.

Não invente experiências.
Transforme apenas o que foi fornecido em linguagem profissional.

PROJETO:
${$("projeto").value}

TECNOLOGIAS:
${$("tecnologias").value}

VAGA:
${$("vagaCuradoria").value || "não informada"}

Responda em português.

Estruture claramente:

1. Resumo profissional
2. Competências demonstradas
3. Palavras-chave
4. Evidências do projeto
5. Sugestão para currículo
6. Aderência estimada à vaga, se houver

Se não houver informação suficiente para algum item,
deixe isso explícito em vez de inventar.
`);


    out.innerHTML =
      resultText(
        result.text,
        {
          warning: result.truncated
            ? "A resposta atingiu o limite de tokens. Tente novamente ou reduza o conteúdo enviado."
            : ""
        }
      );


  } catch (error) {

    out.innerHTML =
      resultText(
        "ERRO: " + error.message,
        {
          error: true
        }
      );

  } finally {

    setButtonLoading(
      button,
      false
    );
  }
}


/* =========================================================
   INTELIGÊNCIA COLETIVA
   ========================================================= */

async function runColetiva() {

  const out =
    $("coletivaResult");

  const button =
    document.querySelector(
      '#coletiva button.primary'
    );


  out.innerHTML =
    "<div class='box loading-box'>Processando relato...</div>";


  setButtonLoading(
    button,
    true,
    "Processando..."
  );


  try {

    const result =
      await gemini(`

Você é o módulo INTELIGÊNCIA COLETIVA.

Extraia conhecimento reutilizável de um relato de processo seletivo.

Não exponha dados pessoais.
Não invente informações.

CARGO:
${$("cargoColetiva").value}

RELATO:
${$("relatoColetiva").value}

Retorne claramente:

- Temas cobrados
- Tecnologias
- Perguntas frequentes
- Dificuldades
- Recomendações
- Nível de dificuldade

Use somente as informações disponíveis no relato.
`);


    out.innerHTML =
      resultText(
        result.text,
        {
          warning: result.truncated
            ? "A resposta atingiu o limite de tokens. Parte da geração pode ter sido interrompida."
            : ""
        }
      );


  } catch (error) {

    out.innerHTML =
      resultText(
        "ERRO: " + error.message,
        {
          error: true
        }
      );

  } finally {

    setButtonLoading(
      button,
      false
    );
  }
}


/* =========================================================
   DESTRAVE DA ENTREVISTA
   ========================================================= */

async function generateInterview() {

  const out =
    $("entrevistaResult");

  const button =
    document.querySelector(
      '#entrevista button.primary'
    );


  out.innerHTML =
    "<div class='box loading-box'>Montando preparação...</div>";


  setButtonLoading(
    button,
    true,
    "Montando..."
  );


  try {

    const result =
      await gemini(`

Você é o módulo DESTRAVE DA ENTREVISTA.

Analise cuidadosamente a vaga abaixo.

VAGA:
${$("vagaEntrevista").value}

Gere uma preparação completa e organizada contendo:

1. Cargo provável
2. Competências exigidas
3. Tecnologias e conhecimentos técnicos
4. 8 perguntas de entrevista
   - misture perguntas técnicas e comportamentais
5. Plano objetivo de estudo

Para cada ponto, seja prático e direto.

Não invente requisitos que não possam ser inferidos da vaga.
`);


    out.innerHTML =
      resultText(
        result.text,
        {
          warning: result.truncated
            ? "A resposta atingiu o limite de tokens. Parte da preparação pode ter sido interrompida."
            : ""
        }
      );


  } catch (error) {

    out.innerHTML =
      resultText(
        "ERRO: " + error.message,
        {
          error: true
        }
      );

  } finally {

    setButtonLoading(
      button,
      false
    );
  }
}


/* =========================================================
   AVALIAÇÃO DE RESPOSTA
   ========================================================= */

async function evaluateAnswer() {

  const out =
    $("avaliacaoResult");

  const button =
    document.querySelector(
      '#entrevista .panel:nth-of-type(2) button.primary'
    );


  out.innerHTML =
    "<div class='box loading-box'>Avaliando...</div>";


  setButtonLoading(
    button,
    true,
    "Avaliando..."
  );


  try {

    const result =
      await gemini(`

Você é um avaliador de entrevista.

Não invente experiência.

PERGUNTA:
${$("pergunta").value}

RESPOSTA:
${$("resposta").value}

Avalie de 0 a 100 considerando:

- Clareza
- Aderência à pergunta
- Evidência concreta
- Domínio técnico quando aplicável
- Comunicação
- Estrutura

Retorne:

- Nota
- Pontos fortes
- Pontos a melhorar
- Feedback
- Como melhorar a resposta

Se a resposta não fornecer evidências suficientes,
explique isso sem inventar informações.
`);


    out.innerHTML =
      resultText(
        result.text,
        {
          warning: result.truncated
            ? "A avaliação atingiu o limite de tokens. Parte da resposta pode ter sido interrompida."
            : ""
        }
      );


  } catch (error) {

    out.innerHTML =
      resultText(
        "ERRO: " + error.message,
        {
          error: true
        }
      );

  } finally {

    setButtonLoading(
      button,
      false
    );
  }
}


/* =========================================================
   EGRESSOS / LOCALSTORAGE
   ========================================================= */

function alumni() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "ifpe_egressos"
      ) || "[]"
    );

  } catch {

    return [];
  }
}


function saveAlumni() {

  const list =
    alumni();


  list.push({

    nome:
      $("nomeEgresso").value.trim(),

    curso:
      $("cursoEgresso").value.trim(),

    ano:
      $("anoEgresso").value,

    cargo:
      $("cargoEgresso").value.trim(),

    empresa:
      $("empresaEgresso").value.trim(),

    area:
      $("areaEgresso").value.trim(),

    tecnologias:
      $("techEgresso").value.trim(),

    tempo:
      Number(
        $("tempoEgresso").value
      ) || null,

    trabalhaNaArea:
      $("areaCheck").checked

  });


  localStorage.setItem(
    "ifpe_egressos",
    JSON.stringify(list)
  );


  renderDashboard();
}


function renderDashboard() {

  const list =
    alumni();


  const total =
    list.length;


  const area =
    list.filter(
      item =>
        item.trabalhaNaArea
    ).length;


  const tempos =
    list
      .filter(
        item =>
          item.tempo !== null
      )
      .map(
        item =>
          item.tempo
      );


  const media =
    tempos.length
      ? (
          tempos.reduce(
            (a, b) => a + b,
            0
          ) / tempos.length
        ).toFixed(1)

      : "−";


  const cargos = {};

  const techs = {};


  list.forEach(item => {

    if (item.cargo) {

      cargos[item.cargo] =
        (cargos[item.cargo] || 0) + 1;
    }


    (item.tecnologias || "")
      .split(",")
      .map(
        technology =>
          technology.trim()
      )
      .filter(Boolean)
      .forEach(
        technology => {

          techs[technology] =
            (techs[technology] || 0) + 1;

        }
      );

  });


  const ranking =
    object =>
      Object
        .entries(object)
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 6);


  const cargoHtml =
    ranking(cargos)
      .map(
        item =>
          `<div class="ranking-item">
            ${esc(item[0])}
            <b>(${item[1]})</b>
          </div>`
      )
      .join("")
      ||
      "<p class='muted'>Sem dados.</p>";


  const techHtml =
    ranking(techs)
      .map(
        item =>
          `<div class="ranking-item">
            ${esc(item[0])}
            <b>(${item[1]})</b>
          </div>`
      )
      .join("")
      ||
      "<p class='muted'>Sem dados.</p>";


  $("dashboard").innerHTML = `

    <div class="panel">

      <h3>Painel local</h3>

      <div class="kpis">

        <div class="kpi">
          <strong>${total}</strong>
          Egressos
        </div>

        <div class="kpi">
          <strong>
            ${total
              ? Math.round(
                  area / total * 100
                )
              : 0}%
          </strong>
          Na área
        </div>

        <div class="kpi">
          <strong>${media}</strong>
          Meses até 1º emprego
        </div>

      </div>

    </div>


    <div class="grid two">

      <div class="panel">

        <h3>Cargos</h3>

        ${cargoHtml}

      </div>


      <div class="panel">

        <h3>Tecnologias</h3>

        ${techHtml}

      </div>

    </div>

  `;
}
