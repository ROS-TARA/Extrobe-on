
import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────
   CSS
   Key responsive fix: on mobile (<640px) the left
   branding panel HIDES completely. The form takes
   the full width. No more 460px fixed right column.
───────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0e0e0f; color: #f0eeea; font-family: 'Syne', sans-serif; min-height: 100vh; overflow-x: hidden; }

  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes orbFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-40px) scale(1.06)} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glowPulse{ 0%,100%{box-shadow:0 0 20px rgba(0,245,160,.3)} 50%{box-shadow:0 0 50px rgba(0,245,160,.6)} }
  @keyframes slide    { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes tickPop  { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
  @keyframes float1   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(3deg)} }
  @keyframes float2   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-24px) rotate(-2deg)} }

  .panel-slide { animation: slide 0.38s cubic-bezier(0.22,1,0.36,1) both; }

  .sp-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 15px 18px;
    color: #f0eeea;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    outline: none;
    transition: border-color .25s, background .25s, box-shadow .25s;
    -webkit-appearance: none;
  }
  .sp-input::placeholder { color: #444; }
  .sp-input:focus {
    border-color: rgba(0,245,160,0.45);
    background: rgba(0,245,160,0.04);
    box-shadow: 0 0 0 3px rgba(0,245,160,0.08);
  }
  .sp-input.err {
    border-color: rgba(255,77,109,0.5);
    box-shadow: 0 0 0 3px rgba(255,77,109,0.08);
  }

  .sp-btn {
    width: 100%;
    background: linear-gradient(135deg,#00f5a0,#00d4ff);
    border: none; border-radius: 14px;
    padding: 16px;
    color: #0a0a0a;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px; letter-spacing: 2px;
    cursor: pointer;
    transition: transform .2s, box-shadow .2s, opacity .2s;
  }
  .sp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,245,160,.35); }
  .sp-btn:active:not(:disabled) { transform: translateY(0); }
  .sp-btn:disabled { opacity: .55; cursor: not-allowed; }

  .sp-social {
    flex: 1; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;
    padding: 13px; color: #888; font-family: 'Syne',sans-serif; font-size: 14px;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background .2s, border-color .2s, color .2s;
  }
  .sp-social:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); color: #f0eeea; }

  .str-bar { height: 3px; border-radius: 99px; transition: background .4s; }

  .tab-wrap {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px; padding: 5px; display: flex; gap: 4px; margin-bottom: 32px;
  }
  .tab-btn {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    font-family: 'Bebas Neue',sans-serif; font-size: 16px; letter-spacing: 2px;
    cursor: pointer; transition: all .25s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn.on  { background: linear-gradient(135deg,#00f5a0,#00d4ff); color: #0a0a0a; box-shadow: 0 4px 16px rgba(0,245,160,.25); }
  .tab-btn.off { background: transparent; color: #555; }
  .tab-btn.off:hover { color: #aaa; }

  /* ── RESPONSIVE ── */
  .ls-left  { display: flex; }   /* show branding on desktop */
  .ls-right { width: 460px; flex-shrink: 0; }

  @media (max-width: 700px) {
    .ls-left  { display: none !important; }   /* hide branding on mobile */
    .ls-right { width: 100% !important; padding: 32px 20px 60px !important; min-height: 100vh; }
  }
`;

const BG = `linear-gradient(to right,#141415 0%,#141415 12.5%,#181819 12.5%,#181819 25%,#1c1d1e 25%,#1c1d1e 37.5%,#212224 37.5%,#212224 50%,#262729 50%,#262729 62.5%,#2b2c2f 62.5%,#2b2c2f 75%,#303235 75%,#303235 87.5%,#36383b 87.5%,#36383b 100%)`;

/* ── particles ── */
function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    let W = c.width = window.innerWidth, H = c.height = window.innerHeight;
    const onR = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    window.addEventListener("resize", onR);
    const pts = Array.from({length:60},()=>({x:Math.random()*W,y:Math.random()*H,dx:(Math.random()-.5)*.25,dy:(Math.random()-.5)*.25,r:Math.random()*1.2+.3,a:Math.random()*.4+.1,col:Math.random()>.5?"#00f5a0":"#00d4ff"}));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      pts.forEach(p=>{p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.col;ctx.globalAlpha=p.a;ctx.fill();});
      ctx.globalAlpha=1; raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",onR);};
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}/>;
}

function Orb({color,size,top,left,delay=0}){
  return <div style={{position:"fixed",top,left,width:size,height:size,borderRadius:"50%",background:`radial-gradient(circle at 30% 30%,${color}44,transparent 70%)`,filter:"blur(80px)",animation:`orbFloat 9s ease-in-out ${delay}s infinite`,zIndex:0,pointerEvents:"none"}}/>;
}

function Shimmer({children}){
  return <span style={{background:"linear-gradient(90deg,#00f5a0 0%,#00d4ff 30%,#fff 50%,#00d4ff 70%,#00f5a0 100%)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3s linear infinite"}}>{children}</span>;
}

/* ── password strength ── */
function pwStrength(pw) {
  if (!pw) return {score:0,label:"",color:""};
  let s=0;
  if(pw.length>=8)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  return [{label:"weak",color:"#ff4d6d"},{label:"weak",color:"#ff4d6d"},{label:"fair",color:"#ffd60a"},{label:"good",color:"#00d4ff"},{label:"strong",color:"#00f5a0"}][s]&&{score:s,...[{label:"weak",color:"#ff4d6d"},{label:"weak",color:"#ff4d6d"},{label:"fair",color:"#ffd60a"},{label:"good",color:"#00d4ff"},{label:"strong",color:"#00f5a0"}][s]};
}

/* ── input field ── */
function Field({label,type="text",placeholder,value,onChange,error,hint,extra}){
  const [show,setShow]=useState(false);
  const isP=type==="password";
  return(
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <label style={{fontSize:11,color:"#666",letterSpacing:1,textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>{label}</label>
        {extra}
      </div>
      <div style={{position:"relative"}}>
        <input className={`sp-input${error?" err":""}`} type={isP&&show?"text":type} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} style={{paddingRight:isP?50:18}} autoComplete="off"/>
        {isP&&<button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#555",fontSize:18}}>{show?"🙈":"👁"}</button>}
      </div>
      {error&&<div style={{fontSize:12,color:"#ff4d6d",marginTop:6,fontFamily:"'JetBrains Mono',monospace"}}>{error}</div>}
      {hint&&!error&&<div style={{fontSize:12,color:"#444",marginTop:6}}>{hint}</div>}
    </div>
  );
}

function Divider(){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}>
      <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
      <span style={{fontSize:12,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>or</span>
      <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
    </div>
  );
}

/* ── success screen ── */
function Success({mode,username,onNavigate}){
  useEffect(()=>{
    // auto-redirect after 2s
    const t=setTimeout(()=>{if(onNavigate)onNavigate("home");},2000);
    return()=>clearTimeout(t);
  },[]);
  return(
    <div className="panel-slide" style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"rgba(0,245,160,.1)",border:"2px solid rgba(0,245,160,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 24px",animation:"tickPop .5s cubic-bezier(.34,1.56,.64,1) both"}}>✓</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,letterSpacing:2,marginBottom:10}}>
        <Shimmer>{mode==="signup"?"YOU'RE IN 🎉":"WELCOME BACK"}</Shimmer>
      </div>
      <div style={{fontSize:14,color:"#666",marginBottom:32}}>
        {mode==="signup"?`account created for ${username}. time to embarrass some strangers.`:`good to see you again, ${username}.`}
      </div>
      <div style={{background:"rgba(0,245,160,.06)",border:"1px solid rgba(0,245,160,.15)",borderRadius:14,padding:"16px 20px",fontSize:13,color:"#555",fontFamily:"'JetBrains Mono',monospace"}}>
        redirecting... <span style={{color:"#00f5a0"}}>▶</span>
      </div>
    </div>
  );
}

/* ── left branding panel (desktop only) ── */
function LeftPanel(){
  return(
    <div className="ls-left" style={{flex:1,flexDirection:"column",justifyContent:"space-between",padding:"60px 50px",borderRight:"1px solid rgba(255,255,255,.05)",position:"relative",overflow:"hidden",minHeight:"100vh"}}>
      <div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:4,color:"#00f5a0",marginBottom:60}}>STRANGERPLAY</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(40px,5vw,58px)",lineHeight:1.05,letterSpacing:1,marginBottom:20}}>
          <div>CALL A</div><div><Shimmer>STRANGER.</Shimmer></div><div>PLAY.</div><div>WIN.</div>
        </div>
        <div style={{fontSize:15,color:"#555",lineHeight:1.7,maxWidth:300}}>No followers. No feed. Just two people and a game.</div>
      </div>
      <div style={{position:"relative",height:180,marginBottom:20}}>
        <div style={{position:"absolute",left:0,top:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(0,245,160,.15)",borderRadius:16,padding:"14px 18px",width:200,animation:"float1 6s ease-in-out infinite"}}>
          <div style={{fontSize:24,marginBottom:6}}>😂</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1.5,color:"#ffd60a"}}>Don't Laugh</div>
          <div style={{fontSize:11,color:"#555",marginTop:4}}>+10 pts per round</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#00f5a0",animation:"glowPulse 2s infinite"}}/>
            <span style={{fontSize:11,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>2,341 playing</span>
          </div>
        </div>
        <div style={{position:"absolute",right:20,top:40,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,77,109,.15)",borderRadius:16,padding:"14px 18px",width:180,animation:"float2 7s ease-in-out 1s infinite"}}>
          <div style={{fontSize:24,marginBottom:6}}>🔥</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1.5,color:"#ff4d6d"}}>Speed Roast</div>
          <div style={{fontSize:11,color:"#555",marginTop:4}}>+20 pts per round</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#ff4d6d",animation:"glowPulse 2s infinite"}}/>
            <span style={{fontSize:11,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>1,892 playing</span>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:28,paddingTop:24,borderTop:"1px solid rgba(255,255,255,.06)"}}>
        {[["14k+","online now"],["6","games to play"],["94","countries"]].map(([v,l])=>(
          <div key={l}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#f0eeea"}}>{v}</div>
            <div style={{fontSize:11,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
   Props:
     onNavigate(page) — called after successful login/signup to go home
──────────────────────────────────────────────── */
export default function LoginSignup({onNavigate, onLogin}){
  const [mode,setMode]       = useState("login");
  const [step,setStep]       = useState(1);
  const [done,setDone]       = useState(false);
  const [doneUser,setDoneUser]= useState("");

  // login fields
  const [lEmail,setLEmail]   = useState("");
  const [lPass,setLPass]     = useState("");
  const [lLoad,setLLoad]     = useState(false);
  const [lErr,setLErr]       = useState({});

  // signup fields
  const [sName,setSName]     = useState("");
  const [sEmail,setSEmail]   = useState("");
  const [sUser,setSUser]     = useState("");
  const [sPass,setSPass]     = useState("");
  const [sConf,setSConf]     = useState("");
  const [agree,setAgree]     = useState(false);
  const [sLoad,setSLoad]     = useState(false);
  const [sErr,setSErr]       = useState({});
  const [sMsg,setSMsg]       = useState(""); // server-level error

  // The API URL comes from .env → VITE_API_URL=http://localhost:3001
  // On Vercel you'll set VITE_API_URL=https://your-render-app.onrender.com
  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const str = pwStrength(sPass) || {score:0,label:"",color:""};

  // If already logged in, skip this page
  useEffect(()=>{
    if(localStorage.getItem("sp_token")&&onNavigate) onNavigate("home");
  },[]);

  function switchMode(m){setMode(m);setStep(1);setDone(false);setLErr({});setSErr({});setSMsg("");}

  /* ── SAVE SESSION ──
     localStorage.setItem stores key-value in the browser forever (until cleared).
     This is how the user stays "logged in" across refreshes.
     We save both the JWT token (for API auth) and the user object (for display).
  */
  function saveSession(token,user){
    localStorage.setItem("sp_token",token);
    localStorage.setItem("sp_user",JSON.stringify(user));
    setDoneUser(user.username||user.name||"");
    // Tell the parent (StrangerPlay_Main) that a user is now logged in.
    // This updates auth state in-place — NO page refresh, NO flicker.
    // The parent's handleLogin() sets its own `user` state from this data.
    if(onLogin) onLogin(user);
    setDone(true);
  }

  /* ── LOGIN ──
     fetch() is the browser's built-in HTTP client.
     We POST to /api/auth/signin with email+password.
     Server checks MongoDB, returns JWT token if correct.
  */
  async function handleLogin(){
    const err={};
    if(!lEmail) err.email="email required";
    else if(!lEmail.includes("@")) err.email="enter a valid email";
    if(!lPass) err.pass="password required";
    if(Object.keys(err).length){setLErr(err);return;}
    setLLoad(true); setLErr({});
    try{
      const res = await fetch(`${API}/api/auth/signin`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:lEmail,password:lPass}),
      });
      const data = await res.json();
      if(!res.ok){setLErr({pass:data.error||"wrong email or password"});setLLoad(false);return;}
      saveSession(data.token,data.user);
    }catch{
      setLErr({pass:"can't reach server — is your backend running?"});
    }
    setLLoad(false);
  }

  /* ── STEP 1 validation (name + email) ── */
  function handleStep1(){
    const err={};
    if(!sName.trim()) err.name="what's your name?";
    if(!sEmail) err.email="email required";
    else if(!sEmail.includes("@")) err.email="enter a valid email";
    if(Object.keys(err).length){setSErr(err);return;}
    setSErr({}); setStep(2);
  }

  /* ── SIGNUP ──
     POST /api/auth/signup → server hashes password with bcrypt,
     saves User to MongoDB, returns JWT token.
  */
  async function handleSignup(){
    const err={};
    if(!sUser.trim()) err.user="pick a username";
    else if(sUser.length<3) err.user="at least 3 characters";
    if(!sPass) err.pass="set a password";
    else if(sPass.length<8) err.pass="at least 8 characters";
    if(sConf!==sPass) err.conf="passwords don't match";
    if(!agree) err.agree="you need to agree to continue";
    if(Object.keys(err).length){setSErr(err);return;}
    setSLoad(true); setSErr({}); setSMsg("");
    try{
      const res = await fetch(`${API}/api/auth/signup`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:sName,email:sEmail,username:sUser,password:sPass,flag:"🇳🇵",country:"Nepal"}),
      });
      const data = await res.json();
      if(!res.ok){
        // username or email already taken — server tells us which
        setSMsg(data.error||"username or email already taken");
        setSLoad(false);return;
      }
      saveSession(data.token,data.user);
    }catch{
      setSMsg("can't reach server — is your backend running?");
    }
    setSLoad(false);
  }

  const Spinner = ()=>(
    <span style={{width:18,height:18,borderRadius:"50%",border:"2px solid rgba(0,0,0,.2)",borderTopColor:"#0a0a0a",animation:"spin .7s linear infinite",display:"inline-block",verticalAlign:"middle",marginRight:8}}/>
  );

  /* ── RENDER ── */
  return(
    <>
      <style>{css}</style>
      <Particles/>
      <Orb color="#00f5a0" size="500px" top="-100px" left="-100px"/>
      <Orb color="#00d4ff" size="400px" top="60%" left="60%" delay={3}/>
      <Orb color="#ff4d6d" size="300px" top="80%" left="-80px" delay={5}/>

      <div style={{position:"relative",zIndex:1,display:"flex",minHeight:"100vh",background:BG}}>

        {/* LEFT — desktop branding */}
        <LeftPanel/>

        {/* RIGHT — form panel */}
        <div className="ls-right" style={{display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 48px",minHeight:"100vh"}}>
          <div style={{width:"100%",maxWidth:380,paddingBottom:60}}>

            {done?(
              <Success mode={mode} username={doneUser} onNavigate={onNavigate}/>
            ):(
              <>
                {/* mode toggle */}
                <div className="tab-wrap">
                  {["login","signup"].map(m=>(
                    <button key={m} className={`tab-btn ${mode===m?"on":"off"}`} onClick={()=>switchMode(m)}>
                      {m==="login"?"SIGN IN":"SIGN UP"}
                    </button>
                  ))}
                </div>

                {/* ────── LOGIN ────── */}
                {mode==="login"&&(
                  <div className="panel-slide">
                    <div style={{marginBottom:28}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#444",letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>// welcome back</div>
                      <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:2,lineHeight:1}}><Shimmer>SIGN IN</Shimmer></h2>
                    </div>

                    <Field label="Email" type="email" placeholder="you@example.com"
                      value={lEmail} onChange={v=>{setLEmail(v);setLErr(e=>({...e,email:""}));}} error={lErr.email}/>
                    <Field label="Password" type="password" placeholder="your password"
                      value={lPass} onChange={v=>{setLPass(v);setLErr(e=>({...e,pass:""}));}} error={lErr.pass}
                      extra={<button onClick={()=>{}} style={{background:"none",border:"none",fontSize:12,color:"#00d4ff",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>forgot?</button>}/>

                    <button className="sp-btn" onClick={handleLogin} disabled={lLoad} style={{marginTop:8}}>
                      {lLoad?<><Spinner/>SIGNING IN...</>:"SIGN IN →"}
                    </button>

                    <Divider/>

                    <div style={{display:"flex",gap:10}}>
                      <button className="sp-social"><span style={{fontSize:18,fontWeight:700}}>G</span>Google</button>
                      <button className="sp-social"><span style={{fontSize:18}}>𝕏</span>X / Twitter</button>
                    </div>

                    <div style={{marginTop:28,textAlign:"center",fontSize:13,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>
                      no account?{" "}
                      <button onClick={()=>switchMode("signup")} style={{background:"none",border:"none",color:"#00f5a0",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>sign up →</button>
                    </div>
                  </div>
                )}

                {/* ────── SIGNUP ────── */}
                {mode==="signup"&&(
                  <div className="panel-slide" key={step}>
                    <div style={{marginBottom:24}}>
                      {/* step progress bar */}
                      <div style={{display:"flex",gap:6,marginBottom:16}}>
                        {[1,2].map(s=>(
                          <div key={s} style={{height:3,flex:1,borderRadius:99,background:step>=s?"linear-gradient(90deg,#00f5a0,#00d4ff)":"rgba(255,255,255,.08)",transition:"background .4s"}}/>
                        ))}
                      </div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#444",letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>// step {step} of 2</div>
                      <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:2,lineHeight:1}}>
                        <Shimmer>{step===1?"WHO ARE YOU?":"LOCK IT IN"}</Shimmer>
                      </h2>
                    </div>

                    {/* server-level error (username/email taken) */}
                    {sMsg&&(
                      <div style={{background:"rgba(255,77,109,.08)",border:"1px solid rgba(255,77,109,.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#ff4d6d",fontFamily:"'JetBrains Mono',monospace",marginBottom:16}}>
                        ⚠ {sMsg}
                      </div>
                    )}

                    {/* ── STEP 1: name + email ── */}
                    {step===1&&(
                      <>
                        <Field label="Full Name" placeholder="your name"
                          value={sName} onChange={v=>{setSName(v);setSErr(e=>({...e,name:""}));}} error={sErr.name}/>
                        <Field label="Email" type="email" placeholder="you@example.com"
                          value={sEmail} onChange={v=>{setSEmail(v);setSErr(e=>({...e,email:""}));}} error={sErr.email}/>

                        <div style={{display:"flex",gap:10,marginTop:8}}>
                          <button className="sp-social"><span style={{fontSize:18,fontWeight:700}}>G</span>Google</button>
                          <button className="sp-social"><span style={{fontSize:18}}>𝕏</span>Twitter</button>
                        </div>

                        <Divider/>

                        {/* This is the button that was broken — it now calls handleStep1()
                            which validates name+email THEN sets step to 2.
                            The old code had the right function, the bug was elsewhere (no onNavigate passed). */}
                        <button className="sp-btn" onClick={handleStep1} style={{marginTop:4}}>
                          CONTINUE →
                        </button>

                        <div style={{marginTop:24,textAlign:"center",fontSize:13,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>
                          already have one?{" "}
                          <button onClick={()=>switchMode("login")} style={{background:"none",border:"none",color:"#00f5a0",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>sign in →</button>
                        </div>
                      </>
                    )}

                    {/* ── STEP 2: username + password ── */}
                    {step===2&&(
                      <>
                        <Field label="Username" placeholder="pick something cool"
                          value={sUser} onChange={v=>{setSUser(v.toLowerCase().replace(/\s/g,"_"));setSErr(e=>({...e,user:""}));setSMsg("");}}
                          error={sErr.user} hint="this is what strangers will see"/>

                        <Field label="Password" type="password" placeholder="make it hard to guess"
                          value={sPass} onChange={v=>{setSPass(v);setSErr(e=>({...e,pass:""}));}} error={sErr.pass}/>

                        {sPass&&(
                          <div style={{marginTop:-12,marginBottom:18}}>
                            <div style={{display:"flex",gap:4,marginBottom:5}}>
                              {[1,2,3,4].map(i=>(
                                <div key={i} className="str-bar" style={{flex:1,background:i<=str.score?str.color:"rgba(255,255,255,.06)"}}/>
                              ))}
                            </div>
                            <div style={{fontSize:11,color:str.color,fontFamily:"'JetBrains Mono',monospace"}}>{str.label}</div>
                          </div>
                        )}

                        <Field label="Confirm Password" type="password" placeholder="same again"
                          value={sConf} onChange={v=>{setSConf(v);setSErr(e=>({...e,conf:""}));}} error={sErr.conf}/>

                        {/* agree checkbox */}
                        <div style={{marginBottom:22}}>
                          <div onClick={()=>setAgree(a=>!a)} style={{display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}}>
                            <div style={{width:20,height:20,borderRadius:6,flexShrink:0,marginTop:2,border:`1px solid ${agree?"#00f5a0":"rgba(255,255,255,.12)"}`,background:agree?"rgba(0,245,160,.12)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",fontSize:12,color:"#00f5a0"}}>
                              {agree?"✓":""}
                            </div>
                            <span style={{fontSize:13,color:"#555",lineHeight:1.5}}>
                              I agree to the <span style={{color:"#00d4ff",cursor:"pointer"}}>terms</span> and <span style={{color:"#00d4ff",cursor:"pointer"}}>privacy policy</span>. I'm at least 13 years old.
                            </span>
                          </div>
                          {sErr.agree&&<div style={{fontSize:12,color:"#ff4d6d",marginTop:6,fontFamily:"'JetBrains Mono',monospace"}}>{sErr.agree}</div>}
                        </div>

                        <div style={{display:"flex",gap:10}}>
                          <button onClick={()=>{setStep(1);setSMsg("");}} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"16px 20px",color:"#666",cursor:"pointer",fontSize:20}}>←</button>
                          <button className="sp-btn" onClick={handleSignup} disabled={sLoad} style={{flex:1}}>
                            {sLoad?<><Spinner/>CREATING...</>:"CREATE ACCOUNT →"}
                          </button>
                        </div>

                        <div style={{marginTop:24,textAlign:"center",fontSize:13,color:"#444",fontFamily:"'JetBrains Mono',monospace"}}>
                          already have one?{" "}
                          <button onClick={()=>switchMode("login")} style={{background:"none",border:"none",color:"#00f5a0",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>sign in →</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


