// ---- SIM DATABASE LOGIC ----
(function() {
    const $ = id => document.getElementById(id);
    
    const simGo = $('simGo');
    const simNum = $('simNum');
    const simLog = $('simLog');
    const simRes = $('simRes');
    const simBody = $('simBody');

    async function searchSim() {
        let num = simNum.value.trim();
        if (!num) {
            // Check if toast function exists from index.html
            if (typeof toast === 'function') {
                toast('Number enter karein boss!');
            } else {
                alert('Number enter karein boss!');
            }
            return;
        }

        // UI Reset
        simGo.disabled = true;
        simRes.style.display = 'none';
        simLog.innerHTML = '';
        simBody.innerHTML = '';
        
        const apis = [
            { name: 'Faisal Ali DB', url: `https://faisal-ali-truecaller.ftgmhacks.workers.dev/?key=pak-digital.store&number=${num}` },
            { name: 'FT SimDB', url: `https://ft-simdb.ftshehryar10044.workers.dev/ft/api?num=${num}` },
            { name: 'ZHHTools DB', url: `https://simdbapi.zhhtools.workers.dev/?num=${num}` }
        ];

        let foundAny = false;

        for (let i = 0; i < apis.length; i++) {
            const api = apis[i];
            const row = document.createElement('div');
            row.textContent = `Searching ${api.name}...`;
            simLog.appendChild(row);

            try {
                const response = await fetch(api.url);
                const data = await response.json();

                if (data && Object.keys(data).length > 0 && data.name !== undefined || data.status !== "error") {
                    foundAny = true;
                    row.innerHTML = `<span style="color: var(--ok)">✓ ${api.name} se data mil gaya!</span>`;
                    
                    const card = document.createElement('div');
                    card.style = "padding: 15px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.02)";
                    card.innerHTML = `
                        <div style="color: var(--gold); font-weight: 700; font-size: 0.9rem; margin-bottom: 8px;">${api.name} Result:</div>
                        <pre style="margin: 0; font-family: monospace; font-size: 0.8rem; color: var(--fg); white-space: pre-wrap; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
                    `;
                    simBody.appendChild(card);
                } else {
                    row.innerHTML = `<span style="color: var(--err)">✗ ${api.name}: No data found.</span>`;
                }
            } catch (e) {
                row.innerHTML = `<span style="color: var(--err)">✗ ${api.name}: API Error.</span>`;
            }
        }

        if (foundAny) {
            simRes.style.display = 'block';
        } else {
            simLog.innerHTML += `<div style="text-align: center; color: var(--err); margin-top: 10px;">Kisi bhi database mein data nahi mila.</div>`;
        }

        simGo.disabled = false;
    }

    if (simGo) {
        simGo.onclick = searchSim;
    }
    if (simNum) {
        simNum.addEventListener('keydown', e => { if (e.key === 'Enter') searchSim(); });
    }
})();
