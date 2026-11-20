"use strict";

/* ============================================================
   O Marcado pela Penitência · livro interativo da lore de Lorenzzo

   Para adicionar um capítulo: salve o texto em capitulos/ (mesmo
   formato do 01: 1ª linha = nome, 2ª linha = título, parágrafos
   separados por uma linha em branco) e acrescente-o em CAPITULOS.
   Para criar uma nota clicável, acrescente-a em NOTAS: o "trecho"
   precisa aparecer exatamente assim no texto (a 1ª ocorrência vira link).
   ============================================================ */

const CAPITULOS = [
  { arquivo: "capitulos/01-o-encontro.txt", numero: "I" },
];

const NOTAS = [
  { id: "sacerdote", trecho: "sacerdote", titulo: "O sacerdote",
    texto: "Meia-idade, ombros largos. Batina escura rasgada abaixo do joelho e uma queimadura antiga perto do olho esquerdo. Uma arma à cintura e, do outro lado, uma comprida tira de couro enrolada." },
  { id: "emblema", trecho: "pequeno emblema ao peito", titulo: "O emblema",
    texto: "Os três homens trazem o mesmo emblema no peito. Naquela tarde, Lorenzzo ainda não sabia o que ele significava." },
  { id: "caderno", trecho: "caderno", titulo: "O caderno",
    texto: "Nomes, idades e breves anotações. Serve para saber quem foi encontrado e para onde cada pessoa foi levada." },
  { id: "piratas", trecho: "piratas", titulo: "Piratas",
    texto: "A palavra que corria entre os sobreviventes naquela noite. Ninguém disse quais." },
  { id: "demonio", trecho: "demônio perto do porto", titulo: "O demônio do porto",
    texto: "Um dos moradores jurou ter visto. Cada pessoa conhecia uma parte diferente do que aconteceu." },
  { id: "oracao", trecho: "O mar acolhe toda criatura nascida sob os céus", titulo: "A oração",
    texto: "Repetida em cada sepultamento. A Ordem acredita que o mar cuida das pessoas." },
  { id: "ordem", trecho: "Ordem da Santa Vigília", titulo: "Ordem da Santa Vigília",
    texto: "Mantém um abrigo em outra ilha, com comida, camas e gente para cuidar dos sobreviventes. Seus membros juram impedir quem usa poderes que mal compreendemos para subjugar os outros." },
  { id: "prato", trecho: "pequeno prato de borda azul", titulo: "O prato de borda azul",
    texto: "Rachado. Era o prato em que Lorenzzo costumava comer. Seguiu viagem embrulhado num pano, junto com a folha dos nomes." },
  { id: "quinn", trecho: "Padre Quinn", titulo: "Padre Quinn",
    texto: "Joaquín. O homem que o tirou dos escombros e fez a viagem com ele. Anos depois, seria o mestre que o treinou na Ordem." },
];

const VELOCIDADES = [["lenta", 30], ["normal", 14], ["rápida", 5], ["instantânea", 0]];
const ROMANOS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

const $ = id => document.getElementById(id);
const livro = $("livro"), raiz = document.documentElement;
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } };

let capitulos = [];
let paginas = [];
let unica = false, aberto = false, ocupado = false;
let atual = 0;             // dupla atual (desktop) ou página atual (celular)
let revelados = new Set(); // âncoras das páginas já escritas
let lidas = new Set(ler("lorenzzo-notas", []));
let vel = ler("lorenzzo-tinta", 1);
let som = ler("lorenzzo-som", true);
let reveladoAtivo = [];
let medidas = "";

const ORNAMENTO = `<svg class="ornamento" viewBox="0 0 240 18" aria-hidden="true"><g fill="currentColor"><path d="M120 2l7 7-7 7-7-7z"/><path d="M8 9h96M136 9h96" stroke="currentColor" stroke-width="1.2"/><circle cx="104" cy="9" r="2"/><circle cx="136" cy="9" r="2"/><path d="M60 9c8-6 16-6 20 0-4-3-10-3-20 0zM180 9c-8-6-16-6-20 0 4-3 10-3 20 0z"/></g></svg>`;
const EMBLEMA = `<svg class="emblema" viewBox="-70 -80 140 160" aria-hidden="true"><g fill="currentColor"><path d="M-8 -56 H8 V-22 H34 V-6 H8 V28 H-8 V-6 H-34 V-22 H-8 Z"/><path d="M-54 36 q9-9 18 0 t18 0 t18 0 t18 0 t18 0 t18 0 v6 q-9-9-18 0 t-18 0 t-18 0 t-18 0 t-18 0 t-18 0 Z"/><path d="M-45 52 q9-9 18 0 t18 0 t18 0 t18 0 t18 0 v5 q-9-9-18 0 t-18 0 t-18 0 t-18 0 t-18 0 Z"/></g><circle r="70" fill="none" stroke="currentColor" stroke-width="3"/><circle r="62" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;

/* ---------------- Texto ---------------- */
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

async function carregarCapitulos() {
  capitulos = await Promise.all(CAPITULOS.map(async (c, i) => {
    try {
      const r = await fetch(c.arquivo, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const linhas = (await r.text()).replace(/\r/g, "").split("\n");
      const cheias = linhas.map(l => l.trim());
      const idx = cheias.findIndex(Boolean);
      const idx2 = cheias.findIndex((l, j) => j > idx && l);
      const corpo = cheias.slice(idx2 + 1).join("\n").split(/\n\s*\n+/).map(p => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      return { n: i, numero: c.numero || ROMANOS[i], personagem: cheias[idx], titulo: cheias[idx2], paragrafos: corpo };
    } catch {
      return { n: i, numero: c.numero || ROMANOS[i], titulo: "Capítulo indisponível", paragrafos: [], erro: true };
    }
  }));
  // tokens + notas (1ª ocorrência de cada trecho vira link)
  const pendentes = new Map(NOTAS.map(n => [n.id, n]));
  let verso = 0;
  for (const cap of capitulos) {
    verso = 0;
    cap.pars = cap.paragrafos.map((texto, pi) => {
      const marcas = [];
      for (const [id, nota] of pendentes) {
        const at = texto.indexOf(nota.trecho);
        if (at >= 0) { marcas.push([at, at + nota.trecho.length, id]); pendentes.delete(id); }
      }
      const tokens = [];
      const re = /\S+/g; let m;
      while ((m = re.exec(texto))) {
        const a = m.index, b = a + m[0].length;
        const marca = marcas.find(([x, y]) => a < y && b > x);
        tokens.push({ t: m[0], kw: marca ? marca[2] : null });
      }
      return { tokens, fala: /^[—–-]/.test(texto), inicio: pi === 0 && /^\p{L}/u.test(texto), verso: ++verso };
    });
  }
}

function htmlTokens(tokens) {
  let h = "", kw = null;
  tokens.forEach((tk, i) => {
    if (tk.kw !== kw) {
      if (kw) h += "</span>";
      if (i) h += " ";
      if (tk.kw) h += `<span class="kw${lidas.has(tk.kw) ? " lida" : ""}" data-nota="${tk.kw}" role="button" tabindex="0">`;
      kw = tk.kw;
    } else if (i) h += " ";
    h += esc(tk.t);
  });
  if (kw) h += "</span>";
  return h;
}

function htmlPar(par, de, ate) {
  const cls = [];
  if (de > 0) cls.push("cont");
  if (par.fala) cls.push("fala");
  if (par.inicio && de === 0) cls.push("inicio");
  let h = `<p class="${cls.join(" ")}">`;
  let toks = par.tokens.slice(de, ate);
  if (de === 0) {
    if (par.inicio) {
      const [primeira, ...resto] = [...toks[0].t];
      h += `<span class="capitular" aria-hidden="true">${esc(primeira)}</span><span class="sr-only">${esc(primeira)}</span>`;
      toks = [{ ...toks[0], t: resto.join("") }, ...toks.slice(1)];
    } else h += `<span class="vers">${par.verso}</span>`;
  }
  return h + htmlTokens(toks) + "</p>";
}

/* ---------------- Páginas ---------------- */
function casca(conteudo, { cabeca = "", numero = "", classe = "" } = {}) {
  return `<div class="miolo ${classe}">${cabeca ? `<div class="cabeca"><span>${cabeca}</span></div>` : ""}${conteudo}${numero ? `<div class="rodape">${numero}</div>` : ""}</div>`;
}

function paginaFixa(ancora, render) { return { ancora, render }; }

function rosto() {
  return casca(`<div class="centro">
    <p class="sobre">A história de</p>
    <h2>O Marcado<br><span class="rubro">pela</span> Penitência</h2>
    <p class="sub">Crônica de Lorenzzo, órfão do mar,<br>e do homem que o encontrou entre os escombros</p>
    ${EMBLEMA}
    <p class="pe">Ordem da Santa Vigília</p>
  </div>`, { classe: "rosto" });
}
function epigrafe() {
  return casca(`<div class="centro"><blockquote>O mar acolhe toda criatura nascida sob os céus. Confiamos à sua guarda aqueles de quem hoje nos despedimos.</blockquote><cite>Oração dos sepultamentos</cite>${ORNAMENTO}</div>`, { classe: "epigrafe" });
}
function sumario() {
  const itens = capitulos.map(c => {
    const pag = paginas.findIndex(p => p.ancora === `c${c.n}-abertura`);
    return `<li><button type="button" data-ir="${pag}"><span class="rom">${c.numero}</span><span>${esc(c.titulo)}</span><span class="pont"></span><span>${pag + 1}</span></button></li>`;
  }).join("");
  const notas = paginas.findIndex(p => p.ancora === "notas-0");
  return casca(`<h2>Sumário</h2>${ORNAMENTO}<ol>${itens}
    <li><button type="button" data-ir="${notas}"><span class="rom">✠</span><span>Notas do caderno</span><span class="pont"></span><span>${notas + 1}</span></button></li>
    <li class="jogo-item"><a href="jogo.html"><span class="rom">▸</span><span>Prólogo jogável: o treino na floresta</span><span class="pont"></span><span>↗</span></a></li>
  </ol>`, { classe: "sumario" });
}
function branca() {
  return casca(`<div class="centro">${EMBLEMA}</div>`, { classe: "branca" });
}
function fim() {
  return casca(`<div class="centro">
    ${ORNAMENTO}
    <p class="continua">A história continua…</p>
    <p class="conv">Anos depois do incêndio, numa floresta do West Blue, Padre Quinn colocou um chicote nas mãos do menino.</p>
    <div class="botoes">
      <a class="botao-livro" href="jogo.html">Jogar o prólogo</a>
      <button class="botao-livro sec" type="button" data-ir="0">Voltar ao início</button>
    </div>
  </div>`, { classe: "fim" });
}

function medidor(lado) {
  const m = $("medidor");
  m.innerHTML = `<section class="pagina ${lado}"></section>`;
  return m.firstChild;
}

function paginar() {
  const lista = [paginaFixa("rosto", rosto), paginaFixa("epigrafe", epigrafe), paginaFixa("sumario", sumario)];
  const sonda = medidor("dir");
  const cabe = el => {
    if (el.scrollHeight > el.clientHeight) return false;
    const ult = el.lastElementChild;
    return !ult || ult.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom - 3;
  };

  for (const cap of capitulos) {
    if (lista.length % 2 === 1) lista.push(paginaFixa(`c${cap.n}-branca`, branca));
    let par = 0, de = 0, primeira = true;
    const total = cap.pars.length;
    if (cap.erro) {
      lista.push(paginaFixa(`c${cap.n}-abertura`, () => casca(`<div class="abertura"><div class="num">Capítulo ${cap.numero}</div><h2>${esc(cap.titulo)}</h2>${ORNAMENTO}</div><p class="erro-cap">Não foi possível carregar o texto. Abra o livro pelo site publicado.</p>`)));
      continue;
    }
    while (par < total) {
      const abertura = primeira ? `<div class="abertura"><div class="num">Capítulo ${cap.numero}</div><h2>${esc(cap.titulo)}</h2>${ORNAMENTO}</div>` : "";
      sonda.innerHTML = casca(`<div class="texto">${abertura}</div>`, { cabeca: "x", numero: "0" });
      const texto = sonda.querySelector(".texto");
      const ancora = primeira ? `c${cap.n}-abertura` : `c${cap.n}-${par}-${de}`;
      let html = abertura;
      let usou = false;
      while (par < total) {
        const p = cap.pars[par];
        texto.innerHTML = html + htmlPar(p, de, p.tokens.length);
        if (cabe(texto)) { html = texto.innerHTML; par++; de = 0; usou = true; continue; }
        let lo = de, hi = p.tokens.length; // maior "ate" que cabe
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          texto.innerHTML = html + htmlPar(p, de, mid);
          if (cabe(texto)) lo = mid; else hi = mid;
        }
        if (lo > de && (lo - de >= 3 || !usou)) {
          // evita deixar uma ou duas palavras sozinhas no fim do parágrafo
          const restante = p.tokens.length - lo;
          if (restante > 0 && restante < 3 && lo - de > 4) lo -= 3 - restante;
          html += htmlPar(p, de, lo); de = lo;
        } else if (!usou) { html += htmlPar(p, de, de + 1); de++; }
        break;
      }
      const corpo = html;
      const titulo = cap.titulo;
      lista.push({ ancora, cap: cap.n, render: (num, lado) => casca(`<div class="texto">${corpo}</div>`, { cabeca: lado === "esq" ? "O Marcado pela Penitência" : titulo, numero: num }) });
      primeira = false;
    }
  }

  // notas do caderno (paginadas com todas visíveis)
  const notasHtml = (de, ate) => `${de === 0 ? `<h2>Notas do caderno</h2><p class="dica-notas">Toque nas palavras marcadas com ✠ para encontrá-las</p>` : ""}<ul>${NOTAS.slice(de, ate).map(n =>
    lidas.has(n.id) ? `<li><b>${esc(n.titulo)}</b>${esc(n.texto)}</li>` : `<li class="oculta"><b>${esc(n.titulo)}</b>Ainda não encontrada.</li>`).join("")}</ul>`;
  let ini = 0, k = 0;
  while (ini < NOTAS.length) {
    let fimN = ini + 1;
    for (let tent = NOTAS.length; tent > ini; tent--) {
      const salva = lidas; lidas = new Set(NOTAS.map(n => n.id));
      sonda.innerHTML = casca(`<div class="texto">${notasHtml(ini, tent)}</div>`, { cabeca: "x", numero: "0" });
      lidas = salva;
      if (cabe(sonda.querySelector(".texto"))) { fimN = tent; break; }
    }
    const a = ini, b = fimN;
    lista.push({ ancora: `notas-${k++}`, render: (num, lado) => casca(`<div class="texto">${notasHtml(a, b)}</div>`, { cabeca: lado === "esq" ? "O Marcado pela Penitência" : "Notas", numero: num, classe: "notas-pag" }) });
    ini = fimN;
  }
  lista.push(paginaFixa("fim", fim));
  $("medidor").innerHTML = "";
  paginas = lista;
}

function htmlPagina(i, lado) {
  if (i === -1) return document.querySelector(".capa .guarda").innerHTML;
  if (i === -2) return "";
  if (i === null || i < 0 || i >= paginas.length) return "";
  const p = paginas[i];
  return p.render(String(i + 1), lado);
}

/* ---------------- Medidas ---------------- */
function medir() {
  const vw = innerWidth, vh = innerHeight;
  unica = vw < 760 || vw / vh < 1.1;
  const topo = vw < 760 ? 74 : 58, baixo = unica ? 86 : 64;
  const altDisp = vh - topo - baixo;
  let ph = Math.min(altDisp, 920), pw = ph * .7;
  const maxW = unica ? vw - 28 : (vw - 140) / 2;
  if (pw > maxW) { pw = maxW; ph = Math.min(altDisp, pw / (unica ? .6 : .7)); }
  const fs = Math.max(13.5, Math.min(18.5, pw * .033));
  raiz.style.setProperty("--pw", pw.toFixed(1) + "px");
  raiz.style.setProperty("--ph", ph.toFixed(1) + "px");
  raiz.style.setProperty("--fs", fs.toFixed(2) + "px");
  $("cena").style.paddingTop = (topo - baixo) / 2 + "px";
  livro.classList.toggle("unica", unica);
  return `${unica}|${pw.toFixed(0)}|${ph.toFixed(0)}`;
}

/* ---------------- Exibição ---------------- */
const esqDe = s => (s > 0 ? 2 * s - 1 : -1); // -1 = guarda (verso da capa)
const dirDe = s => 2 * s;
const maxAtual = () => (unica ? paginas.length - 1 : Math.floor(paginas.length / 2));

function preencher(alvo, i, lado, pendente) {
  alvo.innerHTML = htmlPagina(i, lado);
  alvo.dataset.indice = i === null || i < 0 ? "" : i;
  alvo.classList.toggle("vazia", i === null || i >= paginas.length);
  alvo.classList.toggle("guarda-pag", i === -1 || i === -2);
  if (pendente && i !== null && i >= 0 && i < paginas.length && !revelados.has(paginas[i].ancora) && VELOCIDADES[vel][1] > 0) {
    alvo.querySelectorAll(".texto, .centro").forEach(n => (n.style.visibility = "hidden"));
  }
}

function desenhar() {
  if (unica) {
    preencher($("p-dir"), atual, "dir", true);
    $("p-esq").innerHTML = "";
  } else {
    preencher($("p-esq"), esqDe(atual), "esq", true);
    preencher($("p-dir"), dirDe(atual) < paginas.length ? dirDe(atual) : -2, "dir", true);
  }
  atualizarSetas();
}

function atualizarSetas() {
  $("ant").disabled = atual <= 0;
  $("prox").disabled = atual >= maxAtual();
}

/* ---------------- Tinta ---------------- */
function embrulhar(raizNo) {
  let i = 0;
  const andar = no => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType === 3) {
        if (!filho.nodeValue.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const parte of filho.nodeValue.split(/(\s+)/)) {
          if (!parte) continue;
          if (/^\s+$/.test(parte)) { frag.append(parte); continue; }
          const w = document.createElement("span"); w.className = "w";
          for (const ch of parte) {
            const c = document.createElement("span"); c.className = "c"; c.textContent = ch;
            c.style.setProperty("--i", i++); w.append(c);
          }
          frag.append(w);
        }
        filho.replaceWith(frag);
      } else if (filho.nodeType === 1 && !filho.classList.contains("sr-only") && filho.tagName !== "svg") andar(filho);
    }
  };
  andar(raizNo);
  return i;
}

function revelar(alvo) {
  return new Promise(resolve => {
    const i = Number(alvo.dataset.indice);
    if (alvo.dataset.indice === "" || !paginas[i]) return resolve();
    const ancora = paginas[i].ancora;
    const partes = alvo.querySelectorAll(".texto, .centro");
    const ms = VELOCIDADES[vel][1];
    if (revelados.has(ancora) || !ms) {
      revelados.add(ancora);
      partes.forEach(n => (n.style.visibility = ""));
      return resolve();
    }
    revelados.add(ancora);
    let total = 0;
    const originais = [...partes].map(n => n.innerHTML);
    partes.forEach(n => { total += embrulhar(n); n.style.visibility = ""; });
    alvo.classList.add("revelando");
    const item = { alvo, resolve, timer: 0 };
    const terminar = () => {
      clearTimeout(item.timer);
      alvo.classList.remove("revelando");
      // devolve o texto sem as letras separadas (mesma diagramação da paginação)
      partes.forEach((n, k) => { if (n.isConnected) n.innerHTML = originais[k]; });
      lidas.forEach(id => alvo.querySelectorAll(`.kw[data-nota="${id}"]`).forEach(k => k.classList.add("lida")));
      reveladoAtivo = reveladoAtivo.filter(x => x !== item);
      resolve();
    };
    item.terminar = terminar;
    item.timer = setTimeout(terminar, total * ms + 650);
    reveladoAtivo.push(item);
    tinta(total * ms);
  });
}
function completarTudo() { [...reveladoAtivo].forEach(r => r.terminar()); }

async function revelarVisiveis() {
  if (unica) await revelar($("p-dir"));
  else { await revelar($("p-esq")); await revelar($("p-dir")); }
}

/* ---------------- Virar ---------------- */
function irPara(alvoIdx, animar = true) {
  alvoIdx = Math.max(0, Math.min(maxAtual(), alvoIdx));
  if (ocupado || alvoIdx === atual || !aberto) return;
  completarTudo();
  fecharNota();
  const folha = $("folha"), frente = $("folha-frente"), verso = $("folha-verso");
  const indo = alvoIdx > atual;
  if (!animar || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    atual = alvoIdx; desenhar(); revelarVisiveis(); return;
  }
  ocupado = true;
  folheio();
  const de = atual;
  const dir = s => (dirDe(s) < paginas.length ? dirDe(s) : -2);
  if (unica) {
    preencher(frente, indo ? de : alvoIdx, "dir", true);
    verso.innerHTML = "";
    if (indo) preencher($("p-dir"), alvoIdx, "dir", true);
  } else if (indo) {
    preencher(frente, dir(de), "dir", true);
    preencher(verso, esqDe(alvoIdx), "esq", true);
    preencher($("p-dir"), dir(alvoIdx), "dir", true);
  } else {
    preencher(verso, esqDe(de), "esq", true);
    preencher(frente, dir(alvoIdx), "dir", true);
    preencher($("p-esq"), esqDe(alvoIdx), "esq", true);
  }
  folha.hidden = false;
  folha.className = "folha " + (indo ? "indo" : "voltando");
  const acabar = () => {
    folha.removeEventListener("animationend", acabar);
    atual = alvoIdx;
    desenhar();
    folha.hidden = true; folha.className = "folha";
    ocupado = false;
    revelarVisiveis();
  };
  folha.addEventListener("animationend", acabar);
}
const proxima = () => irPara(atual + 1);
const anterior = () => irPara(atual - 1);
function irParaPagina(k) {
  if (k < 0) return;
  irPara(unica ? k : Math.ceil(k / 2));
}

/* ---------------- Abrir / fechar ---------------- */
function abrir() {
  if (aberto) return;
  aberto = true;
  iniciarAudio(); capaSom();
  livro.classList.remove("fechado");
  $("capa").setAttribute("aria-label", "Capa do livro");
  $("capa").tabIndex = -1;
  ["barra", "ant", "prox", "dica"].forEach(id => ($(id).hidden = false));
  $("dica").textContent = unica ? "Toque na página para terminar de escrever · deslize para virar" : "Clique na página para terminar de escrever · setas para virar";
  $("capa").blur();
  atual = 0; desenhar();
  setTimeout(() => { if (aberto) livro.classList.add("aberto"); }, 1300);
  setTimeout(() => { revelarVisiveis(); }, 1150);
  setTimeout(() => ($("dica").hidden = true), 9000);
}
function fechar() {
  completarTudo(); fecharNota();
  aberto = false; capaSom();
  if (!unica && atual !== 0) { atual = 0; desenhar(); }
  livro.classList.remove("aberto");
  requestAnimationFrame(() => livro.classList.add("fechado"));
  $("capa").setAttribute("aria-label", "Abrir o livro");
  $("capa").tabIndex = 0;
  ["barra", "ant", "prox", "dica"].forEach(id => ($(id).hidden = true));
}

/* ---------------- Notas ---------------- */
function atualizarContador() { $("n-notas").textContent = `${[...lidas].filter(id => NOTAS.some(n => n.id === id)).length}/${NOTAS.length}`; }
function abrirNota(span) {
  const nota = NOTAS.find(n => n.id === span.dataset.nota);
  if (!nota) return;
  $("nota-titulo").textContent = nota.titulo;
  $("nota-texto").textContent = nota.texto;
  const caixa = $("nota");
  caixa.hidden = false;
  const r = span.getBoundingClientRect(), w = caixa.offsetWidth, h = caixa.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10;
  if (y + h > innerHeight - 8) y = r.top - h - 10;
  caixa.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + "px";
  caixa.style.top = Math.max(8, y) + "px";
  if (!lidas.has(nota.id)) {
    lidas.add(nota.id); guardar("lorenzzo-notas", [...lidas]);
    document.querySelectorAll(`.kw[data-nota="${nota.id}"]`).forEach(k => k.classList.add("lida"));
    atualizarContador();
    sino();
  }
  $("nota-x").focus({ preventScroll: true });
}
function fecharNota() { $("nota").hidden = true; }

/* ---------------- Som ---------------- */
let audio;
function iniciarAudio() {
  if (!som || audio) return;
  const A = window.AudioContext || window.webkitAudioContext;
  if (A) audio = new A();
}
function ruido(seg, freq, q, vol, ataque = .02) {
  if (!som || !audio) return;
  const t = audio.currentTime, n = Math.floor(audio.sampleRate * seg);
  const buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audio.createBufferSource(); src.buffer = buf;
  const f = audio.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * .45, t + seg);
  const g = audio.createGain(); g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(.0001, t + seg);
  src.connect(f).connect(g).connect(audio.destination); src.start(t);
}
function folheio() { ruido(.42, 2600, .7, .22, .09); setTimeout(() => ruido(.12, 1500, 1.2, .12), 380); }
function capaSom() { iniciarAudio(); ruido(.5, 380, 1.5, .35, .01); ruido(.9, 900, .5, .08, .2); }
function tinta(ms) { if (ms > 400) ruido(Math.min(ms / 1000, 2.5), 5200, 2.5, .018, .3); }
function sino() {
  if (!som || !audio) return;
  const t = audio.currentTime;
  for (const [f, v] of [[660, .05], [990, .025], [1320, .012]]) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1.5);
  }
}

/* ---------------- Eventos ---------------- */
function rotularBotoes() {
  $("b-tinta").textContent = "Tinta: " + VELOCIDADES[vel][0];
  raiz.style.setProperty("--vel", VELOCIDADES[vel][1] + "ms");
  $("b-som").textContent = som ? "Som ligado" : "Som desligado";
  $("b-som").setAttribute("aria-pressed", String(som));
}

function ligarEventos() {
  $("capa").addEventListener("click", () => { if (!aberto) abrir(); });
  $("prox").addEventListener("click", proxima);
  $("ant").addEventListener("click", anterior);
  $("b-fechar").addEventListener("click", fechar);
  $("b-sumario").addEventListener("click", () => irParaPagina(paginas.findIndex(p => p.ancora === "sumario")));
  $("b-notas").addEventListener("click", () => irParaPagina(paginas.findIndex(p => p.ancora === "notas-0")));
  $("b-tinta").addEventListener("click", () => { vel = (vel + 1) % VELOCIDADES.length; guardar("lorenzzo-tinta", vel); rotularBotoes(); });
  $("b-som").addEventListener("click", () => { som = !som; guardar("lorenzzo-som", som); if (som) iniciarAudio(); rotularBotoes(); });
  $("nota-x").addEventListener("click", fecharNota);

  for (const lado of ["p-esq", "p-dir"]) {
    $(lado).addEventListener("click", e => {
      const kw = e.target.closest(".kw");
      if (kw) { e.stopPropagation(); completarTudo(); abrirNota(kw); return; }
      const ir = e.target.closest("[data-ir]");
      if (ir) { irParaPagina(Number(ir.dataset.ir)); return; }
      if (e.target.closest("a,button")) return;
      if (reveladoAtivo.length) { completarTudo(); return; }
      if (!$("nota").hidden) { fecharNota(); return; }
      if (unica) {
        const r = $(lado).getBoundingClientRect();
        (e.clientX - r.left < r.width * .35 ? anterior : proxima)();
      } else (lado === "p-dir" ? proxima : anterior)();
    });
    $(lado).addEventListener("keydown", e => {
      const kw = e.target.closest(".kw");
      if (kw && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); abrirNota(kw); }
    });
  }
  document.addEventListener("click", e => {
    if (!$("nota").hidden && !e.target.closest(".nota") && !e.target.closest(".kw")) fecharNota();
  }, true);

  addEventListener("keydown", e => {
    if (e.target.closest?.(".kw") && (e.key === "Enter" || e.key === " ")) return;
    if (!aberto) { if ((e.key === "Enter" || e.key === " ") && document.activeElement === $("capa")) return; if (e.key === "ArrowRight") abrir(); return; }
    if (e.key === "Escape") { if (!$("nota").hidden) fecharNota(); else completarTudo(); return; }
    if (e.target.matches?.("button, a") && (e.key === " " || e.key === "Enter")) return;
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); reveladoAtivo.length ? completarTudo() : proxima(); }
    if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); anterior(); }
  });

  let toque = null;
  $("cena").addEventListener("touchstart", e => { toque = [e.touches[0].clientX, e.touches[0].clientY, Date.now()]; }, { passive: true });
  $("cena").addEventListener("touchend", e => {
    if (!toque || !aberto) return;
    const dx = e.changedTouches[0].clientX - toque[0], dy = e.changedTouches[0].clientY - toque[1];
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - toque[2] < 700) {
      e.preventDefault();
      (dx < 0 ? proxima : anterior)();
    }
    toque = null;
  });

  let espera;
  addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const nova = medir();
      if (nova === medidas) return;
      medidas = nova;
      completarTudo(); fecharNota();
      const ancoraAtual = paginas[unica ? atual : dirDe(atual)]?.ancora ?? paginas[esqDe(atual) ?? 0]?.ancora;
      paginar();
      const k = Math.max(0, paginas.findIndex(p => p.ancora === ancoraAtual));
      atual = Math.min(maxAtual(), unica ? k : Math.ceil(k / 2));
      if (aberto) { desenhar(); revelarVisiveis(); }
    }, 220);
  });
}

async function iniciar() {
  rotularBotoes();
  medidas = medir();
  ligarEventos();
  try {
    await Promise.all(["400 18px 'EB Garamond'", "400 18px UnifrakturMaguntia", "600 12px Cinzel", "italic 18px 'IM Fell English'"].map(f => document.fonts.load(f)));
  } catch {}
  await carregarCapitulos();
  paginar();
  atualizarContador();
  desenhar();
  livro.dataset.pronto = "1";
}
iniciar();
