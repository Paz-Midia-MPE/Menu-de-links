//--------------------------------------------------
// CONFIGURAÇÕES
//--------------------------------------------------
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRP-rsjBbuvpdgtNswxvnsiubtHQA2qoB5T-myVQ8ejJ6wPzQeLJh6tp4yJEJDKAxR18FB-Ky2TfftG/pub?output=csv";
const itensPorPagina = 50;
const fallbackNovosCount = 1;
const diasParaConsiderarNovo = 7;

//--------------------------------------------------
let dados = [];
let paginaAtual = 1;
let anoSelecionado = "";
let termoBusca = "";

//--------------------------------------------------
// CSV
//--------------------------------------------------
function parseCSV(text) {
    const linhas = text.trim().split("\n");
    const headers = linhas[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/(^"|"$)/g,"").trim());
    const rows = linhas.slice(1).map(l => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/(^"|"$)/g,"").trim()));
    return { headers, rows };
}

//--------------------------------------------------
// LER HASH DA URL
//--------------------------------------------------
function parseHash() {
    const hash = new URLSearchParams(location.hash.replace("#",""));
    return {
        p: parseInt(hash.get("p") || "1", 10),
        a: hash.get("a") || "",
        q: hash.get("q") || "",
        idx: hash.get("idx") ? parseInt(hash.get("idx"),10) : null
    };
}

// atualizar hash SEM quebrar opções
function updateHash(idx = null) {
    const hash = new URLSearchParams();
    if (paginaAtual > 1) hash.set("p", paginaAtual);
    if (anoSelecionado) hash.set("a", anoSelecionado);
    if (termoBusca) hash.set("q", termoBusca);
    if (idx !== null) hash.set("idx", idx);
    location.hash = hash.toString();
}

//--------------------------------------------------
// CARREGAR PLANILHA
//--------------------------------------------------
async function carregarDados() {
    try {
        const rsp = await fetch(sheetURL);
        const texto = await rsp.text();
        const parsed = parseCSV(texto);
        const headers = parsed.headers.map(h => h.toLowerCase());
        const idxNome = headers.findIndex(h => h.includes("nome"));
        const idxLink = headers.findIndex(h => h.includes("link") || h.includes("url"));
        const idxAno = headers.findIndex(h => h.includes("ano"));
        const idxDestaque = headers.findIndex(h => h.includes("destaque"));
        const idxNovo = headers.findIndex(h => h.includes("novo"));
        const idxData = headers.findIndex(h => h.includes("data") || h.includes("date"));

        let linhas = parsed.rows.map((c,i) => ({
            nome: c[idxNome] || "",
            link: c[idxLink] || "#",
            ano: c[idxAno] || "",
            destaqueVal: idxDestaque >= 0 ? (c[idxDestaque] || "") : "",
            novoVal: idxNovo >= 0 ? (c[idxNovo] || "") : "",
            dataVal: idxData >= 0 ? (c[idxData] || "") : ""
        }));

        linhas.reverse();
        const agora = new Date();

        linhas = linhas.map((item, idx) => {
            let isNovo = false;
            let isDestaque = false;

            if (item.novoVal && ["sim","s","yes","1","y","true"].includes(item.novoVal.toLowerCase()))
                isNovo = true;

            if (!isNovo && item.dataVal) {
                const d = new Date(item.dataVal);
                if (!isNaN(d) && ((agora - d) / 86400000 <= diasParaConsiderarNovo))
                    isNovo = true;
            }

            if (!isNovo && idx < fallbackNovosCount) isNovo = true;

            if (item.destaqueVal && ["sim","yes","1","destaque"].includes(item.destaqueVal.toLowerCase()))
                isDestaque = true;
            if (!isDestaque && (item.nome.includes("★") || item.nome.toLowerCase().startsWith("destaque:")))
                isDestaque = true;

            return { ...item, isNovo, isDestaque };
        });

        const destaques = linhas.filter(x => x.isDestaque);
        const normais = linhas.filter(x => !x.isDestaque);
        dados = [...destaques, ...normais];

        aplicarFiltrosHashInicial();
        preencherFiltroAno();
        renderizarMenu();

    } catch {
        document.getElementById("status").textContent = "Erro ao carregar planilha.";
    }
}

//--------------------------------------------------
// CARREGAR FILTROS DA URL
//--------------------------------------------------
function aplicarFiltrosHashInicial() {
    const h = parseHash();
    paginaAtual = isNaN(h.p) ? 1 : h.p;
    anoSelecionado = h.a || "";
    termoBusca = h.q || "";

    document.getElementById("ano").value = anoSelecionado;
    document.getElementById("busca").value = termoBusca;
}

//--------------------------------------------------
// RENDERIZAR
//--------------------------------------------------
function preencherFiltroAno() {
    const selectAno = document.getElementById("ano");
    const anos = [...new Set(dados.map(i => i.ano).filter(a => a))].sort();
    anos.forEach(a => selectAno.innerHTML += `<option value="${a}">${a}</option>`);

    selectAno.addEventListener("change", () => {
        anoSelecionado = selectAno.value;
        paginaAtual = 1;
        updateHash();
        renderizarMenu();
    });

    document.getElementById("busca").addEventListener("input", () => {
        termoBusca = document.getElementById("busca").value.trim().toLowerCase();
        paginaAtual = 1;
        updateHash();
        renderizarMenu();
    });
}

function renderizarMenu() {
    const menuDiv = document.getElementById("menu");
    const statusDiv = document.getElementById("status");
    menuDiv.innerHTML = "";
    statusDiv.textContent = "";

    let filtrados = dados.filter(i => {
        const okAno = !anoSelecionado || i.ano === anoSelecionado;
        const okBusca = !termoBusca || i.nome.toLowerCase().includes(termoBusca);
        return okAno && okBusca;
    });

    if (filtrados.length === 0) {
        statusDiv.textContent = "Nenhum resultado encontrado.";
        document.getElementById("pagination").innerHTML = "";
        return;
    }

    const totalPag = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPag) paginaAtual = totalPag;
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const pagDados = filtrados.slice(inicio, inicio + itensPorPagina);

    pagDados.forEach((item, i) => {
        const indGlobal = inicio + i;
        const div = document.createElement("div");
        div.className = "link-item";

        const a = document.createElement("a");
        a.href = item.link;
        a.target = "_blank";
        a.textContent = item.nome;
        a.addEventListener("click", () => updateHash(indGlobal));

        div.appendChild(a);

        if (item.isDestaque) div.innerHTML += `<span class="badge-destaque">DESTAQUE</span>`;
        if (item.isNovo) div.innerHTML += `<span class="badge-new">• NOVO</span>`;

        menuDiv.appendChild(div);
    });

    renderizarPaginacao(totalPag);
}

function renderizarPaginacao(total) {
    const pag = document.getElementById("pagination");
    pag.innerHTML = "";
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.disabled = i === paginaAtual;
        btn.onclick = () => {
            paginaAtual = i;
            updateHash();
            renderizarMenu();
        };
        pag.appendChild(btn);
    }
}

//--------------------------------------------------
window.addEventListener("load", carregarDados);
