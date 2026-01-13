let state = { view: 'cat', currentCat: null, currentSub: null, currentNote: null, settings: { dark: false, fontSize: 16 }, masters: ["","","","",""], data: [] };

async function save() {
    const req = indexedDB.open("SecureNotesDB", 1);
    req.onsuccess = (e) => e.target.result.transaction("store", "readwrite").objectStore("store").put(state, "app_state");
    try {
        const root = await navigator.storage.getDirectory();
        for (let i = 1; i <= 2; i++) {
            const h = await root.getFileHandle(`backup_${i}.json`, { create: true });
            const w = await h.createWritable(); await w.write(JSON.stringify(state)); await w.close();
        }
    } catch (e) {}
}

function render() {
    const app = document.getElementById('app');
    const title = document.getElementById('header-title');
    const backBtn = document.getElementById('back-btn');
    const extras = [document.getElementById('extra-1'), document.getElementById('extra-2'), document.getElementById('extra-3')];

    app.innerHTML = "";
    backBtn.classList.toggle('hidden', state.view === 'cat');
    extras.forEach(b => b.classList.add('hidden'));

    if (state.view === 'cat') {
        title.innerText = "Catégories";
        state.data.forEach(c => app.appendChild(createRow(c.name, () => { state.currentCat = c.id; state.view = 'sub'; render(); }, () => editLabel(c))));
    } else if (state.view === 'sub') {
        const cat = state.data.find(c => c.id === state.currentCat);
        title.innerText = "Élèves";
        cat.subs.forEach(s => app.appendChild(createRow(s.name, () => { state.currentSub = s.id; state.view = 'notes'; render(); }, () => editLabel(s))));
    } else if (state.view === 'notes') {
        const sub = getActiveSub();
        title.innerText = sub.name;
        [0, 1, 2].forEach(i => setupExtraBtn(extras[i], sub.fields, i, i));
        sub.notes.slice().reverse().forEach(n => {
            const card = document.createElement('div'); card.className = "note-card";
            card.innerHTML = `<div class="note-meta">${new Date(n.id).toLocaleString()}</div><div class="note-snippet">${n.content.substring(0, 80) || '(Vide)'}</div>`;
            card.onclick = () => { state.currentNote = n.id; state.view = 'editor'; render(); };
            app.appendChild(card);
        });
    } else if (state.view === 'editor') {
        const sub = getActiveSub(); const note = sub.notes.find(n => n.id === state.currentNote);
        title.innerText = "Édition Note";
        setupExtraBtn(extras[0], note.extraFields, 0, 3); setupExtraBtn(extras[1], note.extraFields, 1, 4);
        app.innerHTML = `<div id="editor-container">
        <div class="field-label">ZONE PARTAGÉE (ÉLÈVE)</div><textarea class="shared-field" id="s-sh">${sub.sharedContent || ''}</textarea>
        <div class="field-label">ZONE DE NOTE</div><textarea class="main-editor" id="n-m" placeholder="Écrire ici...">${note.content}</textarea>
        <button id="cam-b" style="width:100%; margin-top:15px;">📸 PRENDRE UNE PHOTO</button><div id="gal" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:10px;"></div></div>`;
        app.querySelector('#n-m').oninput = (e) => { note.content = e.target.value; save(); };
        app.querySelector('#s-sh').oninput = (e) => { sub.sharedContent = e.target.value; save(); };
        app.querySelector('#cam-b').onclick = takePhoto;
        renderPhotos(note);
    }
    save();
}

function setupExtraBtn(el, arr, arrIdx, mIdx) {
    el.classList.remove('hidden'); el.innerHTML = mIdx + 1;
    el.classList.toggle('btn-active', (arr[arrIdx]||"").trim() !== "");
    el.onclick = () => openTextModal(arr, arrIdx, mIdx);
}

function openTextModal(arr, arrIdx, mIdx, isM = false) {
    const mod = document.getElementById('modal-text');
    const inp = document.getElementById('modal-text-input');
    inp.value = isM ? state.masters[mIdx] : arr[arrIdx];
    document.getElementById('master-logic-btns').classList.toggle('hidden', !isM);
    mod.classList.remove('hidden');
    document.getElementById('save-close-text').onclick = () => { if(!isM) arr[arrIdx] = inp.value; mod.classList.add('hidden'); render(); };
    document.getElementById('btn-overwrite').onclick = () => {
        state.masters[mIdx] = inp.value;
        state.data.forEach(c => c.subs.forEach(s => { if(mIdx < 3) s.fields[mIdx] = inp.value; else s.notes.forEach(n => n.extraFields[mIdx-3] = inp.value); }));
        alert("Modifications globales appliquées.");
    };
    document.getElementById('btn-append').onclick = () => {
        state.masters[mIdx] = inp.value;
        state.data.forEach(c => c.subs.forEach(s => { if(mIdx < 3) s.fields[mIdx] += "\n" + inp.value; else s.notes.forEach(n => n.extraFields[mIdx-3] += "\n" + inp.value); }));
        alert("Texte ajouté globalement.");
    };
}

function openMasterEdit(i) { openTextModal(null, null, i, true); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); render(); }

async function takePhoto() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = document.createElement('video'); v.srcObject = s; await v.play();
        const c = document.getElementById('capture-canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        getActiveSub().notes.find(n => n.id === state.currentNote).photos.push(c.toDataURL('image/jpeg', 0.6));
        s.getTracks().forEach(t => t.stop()); render();
    } catch(e) { alert("Accès caméra refusé."); }
}

function renderPhotos(n) {
    const g = document.getElementById('gal');
    n.photos.forEach(p => {
        const i = document.createElement('img'); i.src = p; i.className = "photo-thumb";
        i.onclick = () => {
            const fs = document.createElement('div'); fs.style = "position:fixed;inset:0;background:black;z-index:10000;display:flex;align-items:center;justify-content:center;";
            fs.innerHTML = `<img src="${p}" style="max-width:100%;max-height:100%">`; fs.onclick = () => fs.remove(); document.body.appendChild(fs);
        };
        g.appendChild(i);
    });
}

function createRow(n, c, l) {
    const d = document.createElement('div'); d.className="item-row"; d.innerHTML = `<span style="margin-right:20px; color:var(--text-sub);">☰</span> <b>${n}</b>`;
    d.onclick = c; d.oncontextmenu = (e) => { e.preventDefault(); l(); }; return d;
}

function getActiveSub() { return state.data.find(c => c.id === state.currentCat).subs.find(s => s.id === state.currentSub); }
function editLabel(o) { const n = prompt("Modifier le nom :", o.name); if(n) o.name = n; render(); }

document.getElementById('add-btn').onclick = () => {
    if(state.view === 'cat') state.data.push({id: Date.now(), name: prompt("Nom catégorie ?") || "Nouveau", subs: []});
    else if(state.view === 'sub') state.data.find(c => c.id === state.currentCat).subs.push({id: Date.now(), name: prompt("Nom élève ?") || "Élève", fields: ["","",""], sharedContent: "", notes: []});
    else { const s = getActiveSub(); const n = { id: Date.now(), content: "", extraFields: ["", ""], photos: [] }; s.notes.push(n); state.currentNote = n.id; state.view = 'editor'; }
    render();
};

window.onload = () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
    const r = indexedDB.open("SecureNotesDB", 1); r.onupgradeneeded = (e) => e.target.result.createObjectStore("store");
    r.onsuccess = (e) => { e.target.result.transaction("store").objectStore("store").get("app_state").onsuccess = (ev) => { if(ev.target.result) state = ev.target.result; if(state.settings.dark) document.body.classList.add('dark'); render(); }; };
};

document.getElementById('back-btn').onclick = () => { state.view = (state.view === 'editor') ? 'notes' : (state.view === 'notes') ? 'sub' : 'cat'; render(); };
document.getElementById('settings-btn').onclick = () => document.getElementById('modal-settings').classList.remove('hidden');
document.getElementById('dark-mode-toggle').onchange = (e) => { state.settings.dark = e.target.checked; document.body.classList.toggle('dark', state.settings.dark); save(); };
document.getElementById('font-slider').oninput = (e) => { state.settings.fontSize = e.target.value; document.body.style.fontSize = e.target.value + 'px'; save(); };
document.getElementById('export-btn').onclick = () => {
    const blob = new Blob([JSON.stringify(state)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `notes_backup.json`; a.click();
};
document.getElementById('file-input').onchange = (e) => {
    const r = new FileReader();
    r.onload = (ev) => { try { state = JSON.parse(ev.target.result); render(); } catch(e){alert("Fichier corrompu.");} };
    r.readAsText(e.target.files[0]);
};
document.getElementById('reset-btn').onclick = () => { if(confirm("Attention : Supprimer toutes les données ?")) { state.data = []; render(); save(); } };
