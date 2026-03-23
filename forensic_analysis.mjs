import fs from 'fs';

const FILE_PATH = 'e:/2026 Desarrollo Web/freeboli/freeboli_backup_2026-03-23.json';

async function analyze() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const db = JSON.parse(raw);
    const tables = db.data;

    // Identificar usuarios bajo sospecha (suspendidos, bloqueados o marcados para evaluar)
    const suspectUsers = tables.profiles.filter(p => ['suspendido', 'bloqueado', 'evaluar'].includes(p.status));
    const suspectIds = new Set(suspectUsers.map(p => p.id));

    console.log(`--- REPORTE DE ANALISIS FORENSE (BACKUP ${db.exported_at}) ---`);
    console.log(`Total usuarios analizados: ${suspectUsers.length}\n`);

    suspectUsers.forEach(user => {
      console.log(`================================================================`);
      console.log(`USUARIO: ${user.email} (ID: ${user.id})`);
      console.log(`ESTADO: ${user.status.toUpperCase()} | REGISTRO: ${user.created_at}`);
      
      // Analizar movimientos
      const movements = (tables.movements || []).filter(m => m.user_id === user.id);
      const stats = {};
      let netBalance = 0;

      movements.forEach(m => {
        const type = m.type;
        const pts = Number(m.points) || 0;
        if (!stats[type]) stats[type] = { total: 0, count: 0 };
        stats[type].total += pts;
        stats[type].count += 1;
        netBalance += pts;
      });

      console.log(`\nRESUMEN DE PUNTOS:`);
      Object.entries(stats).forEach(([type, s]) => {
        console.log(`  - ${type.padEnd(25)}: ${s.total.toLocaleString().padStart(12)} pts (${s.count} trans)`);
      });
      console.log(`  TOTAL CALCULADO: ${netBalance.toLocaleString()} pts`);

      // Analizar Referidos
      const refInfo = (tables.referrals || []).find(r => r.referred_id === user.id);
      if (refInfo) {
          const referrer = tables.profiles.find(p => p.id === refInfo.referrer_id);
          console.log(`\nAFILIACION: Referido por ${referrer?.email || 'ID:' + refInfo.referrer_id}`);
      }

      const referralsMade = (tables.referrals || []).filter(r => r.referrer_id === user.id);
      if (referralsMade.length > 0) {
          console.log(`AFILIACION: Trajo ${referralsMade.length} referidos:`);
          referralsMade.forEach(rm => {
              const referred = tables.profiles.find(p => p.id === rm.referred_id);
              const statusStr = referred?.status || 'desconocido';
              console.log(`  - ${referred?.email || rm.referred_id} [${statusStr.toUpperCase()}]`);
          });
      }

      // Analizar Retiros
      const withdrawals = (tables.withdrawals || []).filter(w => w.user_id === user.id);
      if (withdrawals.length > 0) {
          console.log(`\nHISTORIAL DE RETIROS:`);
          withdrawals.forEach(w => {
              // El JSON parece tener nombres de columnas inconsistentes en mi script anterior, 
              // probaremos con las llaves que existan en el objeto
              const amount = w.amount_points || w.points || 0;
              const wallet = w.dest_wallet || w.wallet || 'n/a';
              console.log(`  - [${w.status.padEnd(10)}] | ${amount.toString().padStart(10)} pts | Wallet: ${wallet} | Fecha: ${w.created_at}`);
          });
      }

      // Detectar anomalías específicas
      if (stats['premio_hi_lo'] && stats['apuesta_hi_lo']) {
          const winRatio = Math.abs(stats['premio_hi_lo'].total / stats['apuesta_hi_lo'].total);
          if (winRatio > 1.5) {
              console.log(`\n⚠️ ANOMALIA DETECTADA: Win Rate de HI-LO sospechoso (${winRatio.toFixed(2)}x)`);
          }
      }
    });

    console.log(`\n================================================================`);
    console.log(`--- ANALISIS DE REDES DE REFERIDOS ---`);
    const referralMap = {};
    (tables.referrals || []).forEach(r => {
      referralMap[r.referred_id] = r.referrer_id;
    });

    const printedChains = new Set();
    suspectUsers.forEach(user => {
      let current = user.id;
      let chain = [user.email || user.id];
      let visited = new Set([user.id]);
      while (referralMap[current]) {
        current = referralMap[current];
        if (visited.has(current)) break; // Evitar ciclos infinitos
        visited.add(current);
        const nextUser = tables.profiles.find(p => p.id === current);
        chain.push(nextUser?.email || current);
      }
      if (chain.length > 1) {
          const chainStr = chain.reverse().join(' -> ');
          if (!printedChains.has(chainStr)) {
              console.log(`  CADENA: ${chainStr}`);
              printedChains.add(chainStr);
          }
      }
    });

  } catch (err) {
    console.error('ERROR CRITICO EN ANALISIS:', err.message);
  }
}

analyze();
