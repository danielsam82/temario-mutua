const storagePrefix = window.STORAGE_PREFIX || 'L4_';
// Variables Globales
let db = [];
let selectedQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; 
let isListMode = false;
let currentExamConfig = null; 
let currentEditId = null;

// Study Mode Variables
let studyQuestions = [];

// DOM Elements
const screens = {
    dashboard: document.getElementById('screen-dashboard'),
    config: document.getElementById('screen-config'),
    test: document.getElementById('screen-test'),
    results: document.getElementById('screen-results'),
    history: document.getElementById('screen-history'),
    historyDetail: document.getElementById('screen-history-detail'),
    manager: document.getElementById('screen-manager'),
    sync: document.getElementById('screen-sync'),
    studyConfig: document.getElementById('screen-study-config'),
    studyRun: document.getElementById('screen-study-run')
};

const navBtns = {
    dashboard: document.getElementById('nav-dashboard'),
    config: document.getElementById('nav-config'),
    study: document.getElementById('nav-study'),
    history: document.getElementById('nav-history'),
    manager: document.getElementById('nav-manager'),
    sync: document.getElementById('nav-sync')
};

function initApp() {
    initDB();
    initTheme();
    initDashboard();
    loadThemes();
    setupEventListeners();
    updateCharts();
    switchScreen('dashboard');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initDB() {
    db = JSON.parse(JSON.stringify(preguntasTemario));
    const edits = JSON.parse(localStorage.getItem(storagePrefix + 'db_edits')) || {};
    db.forEach(q => {
        if(edits[q.id]) {
            q.pregunta = edits[q.id].pregunta;
            q.opciones = edits[q.id].opciones;
            q.respuestaCorrecta = edits[q.id].respuestaCorrecta;
        }
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('btn-theme').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });

    // Mobile menu
    const btnMenu = document.getElementById('btn-menu');
    const mainNav = document.getElementById('main-nav');
    if (btnMenu && mainNav) {
        btnMenu.addEventListener('click', () => {
            mainNav.classList.toggle('open');
        });
    }

    const hideLetters = localStorage.getItem('hideLetters') === 'true';
    document.getElementById('hide-letters').checked = hideLetters;
    const studyHideLetters = document.getElementById('study-hide-letters');
    if(studyHideLetters) studyHideLetters.checked = hideLetters;
    
    if(hideLetters) document.body.classList.add('hide-letters');

    document.getElementById('hide-letters').addEventListener('change', (e) => {
        localStorage.setItem('hideLetters', e.target.checked);
        document.body.classList.toggle('hide-letters', e.target.checked);
        if(studyHideLetters) studyHideLetters.checked = e.target.checked;
    });
    
    if(studyHideLetters) {
        studyHideLetters.addEventListener('change', (e) => {
            localStorage.setItem('hideLetters', e.target.checked);
            document.body.classList.toggle('hide-letters', e.target.checked);
            document.getElementById('hide-letters').checked = e.target.checked;
        });
    }
}

function initDashboard() {
    const nameEl = document.getElementById('user-name');
    nameEl.textContent = localStorage.getItem('userName') || 'Estudiante';
    nameEl.addEventListener('blur', () => {
        localStorage.setItem('userName', nameEl.textContent.trim() || 'Estudiante');
    });

    const updateCountdown = () => {
        const now = new Date();
        const examDate = new Date(now.getFullYear(), 9, 30); 
        if (now > examDate) examDate.setFullYear(examDate.getFullYear() + 1);
        const diff = examDate - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        document.getElementById('countdown').textContent = `${days} días`;
    };
    updateCountdown();
    setInterval(updateCountdown, 1000 * 60 * 60 * 24); 

    renderCharts();
}

function renderCharts() {
    const history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    document.getElementById('dash-total-tests').textContent = history.length;
    
    if (history.length > 0) {
        const avg = history.reduce((acc, val) => acc + val.score, 0) / history.length;
        document.getElementById('dash-avg-score').textContent = Math.round(avg) + '%';
    } else {
        document.getElementById('dash-avg-score').textContent = '0%';
    }

    const statsByTheme = {};
    const themes = [...new Set(db.map(p => p.tema))];
    themes.forEach(t => statsByTheme[t] = { correct: 0, total: 0 });

    history.forEach(test => {
        if(!test.questions) return; 
        test.questions.forEach(q => {
            if(statsByTheme[q.tema]) {
                statsByTheme[q.tema].total++;
                if(q.userAns === q.correctAns) statsByTheme[q.tema].correct++;
            }
        });
    });

    const container = document.getElementById('theme-charts');
    container.innerHTML = '';
    themes.forEach(tema => {
        const st = statsByTheme[tema];
        const pct = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
        
        container.innerHTML += `
            <div class="chart-bar-wrap">
                <div class="chart-label" title="${tema}">${tema}</div>
                <div class="chart-track">
                    <div class="chart-fill" style="width: ${pct}%"></div>
                </div>
                <div class="chart-val">${pct}%</div>
            </div>
        `;
    });
}

function loadThemes() {
    const container = document.getElementById('themes-container');
    const studyContainer = document.getElementById('study-themes-container');
    const themes = [...new Set(db.map(p => p.tema))];
    
    themes.forEach((tema, index) => {
        // Para configurador de test
        const lbl = document.createElement('label');
        lbl.className = 'checkbox-label theme-item';
        lbl.innerHTML = `
            <input type="checkbox" class="theme-checkbox" value="${index}" checked>
            <span>${tema}</span>
        `;
        container.appendChild(lbl);

        // Para configurador de estudio
        const studyLbl = document.createElement('label');
        studyLbl.className = 'checkbox-label theme-item';
        studyLbl.innerHTML = `
            <input type="checkbox" class="study-theme-checkbox" value="${index}" checked>
            <span>${tema}</span>
        `;
        studyContainer.appendChild(studyLbl);
    });

    document.querySelectorAll('.theme-checkbox').forEach(cb => {
        cb.addEventListener('change', updateQuestionSlider);
    });
    
    updateQuestionSlider();
}

function updateQuestionSlider() {
    const checkboxes = document.querySelectorAll('.theme-checkbox');
    const activeThemes = Array.from(checkboxes).filter(c => c.checked).map(c => c.nextElementSibling.textContent);
    const poolSize = db.filter(p => activeThemes.includes(p.tema)).length;
    
    const range = document.getElementById('num-questions');
    const rangeVal = document.getElementById('num-val');
    
    range.max = poolSize || 1;
    if (parseInt(range.value) > poolSize) {
        range.value = poolSize;
    }
    rangeVal.textContent = range.value == range.max ? 'Todas (' + poolSize + ')' : range.value;
}

function setupEventListeners() {
    navBtns.dashboard.addEventListener('click', () => { initDashboard(); switchScreen('dashboard'); });
    navBtns.config.addEventListener('click', () => switchScreen('config'));
    navBtns.study.addEventListener('click', () => switchScreen('studyConfig'));
    navBtns.history.addEventListener('click', () => { loadHistory(); switchScreen('history'); });
    navBtns.manager.addEventListener('click', () => { renderDBList(); switchScreen('manager'); });
    navBtns.sync.addEventListener('click', () => switchScreen('sync'));

    const range = document.getElementById('num-questions');
    const rangeVal = document.getElementById('num-val');
    range.addEventListener('input', (e) => {
        rangeVal.textContent = e.target.value == range.max ? 'Todas (' + range.max + ')' : e.target.value;
    });

    document.getElementById('btn-toggle-themes').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.theme-checkbox');
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        checkboxes.forEach(c => c.checked = !allChecked);
        updateQuestionSlider();
    });

    document.getElementById('btn-start').addEventListener('click', startTest);
    
    document.getElementById('btn-quick-100').addEventListener('click', () => {
        document.querySelectorAll('.theme-checkbox').forEach(c => c.checked = true);
        document.getElementById('shuffle-questions').checked = true;
        document.getElementById('shuffle-options').checked = true;
        updateQuestionSlider();
        
        const r = document.getElementById('num-questions');
        r.value = Math.min(100, parseInt(r.max));
        document.getElementById('num-val').textContent = r.value;
        
        startTest();
    });

    document.getElementById('btn-prev').addEventListener('click', prevQuestion);
    document.getElementById('btn-next').addEventListener('click', nextQuestion);
    document.getElementById('btn-finish').addEventListener('click', finishTest);
    
    document.getElementById('btn-home').addEventListener('click', () => { initDashboard(); switchScreen('dashboard'); });
    document.getElementById('btn-review').addEventListener('click', () => {
        document.getElementById('review-container').classList.remove('hidden');
        document.getElementById('review-container').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-clear-history').addEventListener('click', () => {
        if(confirm("¿Seguro que deseas borrar TODO el historial? Se perderán las estadísticas.")) {
            localStorage.removeItem(storagePrefix + 'testHistory');
            localStorage.removeItem(storagePrefix + 'failedQuestions');
            loadHistory();
        }
    });
    
    document.getElementById('btn-test-failed').addEventListener('click', startFailedTest);
    document.getElementById('btn-back-history').addEventListener('click', () => switchScreen('history'));
    
    // Study Mode Listeners
    document.getElementById('btn-toggle-study-themes').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.study-theme-checkbox');
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        checkboxes.forEach(c => c.checked = !allChecked);
    });
    
    const studyOnlyFailed = document.getElementById('study-only-failed');
    studyOnlyFailed.addEventListener('change', (e) => {
        const themesGroup = document.getElementById('study-themes-group');
        themesGroup.style.opacity = e.target.checked ? '0.5' : '1';
        themesGroup.style.pointerEvents = e.target.checked ? 'none' : 'auto';
    });

    document.getElementById('btn-start-study').addEventListener('click', startStudyMode);
    document.getElementById('btn-study-finish').addEventListener('click', () => { initDashboard(); switchScreen('dashboard'); });

    // Sync Logic
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('btn-import-data').addEventListener('click', () => document.getElementById('file-import').click());
    document.getElementById('file-import').addEventListener('change', importData);

    // DB Manager
    document.getElementById('search-db').addEventListener('input', renderDBList);
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-modal').classList.add('hidden');
    });
    document.getElementById('btn-save-edit').addEventListener('click', saveEdit);
}

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        if(s) s.classList.remove('active');
    });
    if(screens[screenName]) {
        screens[screenName].classList.add('active');
    }
    
    Object.keys(navBtns).forEach(k => {
        navBtns[k].classList.toggle('active', k === screenName);
    });
    
    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.classList.remove('open');
    window.scrollTo(0,0);
}

function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function buildTest(pool, doShuffleQ, doShuffleO) {
    let qs = JSON.parse(JSON.stringify(pool));
    
    if (doShuffleQ) qs = shuffleArray(qs);
    
    if (doShuffleO) {
        qs.forEach(q => {
            const correctText = q.opciones.find(o => o.letra === q.respuestaCorrecta).texto;
            q.opciones = shuffleArray(q.opciones);
            const letters = ['a','b','c','d'];
            q.opciones.forEach((opt, idx) => {
                opt.letra = letters[idx];
                if (opt.texto === correctText) q.respuestaCorrecta = opt.letra;
            });
        });
    }
    return qs;
}

// ----------------------------------------------------
// TEST MODE
// ----------------------------------------------------

function startTest() {
    isListMode = document.querySelector('input[name="view-mode"]:checked').value === 'list';
    const doShuffleQ = document.getElementById('shuffle-questions').checked;
    const doShuffleO = document.getElementById('shuffle-options').checked;
    const numQ = parseInt(document.getElementById('num-questions').value);
    
    const checkboxes = document.querySelectorAll('.theme-checkbox');
    const activeThemes = Array.from(checkboxes).filter(c => c.checked).map(c => c.nextElementSibling.textContent);
    
    let pool = db.filter(p => activeThemes.includes(p.tema));
    
    if (pool.length === 0) {
        alert("Selecciona al menos un tema.");
        return;
    }

    pool = buildTest(pool, doShuffleQ, doShuffleO).slice(0, numQ);
    
    currentExamConfig = {
        date: new Date().getTime(),
        settings: `${numQ} preg | ${activeThemes.length} temas | ${isListMode?'Lista':'Tarjeta'}`,
        questions: pool
    };

    selectedQuestions = pool;
    userAnswers = {};
    currentQuestionIndex = 0;
    
    document.getElementById('review-container').classList.add('hidden');
    switchScreen('test');
    renderTest();
}

function startFailedTest() {
    const fails = JSON.parse(localStorage.getItem(storagePrefix + 'failedQuestions')) || [];
    if(fails.length === 0) {
        alert("No tienes preguntas falladas acumuladas. ¡Sigue practicando!");
        return;
    }
    
    let pool = db.filter(p => fails.includes(p.id));
    pool = buildTest(pool, true, true);
    
    currentExamConfig = {
        date: new Date().getTime(),
        settings: `Test de Fallos | ${pool.length} preg`,
        questions: pool
    };

    selectedQuestions = pool;
    isListMode = false;
    userAnswers = {};
    currentQuestionIndex = 0;
    
    document.getElementById('review-container').classList.add('hidden');
    switchScreen('test');
    renderTest();
}

function startRepeatedTestById(id) {
    let history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    const historyItem = history.find(h => h.id === id);
    if (!historyItem || !historyItem.questions) {
        alert("Este examen es de una versión antigua y no puede repetirse.");
        return;
    }
    
    currentExamConfig = {
        date: new Date().getTime(),
        settings: `Repetición de examen | ${historyItem.questions.length} preg`,
        questions: historyItem.questions.map(q => ({
            id: q.id,
            tema: q.tema,
            pregunta: q.pregunta,
            opciones: q.shuffledOpts,
            respuestaCorrecta: q.correctAns
        }))
    };

    selectedQuestions = currentExamConfig.questions;
    isListMode = false;
    userAnswers = {};
    currentQuestionIndex = 0;
    
    document.getElementById('review-container').classList.add('hidden');
    switchScreen('test');
    renderTest();
}

function renderTest() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    if (isListMode) {
        document.getElementById('question-counter').textContent = `${selectedQuestions.length} Preguntas`;
        document.getElementById('progress-bar').style.width = '100%';
        
        selectedQuestions.forEach((q, idx) => {
            container.appendChild(createQuestionCard(q, idx, false));
        });
        
        document.getElementById('btn-prev').classList.add('hidden');
        document.getElementById('btn-next').classList.add('hidden');
        document.getElementById('btn-finish').classList.remove('hidden');
    } else {
        updateProgress();
        container.appendChild(createQuestionCard(selectedQuestions[currentQuestionIndex], currentQuestionIndex, false));
        
        document.getElementById('btn-prev').classList.toggle('hidden', currentQuestionIndex === 0);
        
        if (currentQuestionIndex === selectedQuestions.length - 1) {
            document.getElementById('btn-next').classList.add('hidden');
            document.getElementById('btn-finish').classList.remove('hidden');
        } else {
            document.getElementById('btn-next').classList.remove('hidden');
            document.getElementById('btn-finish').classList.add('hidden');
        }
    }
}

function updateProgress() {
    document.getElementById('question-counter').textContent = `Pregunta ${currentQuestionIndex + 1} de ${selectedQuestions.length}`;
    const pct = ((currentQuestionIndex) / selectedQuestions.length) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
}

function createQuestionCard(q, index, isReview, passedUserAns) {
    const card = document.createElement('div');
    card.className = 'question-card';
    
    let html = `<span class="question-topic">${q.tema}</span>`;
    html += `<div class="question-text">${index + 1}. ${q.pregunta.replace(/^\d+\.\s*/, '')}</div>`;
    html += `<div class="options-container">`;
    
    const ansToUse = isReview && passedUserAns !== undefined ? passedUserAns : userAnswers[q.id];
    const opts = q.opciones || q.shuffledOpts; 
    const correct = q.respuestaCorrecta || q.correctAns;

    opts.forEach(opt => {
        let btnClass = 'option-btn';
        let disabled = isReview ? 'disabled' : '';
        
        const isUserAns = ansToUse === opt.letra;
        const isCorrect = correct === opt.letra;
        
        if (isReview) {
            if (isCorrect) btnClass += ' correct';
            if (isUserAns && !isCorrect) btnClass += ' incorrect';
        } else if (isUserAns) {
            btnClass += ' selected';
        }

        html += `<button class="${btnClass}" onclick="selectOption(${q.id}, '${opt.letra}')" ${disabled}>
                    <span class="option-letter">${opt.letra.toUpperCase()})</span> ${opt.texto}
                 </button>`;
    });
    
    html += `</div>`;
    card.innerHTML = html;
    return card;
}

window.selectOption = function(qId, letra) {
    userAnswers[qId] = letra;
    renderTest(); 
};

function prevQuestion() {
    if (currentQuestionIndex > 0) { currentQuestionIndex--; renderTest(); }
}

function nextQuestion() {
    if (currentQuestionIndex < selectedQuestions.length - 1) { currentQuestionIndex++; renderTest(); }
}

function finishTest() {
    if (!confirm("¿Seguro que deseas finalizar el test?")) return;
    
    let correct = 0;
    let incorrect = 0;
    let omitted = 0;
    
    const reviewContainer = document.getElementById('review-questions');
    reviewContainer.innerHTML = '';
    
    const historySnapshot = {
        id: currentExamConfig.date,
        date: new Date(currentExamConfig.date).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
        settings: currentExamConfig.settings,
        questions: []
    };

    let newFailedIds = [];
    let correctIds = [];

    selectedQuestions.forEach((q, idx) => {
        const ans = userAnswers[q.id];
        
        historySnapshot.questions.push({
            id: q.id,
            tema: q.tema,
            pregunta: q.pregunta,
            shuffledOpts: q.opciones,
            correctAns: q.respuestaCorrecta,
            userAns: ans || null
        });

        if (!ans) {
            omitted++;
            reviewContainer.appendChild(createQuestionCard(q, idx, true));
        } else if (ans === q.respuestaCorrecta) {
            correct++;
            correctIds.push(q.id);
        } else {
            incorrect++;
            newFailedIds.push(q.id);
            reviewContainer.appendChild(createQuestionCard(q, idx, true));
        }
    });

    const score = (correct / selectedQuestions.length) * 100;
    historySnapshot.score = Math.round(score);
    
    document.getElementById('res-correct').textContent = correct;
    document.getElementById('res-incorrect').textContent = incorrect;
    document.getElementById('res-omitted').textContent = omitted;
    document.getElementById('score-text').textContent = Math.round(score) + '%';
    
    const circle = document.getElementById('score-circle-path');
    const color = score >= 50 ? 'var(--success)' : 'var(--danger)';
    circle.style.stroke = color;
    circle.setAttribute('stroke-dasharray', `${score}, 100`);

    saveHistory(historySnapshot, newFailedIds, correctIds);
    switchScreen('results');
}

function saveHistory(snapshot, newFailedIds, correctIds) {
    let history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    history.unshift(snapshot);
    if(history.length > 50) history.pop(); 
    localStorage.setItem(storagePrefix + 'testHistory', JSON.stringify(history));

    let fails = JSON.parse(localStorage.getItem(storagePrefix + 'failedQuestions')) || [];
    fails = [...new Set([...fails, ...newFailedIds])];
    fails = fails.filter(fId => !correctIds.includes(fId));
    
    localStorage.setItem(storagePrefix + 'failedQuestions', JSON.stringify(fails));
}

function loadHistory() {
    let history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    if (history.length > 0) {
        history.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.borderLeftColor = h.score >= 50 ? 'var(--success)' : 'var(--danger)';
            div.innerHTML = `
                <div class="history-item-info">
                    <div class="hist-date">${h.date} - <span style="font-weight:400; color:var(--text-muted)">${h.settings}</span></div>
                    <div class="hist-btns">
                        <button class="btn-secondary btn-sm" onclick="viewHistoryDetail(${h.id})">Ver Detalles</button>
                        <button class="btn-primary btn-sm" onclick="startRepeatedTestById(${h.id})">Repetir Examen</button>
                        <button class="btn-danger btn-sm" onclick="deleteHistoryItem(${h.id})">Borrar</button>
                    </div>
                </div>
                <div class="hist-score" style="color: ${h.score >= 50 ? 'var(--success)' : 'var(--danger)'}">${h.score}%</div>
            `;
            list.appendChild(div);
        });
    } else {
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Aún no has realizado ningún test.</p>';
    }

    const fails = JSON.parse(localStorage.getItem(storagePrefix + 'failedQuestions')) || [];
    const btnFails = document.getElementById('btn-test-failed');
    if (fails.length > 0) {
        btnFails.textContent = `Test Fallos Acumulados (${fails.length})`;
        btnFails.style.display = 'inline-flex';
    } else {
        btnFails.style.display = 'none';
    }
}

window.deleteHistoryItem = function(id) {
    if(!confirm("¿Borrar este examen del historial?")) return;
    let history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    history = history.filter(h => h.id !== id);
    localStorage.setItem(storagePrefix + 'testHistory', JSON.stringify(history));
    loadHistory();
};

window.viewHistoryDetail = function(id) {
    let history = JSON.parse(localStorage.getItem(storagePrefix + 'testHistory')) || [];
    const item = history.find(h => h.id === id);
    if(!item) return;
    
    if(!item.questions) {
        alert("Este examen pertenece a una versión anterior (V1) y no guardó el detalle de las preguntas para poder repasarlo.");
        return;
    }

    document.getElementById('detail-meta').textContent = `${item.date} | Nota: ${item.score}% | ${item.settings}`;
    const container = document.getElementById('detail-questions');
    container.innerHTML = '';
    
    document.getElementById('btn-repeat-exam').onclick = () => startRepeatedTestById(id);

    item.questions.forEach((q, idx) => {
        container.appendChild(createQuestionCard(q, idx, true, q.userAns));
    });

    switchScreen('historyDetail');
};


// ----------------------------------------------------
// STUDY MODE
// ----------------------------------------------------

function startStudyMode() {
    const onlyFailed = document.getElementById('study-only-failed').checked;
    const doShuffleO = document.getElementById('study-shuffle-options').checked;
    
    let pool = [];
    
    if (onlyFailed) {
        const fails = JSON.parse(localStorage.getItem(storagePrefix + 'failedQuestions')) || [];
        if (fails.length === 0) {
            alert("¡No tienes preguntas falladas acumuladas para repasar!");
            return;
        }
        pool = db.filter(p => fails.includes(p.id));
    } else {
        const checkboxes = document.querySelectorAll('.study-theme-checkbox');
        const activeThemes = Array.from(checkboxes).filter(c => c.checked).map(c => c.nextElementSibling.textContent);
        pool = db.filter(p => activeThemes.includes(p.tema));
    }
    
    if (pool.length === 0) {
        alert("No hay preguntas para estudiar con esa configuración.");
        return;
    }

    // Siempre barajamos las preguntas para que no salgan en el mismo orden de lectura del temario
    pool = buildTest(pool, true, doShuffleO);
    
    studyQuestions = pool;
    
    switchScreen('studyRun');
    renderStudyList();
}

function renderStudyList() {
    const container = document.getElementById('study-questions-container');
    container.innerHTML = '';
    
    document.getElementById('study-question-counter').textContent = `${studyQuestions.length} Preguntas en Estudio`;
    document.getElementById('study-progress-bar').style.width = '100%';
    
    studyQuestions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card study-auto-reveal';
        card.style.border = '2px solid var(--accent)';
        
        let html = `<span class="question-topic">${q.tema}</span>`;
        html += `<div class="question-text">${index + 1}. ${q.pregunta.replace(/^\d+\.\s*/, '')}</div>`;
        html += `<div class="options-container" id="study-options">`;
        
        const opts = q.opciones || q.shuffledOpts;
        const correct = q.respuestaCorrecta || q.correctAns;
        
        opts.forEach(opt => {
            const isCorrect = correct === opt.letra;
            html += `<button class="option-btn" disabled data-is-correct="${isCorrect}">
                        <span class="option-letter">${opt.letra.toUpperCase()})</span> ${opt.texto}
                     </button>`;
        });
        html += `</div>`;
        card.innerHTML = html;
        container.appendChild(card);
    });

    // Intersection Observer para revelar automáticamente
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const correctBtn = entry.target.querySelector('.option-btn[data-is-correct="true"]');
                if (correctBtn) {
                    correctBtn.classList.add('correct');
                    correctBtn.style.transform = 'scale(1.02)';
                    correctBtn.style.transition = 'all 0.5s ease';
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.5 // Se enciende cuando el 50% de la tarjeta es visible
    });

    document.querySelectorAll('.study-auto-reveal').forEach(card => {
        observer.observe(card);
    });
}


// ----------------------------------------------------
// DB MANAGER
// ----------------------------------------------------

function renderDBList() {
    const list = document.getElementById('db-list');
    list.innerHTML = '';
    const term = document.getElementById('search-db').value.toLowerCase();
    
    let filtered = db.filter(q => q.pregunta.toLowerCase().includes(term) || q.tema.toLowerCase().includes(term));
    
    filtered.slice(0, 100).forEach(q => {
        const div = document.createElement('div');
        div.className = 'db-item';
        div.innerHTML = `
            <div class="db-item-text">
                <div class="db-item-tema">${q.tema}</div>
                <div class="db-item-q">${q.pregunta}</div>
                <div class="text-muted">Respuesta: ${q.respuestaCorrecta.toUpperCase()}</div>
            </div>
            <button class="btn-secondary btn-sm" onclick="openEditModal(${q.id})">Editar</button>
        `;
        list.appendChild(div);
    });
    
    if(filtered.length > 100) {
        const msg = document.createElement('div');
        msg.className = 'text-muted';
        msg.style.textAlign = 'center';
        msg.style.padding = '1rem';
        msg.textContent = `...y ${filtered.length - 100} más. Usa el buscador para afinar.`;
        list.appendChild(msg);
    }
}

window.openEditModal = function(id) {
    const q = db.find(x => x.id === id);
    if(!q) return;
    currentEditId = id;
    
    document.getElementById('edit-q-text').value = q.pregunta;
    document.getElementById('edit-q-correct').value = q.respuestaCorrecta.toUpperCase();
    
    const optsContainer = document.getElementById('edit-q-options');
    optsContainer.innerHTML = '';
    
    ['a','b','c','d'].forEach(letra => {
        const opt = q.opciones.find(o => o.letra === letra);
        const text = opt ? opt.texto : '';
        optsContainer.innerHTML += `
            <div class="edit-opt-row">
                <span class="edit-opt-letra"><b>${letra.toUpperCase()})</b></span>
                <input type="text" class="input-text" style="margin-bottom:0" id="edit-opt-${letra}" value="${text.replace(/"/g, '&quot;')}">
            </div>
        `;
    });
    
    document.getElementById('edit-modal').classList.remove('hidden');
};

function saveEdit() {
    const q = db.find(x => x.id === currentEditId);
    if(!q) return;
    
    q.pregunta = document.getElementById('edit-q-text').value;
    q.respuestaCorrecta = document.getElementById('edit-q-correct').value.toLowerCase();
    
    ['a','b','c','d'].forEach(letra => {
        const opt = q.opciones.find(o => o.letra === letra);
        if(opt) {
            opt.texto = document.getElementById(`edit-opt-${letra}`).value;
        } else {
            q.opciones.push({letra, texto: document.getElementById(`edit-opt-${letra}`).value});
        }
    });
    
    const edits = JSON.parse(localStorage.getItem(storagePrefix + 'db_edits')) || {};
    edits[q.id] = {
        pregunta: q.pregunta,
        opciones: q.opciones,
        respuestaCorrecta: q.respuestaCorrecta
    };
    localStorage.setItem(storagePrefix + 'db_edits', JSON.stringify(edits));
    
    document.getElementById('edit-modal').classList.add('hidden');
    renderDBList();
    alert("Cambios guardados localmente. Los futuros tests usarán esta versión.");
}

// ==========================================
// SYNC LOGIC (IMPORT/EXPORT)
// ==========================================
function exportData() {
    const data = {
        type: 'teoria',
        t_testHistory: localStorage.getItem(storagePrefix + 'testHistory') || '[]',
        t_failedQuestions: localStorage.getItem(storagePrefix + 'failedQuestions') || '[]',
        t_userName: localStorage.getItem('userName') || 'Estudiante',
        t_db_edits: localStorage.getItem(storagePrefix + 'db_edits') || '{}'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `progreso_teoria_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.type !== 'teoria') {
                alert("Error: Este archivo no parece ser un respaldo válido de la parte Teórica.");
                return;
            }
            
            if (confirm("¡Atención! Esto sobreescribirá todo tu progreso actual de Teoría en este dispositivo con los datos del archivo. ¿Estás seguro?")) {
                localStorage.setItem(storagePrefix + 'testHistory', data.t_testHistory);
                localStorage.setItem(storagePrefix + 'failedQuestions', data.t_failedQuestions);
                localStorage.setItem('userName', data.t_userName);
                localStorage.setItem(storagePrefix + 'db_edits', data.t_db_edits);
                alert("¡Progreso restaurado con éxito! La página se va a recargar.");
                location.reload();
            }
        } catch (err) {
            alert("Error leyendo el archivo: " + err.message);
        }
        // Reset file input so the same file can be selected again if needed
        document.getElementById('file-import').value = '';
    };
    reader.readAsText(file);
}
