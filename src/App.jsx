import { useEffect, useRef, useState } from 'react'
import './App.css'

const RANKS = {
  E: { xp: 10, label: 'E' },
  D: { xp: 20, label: 'D' },
  C: { xp: 40, label: 'C' },
  B: { xp: 80, label: 'B' },
  A: { xp: 150, label: 'A' },
  S: { xp: 300, label: 'S' },
}

const HUNTER_TITLES = [
  { minLevel: 50, rank: 'S', title: 'Shadow Monarch' },
  { minLevel: 35, rank: 'A', title: 'National-Level Hunter' },
  { minLevel: 20, rank: 'B', title: 'Elite Hunter' },
  { minLevel: 10, rank: 'C', title: 'Seasoned Hunter' },
  { minLevel: 5, rank: 'D', title: 'Awakened' },
  { minLevel: 1, rank: 'E', title: 'Weakest Hunter' },
]

const STORAGE_KEY = 'system-quest-log'

// XP needed to go from `level` to `level + 1`
const xpForLevel = (level) => 50 + level * 50

function levelFromXp(totalXp) {
  let level = 1
  let remaining = totalXp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, current: remaining, needed: xpForLevel(level) }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved && Array.isArray(saved.quests)) return saved
  } catch {
    // ignore corrupt or unavailable storage
  }
  return { quests: [], totalXp: 0 }
}

function App() {
  const [state, setState] = useState(loadState)
  const [title, setTitle] = useState('')
  const [rank, setRank] = useState('E')
  const [tab, setTab] = useState('active')
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const { quests, totalXp } = state
  const { level, current, needed } = levelFromXp(totalXp)
  const hunter = HUNTER_TITLES.find((t) => level >= t.minLevel)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable; progress lives only in memory
    }
  }, [state])

  function notify(message, kind = 'info') {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }

  function addQuest(e) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setState((s) => ({
      ...s,
      quests: [
        { id: crypto.randomUUID(), title: text, rank, done: false },
        ...s.quests,
      ],
    }))
    setTitle('')
    notify(`New quest registered: ${text}`)
  }

  function toggleQuest(quest) {
    const reward = RANKS[quest.rank].xp
    const delta = quest.done ? -reward : reward
    const nextXp = Math.max(0, totalXp + delta)
    const nextLevel = levelFromXp(nextXp).level

    setState((s) => ({
      totalXp: nextXp,
      quests: s.quests.map((q) =>
        q.id === quest.id ? { ...q, done: !q.done } : q,
      ),
    }))

    if (!quest.done) {
      notify(`Quest cleared. +${reward} XP`)
      if (nextLevel > level) notify(`LEVEL UP! You are now Lv. ${nextLevel}`, 'levelup')
    } else {
      notify(`Quest reopened. -${reward} XP`, 'warn')
    }
  }

  function deleteQuest(id) {
    setState((s) => ({ ...s, quests: s.quests.filter((q) => q.id !== id) }))
  }

  const active = quests.filter((q) => !q.done)
  const cleared = quests.filter((q) => q.done)
  const shown = tab === 'active' ? active : cleared

  return (
    <main className="system">
      <section className="window status">
        <header className="window-title">
          <span className="bang">!</span> STATUS
        </header>
        <div className="status-grid">
          <div>
            <div className="label">NAME</div>
            <div className="value">Player</div>
          </div>
          <div>
            <div className="label">LEVEL</div>
            <div className="value big">{level}</div>
          </div>
          <div>
            <div className="label">RANK</div>
            <div className={`value rank-text rank-${hunter.rank}`}>{hunter.rank}</div>
          </div>
          <div>
            <div className="label">TITLE</div>
            <div className="value">{hunter.title}</div>
          </div>
        </div>
        <div className="xp">
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: `${(current / needed) * 100}%` }} />
          </div>
          <div className="xp-text">
            EXP {current} / {needed}
          </div>
        </div>
      </section>

      <section className="window">
        <header className="window-title">
          <span className="bang">!</span> QUEST INFO
        </header>

        <form className="add" onSubmit={addQuest}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Register a new quest…"
            aria-label="Quest title"
          />
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            aria-label="Quest rank"
          >
            {Object.entries(RANKS).map(([key, r]) => (
              <option key={key} value={key}>
                {r.label}-Rank · {r.xp} XP
              </option>
            ))}
          </select>
          <button type="submit">Accept</button>
        </form>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'active'}
            className={tab === 'active' ? 'on' : ''}
            onClick={() => setTab('active')}
          >
            Active [{active.length}]
          </button>
          <button
            role="tab"
            aria-selected={tab === 'cleared'}
            className={tab === 'cleared' ? 'on' : ''}
            onClick={() => setTab('cleared')}
          >
            Cleared [{cleared.length}]
          </button>
          <button
            role="tab"
            aria-selected={tab === 'level'}
            className={tab === 'level' ? 'on' : ''}
            onClick={() => setTab('level')}
          >
            Level
          </button>
        </div>

        {tab === 'level' ? (
          <LevelPanel
            level={level}
            totalXp={totalXp}
            toNext={needed - current}
            clearedCount={cleared.length}
          />
        ) : shown.length === 0 ? (
          <p className="empty">
            {tab === 'active'
              ? 'No active quests. The System awaits your orders.'
              : 'No quests cleared yet. Arise.'}
          </p>
        ) : (
          <ul className="quests">
            {shown.map((q) => (
              <li key={q.id} className={q.done ? 'done' : ''}>
                <span className={`badge rank-${q.rank}`}>{q.rank}</span>
                <span className="quest-title">{q.title}</span>
                <span className="reward">+{RANKS[q.rank].xp} XP</span>
                <button
                  className="check"
                  onClick={() => toggleQuest(q)}
                  aria-label={q.done ? 'Reopen quest' : 'Clear quest'}
                  title={q.done ? 'Reopen' : 'Clear'}
                >
                  {q.done ? '↺' : '✓'}
                </button>
                <button
                  className="remove"
                  onClick={() => deleteQuest(q.id)}
                  aria-label="Abandon quest"
                  title="Abandon"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="bang">!</span> {t.message}
          </div>
        ))}
      </div>
    </main>
  )
}

function LevelPanel({ level, totalXp, toNext, clearedCount }) {
  const ladder = [...HUNTER_TITLES].reverse()
  const currentIndex = ladder.findLastIndex((t) => level >= t.minLevel)
  const nextRank = ladder[currentIndex + 1]

  return (
    <div className="level-panel">
      <div className="level-stats">
        <div>
          <div className="label">TOTAL EXP</div>
          <div className="value">{totalXp}</div>
        </div>
        <div>
          <div className="label">TO NEXT LEVEL</div>
          <div className="value">{toNext} XP</div>
        </div>
        <div>
          <div className="label">QUESTS CLEARED</div>
          <div className="value">{clearedCount}</div>
        </div>
        <div>
          <div className="label">NEXT RANK</div>
          <div className="value">
            {nextRank ? `${nextRank.rank} at Lv. ${nextRank.minLevel}` : 'Max rank'}
          </div>
        </div>
      </div>

      <ol className="ladder">
        {ladder.map((t, i) => {
          const status =
            i < currentIndex ? 'passed' : i === currentIndex ? 'current' : 'locked'
          return (
            <li key={t.rank} className={status}>
              <span className={`badge rank-${t.rank}`}>{t.rank}</span>
              <span className="quest-title">{status === 'locked' ? '???' : t.title}</span>
              <span className="ladder-req">Lv. {t.minLevel}+</span>
              {status === 'current' && <span className="ladder-tag">YOU</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default App
