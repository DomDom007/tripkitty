// Tripkitty: a group trip pot. Everyone commits a share before booking, tracks who has paid in, and settles up at the end.
import { useState } from "react";
import { moneyFmt } from "./lib/money";
import { waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { CurrencySelect, Section, Stat, Stats } from "./ui/kit";

const T = "tripkitty";
type Person = { id: string; name: string; phone: string; weight: number; paidIn: number };
type Item = { id: string; what: string; cost: number; booked: boolean };
type Spend = { id: string; what: string; amount: number; paidBy: string; split: string[] };
const SAMPLE = {
  trip: "Djerba long weekend", date: "2026-10-23", deadline: "2026-10-05", cur: "TND",
  people: [{ id: "p1", name: "Salma", phone: "", weight: 1, paidIn: 600 }, { id: "p2", name: "Karim", phone: "", weight: 1, paidIn: 600 }, { id: "p3", name: "Ines", phone: "", weight: 1, paidIn: 300 }, { id: "p4", name: "Walid", phone: "", weight: 1, paidIn: 0 }, { id: "p5", name: "Nour (brings her son)", phone: "", weight: 1.5, paidIn: 0 }] as Person[],
  items: [{ id: "i1", what: "Villa, 3 nights", cost: 1650, booked: true }, { id: "i2", what: "Car hire and fuel", cost: 420, booked: false }, { id: "i3", what: "Boat trip to Flamingo Island", cost: 350, booked: false }, { id: "i4", what: "Groceries and shared dinners", cost: 600, booked: false }] as Item[],
  spends: [{ id: "s1", what: "Deposit on the villa", amount: 500, paidBy: "p1", split: [] }] as Spend[],
};

export default function Tripkitty() {
  const [trip, setTrip] = useStored(T, "trip", { name: SAMPLE.trip, date: SAMPLE.date, deadline: SAMPLE.deadline });
  const [cur, setCur] = useStored(T, "cur", SAMPLE.cur);
  const [people, setPeople] = useStored<Person[]>(T, "people", SAMPLE.people);
  const [items, setItems] = useStored<Item[]>(T, "items", SAMPLE.items);
  const [spends, setSpends] = useStored<Spend[]>(T, "spends", SAMPLE.spends);
  const [organiser, setOrganiser] = useStored(T, "organiser", "p1");
  const [ns, setNs] = useState({ what: "", amount: "", paidBy: "p1" });
  const money = moneyFmt(cur);
  const budget = items.reduce((a, i) => a + i.cost, 0), W = people.reduce((a, p) => a + p.weight, 0) || 1;
  const share = (p: Person) => (budget * p.weight) / W;
  const inPot = people.reduce((a, p) => a + p.paidIn, 0);
  const potSpent = spends.filter(s => s.paidBy === "pot").reduce((a, s) => a + s.amount, 0);
  // Final balance: what each person put in (pot plus own pocket) minus their fair share of everything actually spent.
  const actual = spends.reduce((a, s) => a + s.amount, 0);
  const fairOf = (p: Person) => spends.reduce((a, s) => { const who = s.split.length ? s.split : people.map(x => x.id); const w = who.reduce((b, id) => b + (people.find(x => x.id === id)?.weight ?? 0), 0) || 1; return a + (who.includes(p.id) ? (s.amount * p.weight) / w : 0); }, 0);
  const bal = (p: Person) => p.paidIn + spends.filter(s => s.paidBy === p.id).reduce((a, s) => a + s.amount, 0) - fairOf(p) - (people.find(x => x.id === organiser) === p ? inPot - potSpent : 0);
  const settle = (() => { const d = people.map(p => ({ p, v: bal(p) })); const debt = d.filter(x => x.v < -0.5).sort((a, b) => a.v - b.v), cred = d.filter(x => x.v > 0.5).sort((a, b) => b.v - a.v); const out: { from: Person; to: Person; v: number }[] = []; let i = 0, j = 0; while (i < debt.length && j < cred.length) { const v = Math.min(-debt[i].v, cred[j].v); out.push({ from: debt[i].p, to: cred[j].p, v }); debt[i].v += v; cred[j].v -= v; if (debt[i].v > -0.5) i++; if (cred[j].v < 0.5) j++; } return out; })();
  const daysLeft = Math.ceil((new Date(trip.deadline).getTime() - Date.now()) / 86400000);
  const set = (id: string, p: Partial<Person>) => setPeople(people.map(x => (x.id === id ? { ...x, ...p } : x)));
  const orgName = people.find(p => p.id === organiser)?.name ?? "the organiser";

  return (
    <div className="stack">
      <Section title={trip.name} aside={<CurrencySelect id="tk-cur" value={cur} onChange={setCur} />}>
        <Stats><Stat value={money(budget)} label="Trip budget" /><Stat value={money(inPot)} label="In the pot" tone={inPot >= budget ? "good" : "warn"} /><Stat value={`${Math.round((inPot / Math.max(1, budget)) * 100)}%`} label="Committed" /><Stat value={daysLeft >= 0 ? `${daysLeft} days` : "Passed"} label="Until the pay-in deadline" tone={daysLeft < 5 ? "bad" : undefined} /></Stats>
        <div className="tk-pot"><span style={{ width: `${Math.min(100, (inPot / Math.max(1, budget)) * 100)}%` }} /></div>
        <div className="row" style={{ marginTop: 12 }}><label className="field"><span>Trip</span><input className="input" value={trip.name} onChange={e => setTrip({ ...trip, name: e.target.value })} /></label><label className="field"><span>Leaving</span><input type="date" className="input" value={trip.date} onChange={e => setTrip({ ...trip, date: e.target.value })} /></label><label className="field"><span>Pay in by</span><input type="date" className="input" value={trip.deadline} onChange={e => setTrip({ ...trip, deadline: e.target.value })} /></label><label className="field"><span>Pot held by</span><select className="input" value={organiser} onChange={e => setOrganiser(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
      </Section>
      <div className="grid2">
        <Section title="Who owes the pot">
          {people.map(p => { const owe = share(p) - p.paidIn; return (
            <div key={p.id} className="tk-p">
              <div style={{ flex: 1, minWidth: 0 }}><input className="input" aria-label="Name" value={p.name} onChange={e => set(p.id, { name: e.target.value })} /><p className="note">Share {money(share(p))}{p.weight !== 1 ? ` (${p.weight}× share)` : ""}</p></div>
              <label className="field" style={{ width: 100 }}><span>Paid in</span><input className="input num" value={p.paidIn} onChange={e => set(p.id, { paidIn: parseFloat(e.target.value) || 0 })} /></label>
              <label className="field" style={{ width: 70 }}><span>Weight</span><input className="input num" value={p.weight} onChange={e => set(p.id, { weight: parseFloat(e.target.value) || 0 })} /></label>
              {owe > 0.5 ? <a className="btn small" href={waLink(`Hi ${p.name.split(" ")[0]}! For ${trip.name}, your share is ${money(share(p))}. You've paid ${money(p.paidIn)}, so ${money(owe)} to go by ${trip.deadline}. Please send it to ${orgName}.`, p.phone)} target="_blank" rel="noreferrer">Remind · {money(owe)}</a> : <span className="pill good">Paid up</span>}
            </div>); })}
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => setPeople([...people, { id: uid(), name: "New traveller", phone: "", weight: 1, paidIn: 0 }])}>Add a traveller</button>
        </Section>
        <Section title="Budget">
          {items.map(i => <div key={i.id} className="row" style={{ marginBottom: 6, alignItems: "center" }}><input type="checkbox" aria-label="Booked" checked={i.booked} onChange={e => setItems(items.map(x => x.id === i.id ? { ...x, booked: e.target.checked } : x))} /><input className="input" style={{ flex: 2 }} aria-label="Item" value={i.what} onChange={e => setItems(items.map(x => x.id === i.id ? { ...x, what: e.target.value } : x))} /><input className="input num" style={{ flex: 1 }} aria-label="Cost" value={i.cost} onChange={e => setItems(items.map(x => x.id === i.id ? { ...x, cost: parseFloat(e.target.value) || 0 } : x))} /><button className="btn ghost small danger" onClick={() => setItems(items.filter(x => x.id !== i.id))}>×</button></div>)}
          <button className="btn small" onClick={() => setItems([...items, { id: uid(), what: "New item", cost: 0, booked: false }])}>Add an item</button>
          <p className="note" style={{ marginTop: 8 }}>Tick items once booked. Booking only when the pot covers it avoids anyone fronting money.</p>
        </Section>
      </div>
      <Section title="Spending during the trip">
        <form className="row" style={{ alignItems: "flex-end" }} onSubmit={e => { e.preventDefault(); const a = parseFloat(ns.amount); if (!a) return; setSpends([...spends, { id: uid(), what: ns.what || "Expense", amount: a, paidBy: ns.paidBy, split: [] }]); setNs({ ...ns, what: "", amount: "" }); }}>
          <label className="field" style={{ flexGrow: 2 }}><span>What</span><input className="input" value={ns.what} onChange={e => setNs({ ...ns, what: e.target.value })} /></label>
          <label className="field"><span>Amount</span><input className="input num" value={ns.amount} onChange={e => setNs({ ...ns, amount: e.target.value })} /></label>
          <label className="field"><span>Paid from</span><select className="input" value={ns.paidBy} onChange={e => setNs({ ...ns, paidBy: e.target.value })}><option value="pot">The pot</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}'s pocket</option>)}</select></label>
          <button className="btn primary" type="submit">Add</button>
        </form>
        <div className="table-wrap" style={{ marginTop: 10 }}><table className="t"><tbody>{spends.map(s => <tr key={s.id}><td>{s.what}</td><td>{s.paidBy === "pot" ? "Pot" : people.find(p => p.id === s.paidBy)?.name}</td><td className="r">{money(s.amount)}</td><td><button className="btn ghost small danger" onClick={() => setSpends(spends.filter(x => x.id !== s.id))}>×</button></td></tr>)}</tbody></table></div>
        <p className="note" style={{ marginTop: 8 }}>Spent so far {money(actual)} of {money(budget)}. Left in the pot: {money(inPot - potSpent)}.</p>
      </Section>
      <Section title="Settle up at the end">
        {settle.length === 0 ? <p className="empty-note">Everyone is square.</p> : settle.map((s, i) => <p key={i} className="tk-settle"><strong>{s.from.name}</strong> pays <strong>{s.to.name}</strong> <span className="num">{money(s.v)}</span></p>)}
        <p className="note" style={{ marginTop: 8 }}>Based on what has actually been spent so far. Money still sitting in the pot is shared back, so use this after the trip. Tripkitty keeps track; the money itself moves between you by cash, bank transfer or D17.</p>
      </Section>
      <style>{`.tk-pot{height:14px;background:var(--sunk);border-radius:7px;overflow:hidden;margin-top:14px}.tk-pot span{display:block;height:100%;background:var(--good)}.tk-p{display:flex;gap:8px;align-items:flex-end;padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}.tk-settle{font-size:18px}.tk-settle .num{font-family:var(--serif);font-size:24px;margin-left:6px}`}</style>
    </div>
  );
}
