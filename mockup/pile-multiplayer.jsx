// pile-multiplayer.jsx — Trystero P2P 멀티플레이어 레이어

const { useState, useEffect, useRef, useCallback } = React;

const PEER_COLORS = [
  "oklch(0.55 0.13 245)",
  "oklch(0.52 0.13 145)",
  "oklch(0.55 0.13 320)",
  "oklch(0.56 0.13 30)",
  "oklch(0.52 0.13 190)",
  "oklch(0.54 0.13 60)",
];

function peerColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length];
}

/* ─── 커서 SVG ─── */
function CursorSvg({ color }) {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <path d="M2 1.5L15.5 9L9.5 11.5L7 18L2 1.5Z" fill={color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── 원격 커서 하나 ─── */
function RemoteCursor({ peer, feedScrollTop }) {
  const screenY = peer.docY - feedScrollTop;
  if (screenY < -60 || screenY > window.innerHeight + 20) return null;
  return (
    <div style={{
      position: "fixed",
      left: peer.x,
      top: screenY,
      pointerEvents: "none",
      zIndex: 9990,
      userSelect: "none",
    }}>
      <CursorSvg color={peer.color} />
      <div style={{
        marginTop: 2,
        marginLeft: 5,
        background: peer.color,
        color: "white",
        fontSize: 11,
        fontWeight: 650,
        fontFamily: "inherit",
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,.22)",
        letterSpacing: "-0.01em",
        display: "inline-block",
      }}>{peer.name || "…"}</div>
    </div>
  );
}

/* ─── 커서 레이어 ─── */
function CursorLayer({ peers, feedScrollTop }) {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9990, overflow: "hidden" }}>
      {Object.entries(peers).map(([id, peer]) =>
        peer.docY >= 0 ? <RemoteCursor key={id} peer={peer} feedScrollTop={feedScrollTop} /> : null
      )}
    </div>
  );
}

/* ─── 상단바 피어 아바타 ─── */
function PeerPips({ peers }) {
  const list = Object.values(peers);
  if (list.length === 0) return null;
  return (
    <div className="peer-pips">
      {list.slice(0, 6).map((p, i) => (
        <span key={i} className="peer-pip" style={{ background: p.color }} title={p.name}>
          {(p.name || "?")[0].toUpperCase()}
        </span>
      ))}
      {list.length > 6 && <span className="peer-pip-more">+{list.length - 6}</span>}
    </div>
  );
}

/* ─── 메인 훅 ─── */
function useMultiplayer({ roomId, myName, feedRef, onReceiveItem }) {
  const [peers, setPeers] = useState({});
  const [feedScrollTop, setFeedScrollTop] = useState(0);
  const [status, setStatus] = useState("connecting");

  const roomRef = useRef(null);
  const actRef = useRef({});
  const myNameRef = useRef(myName);
  const onReceiveRef = useRef(onReceiveItem);

  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { onReceiveRef.current = onReceiveItem; }, [onReceiveItem]);

  /* feed 스크롤 추적 → 커서 위치 재계산용 */
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const onScroll = () => setFeedScrollTop(feed.scrollTop);
    feed.addEventListener("scroll", onScroll, { passive: true });
    return () => feed.removeEventListener("scroll", onScroll);
  }, [feedRef]);

  /* Trystero 초기화 */
  useEffect(() => {
    const init = () => {
      const tr = window.__trystero;
      if (!tr) return;

      const room = tr.joinRoom({ appId: "pile-board-v1" }, roomId);
      roomRef.current = room;

      const curAct = room.makeAction("cur");
      const namAct = room.makeAction("nam");
      const itmAct = room.makeAction("itm");
      actRef.current = { curAct, namAct, itmAct };

      room.onPeerJoin = (pid) => {
        setPeers(p => ({ ...p, [pid]: { name: "…", color: peerColor(pid), x: -999, docY: -1 } }));
        setStatus("live");
        // 새 피어에게 내 이름 전송
        namAct.send(myNameRef.current, { target: pid });
      };

      room.onPeerLeave = (pid) => {
        setPeers(p => { const n = { ...p }; delete n[pid]; return n; });
      };

      /* 커서 수신: [clientX, docY] */
      curAct.onMessage = ([x, docY], { peerId }) => {
        setPeers(p => p[peerId]
          ? { ...p, [peerId]: { ...p[peerId], x, docY } }
          : p
        );
      };

      /* 이름 수신 */
      namAct.onMessage = (name, { peerId }) => {
        setPeers(p => ({
          ...p,
          [peerId]: { ...(p[peerId] || { color: peerColor(peerId), x: -999, docY: -1 }), name },
        }));
      };

      /* 아이템 수신 */
      itmAct.onMessage = (item) => {
        onReceiveRef.current?.(item);
      };

      setStatus("live");
    };

    if (window.__trystero) {
      init();
    } else {
      window.__trysteroReady = init;
    }

    return () => { if (roomRef.current) { roomRef.current.leave(); roomRef.current = null; } };
  }, [roomId]);

  /* 이름 변경 시 브로드캐스트 */
  useEffect(() => {
    const { namAct } = actRef.current;
    if (namAct && status === "live") namAct.send(myName);
  }, [myName, status]);

  /* 마우스 이동 → 커서 브로드캐스트 (rAF 스로틀) */
  useEffect(() => {
    let raf = null;
    let pending = null;

    const onMove = (e) => {
      const feed = feedRef.current;
      // docY = 문서 기준 Y (feed 스크롤 오프셋 포함)
      const docY = e.clientY + (feed ? feed.scrollTop : 0);
      pending = [e.clientX, docY];
      if (!raf) {
        raf = requestAnimationFrame(() => {
          const { curAct } = actRef.current;
          if (curAct && pending) curAct.send(pending);
          raf = null;
          pending = null;
        });
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [feedRef]);

  const broadcastItem = useCallback((item) => {
    const { itmAct } = actRef.current;
    if (itmAct) itmAct.send(item);
  }, []);

  return { peers, feedScrollTop, status, broadcastItem };
}

Object.assign(window, { useMultiplayer, CursorLayer, PeerPips });
