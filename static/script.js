// script.js
const API = "https://ledax-redes.onrender.com";
const DOMAIN_MAP_CENTER = [-15.7801, -47.9292]; 
const DOMAIN_MAP_ZOOM = 4;
let map;
let lojasData = [];
const redeColors = {};
const redeLayers = {};
let markerClusterGroup = L.markerClusterGroup();

let geoJsonEstadosData = null; 
let ufToRepresentantesMap = null; 

const camadaRepAtiva = {};

const ALL_UFS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SP', 'SE', 'TO'
];

const ESTADOS_NOMES = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins'
};

const coberturaRepresentante = {
    "RENATO PEREIRA": ["MT"],
    "RODRIGO LISBOA": ["MG"],
    "DANIEL DE EQUIP.": ["PE", "RN"],
    "CLECIO SALVIANO": ["SP"],
    "HAMILTON MORAES": ["GO", "MS"],
    "MARCOS BARIANI": ["SP", "AL"],
    "ALEXANDRE CÂND.": ["AL", "DF"],
    "EDSEU MARQUES": ["TO", "PA"],
    "MAURO FOLLMANN": ["PA"],
    "MANOEL AFONSO": ["AC", "RO"],
    "JOSÉ LOBO": ["BA"],
    "PEDRO AMORIM": ["RJ"],
    "CRYSTIANO SILVA": ["AM"],
    "ERNESTO (LLAMPE)": ["SC", "PR"]
    // "SEM COBERTURA" será adicionado dinamicamente
};

const coresRepresentante = {
    "RENATO PEREIRA": "rgba(255, 105, 180, 0.7)",
    "RODRIGO LISBOA": "rgba(0, 191, 255, 0.7)",
    "DANIEL DE EQUIP.": "rgba(255, 69, 0, 0.7)",
    "CLECIO SALVIANO": "rgba(147, 112, 219, 0.7)",
    "HAMILTON MORAES": "rgba(255, 215, 0, 0.7)",
    "MARCOS BARIANI": "rgba(0, 255, 255, 0.7)",
    "ALEXANDRE CÂND.": "rgba(255, 165, 0, 0.7)",
    "EDSEU MARQUES": "rgba(128, 0, 128, 0.7)",
    "MAURO FOLLMANN": "rgba(255, 0, 0, 0.7)",
    "MANOEL AFONSO": "rgba(0, 128, 0, 0.7)",
    "JOSÉ LOBO": "rgba(255, 140, 0, 0.7)",
    "PEDRO AMORIM": "rgba(70, 130, 180, 0.7)",
    "CRYSTIANO SILVA": "rgba(0, 0, 255, 0.7)",
    "ERNESTO (LLAMPE)": "rgba(0, 128, 15, 0.58)",
    "SEM COBERTURA": "rgba(180, 180, 180, 0.55)"
};

const COR_SOBREPOSICAO = "rgba(255, 102, 0, 0.8)"; // Laranja forte

function stringToHslColor(str) {
    const GOLDEN_ANGLE = 137.508;
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    const normalized = hash / 2 ** 32;
    let h = (normalized * 360 + GOLDEN_ANGLE * (hash % 10)) % 360;
    let s = 65;
    let l = 45;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function aplicarSemCoberturaAutomatica() {
    const cobertos = new Set();
    Object.entries(coberturaRepresentante).forEach(([nome, ufs]) => {
        if (Array.isArray(ufs)) {
            ufs.forEach(uf => cobertos.add(uf));
        }
    });

    const semCobertura = ALL_UFS.filter(uf => !cobertos.has(uf));
    coberturaRepresentante["SEM COBERTURA"] = semCobertura;
    
    if (!coresRepresentante["SEM COBERTURA"]) {
        coresRepresentante["SEM COBERTURA"] = "rgba(180, 180, 180, 0.55)";
    }
}

aplicarSemCoberturaAutomatica();

function getRepresentantePorUF() {
    const ufToRepresentantes = {};
    const ufsNaoCobertas = new Set(ALL_UFS);

    for (const rep in coberturaRepresentante) {
        const ufs = coberturaRepresentante[rep];
        if (!Array.isArray(ufs)) continue;

        ufs.forEach(uf => {
            ufsNaoCobertas.delete(uf);

            if (!ufToRepresentantes[uf]) {
                ufToRepresentantes[uf] = [];
            }
            ufToRepresentantes[uf].push(rep);
        });
    }

    ufsNaoCobertas.forEach(uf => {
        if (!ufToRepresentantes[uf]) {
            ufToRepresentantes[uf] = ["SEM COBERTURA"];
        } else if (!ufToRepresentantes[uf].includes("SEM COBERTURA")) {
            ufToRepresentantes[uf].push("SEM COBERTURA");
        }
    });

    return ufToRepresentantes;
}

async function fetchLojasRede() {
    try {
        const response = await fetch(`${API}/api/lojas_rede/`);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.statusText}`);
        }
        lojasData = await response.json();
        console.log(`✅ ${lojasData.length} lojas carregadas da API.`);
        return lojasData;
    } catch (error) {
        console.error("❌ Erro ao carregar dados das lojas.", error);
        const container = document.getElementById('filterRedesContainer');
        if (container) container.innerHTML = `<div class="checkbox-row" style="color: red;">Erro: Backend offline?</div>`;
        return [];
    }
}

async function fetchGeoJson() {
    try {
        const response = await fetch('brasil_estados.geojson');
        if (!response.ok) {
            throw new Error(`Erro ao carregar GeoJSON: ${response.statusText}`);
        }
        geoJsonEstadosData = await response.json();
        return geoJsonEstadosData;
    } catch (error) {
        console.error("❌ Erro ao carregar GeoJSON dos estados:", error);
        return null;
    }
}

function initMap() {
    map = L.map('map', {
        center: DOMAIN_MAP_CENTER,
        zoom: DOMAIN_MAP_ZOOM,
        zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    markerClusterGroup.addTo(map);

    fetchLojasRede().then(data => {
        if (data.length > 0) {
            const redes = [...new Set(data.map(d => d.rede))].filter(r => r && String(r).trim() !== '').sort();

            redes.forEach(rede => {
                redeColors[rede] = stringToHslColor(rede);
            });

            populateSidebar(redes);
            applyFilters(); // Isso agora também chama updateCorrelatedStats
        }
    });

    drawCoberturaRepresentante();
}

function populateSidebar(uniqueRedes) {
    const container = document.getElementById('filterRedesContainer');
    const legendContainer = document.getElementById('redes-legend');
    if (!container) return;
    
    container.innerHTML = '';
    if (legendContainer) legendContainer.innerHTML = '';

    const selectAllId = 'check-all-redes';
    container.innerHTML += `
        <div class="checkbox-row">
            <input type="checkbox" id="${selectAllId}" name="rede" value="ALL" checked>
            <label for="${selectAllId}">Todas as Redes</label>
        </div>
    `;

    uniqueRedes.forEach(rede => {
        // Cria ID seguro para o checkbox e para o span do contador
        const safeName = rede.replace(/\s/g, '-').replace(/[^\w-]/g, '');
        const id = `check-rede-${safeName}`;
        const countId = `count-rede-${safeName}`; 
        const color = redeColors[rede];

        container.innerHTML += `
            <div class="checkbox-row">
                <input type="checkbox" id="${id}" name="rede" value="${rede}" checked>
                <label for="${id}" class="rede-label-content"> 
                    <div class="rede-color-icon" style="background-color: ${color}; width:12px; height:12px; border-radius:50%; display:inline-block; margin-right:6px;"></div>
                    <span>${rede}</span>
                    <span id="${countId}" style="font-size: 0.85em; color: #666; margin-left: 4px;"></span>
                </label>
            </div>
        `;

        if (legendContainer) {
            legendContainer.innerHTML += `
                <div class="legend-item" style="display:flex; align-items:center; margin-bottom: 5px;">
                    <div style="background-color: ${color}; width:15px; height:15px; border-radius:50%; margin-right: 8px;"></div>
                    <span>${rede}</span>
                </div>
            `;
        }
    });

    // Listeners

    // Todas as redes
    document.getElementById(selectAllId).addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        container.querySelectorAll('input[type="checkbox"][name="rede"]:not(#check-all-redes)').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        applyFilters();
    });

    // Redes individuais
    container.querySelectorAll('input[type="checkbox"][name="rede"]:not(#check-all-redes)').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (!e.target.checked) {
                const allCheck = document.getElementById(selectAllId);
                if(allCheck) allCheck.checked = false;
            }
            applyFilters();
        });
    });

    // Filtros de vendas (garantir listeners e spans)
    const vendasContainer = document.getElementById('filterVendasContainer');
    if (vendasContainer) {
        addCounterToLabel('vendas-sim');
        addCounterToLabel('vendas-nao');

        vendasContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', applyFilters);
        });
    }
}

function addCounterToLabel(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const label = document.querySelector(`label[for="${inputId}"]`);
    if (label && !label.querySelector('.venda-count')) {
        const span = document.createElement('span');
        span.className = 'venda-count';
        span.style.fontSize = "0.85em";
        span.style.color = "#666";
        span.style.marginLeft = "4px";
        label.appendChild(span);
    }
}

function populateCoberturaFilters() {
    const container = document.getElementById('cobertura-legend');
    if (!container) return;
    container.innerHTML = '';

    aplicarSemCoberturaAutomatica();
    ufToRepresentantesMap = getRepresentantePorUF();

    // --- NOVO: Checkbox TODOS ---
    const selectAllId = 'check-all-reps';
    container.innerHTML += `
        <div class="checkbox-row" style="padding: 0; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            <input 
                type="checkbox" 
                id="${selectAllId}" 
                onchange="alternarTodosRepresentantes(this)"
            >
            <label for="${selectAllId}" style="font-weight: bold;">
                TODOS
            </label>
        </div>
    `;
    // ----------------------------

    const representantes = Object.keys(coberturaRepresentante).sort();

    representantes.forEach(rep => {
        const id = `check-rep-${rep.replace(/\s/g, '-').replace(/[^\w-]/g, '')}`;
        const cor = coresRepresentante[rep] || stringToHslColor(rep);

        container.innerHTML += `
            <div class="checkbox-row" style="padding: 0;">
                <input 
                    type="checkbox" 
                    id="${id}" 
                    data-rep-nome="${rep}" 
                    onchange="alternarCoberturaIndividual(this)" 
                >
                <label for="${id}">
                    <div style="background-color: ${cor}; width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 6px;"></div>
                    ${rep}
                </label>
            </div>
        `;
    });
}

function alternarTodosRepresentantes(sourceCheckbox) {
    const isChecked = sourceCheckbox.checked;
    // Seleciona todos os checkboxes de representantes (exceto o próprio "Todos")
    const checkboxes = document.querySelectorAll('#cobertura-legend input[type="checkbox"]:not(#check-all-reps)');
    
    checkboxes.forEach(cb => {
        // Só dispara a alteração se o estado for diferente, para evitar reprocessamento desnecessário
        if (cb.checked !== isChecked) {
            cb.checked = isChecked;
            alternarCoberturaIndividual(cb); // Chama a função que desenha/remove a camada no mapa
        }
    });
}

function updateCorrelatedStats() {
    // 1. Estados atuais dos filtros de Venda
    const vendasSimInput = document.getElementById('vendas-sim');
    const vendasNaoInput = document.getElementById('vendas-nao');
    const isVendaSimChecked = vendasSimInput ? vendasSimInput.checked : true;
    const isVendaNaoChecked = vendasNaoInput ? vendasNaoInput.checked : true;

    // 2. Estados atuais dos filtros de Rede
    const redesCheckboxes = document.querySelectorAll('#filterRedesContainer input[type="checkbox"][name="rede"]:not(#check-all-redes)');
    const redesSelecionadas = Array.from(redesCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    // 3. Inicializa contadores
    const redeCounts = {}; 
    let countComVenda = 0; 
    let countSemVenda = 0;

    // Zera contagem de todas as redes disponíveis
    redesCheckboxes.forEach(cb => {
        redeCounts[cb.value] = 0;
    });

    // 4. Loop único para cálculo cruzado
    lojasData.forEach(item => {
        // A) Contagem de Redes: Considera apenas o filtro de VENDA
        const passaFiltroVenda = (item.teve_venda && isVendaSimChecked) || (!item.teve_venda && isVendaNaoChecked);
        
        if (passaFiltroVenda) {
            if (redeCounts[item.rede] !== undefined) {
                redeCounts[item.rede]++;
            } else {
                // Caso apareça uma rede que não estava nos checkboxes (raro)
                redeCounts[item.rede] = 1;
            }
        }

        // B) Contagem de Vendas: Considera apenas o filtro de REDE
        const passaFiltroRede = redesSelecionadas.includes(item.rede);
        
        if (passaFiltroRede) {
            if (item.teve_venda) {
                countComVenda++;
            } else {
                countSemVenda++;
            }
        }
    });

    // 5. Atualiza UI das Redes
    for (const [rede, count] of Object.entries(redeCounts)) {
        const safeName = rede.replace(/\s/g, '-').replace(/[^\w-]/g, '');
        const countSpan = document.getElementById(`count-rede-${safeName}`);
        const checkbox = document.getElementById(`check-rede-${safeName}`);
        
        if (countSpan) {
            countSpan.innerText = `(${count})`;
            // Opacidade visual para redes sem itens no filtro atual
            if (checkbox && checkbox.parentElement) {
                checkbox.parentElement.style.opacity = count === 0 ? '0.5' : '1';
            }
        }
    }

    // 6. Atualiza UI das Vendas
    if (vendasSimInput) {
        const labelSim = document.querySelector(`label[for="vendas-sim"] .venda-count`);
        if (labelSim) labelSim.innerText = `(${countComVenda})`;
    }
    
    if (vendasNaoInput) {
        const labelNao = document.querySelector(`label[for="vendas-nao"] .venda-count`);
        if (labelNao) labelNao.innerText = `(${countSemVenda})`;
    }
}

function applyFilters() {
    // 1. Limpa
    markerClusterGroup.clearLayers();

    // 2. Coleta filtros
    const redesCheckboxes = document.querySelectorAll('#filterRedesContainer input[type="checkbox"][name="rede"]:not(#check-all-redes)');
    const redesSelecionadas = Array.from(redesCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    const vendasSimEl = document.getElementById('vendas-sim');
    const vendasNaoEl = document.getElementById('vendas-nao');
    const vendasSim = vendasSimEl ? vendasSimEl.checked : true;
    const vendasNao = vendasNaoEl ? vendasNaoEl.checked : true;

    const activeBounds = L.latLngBounds([]);

    // 3. Renderiza mapa (Interseção total: Rede AND Venda)
    lojasData.forEach(item => {
        if (!item.latitude || !item.longitude) return;

        const isRedeMatch = redesSelecionadas.includes(item.rede);
        const isVendaMatch = (item.teve_venda && vendasSim) || (!item.teve_venda && vendasNao);

        if (isRedeMatch && isVendaMatch) {
            const color = redeColors[item.rede] || '#AAAAAA';

            const customIcon = L.divIcon({
                className: 'network-icon',
                html: `<div style="background-color: ${color};"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([item.latitude, item.longitude], { icon: customIcon });

            const popupContent = `
                <b>Rede:</b> ${item.rede}<br>
                <b>Loja:</b> ${item.loja}<br>
                <b>Endereço:</b> ${item.endereco}<br>
                <b>CNPJ:</b> ${item.cnpj || 'N/A'}<br>
                <b>Última Venda:</b> ${item.data_venda || 'N/A'}<br>
                <b>Funil:</b> ${item.funil_ultima_venda || 'N/A'}<br>
                <b>Status Venda:</b> <b>${item.teve_venda ? 'COM VENDA ✅' : 'SEM VENDA ❌'}</b>
            `;
            marker.bindPopup(popupContent);

            markerClusterGroup.addLayer(marker);
            activeBounds.extend([item.latitude, item.longitude]);
        }
    });

    // 4. Ajusta zoom
    if (Object.keys(camadaRepAtiva).length === 0) {
        if (activeBounds.isValid()) {
            map.fitBounds(activeBounds, { padding: [50, 50], maxZoom: 10 });
        } else {
            map.setView(DOMAIN_MAP_CENTER, DOMAIN_MAP_ZOOM);
        }
    }

    // 5. ATUALIZA OS CONTADORES CORRELACIONADOS
    updateCorrelatedStats();
}

function clearFilters() {
    // Reseta Redes
    document.querySelectorAll('#filterRedesContainer input[type="checkbox"][name="rede"]').forEach(checkbox => {
        checkbox.checked = true;
    });

    // Reseta Vendas
    const vendasSimEl = document.getElementById('vendas-sim');
    const vendasNaoEl = document.getElementById('vendas-nao');
    if (vendasSimEl) vendasSimEl.checked = true;
    if (vendasNaoEl) vendasNaoEl.checked = true;

    applyFilters();
}

async function drawCoberturaRepresentante() {
    aplicarSemCoberturaAutomatica();
    ufToRepresentantesMap = getRepresentantePorUF();
    geoJsonEstadosData = await fetchGeoJson();

    if (geoJsonEstadosData) {
        populateCoberturaFilters();
    }
}

function alternarCoberturaIndividual(checkbox) {
    const repNome = checkbox.dataset.repNome;

    if (checkbox.checked) {
        // --- 1. SELECIONADO (aparece no mapa) ---
        if (!geoJsonEstadosData || !ufToRepresentantesMap) {
            console.error("Dados GeoJSON ou mapa indisponível.");
            return;
        }

        const featuresFiltradas = geoJsonEstadosData.features.filter(feature => {
            const uf = feature.properties.sigla;
            const repsNaUF = ufToRepresentantesMap[uf] || [];
            return repsNaUF.includes(repNome);
        });

        const geoJsonFiltrado = {
            type: "FeatureCollection",
            features: featuresFiltradas
        };

        const corBase = coresRepresentante[repNome] || stringToHslColor(repNome);

        const camadaPoligono = L.geoJSON(geoJsonFiltrado, {
            style: function (feature) {
                const uf = feature.properties.sigla;
                const repsNaUF = ufToRepresentantesMap[uf] || [];
                let corPoligono = repsNaUF.length > 1 ? COR_SOBREPOSICAO : corBase;

                return {
                    fillColor: corPoligono,
                    weight: 1.5,
                    opacity: 0.9,
                    color: 'white',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: function (feature, layer) {
                const uf = feature.properties.sigla;
                // Usa o mapa de nomes corrigido
                const nomeEstado = ESTADOS_NOMES[uf] || feature.properties.nome || uf;
                const reps = ufToRepresentantesMap[uf] || [];

                let popupContent = `<b>Estado:</b> ${nomeEstado} (${uf})<br>`;
                popupContent += reps.length > 1
                    ? `<b>Representantes:</b><br> - ${reps.join('<br> - ')}`
                    : `<b>Representante:</b> ${reps[0]}`;

                layer.bindPopup(popupContent);
            }
        });

        camadaPoligono.addTo(map);
        camadaRepAtiva[repNome] = camadaPoligono;

    } else {
        // --- 2. DESSELECIONADO (some do mapa) ---
        if (camadaRepAtiva[repNome]) {
            map.removeLayer(camadaRepAtiva[repNome]);
            delete camadaRepAtiva[repNome];
        }
    }

    ajustarZoomCoberturaAtiva();

    // --- NOVO: Sincroniza o checkbox "TODOS" ---
    // Verifica se todos os checkboxes individuais estão marcados
    const allReps = document.querySelectorAll('#cobertura-legend input[type="checkbox"]:not(#check-all-reps)');
    const allChecked = Array.from(allReps).every(cb => cb.checked);
    
    const checkAllBox = document.getElementById('check-all-reps');
    if (checkAllBox) {
        checkAllBox.checked = allChecked;
    }
}

function ajustarZoomCoberturaAtiva() {
    const camadasAtivas = Object.values(camadaRepAtiva);
    if (camadasAtivas.length > 0) {
        const bounds = L.latLngBounds([]);
        camadasAtivas.forEach(camada => {
            if (camada.getBounds && camada.getBounds().isValid()) {
                bounds.extend(camada.getBounds());
            }
        });
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    } else {
        applyFilters();
    }
}

function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const btnToggle = document.getElementById('btnToggleSidebar');
    if (!btnToggle || !sidebar) return;
    btnToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSidebarToggle();

    const btnAplicar = document.getElementById('btnAplicar');
    const btnLimpar = document.getElementById('btnLimpar');
    if (btnAplicar) btnAplicar.addEventListener('click', applyFilters);
    if (btnLimpar) btnLimpar.addEventListener('click', clearFilters);
});
