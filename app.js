let state = {
    view: 'cat', currentCat: null, currentSub: null, currentNote: null,
    settings: { dark: false, fs: 18, lightC: {m:'#000000', e:'#000000'} },
    masters: ["", ""], data: []
};

async function save() {
    const db = await new Promise(res => {
        const r = indexedDB.open("SecureProV23", 1);
        r.onupgradeneeded = e => e.target.result.createObjectStore("s");
        r.onsuccess = e => res(e.target.result);
    });
    db.transaction("s", "readwrite").objectStore("s").put(state, "app");
    applyStyles();
}

function applyStyles() {
    const isD = state.settings.dark;
    document.body.classList.toggle('dark-mode', isD);
    const r = document.documentElement.style;

    r.setProperty('--fs-menu', state.settings.fs + 'px');
    r.setProperty('--fs-editor', state.settings.fs + 'px');

    if (!isD) {
        r.setProperty('--c-menu', state.settings.lightC.m);
        r.setProperty('--c-editor', state.settings.lightC.e);
    }

    if(document.getElementById('range-fs')) {
        document.getElementById('range-fs').value = state.settings.fs;
        document.getElementById('c-light-m').value = state.settings.lightC.m;
        document.getElementById('c-light-e').value = state.settings.lightC.e;
    }
}

function render() {
    const app = document.getElementById('app');
    const title = document.getElementById('header-title');
    app.innerHTML = "";
    const isMain = state.view === 'cat';
    const showP = ['sub', 'notes', 'editor'].includes(state.view);

    document.getElementById('back-btn').classList.toggle('hidden', isMain);
    document.getElementById('p1-btn').classList.toggle('hidden', !showP);
    document.getElementById('p2-btn').classList.toggle('hidden', !showP);

    if (state.view === 'cat') {
        title.innerText = "CATÉGORIES";
        state.data.forEach(c => app.appendChild(createRow(c, 'cat')));
        initSortable(state.data);
    }
    else if (state.view === 'sub') {
        const cat = state.data.find(c => c.id === state.currentCat);
        title.innerText = cat.name.toUpperCase();
        cat.subs.forEach(s => app.appendChild(createRow(s, 'sub')));
        initSortable(cat.subs);
    }
    else if (state.view === 'notes') {
        const sub = getActiveSub();
        title.innerText = sub.name;
        sub.notes.slice().sort((a,b)=>b.id-a.id).forEach(n => {
            const card = document.createElement('div'); card.className = "item-row";
            card.style.height = "auto"; card.style.padding = "20px";
            card.innerHTML = `<div style="flex:1"><b>Séance ${new Date(n.id).toLocaleDateString()}</b><br><small style="opacity:0.7">${n.content.substring(0,35)}...</small></div>`;
            card.onclick = () => { state.currentNote = n.id; state.view = 'editor'; render(); };
            app.appendChild(card);
        });
    }
    else if (state.view === 'editor') {
        const sub = getActiveSub();
        const note = sub.notes.find(n => n.id === state.currentNote);
        title.innerText = "ÉDITION";
        app.innerHTML = `<div class="editor-container">
        <textarea class="shared-3" placeholder="Notes partagées...">${sub.sharedNotes || ""}</textarea>
        <textarea id="note-body" style="min-height:250px; border-style:dashed" placeholder="Détails de la séance...">${note.content}</textarea>
        <button id="cam-b" style="height:70px; font-size:1.1rem">📸 AJOUTER PHOTO</button>
        <div id="gal" style="display:flex; gap:10px; flex-wrap:wrap;"></div>
        </div>`;
        app.querySelector('.shared-3').oninput = (e) => { sub.sharedNotes = e.target.value; save(); };
        app.querySelector('#note-body').oninput = (e) => { note.content = e.target.value; save(); };
        app.querySelector('#cam-b').onclick = takePhoto;
        renderPhotos(note);
    }
}

function createRow(item, type) {
    const d = document.createElement('div'); d.className = "item-row";
    d.innerHTML = `<div class="handle-sort">≡</div><div class="item-content">${item.name}</div><div class="handle-opt">⚙️</div>`;
    d.querySelector('.item-content').onclick = () => {
        if(type === 'cat') state.currentCat = item.id; else state.currentSub = item.id;
        state.view = type === 'cat' ? 'sub' : 'notes'; render();
    };
    d.querySelector('.handle-opt').onclick = (e) => { e.stopPropagation(); openOptions(item, type); };
    return d;
}

function initSortable(listRef) {
    Sortable.create(document.getElementById('app'), { handle: '.handle-sort', animation: 150, onEnd: (e) => {
        const item = listRef.splice(e.oldIndex, 1)[0];
        listRef.splice(e.newIndex, 0, item); save();
    }});
}

function openPopModal(idx, isMaster) {
    const mod = document.getElementById('modal-pop'); mod.classList.remove('hidden');
    document.getElementById('pop-master-ctrls').classList.toggle('hidden', !isMaster);
    const sub = isMaster ? null : getActiveSub();
    let val = isMaster ? state.masters[idx] : sub.pFields[idx];
    const simpleView = document.getElementById('pop-simple-area');
    const colView = document.getElementById('pop-col-area');
    const isCol = (val || "").includes('|||');
    simpleView.classList.toggle('hidden', isCol);
    colView.classList.toggle('hidden', !isCol);
    if(isCol) {
        const p = val.split('|||');
        document.getElementById('pop-col-left').value = p[0];
        document.getElementById('pop-col-right').value = p[1];
    } else { document.getElementById('pop-input').value = val || ""; }
    document.getElementById('btn-toggle-cols').onclick = () => {
        simpleView.classList.toggle('hidden'); colView.classList.toggle('hidden');
    };
    document.getElementById('pop-save-btn').onclick = () => {
        const res = !colView.classList.contains('hidden') ?
        document.getElementById('pop-col-left').value + "|||" + document.getElementById('pop-col-right').value :
        document.getElementById('pop-input').value;
        if(isMaster) state.masters[idx] = res; else sub.pFields[idx] = res;
        closeModals();
    };
    document.getElementById('btn-overwrite').onclick = () => {
        const v = document.getElementById('pop-input').value;
        state.masters[idx] = v; state.data.forEach(c => c.subs.forEach(s => s.pFields[idx] = v));
        closeModals();
    };
}

function openOptions(item, type) {
    const mod = document.getElementById('modal-opt');
    const fld = document.getElementById('opt-name-field');
    mod.classList.remove('hidden'); fld.value = item.name;
    document.getElementById('btn-rename').onclick = () => { item.name = fld.value; save(); closeModals(); };
    document.getElementById('btn-delete').onclick = () => { if(confirm("Supprimer définitivement ?")) {
        if(type==='cat') state.data = state.data.filter(x=>x.id!==item.id);
        else state.data.find(c=>c.id===state.currentCat).subs = state.data.find(c=>c.id===state.currentCat).subs.filter(x=>x.id!==item.id);
        save(); closeModals();
    }};
}

function openMaster(idx) { document.getElementById('modal-settings').classList.add('hidden'); openPopModal(idx, true); }
function getActiveSub() { return state.data.find(c => c.id === state.currentCat).subs.find(s => s.id === state.currentSub); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); render(); }

async function takePhoto() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = document.createElement('video'); v.srcObject = s; await v.play();
        const c = document.getElementById('capture-canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        const note = getActiveSub().notes.find(n => n.id === state.currentNote);
        if(!note.photos) note.photos = []; note.photos.push(c.toDataURL('image/jpeg', 0.6));
        s.getTracks().forEach(t => t.stop()); render();
    } catch(e) { alert("Erreur Caméra"); }
}

function renderPhotos(n) { const g = document.getElementById('gal'); if(n.photos) n.photos.forEach((p, i) => {
    const img = document.createElement('img'); img.src = p; img.style="width:90px;height:90px;object-fit:cover;border-radius:12px;";
    img.onclick = () => { if(confirm("Supprimer cette photo ?")) { n.photos.splice(i,1); render(); } }; g.appendChild(img);
});}

window.onload = () => {
    const r = indexedDB.open("SecureProV23", 1);
    r.onsuccess = e => e.target.result.transaction("s").objectStore("s").get("app").onsuccess = ev => {
        if(ev.target.result) state = ev.target.result;
        applyStyles(); render();
    };
};

// Event Listeners
document.getElementById('dark-toggle-action').onclick = () => { state.settings.dark = !state.settings.dark; save(); };
document.getElementById('range-fs').oninput = (e) => { state.settings.fs = e.target.value; applyStyles(); save(); };
document.getElementById('c-light-m').oninput = (e) => { state.settings.lightC.m = e.target.value; applyStyles(); save(); };
document.getElementById('c-light-e').oninput = (e) => { state.settings.lightC.e = e.target.value; applyStyles(); save(); };

document.getElementById('settings-btn').onclick = () => document.getElementById('modal-settings').classList.remove('hidden');
document.getElementById('back-btn').onclick = () => {
    state.view = state.view==='editor'?'notes':state.view==='notes'?'sub':'cat'; render();
};
document.getElementById('add-btn').onclick = () => {
    if(state.view === 'notes') {
        const n = { id: Date.now(), content: "", photos: [] }; getActiveSub().notes.push(n);
        state.currentNote = n.id; state.view = 'editor'; render();
    } else {
        const n = prompt("Nouveau nom :"); if(!n) return;
        if(state.view === 'cat') state.data.push({id:Date.now(), name:n, subs:[]});
        else state.data.find(c=>c.id===state.currentCat).subs.push({id:Date.now(), name:n, notes:[], sharedNotes:"", pFields:["",""]});
        save(); render();
    }
};

document.getElementById('p1-btn').onclick = () => openPopModal(0, false);
document.getElementById('p2-btn').onclick = () => openPopModal(1, false);
document.getElementById('exp-btn').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], {type:'application/json'}));
    a.download = `backup_${new Date().toLocaleDateString()}.json`; a.click();
};
document.getElementById('imp-btn').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => {
    const r = new FileReader(); r.onload = (ev) => { state = JSON.parse(ev.target.result); save(); render(); }; r.readAsText(e.target.files[0]);
};
