import { LOGIN_STARS } from "../../data/appData";
import { AuthPanel } from "./authPanel/AuthPanel";

export function LoginScreen() {
  const handleSSOLogin = async (provider) => {
    window.location.href = `/auth/${provider}`;
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#04060E",
        fontFamily: "'DM Mono','Courier New',monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        animation: "loginEnter 0.6s ease forwards",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        @keyframes loginEnter { from{opacity:0} to{opacity:1} }
        @keyframes loginExit  { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(1.06)} }
        @keyframes orbitSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes orbitSpinR { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes logoBreathe{ 0%,100%{filter:drop-shadow(0 0 24px rgba(124,58,237,0.5))} 50%{filter:drop-shadow(0 0 48px rgba(124,58,237,0.9)) drop-shadow(0 0 80px rgba(78,205,196,0.3))} }
        @keyframes loginTwinkle{0%,100%{opacity:0.1}50%{opacity:1}}
        @keyframes cardFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes errorShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 100px #0C0F1C inset !important; -webkit-text-fill-color:rgba(255,255,255,0.85) !important; }
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      {/* Starfield */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {LOGIN_STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              borderRadius: "50%",
              background: "white",
              opacity: s.o,
              animation: `loginTwinkle ${2.5 + s.d}s ${s.d * 0.5}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Nebula blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)",
            top: "-15%",
            left: "-5%",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(78,205,196,0.08) 0%, transparent 65%)",
            bottom: "-10%",
            right: "5%",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(244,114,182,0.06) 0%, transparent 65%)",
            top: "40%",
            right: "-8%",
          }}
        />
      </div>

      {/* Orbiting rings around the logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: "50%",
            border: "1px solid rgba(124,58,237,0.12)",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            animation: "orbitSpin 18s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#7C3AED",
              boxShadow: "0 0 12px #7C3AED",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#4ECDC4",
              boxShadow: "0 0 8px #4ECDC4",
            }}
          />
        </div>
        {/* Middle ring */}
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: "50%",
            border: "1px solid rgba(78,205,196,0.1)",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            animation: "orbitSpinR 12s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#F472B6",
              boxShadow: "0 0 10px #F472B6",
            }}
          />
        </div>
        {/* Inner ring */}
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: "50%",
            border: "1px solid rgba(244,114,182,0.08)",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            animation: "orbitSpin 7s linear infinite",
          }}
        />
      </div>

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: 400,
          padding: "44px 40px",
          background:
            "linear-gradient(160deg, rgba(12,15,28,0.95) 0%, rgba(8,10,20,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18,
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
          animation: "cardFloat 5s ease-in-out infinite",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Top glow edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(78,205,196,0.4), transparent)",
            borderRadius: 1,
          }}
        />

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "white",
              letterSpacing: "-0.02em",
              animation: "logoBreathe 3s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            COSMIC<span style={{ color: "#7C3AED" }}>VAULT</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.18em",
              marginTop: 6,
              textTransform: "uppercase",
            }}
          >
            Your Personal Universe
          </div>
        </div>

        <AuthPanel
          onGoogleLogin={() => handleSSOLogin("google")}
          onGitHubLogin={() => handleSSOLogin("github")}
        />
      </div>
    </div>
  );
}
