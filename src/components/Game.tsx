import { useEffect, useRef, useState } from "react";
import { Battery, Clock, KeyRound, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { batterySvg, characterSvg, CHARACTERS, exclaimSvg, ghostSvg, keySvg, kuntilanakSvg, loadImg, pocongSvg, type CharId } from "@/lib/art";
import { audio } from "@/lib/audio";
import { BATTERIES, CATCH_DIST, decideOutcome, EXIT, GAME_SECONDS, GHOST_SPAWN, HUNTER_SPAWNS, KEYS, move, npcsAt, ROOMS, roomAt, TOTAL_KEYS, WALLS, WORLD } from "@/lib/game";
import { CharImg } from "./Art";
import { Joystick } from "./Joystick";
import { MuteButton } from "./MuteButton";
import { Button } from "./ui/button";

export type GamePlayer = { id: string; nama: string; username: string; karakter: CharId; role: "ghost" | "hunter" | null; status: string };
type Live = { x: number; y: number; tx: number; ty: number; status: string; shoutUntil: number; moving: boolean; battery: number };

const HUNTER_SPEED = 150, GHOST_SPEED = 168;

export function Game({ code, me, players, startedAt, isHost, onBackToLobby, onLeave }: {
  code: string; me: string; players: GamePlayer[]; startedAt: number; isHost: boolean; onBackToLobby: () => void; onLeave: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joy = useRef({ x: 0, y: 0 });
  const keysDown = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({ time: GAME_SECONDS, keys: 0, battery: 100, statuses: {} as Record<string, string>, near: 0, room: "" });
  const [toast, setToast] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"hunters" | "ghost" | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const shoutRef = useRef<() => void>(() => {});

  const meP = players.find((p) => p.id === me)!;
  const amGhost = meP.role === "ghost";

  useEffect(() => { setIsTouch(window.matchMedia("(pointer: coarse)").matches); }, []);

  useEffect(() => {
    audio.init(); audio.startMusic();
    const hunters = players.filter((p) => p.role === "hunter");
    const live: Record<string, Live> = {};
    players.forEach((p) => {
      const s = p.role === "ghost" ? GHOST_SPAWN : HUNTER_SPAWNS[hunters.indexOf(p) % 3]!;
      live[p.id] = { x: s.x, y: s.y, tx: s.x, ty: s.y, status: "alive", shoutUntil: 0, moving: false, battery: 100 };
    });
    let keyMask = 0, batMask = 0, ended = false, lastSend = 0, lastStep = 0, stunUntil = 0, npcCd = 0;
    const meL = live[me]!;
    const imgs = {
      chars: Object.fromEntries((Object.keys(CHARACTERS) as CharId[]).map((c) => [c, loadImg(characterSvg(c))])) as Record<CharId, HTMLImageElement>,
      ghost: loadImg(ghostSvg()), kunti: loadImg(kuntilanakSvg()), pocong: loadImg(pocongSvg()),
      key: loadImg(keySvg()), bat: loadImg(batterySvg()), ex: loadImg(exclaimSvg()),
    };
    const dark = document.createElement("canvas");
    let toastTimer = 0;
    const notify = (m: string) => { setToast(m); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => setToast(null), 2600); };

    const ch = supabase.channel(`game-${code}`, { config: { broadcast: { self: false } } });
    const setStatus = (id: string, s: string) => {
      const l = live[id]; if (!l || l.status === s || l.status !== "alive") return;
      l.status = s;
      if (s === "caught") { audio.scream(); if (id === me) notify("KAMU TERTANGKAP! Sekarang kamu jadi penonton."); else notify(`${players.find((p) => p.id === id)?.nama} tertangkap!`); }
      if (s === "escaped") notify(`${players.find((p) => p.id === id)?.nama} berhasil kabur!`);
      if (id === me) void supabase.from("players").update({ status: s }).eq("room_code", code).eq("profile_id", me);
    };
    const gainKeys = (mask: number, local: boolean) => {
      const fresh = mask & ~keyMask;
      if (!fresh) return;
      keyMask |= mask;
      KEYS.forEach((k) => { if (fresh & (1 << k.id)) { audio.pickup(); notify(local ? `Kamu dapat ${k.name}!` : `Tim dapat ${k.name}!`); } });
      if (keyMask === 31) { audio.creak(); setTimeout(() => notify("Semua kunci terkumpul! Kabur lewat gerbang Kuburan Belakang!"), 1200); }
    };
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id: string; x: number; y: number; m: boolean; st: string; k: number; b: number };
      const l = live[p.id]; if (!l) return;
      l.tx = p.x; l.ty = p.y; l.moving = p.m;
      if (p.st !== "alive") setStatus(p.id, p.st);
      gainKeys(p.k, false); batMask |= p.b;
    });
    ch.on("broadcast", { event: "caught" }, ({ payload }) => setStatus((payload as { id: string }).id, "caught"));
    ch.on("broadcast", { event: "shout" }, ({ payload }) => { const l = live[(payload as { id: string }).id]; if (l) { l.shoutUntil = performance.now() + 2500; audio.shout(); } });
    ch.subscribe();
    const send = (event: string, payload: object) => void ch.send({ type: "broadcast", event, payload });

    shoutRef.current = () => {
      if (meL.status !== "alive" || performance.now() < meL.shoutUntil) return;
      meL.shoutUntil = performance.now() + 2500; audio.shout(); send("shout", { id: me });
    };
    const kd = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; if (e.key === " " ) shoutRef.current(); if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    let raf = 0, last = performance.now(), hudT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      const countdown = Date.now() < startedAt;
      const timeLeft = Math.max(0, GAME_SECONDS - elapsed);
      const t = elapsed;

      // input
      const k = keysDown.current;
      let ix = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0) + joy.current.x;
      let iy = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0) + joy.current.y;
      const mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; }
      const canMove = !countdown && !ended && meL.status === "alive" && now > stunUntil;
      meL.moving = canMove && mag > 0.1;
      if (meL.moving) {
        const sp = (amGhost ? GHOST_SPEED : HUNTER_SPEED) * dt;
        const p = move(meL.x, meL.y, ix * sp, iy * sp);
        meL.x = p.x; meL.y = p.y;
        if (now - lastStep > (amGhost ? 520 : 330)) { lastStep = now; if (!amGhost) audio.step(); }
      }
      meL.tx = meL.x; meL.ty = meL.y;
      for (const [id, l] of Object.entries(live)) if (id !== me) { l.x += (l.tx - l.x) * Math.min(1, dt * 12); l.y += (l.ty - l.y) * Math.min(1, dt * 12); }

      const npcs = npcsAt(t);
      if (!amGhost && meL.status === "alive" && !countdown && !ended) {
        meL.battery = Math.max(0, meL.battery - dt * 1.1);
        KEYS.forEach((key) => { if (!(keyMask & (1 << key.id)) && Math.hypot(key.x - meL.x, key.y - meL.y) < 34) gainKeys(1 << key.id, true); });
        BATTERIES.forEach((b) => { if (!(batMask & (1 << b.id)) && Math.hypot(b.x - meL.x, b.y - meL.y) < 34) { batMask |= 1 << b.id; meL.battery = Math.min(100, meL.battery + 60); audio.pickup(); notify("Baterai senter terisi!"); } });
        if (now > npcCd) for (const n of npcs) if (Math.hypot(n.x - meL.x, n.y - meL.y) < 40) {
          npcCd = now + 3000; stunUntil = now + 900; meL.battery = Math.max(0, meL.battery - 25); audio.scream();
          notify(n.kind === "pocong" ? "Pocong melompat ke arahmu! Senter melemah." : "Kuntilanak menjerit! Senter melemah.");
          break;
        }
        if (keyMask === 31 && Math.hypot(EXIT.x - meL.x, EXIT.y - meL.y) < EXIT.r) setStatus(me, "escaped");
      }
      if (amGhost && !countdown && !ended) {
        for (const [id, l] of Object.entries(live)) if (id !== me && l.status === "alive" && Math.hypot(l.x - meL.x, l.y - meL.y) < CATCH_DIST) { setStatus(id, "caught"); send("caught", { id }); }
      }
      if (now - lastSend > 100) { lastSend = now; send("pos", { id: me, x: Math.round(meL.x), y: Math.round(meL.y), m: meL.moving, st: meL.status, k: keyMask, b: batMask }); }

      // proximity fear
      const ghostId = players.find((p) => p.role === "ghost")?.id;
      const gl = ghostId ? live[ghostId] : undefined;
      const near = !amGhost && gl && meL.status === "alive" ? Math.max(0, 1 - Math.hypot(gl.x - meL.x, gl.y - meL.y) / 360) : 0;
      audio.heartbeat(near); audio.setBreath(amGhost ? 0.25 : near);

      // outcome
      if (!ended && !countdown) {
        const res = decideOutcome(players.filter((p) => p.role === "hunter").map((p) => ({ status: live[p.id]!.status })), timeLeft);
        if (res) {
          ended = true; setOutcome(res); audio.stopAll();
          if (isHost) {
            void supabase.from("game_state").update({ winner: res, keys_found: [0, 1, 2, 3, 4].filter((i) => keyMask & (1 << i)).length, updated_at: new Date().toISOString() }).eq("room_code", code);
            void supabase.from("rooms").update({ status: "ended" }).eq("code", code);
          }
        }
      }

      // camera follows me, or an alive hunter when spectating
      let cam = meL;
      if (meL.status !== "alive") { const alive = Object.entries(live).find(([id, l]) => l.status === "alive" && players.find((p) => p.id === id)?.role === "hunter"); if (alive) cam = alive[1]; }
      draw(now, t, cam, npcs, near, timeLeft, countdown);
      if (now - hudT > 200) {
        hudT = now;
        setHud({ time: Math.ceil(timeLeft), keys: [0, 1, 2, 3, 4].filter((i) => keyMask & (1 << i)).length, battery: meL.battery, near, room: roomAt(meL.x, meL.y), statuses: Object.fromEntries(Object.entries(live).map(([id, l]) => [id, l.status])) });
      }
    };

    const draw = (now: number, t: number, cam: Live, npcs: ReturnType<typeof npcsAt>, near: number, timeLeft: number, countdown: boolean) => {
      const c = canvasRef.current; if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; dark.width = c.width; dark.height = c.height; }
      const g = c.getContext("2d")!;
      const zoom = Math.max(0.6, Math.min(1.3, Math.min(W, H) / 520));
      const S = zoom * dpr;
      const ox = c.width / 2 - cam.x * S, oy = c.height / 2 - cam.y * S;
      const shake = near > 0.55 ? (Math.random() - 0.5) * near * 10 * dpr : 0;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#020102"; g.fillRect(0, 0, c.width, c.height);
      g.setTransform(S, 0, 0, S, ox + shake, oy);
      for (const r of ROOMS) {
        g.fillStyle = r.floor; g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeStyle = "rgba(255,255,255,0.03)"; g.lineWidth = 2;
        for (let yy = r.y; yy < r.y + r.h; yy += 40) { g.beginPath(); g.moveTo(r.x, yy); g.lineTo(r.x + r.w, yy); g.stroke(); }
        g.fillStyle = "rgba(200,170,220,0.18)"; g.font = "28px Creepster, fantasy"; g.fillText(r.name.toUpperCase(), r.x + 30, r.y + 50);
      }
      // graves
      g.fillStyle = "#3a3d38";
      for (const [gx, gy] of [[1060, 600], [1260, 640], [1380, 880], [1080, 900]] as const) { g.beginPath(); g.roundRect(gx, gy, 34, 44, [16, 16, 2, 2]); g.fill(); }
      g.fillStyle = "#3b2416"; WALLS.forEach((w) => g.fillRect(w.x, w.y, w.w, w.h));
      g.strokeStyle = "#1a0e08"; g.lineWidth = 2; WALLS.forEach((w) => g.strokeRect(w.x, w.y, w.w, w.h));
      // exit
      const open = keyMask === 31;
      g.strokeStyle = open ? "#59e36b" : "#8b0d17"; g.lineWidth = 6; g.beginPath(); g.arc(EXIT.x, EXIT.y, EXIT.r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = open ? "rgba(89,227,107,.25)" : "rgba(139,13,23,.25)"; g.fill();
      g.fillStyle = "#ddd"; g.font = "16px 'Special Elite'"; g.textAlign = "center"; g.fillText(open ? "GERBANG TERBUKA" : "GERBANG TERKUNCI", EXIT.x, EXIT.y + EXIT.r + 20); g.textAlign = "left";
      KEYS.forEach((k) => { if (!(keyMask & (1 << k.id))) { const b = Math.sin(t * 3 + k.id) * 4; g.drawImage(imgs.key, k.x - 22, k.y - 11 + b, 44, 22); } });
      BATTERIES.forEach((b) => { if (!(batMask & (1 << b.id))) g.drawImage(imgs.bat, b.x - 10, b.y - 16, 20, 32); });
      for (const n of npcs) g.drawImage(n.kind === "pocong" ? imgs.pocong : imgs.kunti, n.x - 28, n.y - 60, 56, 90);
      // players
      for (const p of players) {
        const l = live[p.id]!;
        if (l.status === "escaped") continue;
        if (p.role === "ghost") {
          g.globalAlpha = 0.85 + Math.sin(t * 4) * 0.1;
          g.drawImage(imgs.ghost, l.x - 42, l.y - 70 + Math.sin(t * 2.5) * 6, 84, 105);
          g.globalAlpha = 1;
        } else {
          g.globalAlpha = l.status === "caught" ? 0.35 : 1;
          const bob = l.moving ? Math.abs(Math.sin(t * 12)) * 3 : 0;
          g.drawImage(imgs.chars[p.karakter], l.x - 24, l.y - 56 - bob, 48, 67);
          g.globalAlpha = 1;
        }
      }
      // darkness
      const d = dark.getContext("2d")!;
      d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = "source-over";
      d.fillStyle = amGhost ? "rgba(8,0,14,0.9)" : "rgba(0,0,0,0.97)"; d.fillRect(0, 0, dark.width, dark.height);
      d.globalCompositeOperation = "destination-out";
      d.setTransform(S, 0, 0, S, ox + shake, oy);
      const hole = (x: number, y: number, r: number, a = 1) => {
        const gr = d.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.7, `rgba(0,0,0,${a * 0.75})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
      };
      if (amGhost) {
        hole(meL.x, meL.y - 20, 260, 0.9);
        for (const p of players) { const l = live[p.id]!; if (p.role === "hunter" && l.status === "alive") hole(l.x, l.y - 20, 60 + l.battery * 0.8, 0.5); }
      } else {
        for (const p of players) {
          const l = live[p.id]!;
          if (p.role !== "hunter" || l.status !== "alive") continue;
          const bat = p.id === me ? l.battery : 70;
          const flick = bat < 20 ? (Math.random() < 0.15 ? 0.3 : 1) : Math.random() < 0.01 ? 0.6 : 1;
          hole(l.x, l.y - 20, (70 + bat * 1.3) * flick, p.id === me ? 1 : 0.7);
        }
        if (meL.status !== "alive") hole(cam.x, cam.y - 20, 180, 0.8);
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dark, 0, 0);
      // overlays above darkness: shouts and names of teammates
      g.setTransform(S, 0, 0, S, ox + shake, oy);
      g.font = "13px 'Special Elite'"; g.textAlign = "center";
      for (const p of players) {
        const l = live[p.id]!;
        if (l.status === "escaped") continue;
        if (now < l.shoutUntil) { const s = 1 + Math.sin(now / 80) * 0.1; g.drawImage(imgs.ex, l.x - 14 * s, l.y - 110 * s, 28 * s, 42 * s); g.fillStyle = "#ff4d4d"; g.fillText("TOLONG!", l.x, l.y - 116); }
        if (p.role === "hunter" && (!amGhost || p.id === me)) { g.fillStyle = "rgba(240,230,250,.8)"; g.fillText(p.nama, l.x, l.y + 26); }
      }
      g.textAlign = "left";
      // noise / glitch
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (near > 0.2) {
        g.fillStyle = `rgba(255,255,255,${near * 0.08})`;
        for (let i = 0; i < 160 * near; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 2 * dpr, 2 * dpr);
        if (Math.random() < near * 0.35) { const y = Math.random() * c.height; const h = 10 + Math.random() * 40; g.drawImage(c, 0, y, c.width, h, (Math.random() - 0.5) * 40 * near, y, c.width, h); g.fillStyle = `rgba(180,0,20,${near * 0.25})`; g.fillRect(0, y, c.width, h); }
      }
      if (countdown) { g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#e33"; g.font = `${90 * dpr}px Creepster`; g.textAlign = "center"; g.fillText(String(Math.ceil((startedAt - Date.now()) / 1000)), c.width / 2, c.height / 2); g.font = `${22 * dpr}px 'Special Elite'`; g.fillStyle = "#eee"; g.fillText(amGhost ? "KAMU HANTU ASAP. Tangkap semua pemburu!" : "KAMU PEMBURU. Cari 5 kunci dan kabur!", c.width / 2, c.height / 2 + 50 * dpr); g.textAlign = "left"; }
      void timeLeft;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(toastTimer);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      void supabase.removeChannel(ch); audio.stopAll();
    };
  }, [code, me, players.map((p) => p.id + p.role).join(), startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const spectating = hud.statuses[me] === "caught";
  const mm = Math.floor(hud.time / 60), ss = String(hud.time % 60).padStart(2, "0");
  const won = outcome === "hunters" ? !amGhost : amGhost;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void">
      <canvas ref={canvasRef} className="h-full w-full" style={{ filter: spectating ? "grayscale(1) contrast(1.1)" : undefined }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${0.75 + hud.near * 0.2}) 100%)`, boxShadow: hud.near > 0.3 ? `inset 0 0 ${80 * hud.near}px rgba(170,0,20,.6)` : undefined }} />
      {/* HUD */}
      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card/80 px-3 py-1.5 text-sm">
          <span className={`flex items-center gap-1 ${hud.time < 60 ? "text-primary animate-pulse" : ""}`}><Clock className="size-4" />{mm}:{ss}</span>
          <span className="flex items-center gap-1 text-gold"><KeyRound className="size-4" />{hud.keys}/{TOTAL_KEYS}</span>
          {!amGhost && <span className="flex items-center gap-1"><Battery className="size-4" />{Math.round(hud.battery)}%</span>}
        </div>
        <div className="flex flex-1 flex-wrap justify-center gap-1">
          {players.filter((p) => p.role === "hunter").map((p) => {
            const st = hud.statuses[p.id] ?? "alive";
            return (
              <div key={p.id} className={`flex items-center gap-1 rounded bg-card/80 px-1.5 py-0.5 text-xs ${st === "caught" ? "opacity-40 grayscale" : ""}`}>
                <CharImg id={p.karakter} className="h-6 w-5" />
                <span className="max-w-16 truncate">{p.nama}</span>
                <span className={st === "alive" ? "text-chart-4" : st === "escaped" ? "text-gold" : "text-primary"}>{st === "alive" ? "hidup" : st === "escaped" ? "kabur" : "tertangkap"}</span>
              </div>
            );
          })}
        </div>
        <MuteButton className="pointer-events-auto" />
      </div>
      <div className="absolute left-1/2 top-12 -translate-x-1/2 text-xs text-muted-foreground">{amGhost ? "HANTU ASAP" : "PEMBURU"} - {hud.room}</div>
      {toast && <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-lg border border-gold bg-card/90 px-4 py-2 text-center text-sm font-bold text-gold">{toast}</div>}
      {spectating && !outcome && <div className="absolute inset-x-0 top-28 text-center font-horror text-2xl text-foreground">KAMU JADI PENONTON</div>}
      {/* controls */}
      {isTouch && <div className="absolute bottom-6 left-6"><Joystick vec={joy} /></div>}
      {!amGhost && !spectating && (
        <button onPointerDown={() => shoutRef.current()} className="absolute bottom-8 right-6 flex size-20 flex-col items-center justify-center rounded-full border-2 border-primary bg-blood/80 text-xs font-bold text-primary-foreground glow-blood">
          <Megaphone className="size-6" />TOLONG!
        </button>
      )}
      {!isTouch && <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">WASD / Panah untuk jalan{!amGhost && ", Spasi untuk teriak"}</div>}
      {outcome && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-void/90 p-6 text-center">
          <h1 className={`font-horror text-drip text-5xl ${won ? "text-gold" : "text-primary"}`}>
            {outcome === "hunters" ? (amGhost ? "PEMBURU KABUR..." : "KAMU BERHASIL KABUR!") : "HANTU MENANG..."}
          </h1>
          <p className="text-muted-foreground">{won ? "Kamu menang malam ini." : "Malam ini milik kegelapan."}</p>
          <div className="flex gap-3">
            {isHost && <Button size="lg" onClick={onBackToLobby}>Main Lagi</Button>}
            <Button size="lg" variant="secondary" onClick={onLeave}>Keluar</Button>
          </div>
          {!isHost && <p className="text-xs text-muted-foreground">Menunggu host untuk main lagi...</p>}
        </div>
      )}
    </div>
  );
}
