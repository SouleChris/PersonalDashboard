/*
  Counterstrike Page Made in the Month of March in 2026
  Author -> Christopher Soule
  APIS -> leetify, leetify/matches
  Reacharts used for showing information visually
  What is this Page -> 
    This page uses the leetify API to gather user data to show different in-game statistics.
    Different views allow for different data to be represented depending on maps, periods of time
      Overview -> Gives stats over the last 100 recent games
      Recent Matches -> 
      Per Map ->
      Match History ->
*/

import { useState, useEffect, useMemo } from "react"
import styles from "../styles/counterstrike.module.css"
import { LineChart, Line, ScatterChart, Scatter, ZAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import LoadingSpinner from "../components/loadSpinner"

export default function CS2() {
  const [data, setData] = useState(null)
  const [matchesData, setMatchesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState("overview")
  const [selectedMap, setSelectedMap] = useState(null)
  const [historyMode, setHistoryMode] = useState("all") // "byMap" | "all"

  // Single coordinated fetch for both endpoints so loading/error state is shared
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [profileRes, matchesRes] = await Promise.all([
          fetch("/leetify"),
          fetch("/leetify/matches")
        ])
        if (!profileRes.ok || !matchesRes.ok) {
          throw new Error("Failed to load Leetify data")
        }
        const [profileJson, matchesJson] = await Promise.all([
          profileRes.json(),
          matchesRes.json()
        ])
        setData(profileJson)
        setMatchesData(matchesJson)
      } catch (err) {
        console.error(err)
        setError("Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // gets 30 most recent matches from the leetify api
  const myStats = matchesData?.slice(0, 30).map((match, i) => {
    const me = match.stats?.find(p => p.steam64_id === import.meta.env.VITE_STEAM_ID)
    return {
      game: i + 1,
      date: new Date(match.finished_at).toLocaleDateString(),
      map: match.map_name,
      hs_kills: me?.total_hs_kills,
      kd: me?.kd_ratio,
      dpr: me?.dpr,
      trade_kill: me?.trade_kills_success_percentage,
      counter_strafing: me?.counter_strafing_shots_good_ratio,
      spray_accuracy: me?.spray_accuracy,
      ct_leetify_rating: me?.ct_leetify_rating,
      t_leetify_rating: me?.t_leetify_rating,
    }
  })

  const recentByMap = (data?.recent_matches ?? []).reduce((acc, match) => {
    const map = match.map_name?.replace("de_", "").replace("cs_", "")
    if (!acc[map]) acc[map] = []
    acc[map].push(match.reaction_time_ms ?? 0)
    return acc
  }, {})

  const mapStats = useMemo(() => {
    if (!matchesData) return []
    return Object.values(
      matchesData.reduce((acc, match) => {
        const me = match.stats?.find(p => p.steam64_id === import.meta.env.VITE_STEAM_ID)
        if (!me) return acc
        const map = match.map_name
        const mapShort = map.replace("de_", "").replace("cs_", "")
        if (!acc[mapShort]) {
          acc[mapShort] = {
            map: mapShort,
            kd: [], dpr: [], hs_kills: [], trade_kill: [], preaim: [],
            spray_accuracy: [], ct_leetify_rating: [], t_leetify_rating: [],
            count: 0
          }
        }
        acc[mapShort].kd.push(me.kd_ratio ?? 0)
        acc[mapShort].dpr.push(me.dpr ?? 0)
        acc[mapShort].hs_kills.push(me.total_hs_kills ?? 0)
        acc[mapShort].trade_kill.push(me.trade_kills_success_percentage ?? 0)
        acc[mapShort].preaim.push(me.preaim ?? 0)
        acc[mapShort].spray_accuracy.push(me.spray_accuracy ?? 0)
        acc[mapShort].ct_leetify_rating.push(me.ct_leetify_rating ?? 0)
        acc[mapShort].t_leetify_rating.push(me.t_leetify_rating ?? 0)
        acc[mapShort].count++
        return acc
      }, {})
    ).map(m => {
      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
      return {
        map: m.map,
        kd: avg(m.kd).toFixed(2),
        dpr: avg(m.dpr).toFixed(1),
        hs_kills: avg(m.hs_kills).toFixed(1),
        trade_kill: (avg(m.trade_kill) * 100).toFixed(1),
        preaim: avg(m.preaim).toFixed(1),
        spray_accuracy: (avg(m.spray_accuracy) * 100).toFixed(1),
        ct_leetify_rating: avg(m.ct_leetify_rating).toFixed(4),
        t_leetify_rating: avg(m.t_leetify_rating).toFixed(4),
        reaction_time: recentByMap[m.map]
          ? (recentByMap[m.map].reduce((a, b) => a + b, 0) / recentByMap[m.map].length).toFixed(0)
          : null,
        count: m.count
      }
    }).sort((a, b) => b.count - a.count)
  }, [matchesData])

  // gets unique maps played and match count for the map grid
  const uniqueMaps = useMemo(() => {
    if (!matchesData) return []
    return [...new Set(matchesData.map(m => m.map_name))]
      .map(mapName => ({
        mapName,
        mapShort: mapName.replace("de_", "").replace("cs_", ""),
        count: matchesData.filter(m => m.map_name === mapName).length
      }))
      .sort((a, b) => b.count - a.count)
  }, [matchesData])

  // FIX: memoized per-map match lookup, uses VITE_STEAM_ID consistently
  const matchesByMap = useMemo(() => {
    if (!matchesData) return {}
    const result = {}
    matchesData.forEach(match => {
      const mapName = match.map_name
      const me = match.stats?.find(p => p.steam64_id === import.meta.env.VITE_STEAM_ID)
      const myTeam = me?.initial_team_number
      const myScore = match.team_scores?.find(t => t.team_number === myTeam)?.score ?? 0
      const oppScore = match.team_scores?.find(t => t.team_number !== myTeam)?.score ?? 0
      const row = {
        id: match.id,
        date: new Date(match.finished_at).toLocaleDateString(),
        result: myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T",
        score: `${myScore} - ${oppScore}`,
        kills: me?.total_kills ?? "—",
        deaths: me?.total_deaths ?? "—",
        kd: me?.kd_ratio?.toFixed(2) ?? "—",
        dpr: me?.dpr?.toFixed(1) ?? "—",
        hs_kills: me?.total_hs_kills ?? "—",
        trade_kill: me?.trade_kills_success_percentage != null ? `${(me.trade_kills_success_percentage * 100).toFixed(1)}%` : "—",
        counter_strafing: me?.counter_strafing_shots_good_ratio != null ? `${(me.counter_strafing_shots_good_ratio * 100).toFixed(1)}%` : "—",
        reaction_time: me?.reaction_time != null ? `${(me.reaction_time * 1000).toFixed(0)}ms` : "—",
        preaim: me?.preaim != null ? `${me.preaim.toFixed(1)}%` : "—",
        spray_accuracy: me?.spray_accuracy != null ? `${(me.spray_accuracy * 100).toFixed(1)}%` : "—",
        ct_leetify_rating: me?.ct_leetify_rating?.toFixed(4) ?? "—",
        t_leetify_rating: me?.t_leetify_rating?.toFixed(4) ?? "—",
      }
      if (!result[mapName]) result[mapName] = []
      result[mapName].push(row)
    })
    return result
  }, [matchesData])

  // All matches across every map for the "All" history mode
  const allMatches = useMemo(() => {
    if (!matchesData) return []
    return matchesData.map(match => {
      const me = match.stats?.find(p => p.steam64_id === import.meta.env.VITE_STEAM_ID)
      const myTeam = me?.initial_team_number
      const myScore = match.team_scores?.find(t => t.team_number === myTeam)?.score ?? 0
      const oppScore = match.team_scores?.find(t => t.team_number !== myTeam)?.score ?? 0
      return {
        id: match.id,
        date: new Date(match.finished_at).toLocaleDateString(),
        map: match.map_name?.replace("de_", "").replace("cs_", ""),
        result: myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T",
        score: `${myScore} - ${oppScore}`,
        kills: me?.total_kills ?? "—",
        deaths: me?.total_deaths ?? "—",
        kd: me?.kd_ratio?.toFixed(2) ?? "—",
        dpr: me?.dpr?.toFixed(1) ?? "—",
        hs_kills: me?.total_hs_kills ?? "—",
        trade_kill: me?.trade_kills_success_percentage != null ? `${(me.trade_kills_success_percentage * 100).toFixed(1)}%` : "—",
        counter_strafing: me?.counter_strafing_shots_good_ratio != null ? `${(me.counter_strafing_shots_good_ratio * 100).toFixed(1)}%` : "—",
        reaction_time: me?.reaction_time != null ? `${(me.reaction_time * 1000).toFixed(0)}ms` : "—",
        preaim: me?.preaim != null ? `${me.preaim.toFixed(1)}%` : "—",
        spray_accuracy: me?.spray_accuracy != null ? `${(me.spray_accuracy * 100).toFixed(1)}%` : "—",
        ct_leetify_rating: me?.ct_leetify_rating?.toFixed(4) ?? "—",
        t_leetify_rating: me?.t_leetify_rating?.toFixed(4) ?? "—",
      }
    })
  }, [matchesData])

  // Shared Y-axis domain for CT/T rating charts so both scales match
  const ctTDomain = useMemo(() => {
    const values = [
      ...(myStats?.map(m => m.ct_leetify_rating).filter(v => v != null) ?? []),
      ...(myStats?.map(m => m.t_leetify_rating).filter(v => v != null) ?? []),
      ...(mapStats.map(m => parseFloat(m.ct_leetify_rating)).filter(v => !isNaN(v))),
      ...(mapStats.map(m => parseFloat(m.t_leetify_rating)).filter(v => !isNaN(v))),
    ]
    if (!values.length) return ["auto", "auto"]
    return [
      parseFloat((Math.min(...values) * 1.1).toFixed(4)),
      parseFloat((Math.max(...values) * 1.1).toFixed(4))
    ]
  }, [myStats, mapStats])

  if (loading) return <div className={styles.container}><LoadingSpinner text="Loading CS2 stats..." /></div>
  if (error) return <div className={styles.container}><p style={{ color: "#e57373", padding: "2rem" }}>{error}</p></div>
  if (!data || !matchesData) return <div className={styles.container}><LoadingSpinner text="Loading CS2 stats..." /></div>

  const { ranks, rating, stats, name, winrate, total_matches, recent_matches } = data
  const { aim, positioning, utility, clutch, opening } = rating ?? {}
  const leetifyRating = ranks?.leetify

  return (
    <div>
      {/* Title and nav always pinned to standard container width */}
      <div className={styles.container} style={{ paddingBottom: 0 }}>
        <h1 className={styles.title}>My CS2 Stats</h1>

        {/* View Toggle */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <button onClick={() => { setView("overview"); setSelectedMap(null) }} className={view === "overview" ? styles.activeButton : styles.button}>
            Overview
          </button>
          <button onClick={() => { setView("recent"); setSelectedMap(null) }} className={view === "recent" ? styles.activeButton : styles.button}>
            Recent Matches
          </button>
          <button onClick={() => { setView("map"); setSelectedMap(null) }} className={view === "map" ? styles.activeButton : styles.button}>
            Per Map
          </button>
          <button onClick={() => { setView("history"); setSelectedMap(null) }} className={view === "history" ? styles.activeButton : styles.button}>
            Match History
          </button>
        </div>
      </div>

      {/* Content — always wide container so left edge never shifts between views */}
      <div className={styles.containerWide} style={{ paddingTop: 0 }}>

      {/* Overview View */}
      {view === "overview" && (
        <div className={styles.contentConstrained}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Overview</h2>
            <div className={styles.grid}>
              <StatCard label="Name" value={name} />
              <StatCard label="Leetify Rating" value={leetifyRating?.toFixed(2)} rating={leetifyRating > 4 ? "excellent" : leetifyRating > 2.5 ? "good" : leetifyRating > 1 ? "average" : "poor"} />
              <StatCard label="Win Rate" value={`${(winrate * 100).toFixed(1)}%`} rating={winrate > 0.55 ? "excellent" : winrate > 0.5 ? "good" : winrate > 0.45 ? "average" : "poor"} />
              <StatCard label="Total Matches" value={total_matches} />
              <StatCard label="Aim" value={aim?.toFixed(2)} rating={aim > 70 ? "excellent" : aim > 55 ? "good" : aim > 40 ? "average" : "poor"} />
              <StatCard label="Positioning" value={positioning?.toFixed(2)} rating={positioning > 70 ? "excellent" : positioning > 55 ? "good" : positioning > 40 ? "average" : "poor"} />
              <StatCard label="Utility" value={utility?.toFixed(2)} rating={utility > 70 ? "excellent" : utility > 55 ? "good" : utility > 40 ? "average" : "poor"} />
              <StatCard label="Clutch" value={clutch?.toFixed(4)} rating={clutch > 0.15 ? "excellent" : clutch > 0.1 ? "good" : clutch > 0.05 ? "average" : "poor"} />
              <StatCard label="Opening" value={opening?.toFixed(4)} rating={opening > 0.08 ? "excellent" : opening > 0.05 ? "good" : opening > 0.02 ? "average" : "poor"} />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Detailed Stats</h2>
            <div className={styles.grid}>
              <StatCard label="Accuracy (Enemy Spotted)" value={`${stats?.accuracy_enemy_spotted?.toFixed(1)}%`} rating={stats?.accuracy_enemy_spotted > 40 ? "excellent" : stats?.accuracy_enemy_spotted > 30 ? "good" : stats?.accuracy_enemy_spotted > 20 ? "average" : "poor"} />
              <StatCard label="Headshot Accuracy" value={`${stats?.accuracy_head?.toFixed(1)}%`} rating={stats?.accuracy_head > 30 ? "excellent" : stats?.accuracy_head > 22 ? "good" : stats?.accuracy_head > 15 ? "average" : "poor"} />
              <StatCard label="Counter Strafing" value={`${stats?.counter_strafing_good_shots_ratio?.toFixed(1)}%`} rating={stats?.counter_strafing_good_shots_ratio > 85 ? "excellent" : stats?.counter_strafing_good_shots_ratio > 70 ? "good" : stats?.counter_strafing_good_shots_ratio > 55 ? "average" : "poor"} />
              <StatCard label="Reaction Time" value={`${stats?.reaction_time_ms?.toFixed(0)}ms`} rating={stats?.reaction_time_ms < 400 ? "excellent" : stats?.reaction_time_ms < 500 ? "good" : stats?.reaction_time_ms < 600 ? "average" : "poor"} />
              <StatCard label="Spray Accuracy" value={`${stats?.spray_accuracy?.toFixed(1)}%`} rating={stats?.spray_accuracy > 45 ? "excellent" : stats?.spray_accuracy > 35 ? "good" : stats?.spray_accuracy > 25 ? "average" : "poor"} />
              <StatCard label="CT Opening Success" value={`${stats?.ct_opening_duel_success_percentage?.toFixed(1)}%`} rating={stats?.ct_opening_duel_success_percentage > 55 ? "excellent" : stats?.ct_opening_duel_success_percentage > 45 ? "good" : stats?.ct_opening_duel_success_percentage > 35 ? "average" : "poor"} />
              <StatCard label="T Opening Success" value={`${stats?.t_opening_duel_success_percentage?.toFixed(1)}%`} rating={stats?.t_opening_duel_success_percentage > 55 ? "excellent" : stats?.t_opening_duel_success_percentage > 45 ? "good" : stats?.t_opening_duel_success_percentage > 35 ? "average" : "poor"} />
              <StatCard label="Trade Kill Success" value={`${stats?.trade_kills_success_percentage?.toFixed(1)}%`} rating={stats?.trade_kills_success_percentage > 45 ? "excellent" : stats?.trade_kills_success_percentage > 35 ? "good" : stats?.trade_kills_success_percentage > 25 ? "average" : "poor"} />
              <StatCard label="Flashbang Duration" value={`${stats?.flashbang_hit_foe_avg_duration?.toFixed(2)}s`} rating={stats?.flashbang_hit_foe_avg_duration > 3 ? "excellent" : stats?.flashbang_hit_foe_avg_duration > 2 ? "good" : stats?.flashbang_hit_foe_avg_duration > 1 ? "average" : "poor"} />
              <StatCard label="HE Grenade Damage" value={stats?.he_foes_damage_avg?.toFixed(1)} rating={stats?.he_foes_damage_avg > 20 ? "excellent" : stats?.he_foes_damage_avg > 12 ? "good" : stats?.he_foes_damage_avg > 6 ? "average" : "poor"} />
              <StatCard label="Utility on Death" value={stats?.utility_on_death_avg?.toFixed(0)} rating={stats?.utility_on_death_avg < 100 ? "excellent" : stats?.utility_on_death_avg < 250 ? "good" : stats?.utility_on_death_avg < 400 ? "average" : "poor"} />
              <StatCard label="Preaim" value={`${stats?.preaim?.toFixed(1)}%`} rating={stats?.preaim > 15 ? "excellent" : stats?.preaim > 10 ? "good" : stats?.preaim > 5 ? "average" : "poor"} />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Matches</h2>
            <div className={styles.matches}>
              {recent_matches?.slice(0, 5).map((match, i) => (
                <div key={i} className={`${styles.matchCard} ${match.outcome === "win" ? styles.win : styles.loss}`}>
                  <p className={styles.matchMap}>{match.map_name}</p>
                  <p className={styles.matchOutcome}>{match.outcome.toUpperCase()}</p>
                  <p className={styles.matchStat}>Rating: {match.leetify_rating?.toFixed(2)}</p>
                  <p className={styles.matchStat}>Rank: {match.rank}</p>
                  <p className={styles.matchStat}>{new Date(match.finished_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Recent Match Charts */}
      {view === "recent" && (
        <div className={styles.contentConstrained}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Reaction Time — Last 30 Matches</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart
                  data={recent_matches?.slice(0, 30).map((match, i) => ({
                    game: i + 1,
                    reaction_time: match.reaction_time_ms,
                    map: match.map_name,
                    date: new Date(match.finished_at).toLocaleDateString()
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" label={{ value: "Match", position: "insideBottom", offset: -5, fill: "#a8b8a0" }} tick={{ fill: "#a8b8a0" }} />
                  <YAxis label={{ value: "ms", angle: -90, position: "insideLeft", fill: "#a8b8a0" }} tick={{ fill: "#a8b8a0" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#b8a0a0ff" }}
                    formatter={(value) => [`${value}ms`, "Reaction Time"]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? `Match ${label}`}
                  />
                  <Line type="monotone" dataKey="reaction_time" stroke="#6499dbff" strokeWidth={2} dot={{ fill: "#6074c4ff", r: 3 }} activeDot={{ r: 6, fill: "#0c00eaff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Preaim — Last 30 Matches</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart
                  data={recent_matches?.slice(0, 30).map((match, i) => ({
                    game: i + 1,
                    preaim: match.preaim,
                    map: match.map_name,
                    date: new Date(match.finished_at).toLocaleDateString()
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" label={{ value: "Match", position: "insideBottom", offset: -5, fill: "#a8b8a0" }} tick={{ fill: "#a8b8a0" }} />
                  <YAxis label={{ value: "%", angle: -90, position: "insideLeft", fill: "#a8b8a0" }} tick={{ fill: "#b8a0a0ff" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [`${value?.toFixed(2)}%`, "Preaim"]}
                    labelFormatter={(label, payload) => {
                      const match = payload?.[0]?.payload
                      return match ? `${match.date} — ${match.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="preaim" stroke="#e78f5cff" strokeWidth={2} dot={{ fill: "#fc642cff", r: 3 }} activeDot={{ r: 6, fill: "#dd4b02ff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Headshot Kills Per Match</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [value, "HS Kills"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="hs_kills" stroke="#6499dbff" strokeWidth={2} dot={{ fill: "#6074c4ff", r: 3 }} activeDot={{ r: 6, fill: "#0c00eaff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>K/D Ratio Per Match</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [value?.toFixed(2), "K/D"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="kd" stroke="#e78f5cff" strokeWidth={2} dot={{ fill: "#fc642cff", r: 3 }} activeDot={{ r: 6, fill: "#dd4b02ff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Damage Per Round</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [value?.toFixed(1), "DPR"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="dpr" stroke="#6499dbff" strokeWidth={2} dot={{ fill: "#6499dbff", r: 3 }} activeDot={{ r: 6, fill: "#0c00eaff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Trade Kill Success %</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [`${(value * 100).toFixed(1)}%`, "Trade Kill Success"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="trade_kill" stroke="#e78f5cff" strokeWidth={2} dot={{ fill: "#fc642cff", r: 3 }} activeDot={{ r: 6, fill: "#dd4b02ff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Counter Strafing Good Shot Ratio</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [`${(value * 100).toFixed(1)}%`, "Counter Strafing"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="counter_strafing" stroke="#6499dbff" strokeWidth={2} dot={{ fill: "#6499dbff", r: 3 }} activeDot={{ r: 6, fill: "#0c00eaff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Spray Accuracy Per Match</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value) => [`${(value * 100).toFixed(1)}%`, "Spray Accuracy"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="spray_accuracy" stroke="#e78f5cff" strokeWidth={2} dot={{ fill: "#fc642cff", r: 3 }} activeDot={{ r: 6, fill: "#dd4b02ff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>CT vs T Leetify Rating Per Match</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={myStats} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                  <XAxis dataKey="game" tick={{ fill: "#a8b8a0" }} />
                  <YAxis tick={{ fill: "#a8b8a0" }} domain={ctTDomain} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#2c2c2c", border: "1px solid #f5c842", borderRadius: "8px" }}
                    labelStyle={{ color: "#a8b8a0" }}
                    formatter={(value, name) => [value?.toFixed(4), name === "ct_leetify_rating" ? "CT Rating" : "T Rating"]}
                    labelFormatter={(label, payload) => {
                      const m = payload?.[0]?.payload
                      return m ? `${m.date} — ${m.map}` : `Match ${label}`
                    }}
                  />
                  <Line type="monotone" dataKey="ct_leetify_rating" stroke="#6499dbff" strokeWidth={2} dot={{ fill: "#6074c4ff", r: 3 }} activeDot={{ r: 6, fill: "#0c00eaff" }} name="ct_leetify_rating" />
                  <Line type="monotone" dataKey="t_leetify_rating" stroke="#e78f5cff" strokeWidth={2} dot={{ fill: "#fc642cff", r: 3 }} activeDot={{ r: 6, fill: "#dd4b02ff" }} name="t_leetify_rating" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "#888" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 12, height: 3, backgroundColor: "#6499dbff", display: "inline-block", borderRadius: 2 }} />
                CT Side
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 12, height: 3, backgroundColor: "#e78f5cff", display: "inline-block", borderRadius: 2 }} />
                T Side
              </span>
            </div>
          </section>
        </div>
      )}

      {/* Per Map Charts */}
      {view === "map" && (
        <div className={styles.contentConstrained}><section className={styles.section}>
          <h2 className={styles.sectionTitle}>Stats By Map</h2>
          {[
            { key: "kd", label: "K/D Ratio", color: "#429ef5ff" },
            { key: "dpr", label: "Damage Per Round", color: "#ef8624ff" },
            { key: "hs_kills", label: "Avg Headshot Kills", color: "#6499dbff" },
            { key: "trade_kill", label: "Trade Kill Success %", color: "#ef8624ff" },
            { key: "preaim", label: "Preaim", color: "#6499dbff" },
            { key: "reaction_time", label: "Reaction Time (ms)", color: "#ef8624ff" },
            { key: "spray_accuracy", label: "Spray Accuracy (%)", color: "#6499dbff" },
            { key: "ct_leetify_rating", label: "CT Leetify Rating", color: "#429ef5ff", domain: ctTDomain },
            { key: "t_leetify_rating", label: "T Leetify Rating", color: "#ef8624ff", domain: ctTDomain },
          ].map(({ key, label, color, domain }) => (
            <div key={key} style={{ marginBottom: "2rem" }}>
              <h3 style={{ color: "#888", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.75rem" }}>{label}</h3>
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                    <XAxis dataKey="map" type="category" tick={{ fill: "#888", fontSize: 12 }} allowDuplicatedCategory={false} />
                    <YAxis dataKey={key} type="number" tick={{ fill: "#888", fontSize: 12 }} domain={domain ?? ["auto", "auto"]} />
                    <ZAxis dataKey="count" range={[40, 200]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #eeeeee", borderRadius: "8px" }}
                      labelStyle={{ color: "#2c2c2c" }}
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value, name) => {
                        if (name === "count") return [value, "Matches played"]
                        return [value, label]
                      }}
                    />
                    <Scatter data={mapStats} fill={color} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </section></div>
      )}

      {/* Match History View */}
      {view === "history" && (
        <>
          {/* FIX: correct label colors — By Map uses byMap condition, All Matches uses all condition */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span className={styles.toggleLabel} style={{ color: historyMode === "byMap" ? "var(--text-primary)" : "var(--text-muted)" }}>By Map</span>
            <button
              className={`${styles.sliderToggle} ${historyMode === "byMap" ? styles.sliderToggleRight : ""}`}
              onClick={() => { setHistoryMode(prev => prev === "byMap" ? "all" : "byMap"); setSelectedMap(null) }}
              aria-label="Toggle history mode"
            >
              <span className={styles.sliderThumb} />
            </button>
            <span className={styles.toggleLabel} style={{ color: historyMode === "all" ? "var(--text-primary)" : "var(--text-muted)" }}>All Matches</span>
          </div>

          {/* By Map mode */}
          {historyMode === "byMap" && (
            <>
              {!selectedMap && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Select a Map</h2>
                  <div className={styles.mapGrid}>
                    {uniqueMaps.map(({ mapName, mapShort, count }) => (
                      <div
                        key={mapName}
                        className={styles.mapCard}
                        onClick={() => setSelectedMap(mapName)}
                      >
                        <div className={styles.mapName}>{mapShort}</div>
                        <div className={styles.mapCount}>{count} matches</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {selectedMap && (
                <section className={styles.section}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                    <button className={styles.button} onClick={() => setSelectedMap(null)}>← Back</button>
                    <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                      {selectedMap.replace("de_", "").replace("cs_", "")} — {matchesByMap[selectedMap]?.length ?? 0} Matches
                    </h2>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className={styles.matchTable}>
                      <thead>
                        <tr>
                          <th className={styles.matchTableTh}>Date</th>
                          <th className={styles.matchTableTh}>Result</th>
                          <th className={styles.matchTableTh}>Score</th>
                          <th className={styles.matchTableTh}>Kills</th>
                          <th className={styles.matchTableTh}>Deaths</th>
                          <th className={styles.matchTableTh}>K/D</th>
                          <th className={styles.matchTableTh}>DPR</th>
                          <th className={styles.matchTableTh}>HS Kills</th>
                          <th className={styles.matchTableTh}>Trade Kill</th>
                          <th className={styles.matchTableTh}>Counter Straf.</th>
                          <th className={styles.matchTableTh}>Reaction</th>
                          <th className={styles.matchTableTh}>Preaim</th>
                          <th className={styles.matchTableTh}>Spray Acc.</th>
                          <th className={styles.matchTableTh}>CT Rating</th>
                          <th className={styles.matchTableTh}>T Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(matchesByMap[selectedMap] ?? []).map((match) => (
                          <tr key={match.id} className={styles.matchTableRow}>
                            <td className={styles.matchTableTd}>{match.date}</td>
                            <td className={styles.matchTableTd}>
                              <span className={match.result === "W" ? styles.resultWin : match.result === "L" ? styles.resultLoss : styles.resultTie}>{match.result}</span>
                            </td>
                            <td className={styles.matchTableTd}>{match.score}</td>
                            <td className={styles.matchTableTd}>{match.kills}</td>
                            <td className={styles.matchTableTd}>{match.deaths}</td>
                            <td className={styles.matchTableTd}>{match.kd}</td>
                            <td className={styles.matchTableTd}>{match.dpr}</td>
                            <td className={styles.matchTableTd}>{match.hs_kills}</td>
                            <td className={styles.matchTableTd}>{match.trade_kill}</td>
                            <td className={styles.matchTableTd}>{match.counter_strafing}</td>
                            <td className={styles.matchTableTd}>{match.reaction_time}</td>
                            <td className={styles.matchTableTd}>{match.preaim}</td>
                            <td className={styles.matchTableTd}>{match.spray_accuracy}</td>
                            <td className={styles.matchTableTd}>{match.ct_leetify_rating}</td>
                            <td className={styles.matchTableTd}>{match.t_leetify_rating}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {/* All Matches mode */}
          {historyMode === "all" && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>All Matches — {allMatches.length} Total</h2>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.matchTable}>
                  <thead>
                    <tr>
                      <th className={styles.matchTableTh}>Date</th>
                      <th className={styles.matchTableTh}>Map</th>
                      <th className={styles.matchTableTh}>Result</th>
                      <th className={styles.matchTableTh}>Score</th>
                      <th className={styles.matchTableTh}>Kills</th>
                      <th className={styles.matchTableTh}>Deaths</th>
                      <th className={styles.matchTableTh}>K/D</th>
                      <th className={styles.matchTableTh}>DPR</th>
                      <th className={styles.matchTableTh}>HS Kills</th>
                      <th className={styles.matchTableTh}>Trade Kill</th>
                      <th className={styles.matchTableTh}>Counter Straf.</th>
                      <th className={styles.matchTableTh}>Reaction</th>
                      <th className={styles.matchTableTh}>Preaim</th>
                      <th className={styles.matchTableTh}>Spray Acc.</th>
                      <th className={styles.matchTableTh}>CT Rating</th>
                      <th className={styles.matchTableTh}>T Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMatches.map((match) => (
                      <tr key={match.id} className={styles.matchTableRow}>
                        <td className={styles.matchTableTd}>{match.date}</td>
                        <td className={styles.matchTableTd} style={{ textTransform: "capitalize" }}>{match.map}</td>
                        <td className={styles.matchTableTd}>
                          <span className={match.result === "W" ? styles.resultWin : match.result === "L" ? styles.resultLoss : styles.resultTie}>{match.result}</span>
                        </td>
                        <td className={styles.matchTableTd}>{match.score}</td>
                        <td className={styles.matchTableTd}>{match.kills}</td>
                        <td className={styles.matchTableTd}>{match.deaths}</td>
                        <td className={styles.matchTableTd}>{match.kd}</td>
                        <td className={styles.matchTableTd}>{match.dpr}</td>
                        <td className={styles.matchTableTd}>{match.hs_kills}</td>
                        <td className={styles.matchTableTd}>{match.trade_kill}</td>
                        <td className={styles.matchTableTd}>{match.counter_strafing}</td>
                        <td className={styles.matchTableTd}>{match.reaction_time}</td>
                        <td className={styles.matchTableTd}>{match.preaim}</td>
                        <td className={styles.matchTableTd}>{match.spray_accuracy}</td>
                        <td className={styles.matchTableTd}>{match.ct_leetify_rating}</td>
                        <td className={styles.matchTableTd}>{match.t_leetify_rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      </div>
    </div>
  )
}

// Gives color styling based on performance rating
function StatCard({ label, value, rating }) {
  const tierClass = rating === "excellent" ? styles.excellent
    : rating === "good" ? styles.good
    : rating === "average" ? styles.average
    : rating === "poor" ? styles.poor
    : ""

  return (
    <div className={`${styles.card} ${tierClass}`}>
      <p className={styles.cardLabel}>{label}</p>
      <p className={styles.cardValue}>{value ?? "N/A"}</p>
    </div>
  )
}