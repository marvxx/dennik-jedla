
  // ---------- Pomáhajú lieky a doplnky? ----------
  function medsHtml() {
    const list = Analysis.medEffects(entries, days, Date.now());
    if (!list.length) return '';
    const p = x => x.n ? x.hit / x.n : 0;
    const rows = list.map(m => {
      const lines = [];
      let tone = '';
      if (m.regular && m.before.n >= 5 && m.since.n >= 5) {
        const d = p(m.since) - p(m.before);
        const word = d <= -0.15 ? 'Odkedy ho užívaš, je ťažkostí menej.' : d >= 0.15 ? 'Odkedy ho užívaš, je ťažkostí viac.' : 'Zatiaľ bez zjavného rozdielu.';
        tone = d <= -0.15 ? 'good' : d >= 0.15 ? 'bad' : '';
        lines.push(`<b>${word}</b> Pred začatím ťažkosti ${m.before.hit} zo ${m.before.n} dní (${pct(p(m.before))}), odvtedy ${m.since.hit} z ${m.since.n} (${pct(p(m.since))}).`);
      } else if (m.with.n >= 3 && m.without.n >= 3) {
        lines.push(`V dni s ním ťažkosti ${m.with.hit} z ${m.with.n} (${pct(p(m.with))}), bez neho ${m.without.hit} z ${m.without.n} (${pct(p(m.without))}).`);
      }
      if (!m.regular && m.acute >= 2) {
        lines.push(`Pri ťažkostiach užité ${m.acute}×. Ďalšie ťažkosti do 4 h potom prišli ${m.again}×.`);
      }
      if (!lines.length) lines.push(`Užité ${m.uses}× v ${m.days} dňoch. Na porovnanie treba viac údajov.`);
      return `<div class="med-row ${tone}"><b class="med-name">${esc(m.name)}</b>${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    }).join('');
    return `<div class="card meds"><h2>Lieky a doplnky</h2>${rows}
      <p class="tiny" style="margin:10px 0 0">Lieky sa často berú práve pri ťažkostiach, preto „viac“ nemusí znamenať, že škodia. Lieky nevysadzuj bez lekára.</p></div>`;
  }
