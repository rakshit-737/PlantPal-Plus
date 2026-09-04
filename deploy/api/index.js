// GENERATED FILE — do not edit, and do not review as source.
// Built from apps/api/edge/index.ts by apps/api/edge/build.mjs.
// Committed deliberately: the deployed edge function loads it from this
// repository over a CDN. See deploy/README.md.
var it=Object.defineProperty;var o=(e,t)=>it(e,"name",{value:t,configurable:!0});var ds=(e,t)=>()=>(e&&(t=e(e=0)),t);var _s=(e,t)=>{for(var r in t)it(e,r,{get:t[r],enumerable:!0})};var mt={};_s(mt,{getPool:()=>_,initPool:()=>Le,setPoolForTesting:()=>Ts,transaction:()=>R});import As from"npm:pg@8.13.1";function Le(e,t=10,r){return j=new As.Pool({connectionString:e,max:t,idleTimeoutMillis:3e4,
connectionTimeoutMillis:15e3,...r===void 0?{}:{ssl:r}}),j.on("error",n=>{console.error({err:n},"postgres pool client error")}),j}function _(){if(!j)throw new Error("Database pool not initialised. Call\
 initPool() at boot.");return j}async function R(e){let t=await _().connect();try{await t.query("BEGIN");let r=await e(t);return await t.query("COMMIT"),r}catch(r){try{await t.query("ROLLBACK")}catch{}
throw r}finally{t.release()}}function Ts(e){j=e}var j,k=ds(()=>{"use strict";o(Le,"initPool");o(_,"getPool");o(R,"transaction");o(Ts,"setPoolForTesting")});import{createHmac as ci}from"node:crypto";import di from"node:process";import _i from"npm:express@4.21.2";import Ko from"npm:cors@2.8.5";import zo from"npm:cookie-parser@1.4.7";import Br from"npm:express@4.21.2";import Qo from"npm:helmet@8.0.0";import{Router as Ns}from"npm:express@4.21.2";import{createHash as bs}from"node:crypto";import{z as S}from"npm:zod@3.24.1";var ms=S.object({NODE_ENV:S.enum(["development","test","production"]).default("development"),PORT:S.coerce.number().int().min(1).max(65535).default(3e3),DATABASE_URL:S.string().url().describe("Postgre\
SQL connection string"),JWT_ACCESS_SECRET:S.string().min(32,"JWT_ACCESS_SECRET must be at least 32 characters"),AUDIT_PEPPER:S.string().min(32,"AUDIT_PEPPER must be at least 32 characters").optional(),
CORS_ORIGINS:S.string().default("http://localhost:5173").transform(e=>e.split(",").map(t=>t.trim()).filter(Boolean)),LOG_LEVEL:S.enum(["fatal","error","warn","info","debug","trace"]).default("info"),REFRESH_COOKIE_PATH:S.
string().startsWith("/").default("/api/auth")}),oe;function at(e=process.env){let t=ms.safeParse(e);if(!t.success){let r=t.error.errors.map(n=>`  - ${n.path.join(".")||"(root)"}: ${n.message}`).join(`\

`);throw new Error(`Invalid environment configuration:
${r}`)}if(t.data.NODE_ENV==="production"&&t.data.CORS_ORIGINS.includes("*"))throw new Error('CORS_ORIGINS must not contain "*" in production (NFR-SEC-06)');return t.data}o(at,"loadEnv");function ut(e=process.
env){return oe=at(e),oe}o(ut,"configureEnv");function F(){return oe??=at(),oe}o(F,"env");var ie={VALIDATION_FAILED:{status:422,messageKey:"errors.validation_failed"},MALFORMED_REQUEST:{status:400,messageKey:"errors.malformed_request"},AUTHENTICATION_REQUIRED:{status:401,messageKey:"errors\
.authentication_required"},INVALID_CREDENTIALS:{status:401,messageKey:"errors.invalid_credentials"},TOKEN_EXPIRED:{status:401,messageKey:"errors.token_expired"},TOKEN_INVALID:{status:401,messageKey:"e\
rrors.token_invalid"},TOKEN_REUSE_DETECTED:{status:401,messageKey:"errors.token_reuse_detected"},EMAIL_NOT_VERIFIED:{status:403,messageKey:"errors.email_not_verified"},FORBIDDEN:{status:403,messageKey:"\
errors.forbidden"},ACCOUNT_LOCKED:{status:403,messageKey:"errors.account_locked"},ACC_UNDERAGE:{status:403,messageKey:"errors.acc_underage"},NOT_FOUND:{status:404,messageKey:"errors.not_found"},CONFLICT:{
status:409,messageKey:"errors.conflict"},CURSOR_EXPIRED:{status:410,messageKey:"errors.cursor_expired"},PAYLOAD_TOO_LARGE:{status:413,messageKey:"errors.payload_too_large"},UNSUPPORTED_MEDIA_TYPE:{status:415,
messageKey:"errors.unsupported_media_type"},RATE_LIMITED:{status:429,messageKey:"errors.rate_limited"},ACC_ACCOUNT_LOCKED:{status:429,messageKey:"errors.rate_limited"},INTERNAL_ERROR:{status:500,messageKey:"\
errors.internal_error"},UPSTREAM_ERROR:{status:502,messageKey:"errors.upstream_error"},SERVICE_UNAVAILABLE:{status:503,messageKey:"errors.service_unavailable"},UPSTREAM_TIMEOUT:{status:504,messageKey:"\
errors.upstream_timeout"}},m=class extends Error{static{o(this,"AppError")}code;status;messageKey;details;context;constructor(t,r,n){super(r,n?.cause!==void 0?{cause:n.cause}:void 0),this.name="AppErr\
or",this.code=t,this.status=ie[t].status,this.messageKey=ie[t].messageKey,this.details=n?.details,this.context=n?.context}},x=o((e,t)=>new m("VALIDATION_FAILED",e,t?{details:t}:void 0),"badRequest");var N=o((e="That resource could not be found.")=>new m("NOT_FOUND",e),"notFound");import ps from"npm:pino@9.5.0";var gs=typeof globalThis.Deno<"u",fs=gs?{write(e){console.log(e.endsWith(`
`)?e.slice(0,-1):e)}}:void 0,h=ps({level:process.env.LOG_LEVEL??"info",redact:{paths:["password","passwordHash","password_hash","*.password","*.passwordHash","*.password_hash","refreshToken","refresh_\
token","*.refreshToken","*.refresh_token","authorization","req.headers.authorization","req.headers.cookie"],censor:"[redacted]"},base:{service:"plantpal-api"}},fs);import{createHash as ys,randomBytes as ws,timingSafeEqual as bi}from"node:crypto";import Ce from"npm:jsonwebtoken@9.0.2";var hs=900,Es=720*60*60,Rs=32,lt=10,ct="plantpal-api",dt="plantpal-clients";function $e(e,t,r,n=1,s=Math.floor(Date.now()/1e3)){let a={sub:e,sid:t,ver:n,jti:crypto.randomUUID(),iss:ct,aud:dt,iat:s,exp:s+
hs};return Ce.sign(a,r,{algorithm:"HS256"})}o($e,"signAccessToken");function _t(e,t){try{let r=Ce.verify(e,t,{algorithms:["HS256"]});return r.iss!==void 0&&r.iss!==ct||r.aud!==void 0&&r.aud!==dt?{ok:!1,
reason:"invalid"}:{ok:!0,claims:r}}catch(r){return r instanceof Ce.TokenExpiredError?{ok:!1,reason:"expired"}:{ok:!1,reason:"invalid"}}}o(_t,"verifyAccessToken");function ae(){let e=ws(Rs).toString("b\
ase64url");return{token:e,digest:H(e)}}o(ae,"issueRefreshToken");function H(e){return ys("sha256").update(e,"utf8").digest("hex")}o(H,"digestRefreshToken");function ue(e=new Date){return new Date(e.getTime()+Es*1e3)}o(ue,"refreshTokenExpiresAt");k();async function pt(e){return await R(async t=>{let{rows:[r]}=await t.query(`insert into users (email, email_normalised, password_hash, minimum_age_confirmed)
       values ($1, lower(trim($1)), $2, $3)
       on conflict (email_normalised) do nothing
       returning id, email, status`,[e.email,e.passwordHash,e.confirmedAge]);if(!r)throw Object.assign(new Error("That email address is already registered."),{code:"CONFLICT",status:409,__appError:!0});
let n=e.email.split("@")[0].slice(0,60);return await t.query(`insert into profiles (user_id, display_name)
       values ($1, $2)`,[r.id,n]),await t.query("insert into user_settings (user_id) values ($1)",[r.id]),r})}o(pt,"createUser");async function gt(e){let t=_(),{rows:r}=await t.query(`select id, email\
, status, password_hash, token_version,
            failed_login_count, locked_until, created_at,
            email_verified_at, deletion_requested_at, purge_after
     from users where email_normalised = $1 and status <> 'DELETED'`,[e]);return r[0]??null}o(gt,"findUserForAuth");async function ft(e){let t=_(),{rows:r}=await t.query("select id, email, status from\
 users where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(ft,"findUserById");async function Pe(e,t){if(!t)return R(c=>Pe(e,c));let r=t,n=ue(),s=e.installationId,a=crypto.randomUUID(),{token:i,
digest:u}=ae(),{rows:[l]}=await r.query(`select count(*)::text from auth_sessions
     where user_id = $1 and status = 'ACTIVE'`,[e.userId]);return Number(l?.count??0)>=lt&&await r.query(`update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'FAMILY_CAP_REACHED'
       where id = (
         select id from auth_sessions
         where user_id = $1 and status = 'ACTIVE'
         order by last_used_at asc nulls first
         limit 1
       )`,[e.userId]),await r.query(`insert into auth_sessions
       (id, user_id, token_family_id, refresh_token_hash, status, platform,
        client_installation_id, device_label, ip_address_hash, user_agent,
        expires_at)
     values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9, $10)`,[a,e.userId,s,u,e.platform,e.installationId,e.deviceLabel,e.ipAddressHash,e.userAgent,n]),await r.query(`insert into auth_tokens
       (user_id, session_id, token_family_id, parent_id, generation,
        refresh_token_digest, expires_at, family_created_at)
     values ($1, $2, $3, null, 1, $4, $5, now())`,[e.userId,a,s,u,n]),{sessionId:a,tokenFamilyId:s,refreshToken:i,refreshTokenDigest:u}}o(Pe,"createSession");async function yt(e,t){await(t??_()).query(
`update users set failed_login_count = 0, locked_until = null, last_login_at = now()
     where id = $1`,[e])}o(yt,"recordLoginSuccess");async function C(e,t,r){await _().query(`insert into login_attempts (email_normalised, ip_prefix, outcome)
     values ($1, $2, $3)`,[e,t,r])}o(C,"recordLoginAttempt");async function wt(e){let t=_(),{rows:[r]}=await t.query(`select count(*)::text as failures, max(attempted_at)::text as last_failure_at
     from login_attempts
     where email_normalised = $1
       and outcome in ('BAD_PASSWORD', 'NO_ACCOUNT')
       and attempted_at > coalesce(
         (select max(attempted_at) from login_attempts
          where email_normalised = $1 and outcome = 'SUCCESS'),
         now() - interval '24 hours'
       )
       and attempted_at > now() - interval '24 hours'`,[e]),n=Number(r?.failures??"0"),s=r?.last_failure_at?new Date(r.last_failure_at):null,a=n>=5?Math.min(60*Math.pow(2,n-5),1800):0;return{failures:n,
lockSeconds:a,lastFailureAt:s}}o(wt,"computeLockoutState");async function Ue(e){await _().query(`update users set failed_login_count = failed_login_count + 1
     where email_normalised = $1`,[e])}o(Ue,"recordFailedLogin");async function ht(e,t){let r=t??_(),{rows:n}=await r.query(`select t.id, t.session_id as "sessionId", t.token_family_id as "tokenFamily\
Id",
            t.generation, t.refresh_token_digest as "refreshTokenDigest",
            t.consumed_at as "consumedAt", t.expires_at as "expiresAt",
            t.user_id as "userId", u.token_version as "tokenVersion"
     from auth_tokens t
     join users u on u.id = t.user_id
     join auth_sessions s on s.id = t.session_id
     where t.refresh_token_digest = $1
       and t.consumed_at is null
       and t.expires_at > now()
       -- BR-ACC-07 clause 6: absolute 180-day family lifetime, regardless of
       -- how recently the chain rotated (expires_at alone re-arms every use).
       and t.family_created_at > now() - interval '180 days'
       and s.status = 'ACTIVE'
       -- BR-ACC-20 clause 2: a scheduled deletion must not disable refresh --
       -- only a purge instant that has already elapsed does. See the note above.
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(ht,"findActiveTokenByDigest");async function Et(e,t){let r=t??_(),{rows:n}=await r.query(`select t.id, t.session_i\
d as "sessionId", t.token_family_id as "tokenFamilyId",
            t.generation, t.refresh_token_digest as "refreshTokenDigest",
            t.consumed_at as "consumedAt", t.expires_at as "expiresAt",
            t.user_id as "userId", u.token_version as "tokenVersion"
     from auth_tokens t
     join users u on u.id = t.user_id
     join auth_sessions s on s.id = t.session_id
     where t.refresh_token_digest = $1
       and t.expires_at > now()
       -- BR-ACC-07 clause 6: absolute 180-day family lifetime, regardless of
       -- how recently the chain rotated (expires_at alone re-arms every use).
       and t.family_created_at > now() - interval '180 days'
       and s.status = 'ACTIVE'
       -- BR-ACC-20 clause 2, as above: block only once the purge instant has
       -- passed. Kept identical to findActiveTokenByDigest on purpose \u2014 the
       -- refresh path falls through from that probe to this one, so a
       -- divergence here would make a replay 401 as TOKEN_EXPIRED instead of
       -- reaching reuse detection.
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(Et,"findTokenByDigestAnyState");async function Rt(e){let t=_(),{rows:r}=await t.query("select password_hash from u\
sers where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(Rt,"findPasswordHashById");async function At(e,t,r,n){let s=await R(async a=>{let{rowCount:i}=await a.query(`update auth_tokens
       set consumed_at = now()
       where id = $1 and consumed_at is null`,[e]);if(i===0){let{rows:[d]}=await a.query(`select (now() - consumed_at) <= interval '15 seconds' as in_grace, generation
         from auth_tokens where id = $1`,[e]);if(d?.in_grace){let{rows:f}=await a.query(`update auth_tokens set consumed_at = now()
           where parent_id = $1 and consumed_at is null
           returning id`,[e]);if(f.length>0){let y=ue(),{token:b}=ae(),T=H(b);return await a.query(`insert into auth_tokens
               (user_id, session_id, token_family_id, parent_id, generation,
                refresh_token_digest, expires_at, family_created_at)
             values ($1, $2, $3, $4,
                     (select generation + 1 from auth_tokens where id = $4),
                     $5, $6,
                     (select family_created_at from auth_tokens where id = $4))`,[n,r,t,e,T,y]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:b,refreshTokenDigest:T}}}}return await ks(a,
t,r,"REUSE_DETECTED"),{kind:"reuse"}}let u=ue(),{token:l}=ae(),c=H(l);return await a.query(`insert into auth_tokens
         (user_id, session_id, token_family_id, parent_id, generation,
          refresh_token_digest, expires_at, family_created_at)
       values ($1, $2, $3, $4,
               (select generation + 1 from auth_tokens where id = $4),
               $5, $6,
               (select family_created_at from auth_tokens where id = $4 for share))`,[n,r,t,e,c,u]),await a.query(`update auth_sessions set last_used_at = now()
       where id = $1 and (last_used_at is null or last_used_at < now() - interval '60 seconds')`,[r]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:l,refreshTokenDigest:c}}});if(s.kind===
"reuse")throw Object.assign(new Error("Token reuse detected. All sessions on this device have been signed out."),{code:"TOKEN_REUSE_DETECTED",status:401,__appError:!0});return s.session}o(At,"consumeA\
ndRotateToken");async function ks(e,t,r,n){await e.query(`update auth_sessions
     set status = 'REVOKED', revoked_at = now(), revoke_reason = $2
     where token_family_id = $1 and status = 'ACTIVE'`,[t,n]),await e.query(`update auth_tokens
     set consumed_at = coalesce(consumed_at, now())
     where token_family_id = $1 and consumed_at is null`,[t])}o(ks,"revokeTokenFamily");var Tt="$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";import xt from"npm:bcryptjs@2.4.3";var kt=12,bt=128,B=Object.freeze({memoryCost:19456,timeCost:2,parallelism:1,outputLen:32,saltLength:16}),It=12,X;async function Dt(){if(X!==void 0)return X;try{X=await import("npm:@node-rs/argon2@2.0.2"),h.info(
{backend:"argon2id",params:B},"password hashing backend selected")}catch{X=null,h.warn({backend:"bcrypt",cost:It},"Argon2 unavailable, using the documented bcrypt fallback of NFR-SEC-03")}return X}o(Dt,
"getArgon2");var le=class extends Error{static{o(this,"PasswordPolicyError")}};function Me(e){let t=[...e].length;if(t<kt)throw new le(`Password must be at least ${kt} characters.`);if(t>bt)throw new le(
`Password must be at most ${bt} characters.`)}o(Me,"assertPasswordPolicy");async function Nt(e){Me(e);let t=await Dt();return t?t.hash(e,{memoryCost:B.memoryCost,timeCost:B.timeCost,parallelism:B.parallelism,
outputLen:B.outputLen,saltLength:B.saltLength}):xt.hash(e,It)}o(Nt,"hashPassword");async function ce(e,t){try{if(t.startsWith("$argon2")){let r=await Dt();return r?await r.verify(t,e):(h.error("an Arg\
on2 hash was stored but no Argon2 backend is available"),!1)}return t.startsWith("$2")?await xt.compare(e,t):(h.error("stored password hash is in an unrecognised format"),!1)}catch{return!1}}o(ce,"ver\
ifyPassword");function vt(e){return e.trim().toLowerCase()}o(vt,"normaliseEmail");function xs(e){let t=e.ip??"0.0.0.0";return t.includes(":")?t.split(":").slice(0,3).join(":")+"::":t.split(".").slice(0,3).join(".")+
".0"}o(xs,"ipPrefix");function Is(e){let t=e.header("x-plantpal-device");return t&&t.replace(/[\x00-\x1f]/g,"").replace(/\s+/g," ").trim().slice(0,120)||null}o(Is,"deviceLabel");function qe(e){let t=e.
header("x-plantpal-client");return t==="IOS"||t==="ANDROID"||t==="WEB"?t:"WEB"}o(qe,"platform");function Fe(){return F().JWT_ACCESS_SECRET}o(Fe,"accessSecret");var Ds=250;async function St(e,t=Ds){let r=t-
(Date.now()-e);r>0&&await new Promise(n=>setTimeout(n,r))}o(St,"enforceTimingFloor");function Ot(){return{httpOnly:!0,secure:!0,sameSite:"none",path:F().REFRESH_COOKIE_PATH,maxAge:720*60*60*1e3}}o(Ot,
"refreshCookieOptions");function Ct(e){if(!!!e.cookies?.refresh_token)return;let r=e.get("origin");if(!r){let n=e.get("referer");if(n)try{r=new URL(n).origin}catch{r=void 0}}if(!r||!F().CORS_ORIGINS.includes(
r))throw new m("FORBIDDEN","Cross-origin session request refused.")}o(Ct,"assertTrustedOriginForCookieAuth");async function $t(e,t,r){let n=Date.now();try{let{email:s,password:a,confirmed_age:i}=e.body,
u=[],l=s?vt(s):"";if((!s||s.length<5||s.length>254||!s.includes("@"))&&u.push({field:"email",issue:"invalid"}),!a)u.push({field:"password",issue:"required"});else try{Me(a)}catch{u.push({field:"passwo\
rd",issue:"policy_violation"})}if(i!==!0&&u.push({field:"confirmed_age",issue:"must_be_confirmed"}),u.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:u});let c=await Nt(
a);try{await pt({email:s,passwordHash:c,confirmedAge:i})}catch(d){if(!(d&&typeof d=="object"&&"__appError"in d))throw d}h.info({email_digest:bs("sha256").update(l).digest("hex").slice(0,16)},"registra\
tion attempt"),await St(n),t.status(202).json({status:"registered",message:"Check your email for a confirmation link."})}catch(s){r(s)}}o($t,"register");async function Lt(e,t,r){let n=Date.now();try{let{
email:s,password:a}=e.body;if(!s||!a)throw new m("VALIDATION_FAILED","Email and password are required.",{details:[...s?[]:[{field:"email",issue:"required"}],...a?[]:[{field:"password",issue:"required"}]]});
let i=vt(s),u=xs(e),l=await wt(i);if(l.failures>=5){let q=(l.lastFailureAt?.getTime()??Date.now())+l.lockSeconds*1e3;if(q>Date.now()){let Q=Math.ceil((q-Date.now())/1e3);throw await C(i,u,"LOCKED_OUT"),
t.setHeader("Retry-After",String(Q)),new m("ACC_ACCOUNT_LOCKED",`Too many attempts. Try again in ${Q} seconds.`,{context:{retry_after_seconds:Q}})}}let c=await gt(i),d=c?.password_hash??Tt,f=await ce(
a,d);if(await St(n),!c||!c.password_hash)throw await C(i,u,"NO_ACCOUNT"),i&&await Ue(i),new m("INVALID_CREDENTIALS","That email or password is not right.");if(!f)throw await C(i,u,"BAD_PASSWORD"),await Ue(
i),new m("INVALID_CREDENTIALS","That email or password is not right.");let y=new Date;if(c.locked_until&&c.locked_until>y)throw await C(i,u,"LOCKED_OUT"),new m("ACCOUNT_LOCKED","Account is locked.");if(c.
purge_after&&c.purge_after<=y)throw await C(i,u,"NO_ACCOUNT"),new m("INVALID_CREDENTIALS","That email or password is not right.");if(c.status==="PENDING_VERIFICATION"&&c.created_at.getTime()+6048e5<y.
getTime())throw await C(i,u,"UNVERIFIED"),new m("EMAIL_NOT_VERIFIED","Confirm your email address to sign in.",{context:{resend_available:!0}});let b=crypto.randomUUID(),T=await Pe({userId:c.id,platform:qe(
e),installationId:b,deviceLabel:Is(e),ipAddressHash:u,userAgent:(e.get("user-agent")??"").slice(0,200)});await yt(c.id),await C(i,u,"SUCCESS");let M={access_token:$e(c.id,T.sessionId,Fe(),c.token_version),
token_type:"Bearer",expires_in:900,user:{id:c.id,email:c.email,status:c.status}};qe(e)==="WEB"?t.cookie("refresh_token",T.refreshToken,Ot()):M.refresh_token=T.refreshToken,c.status==="PENDING_DELETION"&&
(M.account_pending_deletion=!0,M.deletion_scheduled_at=c.purge_after?.toISOString()),t.status(200).json(M)}catch(s){r(s)}}o(Lt,"login");async function Pt(e,t,r){try{Ct(e);let n=e.cookies?.refresh_token??
e.body?.refresh_token;if(!n)throw new m("AUTHENTICATION_REQUIRED","No refresh token provided.");let s=H(n),a=await ht(s)??await Et(s);if(!a)throw new m("TOKEN_EXPIRED","Session expired. Please sign in\
 again.");let i=await At(a.id,a.tokenFamilyId,a.sessionId,a.userId),u=$e(a.userId,a.sessionId,Fe(),a.tokenVersion),l=qe(e)==="WEB",c={access_token:u,token_type:"Bearer",expires_in:900};l?t.cookie("ref\
resh_token",i.refreshToken,Ot()):c.refresh_token=i.refreshToken,t.status(200).json(c)}catch(n){r(n)}}o(Pt,"refresh");async function Ut(e,t,r){try{Ct(e);let n=e.cookies?.refresh_token??e.body?.refresh_token;
if(n){let s=H(n),a=(await Promise.resolve().then(()=>(k(),mt))).getPool();await a.query(`update auth_tokens
         set consumed_at = coalesce(consumed_at, now())
         where refresh_token_digest = $1 and consumed_at is null`,[s]),await a.query(`update auth_sessions s
         set status = 'REVOKED', revoked_at = now(), revoke_reason = 'USER_LOGOUT'
         from auth_tokens t
         where t.session_id = s.id
           and t.refresh_token_digest = $1
           and s.status = 'ACTIVE'`,[s])}t.clearCookie("refresh_token",{path:F().REFRESH_COOKIE_PATH}),t.status(200).json({status:"logged_out"})}catch(n){r(n)}}o(Ut,"logout");async function Mt(e,t,r){
try{let n=e.userId,s=n?await ft(n):null;if(!s)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");t.status(200).json({user:s})}catch(n){r(n)}}o(Mt,"me");async function E(e,t,r){try{let n=e.
header("authorization");if(!n?.startsWith("Bearer "))throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");let s=n.slice(7),a=Fe(),i=_t(s,a);if(!i.ok)throw new m(i.reason==="expired"?"T\
OKEN_EXPIRED":"TOKEN_INVALID",i.reason==="expired"?"Access token expired. Refresh to continue.":"Invalid access token.");e.userId=i.claims.sub,e.sessionId=i.claims.sid,r()}catch(n){r(n)}}o(E,"authenti\
cate");function qt(e){let t=new Map;return o(function(n,s,a){let i=Date.now();if(t.size>1e4)for(let[c,d]of t)d.resetAt<=i&&t.delete(c);let u=n.ip??"unknown",l=t.get(u);if(!l||l.resetAt<=i){t.set(u,{count:1,resetAt:i+
e.windowMs}),a();return}if(l.count+=1,l.count>e.max){s.setHeader("Retry-After",String(Math.ceil((l.resetAt-i)/1e3))),a(new m("RATE_LIMITED","Too many requests. Slow down."));return}a()},"rateLimitMidd\
leware")}o(qt,"rateLimit");var V=Ns();process.env.NODE_ENV!=="test"&&V.use(qt({windowMs:6e4,max:30}));V.post("/register",$t);V.post("/login",Lt);V.post("/refresh",Pt);V.post("/logout",Ut);V.get("/me",E,Mt);var Ft=V;import{Router as Js}from"npm:express@4.21.2";import{z as W}from"npm:zod@3.24.1";function g(e){let t=e.userId;if(typeof t!="string"||t.length===0)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");return t}o(g,"getUserId");function A(...e){return Object.freeze(Object.fromEntries(e.map(t=>[t,t])))}o(A,"asEnum");var He=A("NORTHERN","SOUTHERN","EQUATORIAL"),w=A("SPRING","SUMMER","AUTUMN","WINTER","YEAR_ROUND"),sa=A("METRIC",
"IMPERIAL"),J=A("LOW","MEDIUM","BRIGHT_INDIRECT","DIRECT_SUN"),$=A("FABRIC","TERRACOTTA","CONCRETE","CERAMIC_GLAZED","METAL","PLASTIC","OTHER"),O=A("ORCHID_BARK","CACTUS_SUCCULENT","GARDEN_SOIL","STAN\
DARD_POTTING","PEAT_BASED","COCO_COIR","SEMI_HYDRO_LECA","OTHER"),de=A("INDOOR","OUTDOOR"),Z=A("NONE","HEATED_DRY_WINTER","AIR_CONDITIONED","HUMID_ROOM"),oa=A("THRIVING","NEEDS_ATTENTION","CRITICAL","\
DORMANT"),ia=A("WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"),aa=A("LOW","MODERATE","VIGOROUS"),ua=A("HEAVIEST_WEIGHT","BEST_ESTIMATED_1RM","BEST_REP_COUNT"),la=A("BREAKFAST","L\
UNCH","DINNER","SNACK"),_e=A("MALE","FEMALE","PREFER_NOT_TO_SAY"),Y=A("SEDENTARY","LIGHTLY_ACTIVE","MODERATELY_ACTIVE","VERY_ACTIVE","EXTRA_ACTIVE"),ca=A("LOSE","MAINTAIN","GAIN"),da=A("GRAM","MILLILI\
TRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"),_a=A("SYNCED","PENDING","SYNCING","FAILED"),ma=A("PENDING","SENT","DELIVERED","FAILED","SUPPRESSED","CANCELLED");function Ve(e){if(!Number.isFinite(e))throw new RangeError(`roundHalfUp expected a finite number, received ${e}`);return Math.sign(e)*Math.floor(Math.abs(e)+.5)}o(Ve,"roundHalfUp");function K(e,t){if(!Number.
isFinite(e))throw new RangeError(`roundTo expected a finite number, received ${e}`);if(!Number.isInteger(t)||t<0||t>10)throw new RangeError(`roundTo expected 0..10 decimals, received ${t}`);let r=10**
t;return Math.sign(e)*Math.floor(Math.abs(e)*r+.5)/r}o(K,"roundTo");function Ht(e,t,r){if(t>r)throw new RangeError(`clamp received an inverted range: min ${t} exceeds max ${r}`);return Math.min(Math.max(
e,t),r)}o(Ht,"clamp");var vs=[w.WINTER,w.WINTER,w.SPRING,w.SPRING,w.SPRING,w.SUMMER,w.SUMMER,w.SUMMER,w.AUTUMN,w.AUTUMN,w.AUTUMN,w.WINTER],Ss=Object.freeze({[w.WINTER]:w.SUMMER,[w.SUMMER]:w.WINTER,[w.SPRING]:w.AUTUMN,[w.AUTUMN]:w.
SPRING,[w.YEAR_ROUND]:w.YEAR_ROUND});function Os(e,t){if(t===He.EQUATORIAL)return w.YEAR_ROUND;let r=vs[e-1];if(r===void 0)throw new RangeError(`seasonForMonth expected a month in 1..12, received ${e}`);
return t===He.NORTHERN?r:Ss[r]}o(Os,"seasonForMonth");function Vt(e,t){let r=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!r?.[2])throw new RangeError(`seasonForLocalDate expected a YYYY-MM-DD date, receive\
d "${e}"`);let n=Number(r[2]);if(n<1||n>12)throw new RangeError(`seasonForLocalDate received an out-of-range month in "${e}"`);return Os(n,t)}o(Vt,"seasonForLocalDate");var Cs=Object.freeze({[w.SPRING]:.95,[w.SUMMER]:.8,[w.AUTUMN]:1.15,[w.WINTER]:1.4,[w.YEAR_ROUND]:1}),$s=Object.freeze({[J.LOW]:1.25,[J.MEDIUM]:1.1,[J.BRIGHT_INDIRECT]:1,[J.DIRECT_SUN]:.85}),Ls=Object.
freeze({[$.FABRIC]:.75,[$.TERRACOTTA]:.8,[$.CONCRETE]:.9,[$.CERAMIC_GLAZED]:1,[$.OTHER]:1,[$.METAL]:1.05,[$.PLASTIC]:1.1}),Ps=Object.freeze({[O.ORCHID_BARK]:.75,[O.CACTUS_SUCCULENT]:.85,[O.GARDEN_SOIL]:.95,
[O.STANDARD_POTTING]:1,[O.OTHER]:1,[O.PEAT_BASED]:1.1,[O.COCO_COIR]:1.1,[O.SEMI_HYDRO_LECA]:1.3}),Us=Object.freeze({[de.INDOOR]:1,[de.OUTDOOR]:.85}),Ms=Object.freeze({[Z.HEATED_DRY_WINTER]:.85,[Z.AIR_CONDITIONED]:.9,
[Z.NONE]:1,[Z.HUMID_ROOM]:1.2});function qs(e){if(e==null)return 1;if(!Number.isFinite(e)||e<=0)throw new RangeError(`potDiameterFactor expected a positive diameter, received ${e}`);return e<10?.8:e<15?
.9:e<20?1:e<30?1.15:e<40?1.3:1.45}o(qs,"potDiameterFactor");function Fs(e){return e===!1?1.15:1}o(Fs,"drainageFactor");function Wt(e){let{baseIntervalDays:t,minIntervalDays:r,maxIntervalDays:n,season:s,
lightExposure:a,placement:i}=e;if(!Number.isFinite(t)||t<=0)throw new RangeError(`baseIntervalDays must be positive, received ${t}`);if(r>n)throw new RangeError(`species bounds are inverted: min ${r} \
exceeds max ${n}`);let u=Cs[s],l=$s[a],c=e.potMaterial?Ls[e.potMaterial]:1,d=qs(e.potDiameterCm),f=Fs(e.hasDrainage),y=c*d*f,b=Us[i],T=e.soilType?Ps[e.soilType]:1,D=i===de.OUTDOOR?1:e.indoorClimate?Ms[e.
indoorClimate]:1,M=b*T*D,Se=t*u*l*y*M,q=Ve(Se),Q=Ht(q,r,n),cs=Math.max(Q,1),Oe=null;return q<r?Oe="MIN":q>n&&(Oe="MAX"),{baseIntervalDays:t,season:s,fSeason:u,lightExposure:a,fLight:l,fPot:y,fMaterial:c,
fDiameter:d,fDrainage:f,fEnv:M,fPlacement:b,fSoil:T,fClimate:D,rawInterval:Se,effectiveIntervalDays:cs,clamped:Oe}}o(Wt,"computeWateringInterval");var Ia=Object.freeze({protein:4,carbohydrate:4,fat:9});var Da=Object.freeze({[_e.MALE]:5,[_e.FEMALE]:-161,[_e.PREFER_NOT_TO_SAY]:-78}),Na=Object.freeze({[Y.SEDENTARY]:1.2,[Y.LIGHTLY_ACTIVE]:1.375,[Y.MODERATELY_ACTIVE]:1.55,[Y.VERY_ACTIVE]:1.725,[Y.EXTRA_ACTIVE]:1.9}),
va=Object.freeze({bodyMassKg:{min:30,max:400},heightCm:{min:100,max:250},ageYears:{min:16,max:120}});function me(e,t,r){if(!Number.isFinite(e)||e<1||e>23)throw new RangeError(`metValue must be between 1.0 and 23.0, received ${e}`);if(!Number.isFinite(t)||t<=0)throw new RangeError(`bodyMassKg must be \
positive, received ${t}`);if(!Number.isFinite(r)||r<=0)throw new RangeError(`durationMinutes must be positive, received ${r}`);return K(e*t*r/60,1)}o(me,"workoutEnergyKcal");var Gt=Object.freeze({min:1,
max:12});function pe(e,t){if(!Number.isFinite(e)||e<0)throw new RangeError(`weightKg must be non-negative, received ${e}`);if(!Number.isInteger(t)||t<1)throw new RangeError(`reps must be a positive in\
teger, received ${t}`);if(e===0)return 0;let r=t===1?e:e*(1+t/30);return K(r,1)}o(pe,"estimatedOneRepMax");function ge(e,t){return e>0&&Number.isInteger(t)&&t>=Gt.min&&t<=Gt.max}o(ge,"isEligibleForOne\
RepMaxRecord");function fe(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError(`reps must be a non-negative integer, received ${e}`);if(!Number.isFinite(t)||t<0)throw new RangeError(`weightKg must \
be non-negative, received ${t}`);return K(e*t,1)}o(fe,"setVolumeKg");function ye(e){let t=e.reduce((r,n)=>r+n.reps*n.weightKg,0);return K(t,1)}o(ye,"totalVolumeKg");var We=/^\d{4}-\d{2}-\d{2}$/;function Hs(e,t){if(!We.test(e)||!We.test(t))throw new RangeError("local dates must be YYYY-MM-DD");return Math.round((Date.parse(t)-Date.parse(e))/864e5)}o(Hs,"localDateD\
iffDays");function jt(e,t){if(!We.test(t))throw new RangeError("todayLocalDate must be YYYY-MM-DD");if(e.lastCountedDate===null)return{...e,currentLength:1,longestLength:Math.max(e.longestLength,1),lastCountedDate:t};
let r=Hs(e.lastCountedDate,t);if(r<=0)return e;if(r===1){let s=e.currentLength+1;return{...e,currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t}}let n=r-1;if(n<=e.freezeTokens){
let s=e.currentLength+1;return{currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t,freezeTokens:e.freezeTokens-n}}return{...e,currentLength:1,longestLength:Math.max(e.longestLength,
1),lastCountedDate:t}}o(jt,"advanceStreakOnLog");k();function Vs(e){return{currentLength:e?.current_length??0,longestLength:e?.longest_length??0,lastCountedDate:e?.last_counted_date??null,freezeTokens:e?.freeze_tokens??0}}o(Vs,"toState");async function Bt(e,t,r,n){
await e.query(`insert into streaks (user_id, streak_type)
     values ($1, $2)
     on conflict (user_id, streak_type) do nothing`,[t,r]);let{rows:s}=await e.query(`select current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1 and streak_type = $2
     for update`,[t,r]),a=jt(Vs(s[0]),n);return await e.query(`update streaks
     set current_length = $3, longest_length = $4, last_counted_date = $5,
         freeze_tokens = $6, updated_at = now()
     where user_id = $1 and streak_type = $2`,[t,r,a.currentLength,a.longestLength,a.lastCountedDate,a.freezeTokens]),a}o(Bt,"advanceScope");var Yt={plants_added:"select count(*)::int as v from plants\
 where user_id = $1",active_plants:"select count(*)::int as v from plants where user_id = $1 and deleted_at is null",waterings_logged:"select count(*)::int as v from plant_care_events where user_id = \
$1 and action_type = 'WATER'",workouts_logged:"select count(*)::int as v from workouts where user_id = $1 and deleted_at is null",steps_in_day:`select coalesce(max(daily.steps), 0)::int as v from (
                   select sum(steps) as steps from workouts
                   where user_id = $1 and deleted_at is null group by local_date_str
                 ) daily`,total_volume_kg:"select coalesce(sum(total_volume_kg), 0)::float8 as v from workouts where user_id = $1 and deleted_at is null",meals_logged:"select count(*)::int as v from m\
eals where user_id = $1 and deleted_at is null",hydration_goals_met:`select count(*)::int as v from (
                          select local_date_str from water_logs
                          where user_id = $1
                          group by local_date_str
                          having sum(amount_ml) >= coalesce(max(goal_ml_at_log), 2000)
                        ) met_days`,plant_care_streak:"select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'PLANT_CARE'",fitness_streak:"select coalesce\
(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'FITNESS'",nutrition_streak:"select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and \
streak_type = 'NUTRITION'",overall_streak:"select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'OVERALL'",all_modules_in_day:`select case when exists (
                         select 1
                         from streaks p, streaks f, streaks n
                         where p.user_id = $1 and p.streak_type = 'PLANT_CARE'
                           and f.user_id = $1 and f.streak_type = 'FITNESS'
                           and n.user_id = $1 and n.streak_type = 'NUTRITION'
                           and p.last_counted_date is not null
                           and p.last_counted_date = f.last_counted_date
                           and f.last_counted_date = n.last_counted_date
                       ) then 1 else 0 end as v`};function Ws(e,t){return e.filter(r=>{let n=t.get(r.metric);return n!==void 0&&n>=r.gte})}o(Ws,"evaluateUnlocks");async function Kt(e,t){let{rows:r}=await e.
query(`select a.id, a.code, a.criteria
     from achievements a
     where a.is_active
       and not exists (
         select 1 from user_achievements ua
         where ua.user_id = $1 and ua.achievement_id = a.id and ua.unlocked_at is not null
       )`,[t]),n=[];for(let i of r){let u=i.criteria;typeof u?.metric=="string"&&typeof u?.gte=="number"&&Yt[u.metric]&&n.push({id:i.id,code:i.code,metric:u.metric,gte:u.gte})}if(n.length===0)return[];
let s=new Map;for(let i of new Set(n.map(u=>u.metric))){let u=Yt[i];if(!u)continue;let{rows:l}=await e.query(u,[t]);s.set(i,Number(l[0]?.v??0))}let a=Ws(n,s);for(let i of a)await e.query(`insert into \
user_achievements (user_id, achievement_id, unlocked_at, progress_pct)
       values ($1, $2, now(), 100)
       on conflict (user_id, achievement_id)
       do update set unlocked_at = coalesce(user_achievements.unlocked_at, now()), progress_pct = 100`,[t,i.id]);return a.map(i=>i.code)}o(Kt,"evaluateAchievements");var Gs={PLANT_CARE:`select (not ex\
ists (
                 select 1 from plants p
                 where p.user_id = $1 and p.deleted_at is null
                   and p.next_water_due_at is not null
                   -- The due instant is converted into the user's own
                   -- timezone before taking its calendar date: a UTC cast
                   -- flips the verdict near midnight for non-UTC users.
                   and (p.next_water_due_at at time zone coalesce(
                          (select timezone from user_settings where user_id = $1), 'UTC'
                        ))::date <= $2::date
               )) as met`,FITNESS:`select (
              exists (
                select 1 from workouts
                where user_id = $1 and local_date_str = $2 and deleted_at is null
                  and duration_mins >= 10
              )
              or coalesce((
                select sum(steps) from workouts
                where user_id = $1 and local_date_str = $2 and deleted_at is null
              ), 0) >= 8000
            ) as met`,NUTRITION:`select (count(*) >= 2) as met
              from meals
              where user_id = $1 and local_date_str = $2 and deleted_at is null`};async function js(e,t,r){return R(async n=>{let{rows:s}=await n.query(Gs[t],[e,r]),a=s[0]?.met===!0;if(a){await Bt(n,e,
t,r);let{rows:u}=await n.query(`select streak_type, last_counted_date from streaks
         where user_id = $1 and streak_type in ('PLANT_CARE', 'FITNESS', 'NUTRITION')
         order by streak_type
         for update`,[e]);u.length===3&&u.every(c=>c.last_counted_date===r)&&await Bt(n,e,"OVERALL",r)}let i=await Kt(n,e);return{met:a,unlocked:i}})}o(js,"recordDailyLog");async function we(e){try{let t=await R(
r=>Kt(r,e));t.length>0&&h.info({userId:e,unlocked:t},"achievements unlocked")}catch(t){h.warn({err:t,userId:e},"achievement evaluation failed (log write unaffected)")}}o(we,"evaluateAchievementsSafe");
async function L(e,t,r){try{let{met:n,unlocked:s}=await js(e,t,r);s.length>0&&h.info({userId:e,scope:t,met:n,unlocked:s},"achievements unlocked")}catch(n){h.warn({err:n,userId:e,scope:t},"engagement u\
pdate failed (log write unaffected)")}}o(L,"recordDailyLogSafe");k();async function Qt(e){let t=_(),{rows:r}=await t.query(`select p.id as plant_id, p.user_id, p.nickname, p.next_water_due_at
     from plants p
     where p.deleted_at is null
       and p.next_water_due_at is not null
       and p.next_water_due_at <= now() + ($1 || ' hours')::interval
       and not exists (
         select 1 from reminders r
         where r.user_id = p.user_id
           and r.reminder_type = 'WATER_PLANT'
           and r.target_entity_id = p.id
           and (
             r.status = 'PENDING'
             -- A reminder already fired for the CURRENT due date must not be
             -- re-created every tick: suppress while a sent/delivered row is
             -- newer than the last watering (i.e. the nag is still standing).
             or (r.status in ('SENT', 'DELIVERED')
                 and r.created_at > coalesce(p.last_watered_at, '-infinity'::timestamptz))
           )
       )`,[e]);return r}o(Qt,"findPlantsNeedingReminder");async function Xt(e){if(e.length===0)return 0;let t=_(),r=0;for(let n of e){let s=await t.query(`insert into reminders
         (user_id, reminder_type, target_entity_id, target_entity_type, title, body, due_at_utc)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, reminder_type, target_entity_id)
         where status = 'PENDING' and target_entity_id is not null
       do nothing`,[n.user_id,n.reminder_type,n.target_entity_id,n.target_entity_type,n.title,n.body,n.due_at_utc]);r+=s.rowCount??0}return r}o(Xt,"insertReminders");var Bs=["OFF","WINDOW","SCHEDULED_\
ONLY"];function zt(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(zt,"toWallClock");async function Jt(e){let t=new Map;if(e.length===0)return t;let r=_(),{rows:n}=await r.
query(`select user_id, timezone, quiet_hours_mode, quiet_start_time, quiet_end_time,
            daily_notification_cap
     from user_settings
     where user_id = any ($1::uuid[])`,[e]);for(let s of n)t.set(s.user_id,{timezone:s.timezone,quiet_hours_mode:Bs.includes(s.quiet_hours_mode)?s.quiet_hours_mode:"OFF",quiet_start_time:zt(s.quiet_start_time),
quiet_end_time:zt(s.quiet_end_time),daily_notification_cap:s.daily_notification_cap});return t}o(Jt,"findNotificationSettings");async function Zt(e,t,r=48){let n=new Map;if(e.length===0)return n;let s=_(),
{rows:a}=await s.query(`select user_id, sent_at
     from reminders
     where user_id = any ($1::uuid[])
       and status in ('SENT', 'DELIVERED')
       and sent_at is not null
       -- Bounded by the caller's now(), not the database's, so the count the
       -- engine sees is the count for the instant it is deciding about.
       and sent_at > $2::timestamptz - ($3 || ' hours')::interval
       and sent_at <= $2::timestamptz`,[e,t,r]);for(let i of a){let u=n.get(i.user_id);u?u.push(i.sent_at):n.set(i.user_id,[i.sent_at])}return n}o(Zt,"findRecentSentAt");async function en(e=200){let t=_(),
{rows:r}=await t.query(`select id, user_id, title, body, due_at_utc, attempts
     from reminders
     where status = 'PENDING' and due_at_utc <= now()
     order by due_at_utc asc
     limit $1`,[e]);return r}o(en,"findDuePending");async function tn(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'DELIVERED', updated_at = now()
     where id = any ($1::uuid[]) and status = 'SENT'`,[e])}o(tn,"markDelivered");async function nn(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'SENT', sent_at = now(), attempts = attempts + 1, updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(nn,"markSent");async function rn(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'FAILED', last_error = 'delivery attempts exhausted', updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(rn,"markFailed");async function sn(e,t=50){let r=_(),{rows:n}=await r.query(`select id, reminder_type, target_entity_id, title, body, du\
e_at_utc, status, sent_at
     from reminders
     where user_id = $1
       and (status in ('PENDING', 'SENT')
            or (status = 'DELIVERED' and sent_at > now() - interval '7 days'))
     order by due_at_utc desc
     limit $2`,[e,t]);return n}o(sn,"listForUser");async function on(e,t){return((await _().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where id = $1 and user_id = $2 and status in ('PENDING', 'SENT')`,[t,e])).rowCount??0)>0}o(on,"dismiss");async function Ge(e,t){return(await _().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where user_id = $1 and target_entity_id = $2 and status in ('PENDING', 'SENT')`,[e,t])).rowCount??0}o(Ge,"cancelForTarget");k();var he=`id, nickname, species_id, status, next_water_due_at, effective_interval_days,
  photo_url, watering_factor_snapshot, light_exposure, placement, pot_material, soil_type,
  base_interval_days, min_interval_days, max_interval_days, last_watered_at, room,
  acquisition_date, created_at`;async function un(e){let t=_(),{rows:r}=await t.query(`SELECT ${he} FROM plants WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[e]);return r}o(un,"li\
stPlants");async function Ee(e,t){let r=_(),{rows:n}=await r.query(`SELECT ${he} FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[e,t]);return n[0]??null}o(Ee,"getPlant");async function ln(e,t){
let r=_(),{rows:[n]}=await r.query(`INSERT INTO plants
       (user_id, nickname, species_id, room, acquisition_date, light_exposure, placement,
        pot_material, has_drainage, soil_type, indoor_climate, base_interval_days,
        min_interval_days, max_interval_days, photo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${he}`,[e,t.nickname,t.species_id??null,t.room??null,t.acquisition_date??null,t.light_exposure,t.placement,t.pot_material??null,t.has_drainage??null,t.soil_type??null,t.indoor_climate??
null,t.base_interval_days,t.min_interval_days,t.max_interval_days,t.photo_url??null]);return n}o(ln,"createPlant");var Ys=new Set(["nickname","species_id","room","acquisition_date","light_exposure","p\
lacement","pot_material","has_drainage","soil_type","indoor_climate","base_interval_days","min_interval_days","max_interval_days","photo_url"]);async function cn(e,t,r){let n=Object.entries(r).filter(
([l,c])=>c!==void 0&&Ys.has(l));if(n.length===0)return Ee(e,t);let s=n.map(([l],c)=>`${l}=$${c+3}`).join(", "),a=n.map(([,l])=>l),i=_(),{rows:u}=await i.query(`UPDATE plants SET ${s}, updated_at=now()\

     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     RETURNING ${he}`,[e,t,...a]);return u[0]??null}o(cn,"updatePlant");async function dn(e,t){let r=_(),{rowCount:n}=await r.query("UPDATE plants SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND d\
eleted_at IS NULL",[e,t]);return(n??0)>0}o(dn,"softDeletePlant");async function Re(e,t,r,n,s,a){await R(async i=>{let{rows:[u]}=await i.query(`SELECT base_interval_days, min_interval_days, max_interva\
l_days, light_exposure,
              placement, pot_material, pot_diameter_cm, soil_type, indoor_climate,
              has_drainage, effective_interval_days
       FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[t,e]);if(!u)throw Object.assign(new Error("Plant not found"),{__notFound:!0});if(((await i.query(`INSERT INTO plant_care_events
         (plant_id, user_id, action_type, note, local_date_str, interval_at_log_days, client_idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (client_idempotency_key) DO NOTHING`,[t,e,r,n??null,s,u.effective_interval_days??null,a??null])).rowCount??0)!==0&&r==="WATER"){let c=Vt(s,"NORTHERN"),d=Wt({baseIntervalDays:u.base_interval_days,
minIntervalDays:u.min_interval_days,maxIntervalDays:u.max_interval_days,season:c,lightExposure:u.light_exposure,placement:u.placement,potMaterial:u.pot_material,potDiameterCm:u.pot_diameter_cm,hasDrainage:u.
has_drainage,soilType:u.soil_type,indoorClimate:u.indoor_climate});await i.query(`UPDATE plants
         SET last_watered_at=now(),
             next_water_due_at=now() + ($1 || ' days')::interval,
             effective_interval_days=$1,
             watering_factor_snapshot=$2,
             updated_at=now()
         WHERE id=$3`,[d.effectiveIntervalDays,JSON.stringify(d),t])}})}o(Re,"logCareEvent");async function _n(e,t,r=50){let n=_(),{rows:s}=await n.query(`SELECT id, plant_id, user_id, action_type, no\
te, logged_at_utc, local_date_str,
            interval_at_log_days, client_idempotency_key
     FROM plant_care_events WHERE plant_id=$1 AND user_id=$2 ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(_n,"listCareEvents");var mn=`id, plant_id, user_id, photo_url, photo_storage_key,\
 height_cm, note,
  logged_at_utc, local_date_str, created_at`,an=40;async function pn(e,t,r){let n=_(),{rows:s}=await n.query(`INSERT INTO growth_log_entries
       (plant_id, user_id, photo_url, photo_storage_key, height_cm, note, local_date_str)
     SELECT p.id, p.user_id, $3::text, $4::text, $5::numeric, $6::text, $7::text
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL
        AND (SELECT count(*) FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) < $8::int
     RETURNING ${mn}`,[t,e,r.photo_url,r.photo_storage_key,r.height_cm??null,r.note??null,r.local_date_str,an]),a=s[0];if(a)return{status:"CREATED",entry:a};let{rows:[i]}=await n.query(`SELECT (SELECT\
 count(*)::int FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) AS current
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL`,[t,e]);return i?{status:"LIMIT_EXCEEDED",current:i.current,ceiling:an}:{status:"NOT_FOUND"}}o(pn,"createGrowthEntry");async function gn(e,t,r=50){
let n=_(),{rows:s}=await n.query(`SELECT ${mn}
     FROM growth_log_entries
     WHERE plant_id=$1 AND user_id=$2 AND deleted_at IS NULL
     ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(gn,"listGrowthEntries");async function fn(e,t,r){let n=_(),{rowCount:s}=await n.query(`UPDATE growth_log_entries SET deleted_at=now()
     WHERE id=$1 AND plant_id=$2 AND user_id=$3 AND deleted_at IS NULL`,[e,t,r]);return(s??0)>0}o(fn,"softDeleteGrowthEntry");async function yn(e){let t=_();if(e){let{rows:n}=await t.query(`SELECT id,\
 common_name, scientific_name, base_interval_days, min_interval_days,
              max_interval_days, default_light, default_soil, care_notes, image_url
       FROM species WHERE lower(common_name) ILIKE $1 AND NOT is_custom ORDER BY common_name LIMIT 200`,[`%${e.toLowerCase()}%`]);return n}let{rows:r}=await t.query(`SELECT id, common_name, scientific\
_name, base_interval_days, min_interval_days,
            max_interval_days, default_light, default_soil, care_notes, image_url
     FROM species WHERE NOT is_custom ORDER BY common_name LIMIT 200`);return r}o(yn,"listSpecies");var wn=["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"],Ks=W.string().trim().max(2048).url().refine(e=>/^https?:\/\//i.test(e),"photo_url must be an http(s) URL"),zs=W.object({photo_url:Ks,
photo_storage_key:W.string().trim().min(1).max(512).optional(),height_cm:W.number().min(0).max(5e3).optional(),note:W.string().trim().max(1e3).optional(),local_date_str:W.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).
strict(),Qs=20;function Xs(e){return e.issues.slice(0,Qs).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))}o(Xs,"detailsFor");function Ae(e,t){let r=W.string().uuid().safeParse(e);if(!r.success)
throw x(`${t} must be a UUID.`,[{field:t,issue:"invalid"}]);return r.data}o(Ae,"requireUuidParam");async function hn(e,t,r){try{let n=g(e),s=await un(n);t.json(s)}catch(n){r(n)}}o(hn,"list");async function En(e,t,r){try{let n=g(e),s=await Ee(e.params.id,n);if(!s)throw N();t.json(s)}catch(n){r(n)}}o(
En,"get");async function Rn(e,t,r){try{let n=g(e),s=e.body,a=typeof s.nickname=="string"?s.nickname.trim():"";if(!a||a.length>80)throw x("nickname must be 1\u201380 characters.",[{field:"nickname",issue:"\
invalid"}]);let i=Number(s.base_interval_days);if(!Number.isInteger(i)||i<1||i>365)throw x("base_interval_days must be 1\u2013365.",[{field:"base_interval_days",issue:"invalid"}]);let u=Number(s.min_interval_days),
l=Number(s.max_interval_days);if(u>l)throw x("min_interval_days must not exceed max_interval_days.",[{field:"min_interval_days",issue:"invalid"}]);let c=await ln(n,s);t.status(201).json(c)}catch(n){r(
n)}}o(Rn,"create");async function An(e,t,r){try{let n=g(e),s=await cn(e.params.id,n,e.body);if(!s)throw N();t.json(s)}catch(n){r(n)}}o(An,"update");async function Tn(e,t,r){try{let n=g(e);if(!await dn(
e.params.id,n))throw N();await Ge(n,e.params.id).catch(()=>{}),t.json({status:"deleted"})}catch(n){r(n)}}o(Tn,"remove");async function kn(e,t,r){try{let n=g(e),s=e.body,a=s.action_type;if(!a||!wn.includes(
a))throw x("action_type must be one of: "+wn.join(", "),[{field:"action_type",issue:"invalid"}]);let i=s.local_date_str;if(!i)throw x("local_date_str is required.",[{field:"local_date_str",issue:"requ\
ired"}]);try{await Re(n,e.params.id,a,s.note,i,s.client_idempotency_key)}catch(u){throw u&&typeof u=="object"&&"__notFound"in u?N():u}a==="WATER"&&await Ge(n,e.params.id).catch(()=>{}),await L(n,"PLAN\
T_CARE",i),t.status(201).json({status:"logged"})}catch(n){r(n)}}o(kn,"logCare");async function bn(e,t,r){try{let n=g(e),s=await _n(e.params.id,n);t.json(s)}catch(n){r(n)}}o(bn,"getCareHistory");async function xn(e,t,r){
try{let n=g(e),s=Ae(e.params.id,"id"),a=zs.safeParse(e.body);if(!a.success)throw x("The request failed validation.",Xs(a.error));let i=a.data,u=await pn(n,s,{photo_url:i.photo_url,photo_storage_key:i.
photo_storage_key??i.photo_url,...i.height_cm!==void 0?{height_cm:i.height_cm}:{},...i.note!==void 0?{note:i.note}:{},local_date_str:i.local_date_str});if(u.status==="NOT_FOUND")throw N();if(u.status===
"LIMIT_EXCEEDED")throw new m("CONFLICT",`This plant already has the maximum of ${u.ceiling} growth entries. Delete an older entry to add a new one.`,{details:[{field:"growth",issue:"limit_exceeded",current:u.
current,ceiling:u.ceiling}]});t.status(201).json(u.entry)}catch(n){r(n)}}o(xn,"logGrowth");async function In(e,t,r){try{let n=g(e),s=Ae(e.params.id,"id");if(!await Ee(s,n))throw N();t.json(await gn(s,
n))}catch(n){r(n)}}o(In,"getGrowthHistory");async function Dn(e,t,r){try{let n=g(e),s=Ae(e.params.id,"id"),a=Ae(e.params.entryId,"entryId");if(!await fn(a,s,n))throw N();t.json({status:"deleted"})}catch(n){
r(n)}}o(Dn,"removeGrowthEntry");async function Nn(e,t,r){try{let n=await yn(e.query.q);t.json(n)}catch(n){r(n)}}o(Nn,"searchSpecies");var I=Js();I.use(E);I.get("/species",Nn);I.get("/",hn);I.post("/",Rn);I.get("/:id",En);I.put("/:id",An);I.delete("/:id",Tn);I.post("/:id/care",kn);I.get("/:id/care",bn);I.post("/:id/growth",xn);I.get(
"/:id/growth",In);I.delete("/:id/growth/:entryId",Dn);var vn=I;import{Router as eo}from"npm:express@4.21.2";k();async function Sn(e){if(e.length===0)return new Map;let t=_(),{rows:r}=await t.query(`select workout_id, id, set_index, reps,
            weight_kg::float8        as weight_kg,
            volume_kg::float8        as volume_kg,
            estimated_1rm_kg::float8 as estimated_1rm_kg
     from workout_sets
     where workout_id = any($1)
     order by workout_id, set_index`,[e]),n=new Map;for(let s of r){let{workout_id:a,...i}=s,u=n.get(a)??[];u.push(i),n.set(a,u)}return n}o(Sn,"fetchSetsForWorkouts");async function On(e,t=20,r=0){let n=_(),
{rows:s}=await n.query(`select id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where user_id = $1 and deleted_at is null
     order by logged_at_utc desc
     limit $2 offset $3`,[e,t,r]),a=await Sn(s.map(i=>i.id));return s.map(i=>({...i,sets:a.get(i.id)??[]}))}o(On,"listWorkouts");async function Cn(e,t){let r=_(),{rows:n}=await r.query(`select id, use\
r_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where id = $1 and user_id = $2 and deleted_at is null`,[e,t]);if(!n[0])return null;let s=await Sn([n[0].id]);return{...n[0],sets:s.get(n[0].id)??[]}}o(Cn,"getWorkout");async function Te(e,t){return await R(
async r=>{let{rows:n}=await r.query(`insert into workouts
         (user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
          met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
          steps, note, local_date_str, client_idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
                 met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
                 steps, note, logged_at_utc, local_date_str, client_idempotency_key`,[e,t.exercise_id??null,t.activity_type,t.duration_mins??null,t.perceived_intensity??null,t.met_value_at_log??null,t.
body_mass_at_log_kg??null,t.calories_burned??null,t.total_volume_kg,t.steps??null,t.note??null,t.local_date_str,t.client_idempotency_key??null]),s=n[0];if(!s)throw new Error("workout insert returned n\
o row");let a=[];if(t.sets&&t.sets.length>0)for(let i of t.sets){let{rows:u}=await r.query(`insert into workout_sets (workout_id, set_index, reps, weight_kg, volume_kg, estimated_1rm_kg)
           values ($1,$2,$3,$4,$5,$6)
           returning id, set_index, reps,
               weight_kg::float8        as weight_kg,
               volume_kg::float8        as volume_kg,
               estimated_1rm_kg::float8 as estimated_1rm_kg`,[s.id,i.set_index,i.reps,i.weight_kg,i.volume_kg,i.estimated_1rm_kg??null]),l=u[0];if(!l)throw new Error("workout_sets insert returned no r\
ow");a.push(l)}return{...s,sets:a}})}o(Te,"createWorkout");async function $n(e,t){let r=_(),{rows:n}=await r.query(`select local_date_str as date,
            count(*)::text as workouts,
            coalesce(sum(steps), 0)::text as steps,
            coalesce(sum(calories_burned), 0)::text as calories,
            coalesce(sum(duration_mins), 0)::text as duration_mins
     from workouts
     where user_id = $1
       and deleted_at is null
       and local_date_str >= $2
       and local_date_str < ($2::date + interval '7 days')::text
     group by local_date_str
     order by local_date_str`,[e,t]),s=n.map(a=>({date:a.date,workouts:Number(a.workouts),steps:Number(a.steps),calories:Number(a.calories)}));return{total_workouts:s.reduce((a,i)=>a+i.workouts,0),total_duration_mins:n.
reduce((a,i)=>a+Number(i.duration_mins),0),total_calories:s.reduce((a,i)=>a+i.calories,0),total_steps:s.reduce((a,i)=>a+i.steps,0),by_day:s}}o($n,"getWeeklySummary");async function Ln(e){let t=_(),{rows:r}=await t.
query(`select id, name, activity_type, met_value, is_strength, muscle_group, is_custom
     from exercises
     where ($1::text is null or lower(name) like '%' || lower($1) || '%')
       and (not is_custom or created_by is null)
     order by name
     limit 100`,[e??null]);return r}o(Ln,"listExercises");async function Pn(e){let t=_(),{rows:r}=await t.query(`select pr.id, pr.exercise_id, e.name as exercise_name, pr.record_type,
            pr.value, pr.source_workout_id, pr.achieved_at
     from personal_records pr
     join exercises e on e.id = pr.exercise_id
     where pr.user_id = $1
     order by e.name, pr.record_type`,[e]);return r}o(Pn,"getPersonalRecords");var z=g;async function Un(e,t,r){try{let n=Number(e.query.limit??20),s=Number(e.query.offset??0),a=Number.isFinite(n)?Math.min(Math.max(1,Math.trunc(n)),100):20,i=Number.isFinite(s)?Math.max(0,Math.trunc(
s)):0,u=await On(z(e),a,i);t.json({workouts:u})}catch(n){r(n)}}o(Un,"listWorkoutsHandler");async function Mn(e,t,r){try{let n=await Cn(e.params.id,z(e));if(!n)throw N();t.json(n)}catch(n){r(n)}}o(Mn,"\
getWorkoutHandler");var Zs=new Set(["WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"]);async function qn(e,t,r){try{let n=e.body;if(!n.activity_type||!Zs.has(n.activity_type))throw x(
"activity_type is required and must be a valid type.",[{field:"activity_type",issue:"required_or_invalid"}]);let s=n.duration_mins;if(s!=null&&(typeof s!="number"||!Number.isInteger(s)||s<1||s>1440))throw x(
"duration_mins must be an integer between 1 and 1440.",[{field:"duration_mins",issue:"out_of_range"}]);if(!n.local_date_str||!/^\d{4}-\d{2}-\d{2}$/.test(n.local_date_str))throw x("local_date_str is re\
quired in YYYY-MM-DD format.",[{field:"local_date_str",issue:"required_or_invalid"}]);let i=(Array.isArray(n.sets)?n.sets:[]).map((y,b)=>{let T=Number(y.reps??0),D=Number(y.weight_kg??0);return{set_index:Number(
y.set_index??b+1),reps:T,weight_kg:D,volume_kg:fe(T,D),estimated_1rm_kg:ge(D,T)?pe(D,T):void 0}}),u=ye(i.map(y=>({reps:y.reps,weightKg:y.weight_kg}))),l=n.met_value_at_log,c=n.body_mass_at_log_kg,d=n.
calories_burned;d===void 0&&typeof l=="number"&&typeof c=="number"&&typeof s=="number"&&s>0&&(d=me(l,c,s));let f=await Te(z(e),{exercise_id:n.exercise_id,activity_type:n.activity_type,duration_mins:s??
void 0,perceived_intensity:n.perceived_intensity,met_value_at_log:l,body_mass_at_log_kg:c,calories_burned:d,total_volume_kg:u,steps:n.steps,note:n.note,local_date_str:n.local_date_str,client_idempotency_key:typeof n.
client_idempotency_key=="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{12}$/i.test(n.client_idempotency_key)?n.client_idempotency_key:void 0,sets:i.length>0?i:void 0});await L(
z(e),"FITNESS",n.local_date_str),t.status(201).json(f)}catch(n){r(n)}}o(qn,"logWorkout");async function Fn(e,t,r){try{let n=e.query.week;if(!n||!/^\d{4}-\d{2}-\d{2}$/.test(n))throw x("week query param\
eter is required in YYYY-MM-DD format.",[{field:"week",issue:"required_or_invalid"}]);let s=await $n(z(e),n);t.json(s)}catch(n){r(n)}}o(Fn,"getSummary");async function Hn(e,t,r){try{let n=e.query.q,s=await Ln(
n);t.json({exercises:s})}catch(n){r(n)}}o(Hn,"searchExercises");async function Vn(e,t,r){try{let n=await Pn(z(e));t.json({personal_records:n})}catch(n){r(n)}}o(Vn,"getPersonalRecordsHandler");var P=eo();P.use(E);P.get("/exercises",Hn);P.get("/personal-records",Vn);P.get("/summary",Fn);P.get("/",Un);P.post("/",qn);P.get("/:id",Mn);var Wn=P;import{Router as oo}from"npm:express@4.21.2";import{z as v}from"npm:zod@3.24.1";k();var jn=`id, name, brand,
       kcal_per_100g::float8    as kcal_per_100g,
       protein_per_100g::float8 as protein_per_100g,
       carbs_per_100g::float8   as carbs_per_100g,
       fat_per_100g::float8     as fat_per_100g,
       default_serving_unit,
       default_serving_grams::float8 as default_serving_grams,
       is_custom`;async function Bn(e,t){let r=_(),{rows:n}=await r.query(`select ${jn}
     from foods
     where deleted_at is null
       and name ilike '%' || $1 || '%'
       and (is_custom = false or created_by = $2)
     order by (lower(name) = lower($1)) desc,
              (lower(name) like lower($1) || '%') desc,
              name asc
     limit 200`,[e,t]);return n}o(Bn,"searchFoods");var je=200,ee=30;function Gn(e,t){return`created_by = ${e}::uuid and is_custom
            and (deleted_at is null
                 or deleted_at > now() - (${t}::int * interval '1 day'))`}o(Gn,"ceilingScopeSql");async function Yn(e,t){let r=_(),{rows:n}=await r.query(`insert into foods
       (name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        default_serving_unit, default_serving_grams, barcode, source, is_custom, created_by)
     select $1::text, $2::text, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
            $7::text, $8::numeric, $9::text, 'CUSTOM', true, $10::uuid
     where (select count(*) from foods
             where ${Gn("$10","$12")}) < $11::int
     returning ${jn}`,[t.name,t.brand??null,t.kcal_per_100g,t.protein_per_100g,t.carbs_per_100g,t.fat_per_100g,t.default_serving_unit,t.default_serving_grams??null,t.barcode??null,e,je,ee]),s=n[0];if(s)
return{status:"CREATED",food:s};let{rows:[a]}=await r.query(`select count(*)::int                                        as current,
            count(*) filter (where deleted_at is not null)::int  as deleted
     from foods
     where ${Gn("$1","$2")}`,[e,ee]);return{status:"LIMIT_EXCEEDED",current:a?.current??je,ceiling:je,deleted:a?.deleted??0}}o(Yn,"createCustomFood");async function Kn(e,t){let r=_(),{rowCount:n}=await r.
query(`update foods
        set deleted_at = now(), updated_at = now()
      where id = $1 and created_by = $2 and is_custom and deleted_at is null`,[e,t]);return(n??0)>0}o(Kn,"softDeleteCustomFood");var to=2e3;async function zn(e,t){let r=_(),{rows:n}=await r.query(`sel\
ect id, meal_type,
            total_kcal::float8      as total_kcal,
            total_protein_g::float8 as total_protein_g,
            total_carbs_g::float8   as total_carbs_g,
            total_fat_g::float8     as total_fat_g,
            note
     from meals
     where user_id = $1 and local_date_str = $2 and deleted_at is null
     order by logged_at_utc asc`,[e,t]),s=n.map(u=>({...u,items:[]}));if(s.length>0){let u=s.map(d=>d.id),{rows:l}=await r.query(`select mi.meal_id, mi.id, mi.food_id, mi.food_name_at_log,
              mi.quantity::float8  as quantity,
              mi.serving_unit,
              mi.grams::float8     as grams,
              mi.kcal::float8      as kcal,
              mi.protein_g::float8 as protein_g,
              mi.carbs_g::float8   as carbs_g,
              mi.fat_g::float8     as fat_g
       from meal_items mi
       where mi.meal_id = any ($1::uuid[])
       order by mi.created_at asc`,[u]),c=new Map;for(let{meal_id:d,...f}of l){let y=c.get(d);y?y.push(f):c.set(d,[f])}for(let d of s)d.items=c.get(d.id)??[]}let{rows:[a]}=await r.query(`select coales\
ce(sum(amount_ml), 0)::text as water_ml_total,
            max(goal_ml_at_log)               as water_goal_ml
     from water_logs
     where user_id = $1 and local_date_str = $2`,[e,t]),i=s.reduce((u,l)=>(u.kcal+=l.total_kcal,u.protein_g+=l.total_protein_g,u.carbs_g+=l.total_carbs_g,u.fat_g+=l.total_fat_g,u),{kcal:0,protein_g:0,
carbs_g:0,fat_g:0});return{meals:s,water_ml_total:Number(a?.water_ml_total??0),water_goal_ml:a?.water_goal_ml??to,totals:i}}o(zn,"getDailySummary");async function ke(e,t){return R(async r=>{let n=t.items.
reduce((c,d)=>c+d.kcal,0),s=t.items.reduce((c,d)=>c+d.protein_g,0),a=t.items.reduce((c,d)=>c+d.carbs_g,0),i=t.items.reduce((c,d)=>c+d.fat_g,0),{rows:u}=await r.query(`insert into meals
         (user_id, meal_type, total_kcal, total_protein_g, total_carbs_g, total_fat_g,
          note, local_date_str, client_idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, meal_type,
                 total_kcal::float8      as total_kcal,
                 total_protein_g::float8 as total_protein_g,
                 total_carbs_g::float8   as total_carbs_g,
                 total_fat_g::float8     as total_fat_g`,[e,t.meal_type,n,s,a,i,t.note??null,t.local_date_str,t.client_idempotency_key??null]),l=u[0];if(!l)throw new Error("meal insert returned no row");
for(let c of t.items)await r.query(`insert into meal_items
           (meal_id, food_id, food_name_at_log, quantity, serving_unit, grams,
            kcal, protein_g, carbs_g, fat_g)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,[l.id,c.food_id??null,c.food_name_at_log,c.quantity,c.serving_unit,c.grams,c.kcal,c.protein_g,c.carbs_g,c.fat_g]);return l})}o(ke,"logMeal");
async function be(e,t){let r=_(),{rows:n}=await r.query(`insert into water_logs (user_id, amount_ml, goal_ml_at_log, local_date_str, client_idempotency_key)
     values ($1, $2, $3, $4, $5)
     returning id, amount_ml`,[e,t.amount_ml,t.goal_ml_at_log??null,t.local_date_str,t.client_idempotency_key??null]),s=n[0];if(!s)throw new Error("water_logs insert returned no row");return s}o(be,"l\
ogWater");var Qn=["BREAKFAST","LUNCH","DINNER","SNACK"],Be=["GRAM","MILLILITRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"];function no(){return new Date().toISOString().slice(0,10)}o(no,"todayUtcDateStr");function Ye(e){
return typeof e=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e)}o(Ye,"isValidDateStr");function ro(e,t){let r=v.string().uuid().safeParse(e);if(!r.success)throw new m("VALIDATION_FAILED",`${t} must be a UUID\
.`,{details:[{field:t,issue:"invalid"}]});return r.data}o(ro,"requireUuidParam");async function Xn(e,t,r){try{let n=e.query.q;if(n!==void 0&&typeof n!="string")throw new m("VALIDATION_FAILED","Query p\
arameter q must be a string.");let s=g(e),a=await Bn((n??"").trim(),s);t.status(200).json({foods:a})}catch(n){r(n)}}o(Xn,"searchFoodsHandler");var so=v.object({name:v.string().trim().min(1).max(120),brand:v.
string().trim().max(80).optional(),kcal_per_100g:v.number().min(0).max(9e3),protein_per_100g:v.number().min(0).max(100).default(0),carbs_per_100g:v.number().min(0).max(100).default(0),fat_per_100g:v.number().
min(0).max(100).default(0),default_serving_unit:v.enum(Be).default("GRAM"),default_serving_grams:v.number().min(.1).max(5e3).optional(),barcode:v.string().regex(/^\d{8,14}$/,"must be 8 to 14 digits").
optional()}).strict();async function Jn(e,t,r){try{let n=g(e),s=so.safeParse(e.body);if(!s.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).
map(u=>({field:u.path.join(".")||"(root)",issue:u.message}))});let a=s.data,i=await Yn(n,{...a,brand:a.brand?a.brand:void 0});if(i.status==="LIMIT_EXCEEDED")throw new m("CONFLICT",`You have reached yo\
ur limit of ${i.ceiling} custom foods. Deleting one frees its slot ${ee} days later, when its retention window closes.`,{details:[{field:"foods",issue:"limit_exceeded",current:i.current,ceiling:i.ceiling,
deleted:i.deleted,retention_days:ee}]});t.status(201).json(i.food)}catch(n){r(n)}}o(Jn,"createCustomFoodHandler");async function Zn(e,t,r){try{let n=g(e),s=ro(e.params.id,"id");if(!await Kn(s,n))throw N();
t.json({status:"deleted"})}catch(n){r(n)}}o(Zn,"deleteCustomFoodHandler");async function er(e,t,r){try{let n=e.query.date??no();if(!Ye(n))throw new m("VALIDATION_FAILED","date must be YYYY-MM-DD.");let s=g(
e),a=await zn(s,n);t.status(200).json(a)}catch(n){r(n)}}o(er,"getDailySummaryHandler");async function tr(e,t,r){try{let n=e.body,s=[];if((!n.meal_type||!Qn.includes(n.meal_type))&&s.push({field:"meal_\
type",issue:`must be one of ${Qn.join(", ")}`}),Ye(n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),!Array.isArray(n.items)||n.items.length===0)s.push({field:"i\
tems",issue:"must be a non-empty array"});else for(let u=0;u<n.items.length;u++){let l=n.items[u];(!l.food_name_at_log||typeof l.food_name_at_log!="string")&&s.push({field:`items[${u}].food_name_at_lo\
g`,issue:"required"}),(typeof l.quantity!="number"||l.quantity<=0)&&s.push({field:`items[${u}].quantity`,issue:"must be a positive number"}),Be.includes(l.serving_unit)||s.push({field:`items[${u}].ser\
ving_unit`,issue:`must be one of ${Be.join(", ")}`}),(typeof l.grams!="number"||l.grams<=0)&&s.push({field:`items[${u}].grams`,issue:"must be a positive number"}),(typeof l.kcal!="number"||l.kcal<0)&&
s.push({field:`items[${u}].kcal`,issue:"must be a non-negative number"})}if(s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=g(e),i=await ke(a,{meal_type:n.
meal_type,note:typeof n.note=="string"?n.note:void 0,local_date_str:n.local_date_str,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:void 0,items:n.items.map(
u=>({food_id:typeof u.food_id=="string"?u.food_id:void 0,food_name_at_log:u.food_name_at_log,quantity:u.quantity,serving_unit:u.serving_unit,grams:u.grams,kcal:u.kcal,protein_g:typeof u.protein_g=="nu\
mber"?u.protein_g:0,carbs_g:typeof u.carbs_g=="number"?u.carbs_g:0,fat_g:typeof u.fat_g=="number"?u.fat_g:0}))});await L(a,"NUTRITION",n.local_date_str),t.status(201).json(i)}catch(n){r(n)}}o(tr,"logM\
ealHandler");async function nr(e,t,r){try{let n=e.body,s=[];if((typeof n.amount_ml!="number"||n.amount_ml<1||n.amount_ml>5e3)&&s.push({field:"amount_ml",issue:"must be a number between 1 and 5000"}),Ye(
n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=g(e),i=await be(a,
{amount_ml:n.amount_ml,local_date_str:n.local_date_str,goal_ml_at_log:typeof n.goal_ml_at_log=="number"?n.goal_ml_at_log:void 0,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:
void 0});await we(a),t.status(201).json(i)}catch(n){r(n)}}o(nr,"logWaterHandler");var U=oo();U.use(E);U.get("/foods/search",Xn);U.post("/foods",Jn);U.delete("/foods/:id",Zn);U.get("/summary",er);U.post("/meals",tr);U.post("/water",nr);var rr=U;import{Router as uo}from"npm:express@4.21.2";k();var io=1e4,sr=2e3;async function or(e,t){let r=_(),[n,s,a,i,u]=await Promise.all([r.query(`select current_length, longest_length
         from streaks
         where user_id = $1 and streak_type = 'OVERALL'
         limit 1`,[e]),r.query(`select id, nickname
         from plants
         where user_id = $1
           and deleted_at is null
           and next_water_due_at::date = $2::date`,[e,t]),r.query(`select count(*)::text as count
         from plants
         where user_id = $1
           and deleted_at is null
           and next_water_due_at < now()
           and next_water_due_at::date < $2::date`,[e,t]),r.query(`select coalesce(sum(steps), 0)::text as steps
         from workouts
         where user_id = $1 and local_date_str = $2 and deleted_at is null`,[e,t]),r.query(`select coalesce(sum(total_kcal), 0)::text as calories
         from meals
         where user_id = $1 and local_date_str = $2 and deleted_at is null`,[e,t])]),l=n.rows[0],c=Number(i.rows[0]?.steps??0),d=Number(u.rows[0]?.calories??0),f=[...s.rows.map(y=>({type:"PLANT_WATER",
id:y.id,title:y.nickname}))];return d<sr&&f.push({type:"LOG_MEAL",id:"log_meal",title:"Log a meal"}),{streak:{current:l?.current_length??0,longest:l?.longest_length??0},plants:{due_today:s.rows.length,
overdue:Number(a.rows[0]?.count??0)},fitness:{steps:c,goal:io},nutrition:{calories_consumed:d,target:sr},today_list:f}}o(or,"getDashboard");function ao(){return new Date().toISOString().slice(0,10)}o(ao,"todayUtcDateStr");async function ir(e,t,r){try{let n=typeof e.query.date=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.query.date)?e.query.date:
ao(),s=g(e),a=await or(s,n);t.status(200).json(a)}catch(n){r(n)}}o(ir,"getDashboardHandler");var Ke=uo();Ke.use(E);Ke.get("/",ir);var ar=Ke;import{Router as lo}from"npm:express@4.21.2";k();async function ur(e){let t=_(),{rows:r}=await t.query(`select a.id as a_id, a.code, a.name, a.description, a.module, a.icon,
            a.tier, a.points, a.is_active,
            ua.id as ua_id, ua.unlocked_at, ua.progress_pct, ua.seen_at
     from achievements a
     left join user_achievements ua
       on ua.achievement_id = a.id and ua.user_id = $1
     where a.is_active
     order by a.module, a.points, a.name`,[e]);return r.map(n=>({id:n.ua_id??n.a_id,achievement_id:n.a_id,unlocked_at:n.unlocked_at,progress_pct:n.ua_id?n.progress_pct??0:0,seen_at:n.seen_at,achievement:{
id:n.a_id,code:n.code,name:n.name,description:n.description,module:n.module,icon:n.icon,tier:n.tier,points:n.points,is_active:n.is_active}}))}o(ur,"listForUser");async function lr(e){let t=_(),{rows:r}=await t.
query(`select streak_type, current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1
     order by streak_type`,[e]);return r}o(lr,"listStreaks");async function cr(e){return(await _().query(`update user_achievements
     set seen_at = now()
     where user_id = $1 and unlocked_at is not null and seen_at is null`,[e])).rowCount??0}o(cr,"markSeen");async function dr(e,t,r){try{let n=g(e),s=await ur(n);t.status(200).json(s)}catch(n){r(n)}}o(dr,"listAchievementsHandler");async function _r(e,t,r){try{let n=g(e),s=await lr(n);t.status(200).json({streaks:s})}catch(n){
r(n)}}o(_r,"listStreaksHandler");async function mr(e,t,r){try{let n=g(e),s=await cr(n);t.status(200).json({marked_seen:s})}catch(n){r(n)}}o(mr,"markSeenHandler");var te=lo();te.use(E);te.get("/",dr);te.get("/streaks",_r);te.post("/seen",mr);var pr=te;import{Router as co}from"npm:express@4.21.2";var xe=co();xe.use(E);xe.get("/",async(e,t,r)=>{try{let n=await sn(g(e));t.status(200).json({reminders:n})}catch(n){r(n)}});xe.post("/:id/dismiss",async(e,t,r)=>{try{let n=e.params.id;if(!n||!/^[0-9a-f-]{36}$/i.
test(n))throw new m("VALIDATION_FAILED","Reminder id must be a UUID.");if(!await on(g(e),n))throw new m("NOT_FOUND","Reminder not found or already resolved.");t.status(200).json({status:"dismissed"})}catch(n){
r(n)}});var gr=xe;import{Router as mo}from"npm:express@4.21.2";import{z as G}from"npm:zod@3.24.1";k();var _o=5;async function yr(e,t){try{return await fr(e,t)}catch(r){if(typeof r=="object"&&r!==null&&r.code==="23505")return fr(e,t);throw r}}o(yr,"registerToken");async function fr(e,t){return R(async r=>{
let{rows:n}=await r.query(`select id, user_id from device_push_tokens
       where token = $1
       order by (status = 'ACTIVE') desc, created_at desc
       limit 1
       for update`,[t.expo_push_token]),s=n[0],a;if(s&&s.user_id===e){let{rows:u}=await r.query(`update device_push_tokens
         set platform = $2, installation_id = $3, device_label = $4, app_version = $5,
             permission_status = $6, status = 'ACTIVE', revoked_at = null,
             revoke_reason = null, last_confirmed_at = now(), updated_at = now()
         where id = $1
         returning id`,[s.id,t.platform,t.client_installation_id,t.device_label??null,t.app_version??null,t.permission_status]);a=u[0].id}else{s&&await r.query(`update device_push_tokens
           set status = 'STALE', revoked_at = now(), revoke_reason = 'TOKEN_REASSIGNED',
               updated_at = now()
           where id = $1`,[s.id]),await r.query(`update device_push_tokens
         set status = 'STALE', revoked_at = now(), revoke_reason = 'TOKEN_ROTATED',
             updated_at = now()
         where user_id = $1 and installation_id = $2 and status = 'ACTIVE' and token <> $3`,[e,t.client_installation_id,t.expo_push_token]);let{rows:u}=await r.query(`insert into device_push_tokens
           (user_id, installation_id, platform, token, status, device_label, app_version,
            permission_status, last_confirmed_at)
         values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, now())
         returning id`,[e,t.client_installation_id,t.platform,t.expo_push_token,t.device_label??null,t.app_version??null,t.permission_status]);a=u[0].id}await r.query(`update device_push_tokens
       set status = 'STALE', revoked_at = now(), revoke_reason = 'LRU_EVICTED',
           updated_at = now()
       where id in (
         select id from device_push_tokens
         where user_id = $1 and status = 'ACTIVE'
         order by last_confirmed_at desc nulls last
         offset $2
       )`,[e,_o]);let{rows:i}=await r.query(`select id, platform, device_label, app_version, permission_status, last_confirmed_at
       from device_push_tokens
       where user_id = $1 and status = 'ACTIVE'
       order by last_confirmed_at desc nulls last`,[e]);return{id:a,devices:i}})}o(fr,"registerTokenOnce");async function wr(e){if(e.length===0)return new Map;let t=_(),{rows:r}=await t.query(`select \
user_id, token
     from device_push_tokens
     where user_id = any ($1::uuid[])
       and status = 'ACTIVE'
       and permission_status = 'GRANTED'`,[e]),n=new Map;for(let s of r){let a=n.get(s.user_id);a?a.push(s.token):n.set(s.user_id,[s.token])}return n}o(wr,"activeTokensForUsers");async function hr(e,t){
if(e.length===0)return;await _().query(`update device_push_tokens
     set status = case when $2 = 'DEVICE_NOT_REGISTERED' then 'UNREGISTERED' else 'STALE' end,
         revoked_at = now(), revoke_reason = $2, updated_at = now()
     where token = any ($1::text[]) and status = 'ACTIVE'`,[e,t])}o(hr,"revokeTokens");var po=G.object({expo_push_token:G.string().min(20).max(200).regex(/^Expo(nent)?PushToken\[.+\]$/),platform:G.enum(["IOS","ANDROID"]),client_installation_id:G.string().uuid(),device_label:G.string().max(
64).optional(),app_version:G.string().max(20).optional(),permission_status:G.enum(["GRANTED","DENIED","UNDETERMINED"])}).strict(),ze=mo();ze.use(E);ze.post("/",async(e,t,r)=>{try{let n=po.safeParse(e.
body);if(!n.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:n.error.issues.slice(0,10).map(i=>({field:i.path.join("."),issue:i.message}))});let{id:s,devices:a}=await yr(
g(e),{...n.data,device_label:n.data.device_label?.trim()||void 0});t.status(200).json({id:s,devices:a})}catch(n){r(n)}});var Er=ze;import{Router as Do}from"npm:express@4.21.2";import{z as p}from"npm:zod@3.24.1";k();async function Rr(e,t,r,n){let s=_(),{rows:a}=await s.query(`insert into sync_events (user_id, client_idempotency_key, entity_type, payload)
     values ($1, $2, $3, $4)
     on conflict (user_id, client_idempotency_key) do nothing
     returning id, client_idempotency_key, entity_type, status, result_entity_id, error_code`,[e,t,r,JSON.stringify(n)]),i=a[0];if(i)return{row:i,replay:!1};let{rows:u}=await s.query(`select id, clien\
t_idempotency_key, entity_type, status, result_entity_id, error_code
     from sync_events
     where user_id = $1 and client_idempotency_key = $2`,[e,t]),l=u[0];if(!l)throw new Error("sync_events upsert returned neither insert nor existing row");return{row:l,replay:!0}}o(Rr,"recordEvent");
async function Qe(e,t){await _().query(`update sync_events
     set status = 'PROCESSED', result_entity_id = $2, processed_at = now()
     where id = $1`,[e,t])}o(Qe,"markProcessed");async function Ar(e,t,r){await _().query(`update sync_events
     set status = 'FAILED', error_code = $2, error_detail = $3, processed_at = now()
     where id = $1`,[e,t.slice(0,60),r.slice(0,500)])}o(Ar,"markFailed");async function Xe(e,t,r){let n=_(),{rows:s}=await n.query(`select id from ${e} where user_id = $1 and client_idempotency_key = \
$2`,[t,r]);return s[0]?.id??null}o(Xe,"findEntityIdByKey");var go=50,Ie=p.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(e=>{let t=Date.parse(e);return t>Date.now()-366*864e5&&t<Date.now()+2*864e5},"local_date_str outside the accepted window"),fo=p.object({plant_id:p.
string().uuid(),action_type:p.enum(["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"]),note:p.string().max(500).optional(),local_date_str:Ie}).strict(),yo=p.object({set_index:p.number().int().
min(1).max(200).optional(),reps:p.number().int().min(0).max(1e3),weight_kg:p.number().min(0).max(1e3)}).strict(),wo=p.object({activity_type:p.string().min(1).max(40),duration_mins:p.number().int().min(
1).max(1440).optional(),perceived_intensity:p.enum(["LOW","MODERATE","VIGOROUS"]).optional(),met_value_at_log:p.number().min(1).max(23).optional(),body_mass_at_log_kg:p.number().min(20).max(400).optional(),
steps:p.number().int().min(0).max(2e5).optional(),note:p.string().max(500).optional(),local_date_str:Ie,sets:p.array(yo).max(200).optional()}).strict(),ho=p.object({food_id:p.string().uuid().optional(),
food_name_at_log:p.string().min(1).max(200),quantity:p.number().positive().max(1e5),serving_unit:p.string().min(1).max(20),grams:p.number().positive().max(1e5),kcal:p.number().min(0).max(1e5),protein_g:p.
number().min(0).max(1e4),carbs_g:p.number().min(0).max(1e4),fat_g:p.number().min(0).max(1e4)}).strict(),Eo=p.object({meal_type:p.enum(["BREAKFAST","LUNCH","DINNER","SNACK"]),note:p.string().max(500).optional(),
local_date_str:Ie,items:p.array(ho).min(1).max(50)}).strict(),Ro=p.object({amount_ml:p.number().int().min(1).max(5e3),goal_ml_at_log:p.number().int().min(1).max(2e4).optional(),local_date_str:Ie}).strict(),
Ao=p.object({client_idempotency_key:p.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),entity_type:p.enum(["PLANT_CARE_EVENT","WORKOUT","MEAL","WATER_LOG"]),payload:p.
unknown()}).strict(),To=p.object({events:p.array(Ao).min(1).max(go)}).strict();function ko(e){return typeof e=="object"&&e!==null&&e.code==="23505"}o(ko,"isUniqueViolation");var bo={PLANT_CARE_EVENT:"\
plant_care_events",WORKOUT:"workouts",MEAL:"meals",WATER_LOG:"water_logs"},xo={PLANT_CARE_EVENT:"PLANT_CARE",WORKOUT:"FITNESS",MEAL:"NUTRITION",WATER_LOG:null};async function Io(e,t,r,n){switch(r){case"\
PLANT_CARE_EVENT":{let s=fo.parse(n);return await Re(e,s.plant_id,s.action_type,s.note,s.local_date_str,t),Xe("plant_care_events",e,t)}case"WORKOUT":{let s=wo.parse(n),a=(s.sets??[]).map((c,d)=>{let f=fe(
c.reps,c.weight_kg),y=ge(c.weight_kg,c.reps);return{set_index:c.set_index??d+1,reps:c.reps,weight_kg:c.weight_kg,volume_kg:f,...y?{estimated_1rm_kg:pe(c.weight_kg,c.reps)}:{}}}),i=ye(a.map(c=>({reps:c.
reps,weightKg:c.weight_kg}))),u;return s.met_value_at_log!==void 0&&s.body_mass_at_log_kg!==void 0&&s.duration_mins!==void 0&&(u=me(s.met_value_at_log,s.body_mass_at_log_kg,s.duration_mins)),(await Te(
e,{activity_type:s.activity_type,duration_mins:s.duration_mins,perceived_intensity:s.perceived_intensity,met_value_at_log:s.met_value_at_log,body_mass_at_log_kg:s.body_mass_at_log_kg,calories_burned:u,
total_volume_kg:i,steps:s.steps,note:s.note,local_date_str:s.local_date_str,client_idempotency_key:t,sets:a.length>0?a:void 0})).id}case"MEAL":{let s=Eo.parse(n);return(await ke(e,{...s,client_idempotency_key:t})).
id}case"WATER_LOG":{let s=Ro.parse(n);return(await be(e,{...s,client_idempotency_key:t})).id}}}o(Io,"applyEvent");async function Tr(e,t,r){try{let n=g(e),s=To.safeParse(e.body);if(!s.success)throw new m(
"VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).map(i=>({field:i.path.join("."),issue:i.message}))});let a=[];for(let i of s.data.events){let u=i.client_idempotency_key.
toLowerCase(),{row:l,replay:c}=await Rr(n,u,i.entity_type,i.payload);if(c&&l.status!=="PENDING"){a.push({client_idempotency_key:u,status:l.status==="FAILED"?"FAILED":"PROCESSED",replay:!0,entity_id:l.
result_entity_id,error_code:l.error_code});continue}try{let d=await Io(n,u,i.entity_type,i.payload);await Qe(l.id,d);let f=xo[i.entity_type],y=i.payload.local_date_str;f&&y?await L(n,f,y):i.entity_type===
"WATER_LOG"&&await we(n),a.push({client_idempotency_key:u,status:"PROCESSED",replay:!1,entity_id:d,error_code:null})}catch(d){if(ko(d)){let D=await Xe(bo[i.entity_type],n,u);if(D){await Qe(l.id,D),a.push(
{client_idempotency_key:u,status:"PROCESSED",replay:!0,entity_id:D,error_code:null});continue}}let f=d instanceof p.ZodError,y=typeof d=="object"&&d!==null&&"__notFound"in d,b=f?"VALIDATION_FAILED":y?
"PARENT_NOT_FOUND":"INTERNAL_ERROR",T=d instanceof Error?d.message:String(d);await Ar(l.id,b,T),h.warn({key:u,entity_type:i.entity_type,code:b},"sync event failed"),a.push({client_idempotency_key:u,status:"\
FAILED",replay:!1,entity_id:null,error_code:b})}}t.status(200).json({results:a})}catch(n){r(n)}}o(Tr,"drainOutboxHandler");var Je=Do();Je.use(E);Je.post("/outbox",Tr);var kr=Je;import{Router as Lo}from"npm:express@4.21.2";import{z as vo}from"npm:zod@3.24.1";k();var xr=`timezone, hemisphere, locale, unit_system, theme, week_start_day,
  plant_care_enabled, fitness_enabled, nutrition_enabled, quiet_hours_mode,
  quiet_start_time, quiet_end_time,
  daily_notification_cap, reduce_motion, larger_text, high_contrast, analytics_opt_in`;function br(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(br,"normaliseTimeOfD\
ay");function Ir(e){return{...e,quiet_start_time:br(e.quiet_start_time),quiet_end_time:br(e.quiet_end_time)}}o(Ir,"normaliseSettingsRow");async function De(e){let t=_();await t.query("insert into user\
_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let{rows:r}=await t.query(`select ${xr} from user_settings where user_id = $1`,[e]);return Ir(r[0])}o(De,"getSettings");var No=new Set(
["timezone","hemisphere","locale","unit_system","theme","week_start_day","plant_care_enabled","fitness_enabled","nutrition_enabled","quiet_hours_mode","quiet_start_time","quiet_end_time","daily_notifi\
cation_cap","reduce_motion","larger_text","high_contrast","analytics_opt_in"]);async function Dr(e,t){let r=Object.entries(t).filter(([u,l])=>l!==void 0&&No.has(u));if(r.length===0)return De(e);let n=_();
await n.query("insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let s=r.map(([u],l)=>`${u}=$${l+2}`).join(", "),a=r.map(([,u])=>u),{rows:i}=await n.query(`update \
user_settings set ${s}, updated_at=now()
     where user_id=$1
     returning ${xr}`,[e,...a]);return Ir(i[0])}o(Dr,"updateSettings");var So={hemisphere:["NORTHERN","SOUTHERN","EQUATORIAL"],unit_system:["METRIC","IMPERIAL"],theme:["LIGHT","DARK","SYSTEM"],week_start_day:["SUNDAY","MONDAY"],quiet_hours_mode:["OFF","WINDOW","SCHEDULED\
_ONLY"]},Oo=["plant_care_enabled","fitness_enabled","nutrition_enabled","reduce_motion","larger_text","high_contrast","analytics_opt_in"],Co=vo.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),Nr=[
"quiet_start_time","quiet_end_time"],$o=["quiet_hours_mode",...Nr];async function vr(e,t,r){try{t.json(await De(g(e)))}catch(n){r(n)}}o(vr,"getSettingsHandler");async function Sr(e,t,r){try{let n=e.body??
{},s=[],a={};for(let[c,d]of Object.entries(So)){let f=n[c];f!==void 0&&(typeof f!="string"||!d.includes(f)?s.push({field:c,issue:`must_be_one_of:${d.join(",")}`}):a[c]=f)}for(let c of Oo){let d=n[c];d!==
void 0&&(typeof d!="boolean"?s.push({field:c,issue:"must_be_boolean"}):a[c]=d)}for(let c of Nr){let d=n[c];if(d===void 0)continue;let f=Co.safeParse(d);f.success?a[c]=f.data:s.push({field:c,issue:"mus\
t_be_hh_mm_24h_or_null"})}if(n.timezone!==void 0&&(typeof n.timezone!="string"||n.timezone.length>64?s.push({field:"timezone",issue:"must_be_string_max_64"}):a.timezone=n.timezone),n.locale!==void 0&&
(typeof n.locale!="string"||n.locale.length>20?s.push({field:"locale",issue:"must_be_string_max_20"}):a.locale=n.locale),n.daily_notification_cap!==void 0){let c=n.daily_notification_cap;typeof c!="nu\
mber"||!Number.isInteger(c)||c<1||c>20?s.push({field:"daily_notification_cap",issue:"must_be_integer_1_to_20"}):a.daily_notification_cap=c}if(s.length>0)throw new m("VALIDATION_FAILED","The request fa\
iled validation.",{details:s});let i=g(e),l={...await De(i),...a};if(!l.plant_care_enabled&&!l.fitness_enabled&&!l.nutrition_enabled)throw new m("VALIDATION_FAILED","At least one module must stay enab\
led.",{details:[{field:"modules",issue:"at_least_one_module_required"}]});if($o.some(c=>c in a)&&l.quiet_hours_mode==="WINDOW"){if(l.quiet_start_time===null||l.quiet_end_time===null)throw new m("VALID\
ATION_FAILED","Quiet hours need both a start and an end time.",{details:[{field:"quiet_hours_mode",issue:"window_requires_start_and_end"}]});if(l.quiet_start_time===l.quiet_end_time)throw new m("VALID\
ATION_FAILED","Quiet hours need a different start and end time.",{details:[{field:"quiet_end_time",issue:"window_start_equals_end"}]})}t.json(await Dr(i,a))}catch(n){r(n)}}o(Sr,"updateSettingsHandler");var Ne=Lo();Ne.use(E);Ne.get("/",vr);Ne.put("/",Sr);var Or=Ne;import{Router as Fo}from"npm:express@4.21.2";import{z as Ze}from"npm:zod@3.24.1";k();var Po=30,Cr="PENDING_DELETION",ne="status, deletion_requested_at, purge_after";async function $r(e){let t=_(),{rows:r}=await t.query(`select ${ne} from users where id = $1`,[e]);return r[0]??null}o($r,
"getAccountState");async function Lr(e,t){return R(async r=>{let{rows:[n]}=await r.query(`select ${ne} from users where id = $1 for update`,[e]);if(!n)return{kind:"missing"};if(n.status===Cr)return{kind:"\
already_pending",state:n};let{rows:[s]}=await r.query(`update users
       set status = 'PENDING_DELETION',
           deletion_requested_at = now(),
           -- An interval literal cannot carry a placeholder, so the window is
           -- bound as an integer and multiplied by a fixed unit interval.
           -- Interpolating the number into the statement text would be the
           -- concatenation shape the injection audit flagged, even for a value
           -- that never comes from the request.
           purge_after = now() + ($2::int * interval '1 day'),
           updated_at = now()
       -- No status guard needed: the row is held under the lock taken above,
       -- so it cannot have changed state or disappeared, and the update is
       -- therefore guaranteed to return exactly one row.
       where id = $1
       returning ${ne}`,[e,Po]);return await r.query(`update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'DELETION_REQUESTED'
       where user_id = $1
         and status = 'ACTIVE'
         and ($2::uuid is null or id <> $2::uuid)`,[e,t]),await r.query(`update auth_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1
         and consumed_at is null
         and ($2::uuid is null or session_id <> $2::uuid)`,[e,t]),{kind:"scheduled",state:s}})}o(Lr,"requestDeletion");async function Pr(e){return R(async t=>{let{rows:[r]}=await t.query(`select ${ne}\
 from users where id = $1 for update`,[e]);if(!r)return{kind:"missing"};if(r.status!==Cr)return{kind:"not_pending",state:r};let{rows:[n]}=await t.query(`update users
       set status = case when email_verified_at is null then 'PENDING_VERIFICATION' else 'ACTIVE' end,
           deletion_requested_at = null,
           purge_after = null,
           updated_at = now()
       where id = $1 and status = 'PENDING_DELETION'
       returning ${ne}`,[e]);return{kind:"cancelled",state:n}})}o(Pr,"cancelDeletion");var Uo=Ze.object({password:Ze.string().min(1,"Your password is required to confirm deletion.")}).strict();function Mo(e){return new m("VALIDATION_FAILED","The request failed validation.",{details:e.issues.
slice(0,10).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))})}o(Mo,"validationError");function qo(e){let t=e.sessionId,r=Ze.string().uuid().safeParse(t);return r.success?r.data:null}o(qo,
"callerSessionId");function et(e){let t=e.purge_after?.toISOString()??null;return{status:e.status,deletion_requested_at:e.deletion_requested_at?.toISOString()??null,purge_after:t,deletion_scheduled_at:t}}
o(et,"toBody");function ve(){return new m("AUTHENTICATION_REQUIRED","Authentication is required.")}o(ve,"accountGone");async function Ur(e,t,r){try{let n=await $r(g(e));if(!n)throw ve();t.status(200).
json(et(n))}catch(n){r(n)}}o(Ur,"getAccountHandler");async function Mr(e,t,r){try{let n=Uo.safeParse(e.body??{});if(!n.success)throw Mo(n.error);let s=g(e),a=await Rt(s);if(!a)throw ve();if(a.password_hash===
null)throw new m("VALIDATION_FAILED","The request failed validation.",{details:[{field:"password",issue:"password_required_but_account_has_none"}]});if(!await ce(n.data.password,a.password_hash))throw new m(
"INVALID_CREDENTIALS","That password is not right.");let i=await Lr(s,qo(e));if(i.kind==="missing")throw ve();t.status(200).json({...et(i.state),already_pending:i.kind==="already_pending"})}catch(n){r(
n)}}o(Mr,"requestDeletionHandler");async function qr(e,t,r){try{let n=await Pr(g(e));if(n.kind==="missing")throw ve();if(n.kind==="not_pending")throw new m("CONFLICT","This account is not scheduled fo\
r deletion.");t.status(200).json(et(n.state))}catch(n){r(n)}}o(qr,"cancelDeletionHandler");var re=Fo();re.use(E);re.get("/",Ur);re.post("/deletion",Mr);re.delete("/deletion",qr);var Fr=re;import{ZodError as Go}from"npm:zod@3.24.1";import{randomUUID as Ho}from"node:crypto";var Hr="x-request-id",Vo=64,Wo=/^[A-Za-z0-9._-]+$/,Vr=o((e,t,r)=>{let n=e.header(Hr),a=(n&&n.length<=Vo&&Wo.test(n)?n:void 0)??Ho();e.requestId=a,t.setHeader(Hr,a),r()},"requestId");function Wr(e){return e.
requestId??"unknown"}o(Wr,"getRequestId");var jo=50;function Bo(e){return e.errors.slice(0,jo).map(t=>({field:t.path.join(".")||"(root)",issue:t.code,message:t.message}))}o(Bo,"detailsFromZod");var Gr=o((e,t,r)=>{r(new m("NOT_FOUND",`No route\
 matches ${e.method} ${e.path}`))},"notFoundHandler");function Yo(e){if(!(e instanceof Error))return!1;let t=e;return t.__appError===!0&&typeof t.code=="string"&&t.code in ie}o(Yo,"isMarkedAppError");
var jr=o((e,t,r,n)=>{let s=Wr(t),a=new Date().toISOString(),i;e instanceof m?i=e:e instanceof Go?i=new m("VALIDATION_FAILED","The request failed validation.",{details:Bo(e)}):e instanceof SyntaxError&&
"body"in e?i=new m("MALFORMED_REQUEST","The request body is not valid JSON."):Yo(e)?i=new m(e.code,e.message):i=new m("INTERNAL_ERROR","An unexpected error occurred.",{cause:e});let u={requestId:s,code:i.
code,status:i.status,method:t.method,path:t.path,context:i.context,err:i.status>=500?e:void 0};i.status>=500?h.error(u,i.message):h.warn(u,i.message);let l={error:{code:i.code,message:i.message,message_key:i.
messageKey,...i.details?{details:i.details}:{},request_id:s,timestamp:a}};r.status(i.status).json(l)},"errorHandler");function Yr(e){let t=Br();t.set("trust proxy",1),t.disable("x-powered-by");let r=e.basePath?.replace(/\/+$/,"");return r&&t.use((n,s,a)=>{n.url===r?(n.url="/",n.originalUrl="/"):n.url.startsWith(`${r}\
/`)&&(n.url=n.url.slice(r.length),n.originalUrl=n.url),a()}),t.use(Vr),t.use(Qo()),t.use(Ko({origin:e.corsOrigins,credentials:!0,exposedHeaders:["x-request-id"]})),t.use(Br.json({limit:e.bodyLimit??"1\
mb"})),t.use(zo()),t.use("/api/auth",Ft),t.use("/api/v1/plants",vn),t.use("/api/v1/fitness",Wn),t.use("/api/v1/nutrition",rr),t.use("/api/v1/dashboard",ar),t.use("/api/v1/achievements",pr),t.use("/api\
/v1/reminders",gr),t.use("/api/v1/devices",Er),t.use("/api/v1/sync",kr),t.use("/api/v1/settings",Or),t.use("/api/v1/account",Fr),t.get("/healthz",(n,s)=>{s.json({status:"ok",uptime_s:Math.round(process.
uptime())})}),t.get("/api/v1",(n,s)=>{s.json({name:"PlantPal+ API",version:"v1"})}),t.use(Gr),t.use(jr),t}o(Yr,"createApp");k();import nd from"npm:node-cron@4.6.0";k();import{createHmac as Xo}from"node:crypto";var tt=100,Kr=Object.freeze([{table:"profiles",column:"user_id"},{table:"user_settings",column:"user_id"},{table:"auth_sessions",column:"user_id"},{table:"auth_tokens",column:"user_id"},{table:"email_\
verification_tokens",column:"user_id"},{table:"password_reset_tokens",column:"user_id"},{table:"consent_records",column:"user_id"},{table:"device_push_tokens",column:"user_id"},{table:"plants",column:"\
user_id"},{table:"plant_care_events",column:"user_id"},{table:"growth_log_entries",column:"user_id"},{table:"workouts",column:"user_id"},{table:"personal_records",column:"user_id"},{table:"meals",column:"\
user_id"},{table:"water_logs",column:"user_id"},{table:"foods",column:"created_by"},{table:"reminders",column:"user_id"},{table:"streaks",column:"user_id"},{table:"user_achievements",column:"user_id"},
{table:"sync_events",column:"user_id"}]);async function zr(e=tt){let{rows:t}=await _().query(`select id, email_normalised
       from users
      where status = 'PENDING_DELETION'
        and purge_after is not null
        and purge_after <= now()
      order by purge_after asc
      limit $1`,[e]);return t}o(zr,"findAccountsDueForPurge");function Jo(e,t){return Xo("sha256",t).update(e).digest("hex")}o(Jo,"subjectHash");async function Qr(e,t){return R(async r=>{let{rows:[n]}=await r.
query(`select id
         from users
        where id = $1
          and status = 'PENDING_DELETION'
          and purge_after is not null
          and purge_after <= now()
        for update`,[e.id]);if(!n)return{erased:!1,counts:{}};let s=Kr.map(({table:d,column:f},y)=>`(select count(*)::int from ${d} where ${f} = $1) as "t${y}"`).join(", "),{rows:[a]}=await r.query(`s\
elect ${s}`,[e.id]),i={};Kr.forEach(({table:d},f)=>{i[d]=a?.[`t${f}`]??0});let u=Jo(e.id,t),{rowCount:l}=await r.query(`update audit_events
          set user_id = null,
              payload = (payload - 'email' - 'email_normalised')
                        || jsonb_build_object('subject', $2::text)
        where user_id = $1`,[e.id,u]);i.audit_events_anonymised=l??0;let{rowCount:c}=await r.query("delete from login_attempts where email_normalised = $1",[e.email_normalised]);return i.login_attempts=
c??0,await r.query("delete from users where id = $1",[e.id]),i.users=1,await r.query(`insert into audit_events (user_id, event_type, payload)
       values (null, 'ACCOUNT_ERASED', $1::jsonb)`,[JSON.stringify({subject:u,rows:i,erased_at:new Date().toISOString()})]),{erased:!0,counts:i}})}o(Qr,"purgeAccount");function Zo(){let e=F();return e.AUDIT_PEPPER??e.JWT_ACCESS_SECRET}o(Zo,"pepper");async function Xr(e=tt){let t=await zr(e),r={due:t.length,erased:0,skipped:0,failed:0,counts:{}};if(t.length===0)return r;
let n=Zo();for(let s of t)try{let a=await Qr(s,n);if(!a.erased){r.skipped++;continue}r.erased++;for(let[i,u]of Object.entries(a.counts))r.counts[i]=(r.counts[i]??0)+u}catch(a){r.failed++,h.error({err:a},
"account erasure failed; will retry on the next sweep")}return h.info(r,"account erasure sweep complete"),r}o(Xr,"runPurgePass");import pd from"npm:node-cron@4.6.0";var ei="https://exp.host/--/api/v2/push/send",ti=100;function ni(e,t=ti){let r=[];for(let n=0;n<e.length;n+=t)r.push(e.slice(n,n+t));return r}o(ni,"chunkMessages");async function Jr(e){let t={delivered:[],
notRegistered:[],failed:[]};for(let r of ni(e))try{let n=await fetch(ei,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(r)});if(!n.ok){t.failed.
push(...r.map(i=>i.to)),h.warn({status:n.status},"expo push batch rejected");continue}let a=(await n.json()).data??[];r.forEach((i,u)=>{let l=a[u];l?.status==="ok"?t.delivered.push(i.to):l?.details?.error===
"DeviceNotRegistered"?t.notRegistered.push(i.to):t.failed.push(i.to)})}catch(n){t.failed.push(...r.map(s=>s.to)),h.warn({err:n},"expo push batch failed")}return t}o(Jr,"sendPushMessages");function ns(e,t,r=24){let n=r*36e5;return t.filter(s=>s.next_water_due_at.getTime()-e.getTime()<=n).map(s=>({user_id:s.user_id,reminder_type:"WATER_PLANT",target_entity_id:s.plant_id,target_entity_type:"\
PLANT",title:`Water ${s.nickname}`,body:s.next_water_due_at.getTime()<=e.getTime()?`${s.nickname} is due for watering.`:`${s.nickname} needs water soon.`,due_at_utc:s.next_water_due_at.getTime()<e.getTime()?
e:s.next_water_due_at}))}o(ns,"planWateringReminders");var ri=5,rs={timezone:"UTC",quiet_hours_mode:"WINDOW",quiet_start_time:null,quiet_end_time:null,daily_notification_cap:12},Zr={hourCycle:"h23",year:"\
numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"},es=new Map;function si(e){let t=es.get(e);if(t)return t;let r;try{r=new Intl.DateTimeFormat("en-US",{...Zr,timeZone:e})}catch{r=
new Intl.DateTimeFormat("en-US",{...Zr,timeZone:"UTC"})}return es.set(e,r),r}o(si,"formatterFor");function nt(e,t){let r=si(t).formatToParts(e),n=o(a=>r.find(i=>i.type===a)?.value??"00","part"),s=Number(
n("hour"))%24;return{dateKey:`${n("year")}-${n("month")}-${n("day")}`,minutes:s*60+Number(n("minute"))}}o(nt,"localClock");var oi=1440;function ts(e){if(e===null)return null;let t=/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.
exec(e.trim());if(!t)return null;let r=Number(t[1])*60+Number(t[2]);return r>=0&&r<oi?r:null}o(ts,"wallClockMinutes");function ii(e,t){if(t.quiet_hours_mode==="OFF")return!1;if(t.quiet_hours_mode==="S\
CHEDULED_ONLY")return!0;let r=ts(t.quiet_start_time),n=ts(t.quiet_end_time);if(r===null||n===null||r===n)return!1;let s=nt(e,t.timezone).minutes;return r<n?s>=r&&s<n:s>=r||s<n}o(ii,"isWithinQuietHours");
function ai(e,t,r){let n=nt(t,r).dateKey,s=0;for(let a of e)nt(a,r).dateKey===n&&(s+=1);return s}o(ai,"sentOnLocalDay");function ui(e){let t=e.daily_notification_cap;return!Number.isFinite(t)||t<1?rs.
daily_notification_cap:Math.floor(t)}o(ui,"capOf");function ss(e,t,r={}){let n={send:[],fail:[],defer:[]},s=t.filter(i=>i.due_at_utc.getTime()<=e.getTime()).sort((i,u)=>{let l=i.due_at_utc.getTime()-u.
due_at_utc.getTime();return l!==0?l:i.id<u.id?-1:i.id>u.id?1:0}),a=new Map;for(let i of s){if(i.attempts>=ri){n.fail.push(i.id);continue}let u=r.settings?.get(i.user_id)??rs;if(ii(e,u)){n.defer.push({
id:i.id,reason:"QUIET_HOURS"});continue}let l=a.get(i.user_id);if(l===void 0){let c=r.sentAt?.get(i.user_id)??[];l=Math.max(0,ui(u)-ai(c,e,u.timezone))}if(l===0){a.set(i.user_id,0),n.defer.push({id:i.
id,reason:"DAILY_CAP_REACHED"});continue}a.set(i.user_id,l-1),n.send.push(i.id)}return n}o(ss,"tick");var os=24;async function li(e){if(e.length===0)return 0;let t=await wr([...new Set(e.map(i=>i.user_id))]);if(t.size===0)return 0;let r=[],n=new Map;for(let i of e)for(let u of t.get(i.user_id)??[]){r.
push({to:u,title:i.title,body:i.body??"",data:{reminder_id:i.id}});let l=n.get(u);l?l.push(i.id):n.set(u,[i.id])}if(r.length===0)return 0;let s=await Jr(r);await hr(s.notRegistered,"DEVICE_NOT_REGISTE\
RED");let a=new Set;for(let i of s.delivered)for(let u of n.get(i)??[])a.add(u);return await tn([...a]),a.size}o(li,"deliverByPush");async function is(e=new Date){let t=await Qt(os),r=ns(e,t,os),n=await Xt(
r),s=await en(),a=[...new Set(s.map(f=>f.user_id))],[i,u]=await Promise.all([Jt(a),Zt(a,e)]),l=ss(e,s,{settings:i,sentAt:u});await nn(l.send),await rn(l.fail);let c=new Set(l.send),d=await li(s.filter(
f=>c.has(f.id)));return{scheduled:n,sent:l.send.length,delivered:d,failed:l.fail.length,deferred:l.defer.length}}o(is,"runReminderPass");var st=Deno.env.get("SUPABASE_FUNCTION_SLUG")??"plantpal-api";function rt(e){let t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_DB_URL");if(!t)throw new Error(
"No platform secret to derive from: set JWT_ACCESS_SECRET on the function explicitly.");return ci("sha256",t).update(`plantpal:${e}`).digest("hex")}o(rt,"derivedSecret");function se(e,t){let r=Deno.env.
get(e);return r&&r.length>0?r:t}o(se,"fromEdge");var mi=(Deno.env.get("EXTRA_CORS_ORIGINS")??Deno.env.get("CORS_ORIGINS")??"").split(",").map(e=>e.trim()).filter(Boolean),as=Deno.env.get("DATABASE_URL")??
Deno.env.get("SUPABASE_DB_URL");if(!as)throw new Error("Neither DATABASE_URL nor SUPABASE_DB_URL is set.");var us=new URL(Deno.env.get("SUPABASE_URL")??"https://localhost").origin,ls=ut({...di.env,NODE_ENV:"\
production",DATABASE_URL:as,JWT_ACCESS_SECRET:se("JWT_ACCESS_SECRET",rt("jwt-access")),AUDIT_PEPPER:se("AUDIT_PEPPER",rt("audit-pepper")),LOG_LEVEL:se("LOG_LEVEL","info"),CORS_ORIGINS:[us,...mi].join(
","),REFRESH_COOKIE_PATH:se("REFRESH_COOKIE_PATH","/")});Le(ls.DATABASE_URL,3,{rejectUnauthorized:!1});var pi=se("TICK_SECRET",rt("internal-tick")),gi=Yr({corsOrigins:ls.CORS_ORIGINS,basePath:`/${st}`}),
ot=_i();ot.post(`/${st}/internal/tick`,(e,t)=>{if(e.get("authorization")!==`Bearer ${pi}`){t.status(401).json({error:{code:"AUTHENTICATION_REQUIRED"}});return}Promise.allSettled([is(),Xr()]).then(([r,
n])=>{h.info({reminders:r.status==="fulfilled"?r.value:"failed",purge:n.status==="fulfilled"?n.value:"failed"},"internal tick complete")}),t.status(202).json({status:"accepted"})});ot.use(gi);h.info({
slug:st,origin:us},"PlantPal+ API starting on Supabase Edge");ot.listen(8e3);
