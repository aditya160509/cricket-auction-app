import { useEffect, useState } from 'react'
import './App.css'

type Tab = 'home' | 'auction' | 'teams'
type TeamId = 'mi' | 'csk' | 'rcb'
type Tier = 'LEVEL 1' | 'LEVEL 2' | 'LEVEL 3'

type Player = { id: number; name: string; tier: Tier; role: string }
type TeamState = { budget: number; players: Array<{ name: string; price: number; tier: Tier; role: string }> }
type SaleLog = { id: string; text: string; teamId: TeamId; player: Player; price: number; at: string }

const BASE_PRICE = 10
const TEAM_BUDGET = 1000
const LIVE_AUCTION_BG = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260422_191657_800d4e1f-7ab3-41af-90b6-9bd3039eb294.mp4'
const SQUADS_BG = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4'

const TEAMS: Array<{ id: TeamId; name: string; short: string }> = [
  { id: 'mi', name: 'Mumbai Indians', short: 'MI' },
  { id: 'csk', name: 'Chennai Super Kings', short: 'CSK' },
  { id: 'rcb', name: 'Royal Challengers Bangalore', short: 'RCB' },
]

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function parseTiers(markdown: string): Record<Tier, string[]> {
  const out: Record<Tier, string[]> = { 'LEVEL 1': [], 'LEVEL 2': [], 'LEVEL 3': [] }
  const rows = markdown.split(/\r?\n/).filter((x) => x.includes('|')).slice(2)
  rows.forEach((row) => {
    const cols = row.split('|').map((x) => x.trim()).filter(Boolean)
    if (cols[0]) out['LEVEL 1'].push(cols[0])
    if (cols[1]) out['LEVEL 2'].push(cols[1])
    if (cols[2]) out['LEVEL 3'].push(cols[2])
  })
  return out
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [pool, setPool] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [currentBid, setCurrentBid] = useState(BASE_PRICE)
  const [custom, setCustom] = useState('')
  const [saleLog, setSaleLog] = useState<SaleLog[]>([])

  const [teams, setTeams] = useState<Record<TeamId, TeamState>>({
    mi: { budget: TEAM_BUDGET, players: [] },
    csk: { budget: TEAM_BUDGET, players: [] },
    rcb: { budget: TEAM_BUDGET, players: [] },
  })

  useEffect(() => {
    ;(async () => {
      const [playersMd, tiersMd] = await Promise.all([
        fetch('/player.md').then((r) => r.text()),
        fetch('/tier-list.md').then((r) => r.text()),
      ])
      const names = playersMd.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      const tierMap = new Map<string, Tier>()
      const tiers = parseTiers(tiersMd)
      tiers['LEVEL 1'].forEach((n) => tierMap.set(n, 'LEVEL 1'))
      tiers['LEVEL 2'].forEach((n) => tierMap.set(n, 'LEVEL 2'))
      tiers['LEVEL 3'].forEach((n) => tierMap.set(n, 'LEVEL 3'))

      const all = names.map((name, i) => ({ id: i + 1, name, tier: tierMap.get(name) ?? 'LEVEL 3', role: ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper'][i % 4] }))
      const randomized = shuffle(all)
      setCurrentPlayer(randomized[0] ?? null)
      setPool(randomized.slice(1))
    })()
  }, [])

  const nextPlayer = () => {
    if (!pool.length) {
      setCurrentPlayer(null)
      return
    }
    setCurrentPlayer(pool[0])
    setPool((p) => p.slice(1))
    setCurrentBid(BASE_PRICE)
    setCustom('')
  }

  const sellToTeam = (teamId: TeamId) => {
    if (!currentPlayer) return
    const soldPrice = currentBid
    if (teams[teamId].budget < soldPrice) return alert('Budget not enough')

    setTeams((prev) => ({
      ...prev,
      [teamId]: {
        budget: prev[teamId].budget - soldPrice,
        players: [...prev[teamId].players, { name: currentPlayer.name, price: soldPrice, tier: currentPlayer.tier, role: currentPlayer.role }],
      },
    }))

    const tname = TEAMS.find((t) => t.id === teamId)?.short ?? teamId.toUpperCase()
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const message = `${currentPlayer.name} sold to ${tname} for ₹${soldPrice}L`
    setSaleLog((prev) => [{ id: `${Date.now()}`, text: message, teamId, player: currentPlayer, price: soldPrice, at: now }, ...prev].slice(0, 24))
    nextPlayer()
  }

  const cancelLastSale = () => {
    if (!saleLog.length) return
    const [last, ...rest] = saleLog
    setSaleLog(rest)

    setTeams((prev) => ({
      ...prev,
      [last.teamId]: {
        budget: prev[last.teamId].budget + last.price,
        players: prev[last.teamId].players.filter((p) => !(p.name === last.player.name && p.price === last.price)).length === prev[last.teamId].players.length
          ? prev[last.teamId].players
          : (() => {
              const copy = [...prev[last.teamId].players]
              const idx = copy.findIndex((p) => p.name === last.player.name && p.price === last.price)
              if (idx >= 0) copy.splice(idx, 1)
              return copy
            })(),
      },
    }))

    setPool((prev) => shuffle([last.player, ...(currentPlayer ? [currentPlayer] : []), ...prev]))
    setCurrentPlayer(last.player)
    setCurrentBid(BASE_PRICE)
  }

  return (
    <div className="app-shell">
      <header className="topbar fixed-center liquid-glass">
        <nav className="tabs">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Arena</button>
          <button className={tab === 'auction' ? 'active' : ''} onClick={() => setTab('auction')}>Live Auction</button>
          <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}>Squads</button>
        </nav>
      </header>

      {tab === 'home' && <iframe title="Home Hero" className="home-frame" src="/home-hero.html" />}

      {tab === 'auction' && (
        <section className="stage">
          <video className="bg-video" autoPlay muted loop playsInline src={LIVE_AUCTION_BG} />
          <div className="veil" />
          <div className="board roomy-3">
            <aside className="card liquid-glass panel-strong">
              <h3>Teams Budget</h3>
              {TEAMS.map((t) => <div key={t.id} className="row liquid-glass"><span>{t.name}</span><strong>₹{(teams[t.id].budget / 100).toFixed(2)}Cr</strong></div>)}
            </aside>

            <main className="card liquid-glass panel-focus">
              <div className="center-block">
                <p className="eyebrow">Current Player</p>
                <h1>{currentPlayer ? currentPlayer.name : 'No Player On Stage'}</h1>
                <h2>{currentPlayer ? `${currentPlayer.role} • ${currentPlayer.tier}` : 'Pool exhausted'}</h2>
                <div className="price">₹{currentBid}L</div>
                <div className="controls big">{[5, 10, 15, 20].map((v) => <button key={v} className="liquid-glass" onClick={() => setCurrentBid((b) => b + v)}>+{v}L</button>)}</div>
                <div className="controls"><input value={custom} onChange={(e) => setCustom(e.target.value)} type="number" placeholder="Custom in Lakhs" /><button className="liquid-glass" onClick={() => { const v = Number(custom); if (v > 0) setCurrentBid((b) => b + v) }}>+Custom</button><button className="liquid-glass" onClick={() => { const v = Number(custom); if (v >= BASE_PRICE) setCurrentBid(v) }}>Set</button></div>
                <div className="controls"><button className="liquid-glass" onClick={nextPlayer}>Next Player</button><button className="liquid-glass" onClick={() => sellToTeam('mi')}>Sold MI</button><button className="liquid-glass" onClick={() => sellToTeam('csk')}>Sold CSK</button><button className="liquid-glass" onClick={() => sellToTeam('rcb')}>Sold RCB</button><button className="liquid-glass" onClick={cancelLastSale}>Cancel Last Sale</button></div>
              </div>
            </main>

            <aside className="card liquid-glass panel-strong">
              <h3>Latest Sold</h3>
              <div className="log-scroll">{saleLog.length ? saleLog.map((l) => <div key={l.id} className="log-item liquid-glass"><span>{l.text}</span><time>{l.at}</time></div>) : <div className="muted">No sales yet</div>}</div>
            </aside>
          </div>
        </section>
      )}

      {tab === 'teams' && (
        <section className="stage squads">
          <video className="bg-video" autoPlay muted loop playsInline src={SQUADS_BG} />
          <div className="veil" />
          <div className="squad-layout wide-cards">
            {TEAMS.map((t) => (
              <details key={t.id} className="card liquid-glass squad-expand panel-strong" open>
                <summary>
                  <div>
                    <h3>{t.name}</h3>
                    <p className="budget">₹{(teams[t.id].budget / 100).toFixed(2)}Cr</p>
                    <p className="muted">Purse Remaining</p>
                  </div>
                  <span className="count-pill liquid-glass">Players: {teams[t.id].players.length}</span>
                </summary>
                <div className="squad-inner">
                  <div className="players">{teams[t.id].players.length ? teams[t.id].players.map((p, i) => <div key={`${p.name}-${i}`} className="row liquid-glass"><span>{p.name}</span><strong>₹{p.price}L</strong></div>) : <div className="muted">No players yet.</div>}</div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
