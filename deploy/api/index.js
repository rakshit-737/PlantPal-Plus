// GENERATED FILE — do not edit, and do not review as source.
// Built from apps/api/edge/index.ts by apps/api/edge/build.mjs.
// Committed deliberately: the deployed edge function loads it from this
// repository over a CDN. See deploy/README.md.
var it=Object.defineProperty;var o=(e,t)=>it(e,"name",{value:t,configurable:!0});var cs=(e,t)=>()=>(e&&(t=e(e=0)),t);var ds=(e,t)=>{for(var r in t)it(e,r,{get:t[r],enumerable:!0})};var _t={};ds(_t,{getPool:()=>_,initPool:()=>Pe,setPoolForTesting:()=>As,transaction:()=>R});import Rs from"npm:pg@8.13.1";function Pe(e,t=10,r){return j=new Rs.Pool({connectionString:e,max:t,idleTimeoutMillis:3e4,
connectionTimeoutMillis:15e3,...r===void 0?{}:{ssl:r}}),j.on("error",n=>{console.error({err:n},"postgres pool client error")}),j}function _(){if(!j)throw new Error("Database pool not initialised. Call\
 initPool() at boot.");return j}async function R(e){let t=await _().connect();try{await t.query("BEGIN");let r=await e(t);return await t.query("COMMIT"),r}catch(r){try{await t.query("ROLLBACK")}catch{}
throw r}finally{t.release()}}function As(e){j=e}var j,k=cs(()=>{"use strict";o(Pe,"initPool");o(_,"getPool");o(R,"transaction");o(As,"setPoolForTesting")});import{createHmac as li}from"node:crypto";import ci from"node:process";import di from"npm:express@4.21.2";import Yo from"npm:cors@2.8.5";import Ko from"npm:cookie-parser@1.4.7";import jr from"npm:express@4.21.2";import zo from"npm:helmet@8.0.0";import{Router as Ds}from"npm:express@4.21.2";import{createHash as ks}from"node:crypto";import{z as S}from"npm:zod@3.24.1";var _s=S.object({NODE_ENV:S.enum(["development","test","production"]).default("development"),PORT:S.coerce.number().int().min(1).max(65535).default(3e3),DATABASE_URL:S.string().url().describe("Postgre\
SQL connection string"),JWT_ACCESS_SECRET:S.string().min(32,"JWT_ACCESS_SECRET must be at least 32 characters"),AUDIT_PEPPER:S.string().min(32,"AUDIT_PEPPER must be at least 32 characters").optional(),
CORS_ORIGINS:S.string().default("http://localhost:5173").transform(e=>e.split(",").map(t=>t.trim()).filter(Boolean)),LOG_LEVEL:S.enum(["fatal","error","warn","info","debug","trace"]).default("info"),REFRESH_COOKIE_PATH:S.
string().startsWith("/").default("/api/auth")}),at;function Ce(e=process.env){let t=_s.safeParse(e);if(!t.success){let r=t.error.errors.map(n=>`  - ${n.path.join(".")||"(root)"}: ${n.message}`).join(`\

`);throw new Error(`Invalid environment configuration:
${r}`)}if(t.data.NODE_ENV==="production"&&t.data.CORS_ORIGINS.includes("*"))throw new Error('CORS_ORIGINS must not contain "*" in production (NFR-SEC-06)');return t.data}o(Ce,"loadEnv");function F(){return at??=
Ce(),at}o(F,"env");var oe={VALIDATION_FAILED:{status:422,messageKey:"errors.validation_failed"},MALFORMED_REQUEST:{status:400,messageKey:"errors.malformed_request"},AUTHENTICATION_REQUIRED:{status:401,messageKey:"errors\
.authentication_required"},INVALID_CREDENTIALS:{status:401,messageKey:"errors.invalid_credentials"},TOKEN_EXPIRED:{status:401,messageKey:"errors.token_expired"},TOKEN_INVALID:{status:401,messageKey:"e\
rrors.token_invalid"},TOKEN_REUSE_DETECTED:{status:401,messageKey:"errors.token_reuse_detected"},EMAIL_NOT_VERIFIED:{status:403,messageKey:"errors.email_not_verified"},FORBIDDEN:{status:403,messageKey:"\
errors.forbidden"},ACCOUNT_LOCKED:{status:403,messageKey:"errors.account_locked"},ACC_UNDERAGE:{status:403,messageKey:"errors.acc_underage"},NOT_FOUND:{status:404,messageKey:"errors.not_found"},CONFLICT:{
status:409,messageKey:"errors.conflict"},CURSOR_EXPIRED:{status:410,messageKey:"errors.cursor_expired"},PAYLOAD_TOO_LARGE:{status:413,messageKey:"errors.payload_too_large"},UNSUPPORTED_MEDIA_TYPE:{status:415,
messageKey:"errors.unsupported_media_type"},RATE_LIMITED:{status:429,messageKey:"errors.rate_limited"},ACC_ACCOUNT_LOCKED:{status:429,messageKey:"errors.rate_limited"},INTERNAL_ERROR:{status:500,messageKey:"\
errors.internal_error"},UPSTREAM_ERROR:{status:502,messageKey:"errors.upstream_error"},SERVICE_UNAVAILABLE:{status:503,messageKey:"errors.service_unavailable"},UPSTREAM_TIMEOUT:{status:504,messageKey:"\
errors.upstream_timeout"}},m=class extends Error{static{o(this,"AppError")}code;status;messageKey;details;context;constructor(t,r,n){super(r,n?.cause!==void 0?{cause:n.cause}:void 0),this.name="AppErr\
or",this.code=t,this.status=oe[t].status,this.messageKey=oe[t].messageKey,this.details=n?.details,this.context=n?.context}},x=o((e,t)=>new m("VALIDATION_FAILED",e,t?{details:t}:void 0),"badRequest");var N=o((e="That resource could not be found.")=>new m("NOT_FOUND",e),"notFound");import ms from"npm:pino@9.5.0";var ps=typeof globalThis.Deno<"u",gs=ps?{write(e){console.log(e.endsWith(`
`)?e.slice(0,-1):e)}}:void 0,h=ms({level:process.env.LOG_LEVEL??"info",redact:{paths:["password","passwordHash","password_hash","*.password","*.passwordHash","*.password_hash","refreshToken","refresh_\
token","*.refreshToken","*.refresh_token","authorization","req.headers.authorization","req.headers.cookie"],censor:"[redacted]"},base:{service:"plantpal-api"}},gs);import{createHash as fs,randomBytes as ys,timingSafeEqual as Ti}from"node:crypto";import $e from"npm:jsonwebtoken@9.0.2";var ws=900,hs=720*60*60,Es=32,ut=10,lt="plantpal-api",ct="plantpal-clients";function Le(e,t,r,n=1,s=Math.floor(Date.now()/1e3)){let a={sub:e,sid:t,ver:n,jti:crypto.randomUUID(),iss:lt,aud:ct,iat:s,exp:s+
ws};return $e.sign(a,r,{algorithm:"HS256"})}o(Le,"signAccessToken");function dt(e,t){try{let r=$e.verify(e,t,{algorithms:["HS256"]});return r.iss!==void 0&&r.iss!==lt||r.aud!==void 0&&r.aud!==ct?{ok:!1,
reason:"invalid"}:{ok:!0,claims:r}}catch(r){return r instanceof $e.TokenExpiredError?{ok:!1,reason:"expired"}:{ok:!1,reason:"invalid"}}}o(dt,"verifyAccessToken");function ie(){let e=ys(Es).toString("b\
ase64url");return{token:e,digest:H(e)}}o(ie,"issueRefreshToken");function H(e){return fs("sha256").update(e,"utf8").digest("hex")}o(H,"digestRefreshToken");function ae(e=new Date){return new Date(e.getTime()+hs*1e3)}o(ae,"refreshTokenExpiresAt");k();async function mt(e){return await R(async t=>{let{rows:[r]}=await t.query(`insert into users (email, email_normalised, password_hash, minimum_age_confirmed)
       values ($1, lower(trim($1)), $2, $3)
       on conflict (email_normalised) do nothing
       returning id, email, status`,[e.email,e.passwordHash,e.confirmedAge]);if(!r)throw Object.assign(new Error("That email address is already registered."),{code:"CONFLICT",status:409,__appError:!0});
let n=e.email.split("@")[0].slice(0,60);return await t.query(`insert into profiles (user_id, display_name)
       values ($1, $2)`,[r.id,n]),await t.query("insert into user_settings (user_id) values ($1)",[r.id]),r})}o(mt,"createUser");async function pt(e){let t=_(),{rows:r}=await t.query(`select id, email\
, status, password_hash, token_version,
            failed_login_count, locked_until, created_at,
            email_verified_at, deletion_requested_at, purge_after
     from users where email_normalised = $1 and status <> 'DELETED'`,[e]);return r[0]??null}o(pt,"findUserForAuth");async function gt(e){let t=_(),{rows:r}=await t.query("select id, email, status from\
 users where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(gt,"findUserById");async function Ue(e,t){if(!t)return R(c=>Ue(e,c));let r=t,n=ae(),s=e.installationId,a=crypto.randomUUID(),{token:i,
digest:u}=ie(),{rows:[l]}=await r.query(`select count(*)::text from auth_sessions
     where user_id = $1 and status = 'ACTIVE'`,[e.userId]);return Number(l?.count??0)>=ut&&await r.query(`update auth_sessions
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
     values ($1, $2, $3, null, 1, $4, $5, now())`,[e.userId,a,s,u,n]),{sessionId:a,tokenFamilyId:s,refreshToken:i,refreshTokenDigest:u}}o(Ue,"createSession");async function ft(e,t){await(t??_()).query(
`update users set failed_login_count = 0, locked_until = null, last_login_at = now()
     where id = $1`,[e])}o(ft,"recordLoginSuccess");async function C(e,t,r){await _().query(`insert into login_attempts (email_normalised, ip_prefix, outcome)
     values ($1, $2, $3)`,[e,t,r])}o(C,"recordLoginAttempt");async function yt(e){let t=_(),{rows:[r]}=await t.query(`select count(*)::text as failures, max(attempted_at)::text as last_failure_at
     from login_attempts
     where email_normalised = $1
       and outcome in ('BAD_PASSWORD', 'NO_ACCOUNT')
       and attempted_at > coalesce(
         (select max(attempted_at) from login_attempts
          where email_normalised = $1 and outcome = 'SUCCESS'),
         now() - interval '24 hours'
       )
       and attempted_at > now() - interval '24 hours'`,[e]),n=Number(r?.failures??"0"),s=r?.last_failure_at?new Date(r.last_failure_at):null,a=n>=5?Math.min(60*Math.pow(2,n-5),1800):0;return{failures:n,
lockSeconds:a,lastFailureAt:s}}o(yt,"computeLockoutState");async function Me(e){await _().query(`update users set failed_login_count = failed_login_count + 1
     where email_normalised = $1`,[e])}o(Me,"recordFailedLogin");async function wt(e,t){let r=t??_(),{rows:n}=await r.query(`select t.id, t.session_id as "sessionId", t.token_family_id as "tokenFamily\
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
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(wt,"findActiveTokenByDigest");async function ht(e,t){let r=t??_(),{rows:n}=await r.query(`select t.id, t.session_i\
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
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(ht,"findTokenByDigestAnyState");async function Et(e){let t=_(),{rows:r}=await t.query("select password_hash from u\
sers where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(Et,"findPasswordHashById");async function Rt(e,t,r,n){let s=await R(async a=>{let{rowCount:i}=await a.query(`update auth_tokens
       set consumed_at = now()
       where id = $1 and consumed_at is null`,[e]);if(i===0){let{rows:[d]}=await a.query(`select (now() - consumed_at) <= interval '15 seconds' as in_grace, generation
         from auth_tokens where id = $1`,[e]);if(d?.in_grace){let{rows:f}=await a.query(`update auth_tokens set consumed_at = now()
           where parent_id = $1 and consumed_at is null
           returning id`,[e]);if(f.length>0){let y=ae(),{token:b}=ie(),T=H(b);return await a.query(`insert into auth_tokens
               (user_id, session_id, token_family_id, parent_id, generation,
                refresh_token_digest, expires_at, family_created_at)
             values ($1, $2, $3, $4,
                     (select generation + 1 from auth_tokens where id = $4),
                     $5, $6,
                     (select family_created_at from auth_tokens where id = $4))`,[n,r,t,e,T,y]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:b,refreshTokenDigest:T}}}}return await Ts(a,
t,r,"REUSE_DETECTED"),{kind:"reuse"}}let u=ae(),{token:l}=ie(),c=H(l);return await a.query(`insert into auth_tokens
         (user_id, session_id, token_family_id, parent_id, generation,
          refresh_token_digest, expires_at, family_created_at)
       values ($1, $2, $3, $4,
               (select generation + 1 from auth_tokens where id = $4),
               $5, $6,
               (select family_created_at from auth_tokens where id = $4 for share))`,[n,r,t,e,c,u]),await a.query(`update auth_sessions set last_used_at = now()
       where id = $1 and (last_used_at is null or last_used_at < now() - interval '60 seconds')`,[r]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:l,refreshTokenDigest:c}}});if(s.kind===
"reuse")throw Object.assign(new Error("Token reuse detected. All sessions on this device have been signed out."),{code:"TOKEN_REUSE_DETECTED",status:401,__appError:!0});return s.session}o(Rt,"consumeA\
ndRotateToken");async function Ts(e,t,r,n){await e.query(`update auth_sessions
     set status = 'REVOKED', revoked_at = now(), revoke_reason = $2
     where token_family_id = $1 and status = 'ACTIVE'`,[t,n]),await e.query(`update auth_tokens
     set consumed_at = coalesce(consumed_at, now())
     where token_family_id = $1 and consumed_at is null`,[t])}o(Ts,"revokeTokenFamily");var At="$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";import bt from"npm:bcryptjs@2.4.3";var Tt=12,kt=128,B=Object.freeze({memoryCost:19456,timeCost:2,parallelism:1,outputLen:32,saltLength:16}),xt=12,J;async function It(){if(J!==void 0)return J;try{J=await import("npm:@node-rs/argon2@2.0.2"),h.info(
{backend:"argon2id",params:B},"password hashing backend selected")}catch{J=null,h.warn({backend:"bcrypt",cost:xt},"Argon2 unavailable, using the documented bcrypt fallback of NFR-SEC-03")}return J}o(It,
"getArgon2");var ue=class extends Error{static{o(this,"PasswordPolicyError")}};function qe(e){let t=[...e].length;if(t<Tt)throw new ue(`Password must be at least ${Tt} characters.`);if(t>kt)throw new ue(
`Password must be at most ${kt} characters.`)}o(qe,"assertPasswordPolicy");async function Dt(e){qe(e);let t=await It();return t?t.hash(e,{memoryCost:B.memoryCost,timeCost:B.timeCost,parallelism:B.parallelism,
outputLen:B.outputLen,saltLength:B.saltLength}):bt.hash(e,xt)}o(Dt,"hashPassword");async function le(e,t){try{if(t.startsWith("$argon2")){let r=await It();return r?await r.verify(t,e):(h.error("an Arg\
on2 hash was stored but no Argon2 backend is available"),!1)}return t.startsWith("$2")?await bt.compare(e,t):(h.error("stored password hash is in an unrecognised format"),!1)}catch{return!1}}o(le,"ver\
ifyPassword");function Nt(e){return e.trim().toLowerCase()}o(Nt,"normaliseEmail");function bs(e){let t=e.ip??"0.0.0.0";return t.includes(":")?t.split(":").slice(0,3).join(":")+"::":t.split(".").slice(0,3).join(".")+
".0"}o(bs,"ipPrefix");function xs(e){let t=e.header("x-plantpal-device");return t&&t.replace(/[\x00-\x1f]/g,"").replace(/\s+/g," ").trim().slice(0,120)||null}o(xs,"deviceLabel");function Fe(e){let t=e.
header("x-plantpal-client");return t==="IOS"||t==="ANDROID"||t==="WEB"?t:"WEB"}o(Fe,"platform");function He(){return F().JWT_ACCESS_SECRET}o(He,"accessSecret");var Is=250;async function vt(e,t=Is){let r=t-
(Date.now()-e);r>0&&await new Promise(n=>setTimeout(n,r))}o(vt,"enforceTimingFloor");function St(){return{httpOnly:!0,secure:!0,sameSite:"none",path:F().REFRESH_COOKIE_PATH,maxAge:720*60*60*1e3}}o(St,
"refreshCookieOptions");function Ot(e){if(!!!e.cookies?.refresh_token)return;let r=e.get("origin");if(!r){let n=e.get("referer");if(n)try{r=new URL(n).origin}catch{r=void 0}}if(!r||!F().CORS_ORIGINS.includes(
r))throw new m("FORBIDDEN","Cross-origin session request refused.")}o(Ot,"assertTrustedOriginForCookieAuth");async function Ct(e,t,r){let n=Date.now();try{let{email:s,password:a,confirmed_age:i}=e.body,
u=[],l=s?Nt(s):"";if((!s||s.length<5||s.length>254||!s.includes("@"))&&u.push({field:"email",issue:"invalid"}),!a)u.push({field:"password",issue:"required"});else try{qe(a)}catch{u.push({field:"passwo\
rd",issue:"policy_violation"})}if(i!==!0&&u.push({field:"confirmed_age",issue:"must_be_confirmed"}),u.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:u});let c=await Dt(
a);try{await mt({email:s,passwordHash:c,confirmedAge:i})}catch(d){if(!(d&&typeof d=="object"&&"__appError"in d))throw d}h.info({email_digest:ks("sha256").update(l).digest("hex").slice(0,16)},"registra\
tion attempt"),await vt(n),t.status(202).json({status:"registered",message:"Check your email for a confirmation link."})}catch(s){r(s)}}o(Ct,"register");async function $t(e,t,r){let n=Date.now();try{let{
email:s,password:a}=e.body;if(!s||!a)throw new m("VALIDATION_FAILED","Email and password are required.",{details:[...s?[]:[{field:"email",issue:"required"}],...a?[]:[{field:"password",issue:"required"}]]});
let i=Nt(s),u=bs(e),l=await yt(i);if(l.failures>=5){let q=(l.lastFailureAt?.getTime()??Date.now())+l.lockSeconds*1e3;if(q>Date.now()){let X=Math.ceil((q-Date.now())/1e3);throw await C(i,u,"LOCKED_OUT"),
t.setHeader("Retry-After",String(X)),new m("ACC_ACCOUNT_LOCKED",`Too many attempts. Try again in ${X} seconds.`,{context:{retry_after_seconds:X}})}}let c=await pt(i),d=c?.password_hash??At,f=await le(
a,d);if(await vt(n),!c||!c.password_hash)throw await C(i,u,"NO_ACCOUNT"),i&&await Me(i),new m("INVALID_CREDENTIALS","That email or password is not right.");if(!f)throw await C(i,u,"BAD_PASSWORD"),await Me(
i),new m("INVALID_CREDENTIALS","That email or password is not right.");let y=new Date;if(c.locked_until&&c.locked_until>y)throw await C(i,u,"LOCKED_OUT"),new m("ACCOUNT_LOCKED","Account is locked.");if(c.
purge_after&&c.purge_after<=y)throw await C(i,u,"NO_ACCOUNT"),new m("INVALID_CREDENTIALS","That email or password is not right.");if(c.status==="PENDING_VERIFICATION"&&c.created_at.getTime()+6048e5<y.
getTime())throw await C(i,u,"UNVERIFIED"),new m("EMAIL_NOT_VERIFIED","Confirm your email address to sign in.",{context:{resend_available:!0}});let b=crypto.randomUUID(),T=await Ue({userId:c.id,platform:Fe(
e),installationId:b,deviceLabel:xs(e),ipAddressHash:u,userAgent:(e.get("user-agent")??"").slice(0,200)});await ft(c.id),await C(i,u,"SUCCESS");let M={access_token:Le(c.id,T.sessionId,He(),c.token_version),
token_type:"Bearer",expires_in:900,user:{id:c.id,email:c.email,status:c.status}};Fe(e)==="WEB"?t.cookie("refresh_token",T.refreshToken,St()):M.refresh_token=T.refreshToken,c.status==="PENDING_DELETION"&&
(M.account_pending_deletion=!0,M.deletion_scheduled_at=c.purge_after?.toISOString()),t.status(200).json(M)}catch(s){r(s)}}o($t,"login");async function Lt(e,t,r){try{Ot(e);let n=e.cookies?.refresh_token??
e.body?.refresh_token;if(!n)throw new m("AUTHENTICATION_REQUIRED","No refresh token provided.");let s=H(n),a=await wt(s)??await ht(s);if(!a)throw new m("TOKEN_EXPIRED","Session expired. Please sign in\
 again.");let i=await Rt(a.id,a.tokenFamilyId,a.sessionId,a.userId),u=Le(a.userId,a.sessionId,He(),a.tokenVersion),l=Fe(e)==="WEB",c={access_token:u,token_type:"Bearer",expires_in:900};l?t.cookie("ref\
resh_token",i.refreshToken,St()):c.refresh_token=i.refreshToken,t.status(200).json(c)}catch(n){r(n)}}o(Lt,"refresh");async function Pt(e,t,r){try{Ot(e);let n=e.cookies?.refresh_token??e.body?.refresh_token;
if(n){let s=H(n),a=(await Promise.resolve().then(()=>(k(),_t))).getPool();await a.query(`update auth_tokens
         set consumed_at = coalesce(consumed_at, now())
         where refresh_token_digest = $1 and consumed_at is null`,[s]),await a.query(`update auth_sessions s
         set status = 'REVOKED', revoked_at = now(), revoke_reason = 'USER_LOGOUT'
         from auth_tokens t
         where t.session_id = s.id
           and t.refresh_token_digest = $1
           and s.status = 'ACTIVE'`,[s])}t.clearCookie("refresh_token",{path:F().REFRESH_COOKIE_PATH}),t.status(200).json({status:"logged_out"})}catch(n){r(n)}}o(Pt,"logout");async function Ut(e,t,r){
try{let n=e.userId,s=n?await gt(n):null;if(!s)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");t.status(200).json({user:s})}catch(n){r(n)}}o(Ut,"me");async function E(e,t,r){try{let n=e.
header("authorization");if(!n?.startsWith("Bearer "))throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");let s=n.slice(7),a=He(),i=dt(s,a);if(!i.ok)throw new m(i.reason==="expired"?"T\
OKEN_EXPIRED":"TOKEN_INVALID",i.reason==="expired"?"Access token expired. Refresh to continue.":"Invalid access token.");e.userId=i.claims.sub,e.sessionId=i.claims.sid,r()}catch(n){r(n)}}o(E,"authenti\
cate");function Mt(e){let t=new Map;return o(function(n,s,a){let i=Date.now();if(t.size>1e4)for(let[c,d]of t)d.resetAt<=i&&t.delete(c);let u=n.ip??"unknown",l=t.get(u);if(!l||l.resetAt<=i){t.set(u,{count:1,resetAt:i+
e.windowMs}),a();return}if(l.count+=1,l.count>e.max){s.setHeader("Retry-After",String(Math.ceil((l.resetAt-i)/1e3))),a(new m("RATE_LIMITED","Too many requests. Slow down."));return}a()},"rateLimitMidd\
leware")}o(Mt,"rateLimit");var V=Ds();process.env.NODE_ENV!=="test"&&V.use(Mt({windowMs:6e4,max:30}));V.post("/register",Ct);V.post("/login",$t);V.post("/refresh",Lt);V.post("/logout",Pt);V.get("/me",E,Ut);var qt=V;import{Router as Xs}from"npm:express@4.21.2";import{z as W}from"npm:zod@3.24.1";function g(e){let t=e.userId;if(typeof t!="string"||t.length===0)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");return t}o(g,"getUserId");function A(...e){return Object.freeze(Object.fromEntries(e.map(t=>[t,t])))}o(A,"asEnum");var Ve=A("NORTHERN","SOUTHERN","EQUATORIAL"),w=A("SPRING","SUMMER","AUTUMN","WINTER","YEAR_ROUND"),na=A("METRIC",
"IMPERIAL"),Z=A("LOW","MEDIUM","BRIGHT_INDIRECT","DIRECT_SUN"),$=A("FABRIC","TERRACOTTA","CONCRETE","CERAMIC_GLAZED","METAL","PLASTIC","OTHER"),O=A("ORCHID_BARK","CACTUS_SUCCULENT","GARDEN_SOIL","STAN\
DARD_POTTING","PEAT_BASED","COCO_COIR","SEMI_HYDRO_LECA","OTHER"),ce=A("INDOOR","OUTDOOR"),ee=A("NONE","HEATED_DRY_WINTER","AIR_CONDITIONED","HUMID_ROOM"),ra=A("THRIVING","NEEDS_ATTENTION","CRITICAL",
"DORMANT"),sa=A("WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"),oa=A("LOW","MODERATE","VIGOROUS"),ia=A("HEAVIEST_WEIGHT","BEST_ESTIMATED_1RM","BEST_REP_COUNT"),aa=A("BREAKFAST","\
LUNCH","DINNER","SNACK"),de=A("MALE","FEMALE","PREFER_NOT_TO_SAY"),Y=A("SEDENTARY","LIGHTLY_ACTIVE","MODERATELY_ACTIVE","VERY_ACTIVE","EXTRA_ACTIVE"),ua=A("LOSE","MAINTAIN","GAIN"),la=A("GRAM","MILLIL\
ITRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"),ca=A("SYNCED","PENDING","SYNCING","FAILED"),da=A("PENDING","SENT","DELIVERED","FAILED","SUPPRESSED","CANCELLED");function We(e){if(!Number.isFinite(e))throw new RangeError(`roundHalfUp expected a finite number, received ${e}`);return Math.sign(e)*Math.floor(Math.abs(e)+.5)}o(We,"roundHalfUp");function K(e,t){if(!Number.
isFinite(e))throw new RangeError(`roundTo expected a finite number, received ${e}`);if(!Number.isInteger(t)||t<0||t>10)throw new RangeError(`roundTo expected 0..10 decimals, received ${t}`);let r=10**
t;return Math.sign(e)*Math.floor(Math.abs(e)*r+.5)/r}o(K,"roundTo");function Ft(e,t,r){if(t>r)throw new RangeError(`clamp received an inverted range: min ${t} exceeds max ${r}`);return Math.min(Math.max(
e,t),r)}o(Ft,"clamp");var Ns=[w.WINTER,w.WINTER,w.SPRING,w.SPRING,w.SPRING,w.SUMMER,w.SUMMER,w.SUMMER,w.AUTUMN,w.AUTUMN,w.AUTUMN,w.WINTER],vs=Object.freeze({[w.WINTER]:w.SUMMER,[w.SUMMER]:w.WINTER,[w.SPRING]:w.AUTUMN,[w.AUTUMN]:w.
SPRING,[w.YEAR_ROUND]:w.YEAR_ROUND});function Ss(e,t){if(t===Ve.EQUATORIAL)return w.YEAR_ROUND;let r=Ns[e-1];if(r===void 0)throw new RangeError(`seasonForMonth expected a month in 1..12, received ${e}`);
return t===Ve.NORTHERN?r:vs[r]}o(Ss,"seasonForMonth");function Ht(e,t){let r=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!r?.[2])throw new RangeError(`seasonForLocalDate expected a YYYY-MM-DD date, receive\
d "${e}"`);let n=Number(r[2]);if(n<1||n>12)throw new RangeError(`seasonForLocalDate received an out-of-range month in "${e}"`);return Ss(n,t)}o(Ht,"seasonForLocalDate");var Os=Object.freeze({[w.SPRING]:.95,[w.SUMMER]:.8,[w.AUTUMN]:1.15,[w.WINTER]:1.4,[w.YEAR_ROUND]:1}),Cs=Object.freeze({[Z.LOW]:1.25,[Z.MEDIUM]:1.1,[Z.BRIGHT_INDIRECT]:1,[Z.DIRECT_SUN]:.85}),$s=Object.
freeze({[$.FABRIC]:.75,[$.TERRACOTTA]:.8,[$.CONCRETE]:.9,[$.CERAMIC_GLAZED]:1,[$.OTHER]:1,[$.METAL]:1.05,[$.PLASTIC]:1.1}),Ls=Object.freeze({[O.ORCHID_BARK]:.75,[O.CACTUS_SUCCULENT]:.85,[O.GARDEN_SOIL]:.95,
[O.STANDARD_POTTING]:1,[O.OTHER]:1,[O.PEAT_BASED]:1.1,[O.COCO_COIR]:1.1,[O.SEMI_HYDRO_LECA]:1.3}),Ps=Object.freeze({[ce.INDOOR]:1,[ce.OUTDOOR]:.85}),Us=Object.freeze({[ee.HEATED_DRY_WINTER]:.85,[ee.AIR_CONDITIONED]:.9,
[ee.NONE]:1,[ee.HUMID_ROOM]:1.2});function Ms(e){if(e==null)return 1;if(!Number.isFinite(e)||e<=0)throw new RangeError(`potDiameterFactor expected a positive diameter, received ${e}`);return e<10?.8:e<
15?.9:e<20?1:e<30?1.15:e<40?1.3:1.45}o(Ms,"potDiameterFactor");function qs(e){return e===!1?1.15:1}o(qs,"drainageFactor");function Vt(e){let{baseIntervalDays:t,minIntervalDays:r,maxIntervalDays:n,season:s,
lightExposure:a,placement:i}=e;if(!Number.isFinite(t)||t<=0)throw new RangeError(`baseIntervalDays must be positive, received ${t}`);if(r>n)throw new RangeError(`species bounds are inverted: min ${r} \
exceeds max ${n}`);let u=Os[s],l=Cs[a],c=e.potMaterial?$s[e.potMaterial]:1,d=Ms(e.potDiameterCm),f=qs(e.hasDrainage),y=c*d*f,b=Ps[i],T=e.soilType?Ls[e.soilType]:1,D=i===ce.OUTDOOR?1:e.indoorClimate?Us[e.
indoorClimate]:1,M=b*T*D,Se=t*u*l*y*M,q=We(Se),X=Ft(q,r,n),ls=Math.max(X,1),Oe=null;return q<r?Oe="MIN":q>n&&(Oe="MAX"),{baseIntervalDays:t,season:s,fSeason:u,lightExposure:a,fLight:l,fPot:y,fMaterial:c,
fDiameter:d,fDrainage:f,fEnv:M,fPlacement:b,fSoil:T,fClimate:D,rawInterval:Se,effectiveIntervalDays:ls,clamped:Oe}}o(Vt,"computeWateringInterval");var ba=Object.freeze({protein:4,carbohydrate:4,fat:9});var xa=Object.freeze({[de.MALE]:5,[de.FEMALE]:-161,[de.PREFER_NOT_TO_SAY]:-78}),Ia=Object.freeze({[Y.SEDENTARY]:1.2,[Y.LIGHTLY_ACTIVE]:1.375,[Y.MODERATELY_ACTIVE]:1.55,[Y.VERY_ACTIVE]:1.725,[Y.EXTRA_ACTIVE]:1.9}),
Da=Object.freeze({bodyMassKg:{min:30,max:400},heightCm:{min:100,max:250},ageYears:{min:16,max:120}});function _e(e,t,r){if(!Number.isFinite(e)||e<1||e>23)throw new RangeError(`metValue must be between 1.0 and 23.0, received ${e}`);if(!Number.isFinite(t)||t<=0)throw new RangeError(`bodyMassKg must be \
positive, received ${t}`);if(!Number.isFinite(r)||r<=0)throw new RangeError(`durationMinutes must be positive, received ${r}`);return K(e*t*r/60,1)}o(_e,"workoutEnergyKcal");var Wt=Object.freeze({min:1,
max:12});function me(e,t){if(!Number.isFinite(e)||e<0)throw new RangeError(`weightKg must be non-negative, received ${e}`);if(!Number.isInteger(t)||t<1)throw new RangeError(`reps must be a positive in\
teger, received ${t}`);if(e===0)return 0;let r=t===1?e:e*(1+t/30);return K(r,1)}o(me,"estimatedOneRepMax");function pe(e,t){return e>0&&Number.isInteger(t)&&t>=Wt.min&&t<=Wt.max}o(pe,"isEligibleForOne\
RepMaxRecord");function ge(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError(`reps must be a non-negative integer, received ${e}`);if(!Number.isFinite(t)||t<0)throw new RangeError(`weightKg must \
be non-negative, received ${t}`);return K(e*t,1)}o(ge,"setVolumeKg");function fe(e){let t=e.reduce((r,n)=>r+n.reps*n.weightKg,0);return K(t,1)}o(fe,"totalVolumeKg");var Ge=/^\d{4}-\d{2}-\d{2}$/;function Fs(e,t){if(!Ge.test(e)||!Ge.test(t))throw new RangeError("local dates must be YYYY-MM-DD");return Math.round((Date.parse(t)-Date.parse(e))/864e5)}o(Fs,"localDateD\
iffDays");function Gt(e,t){if(!Ge.test(t))throw new RangeError("todayLocalDate must be YYYY-MM-DD");if(e.lastCountedDate===null)return{...e,currentLength:1,longestLength:Math.max(e.longestLength,1),lastCountedDate:t};
let r=Fs(e.lastCountedDate,t);if(r<=0)return e;if(r===1){let s=e.currentLength+1;return{...e,currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t}}let n=r-1;if(n<=e.freezeTokens){
let s=e.currentLength+1;return{currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t,freezeTokens:e.freezeTokens-n}}return{...e,currentLength:1,longestLength:Math.max(e.longestLength,
1),lastCountedDate:t}}o(Gt,"advanceStreakOnLog");k();function Hs(e){return{currentLength:e?.current_length??0,longestLength:e?.longest_length??0,lastCountedDate:e?.last_counted_date??null,freezeTokens:e?.freeze_tokens??0}}o(Hs,"toState");async function jt(e,t,r,n){
await e.query(`insert into streaks (user_id, streak_type)
     values ($1, $2)
     on conflict (user_id, streak_type) do nothing`,[t,r]);let{rows:s}=await e.query(`select current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1 and streak_type = $2
     for update`,[t,r]),a=Gt(Hs(s[0]),n);return await e.query(`update streaks
     set current_length = $3, longest_length = $4, last_counted_date = $5,
         freeze_tokens = $6, updated_at = now()
     where user_id = $1 and streak_type = $2`,[t,r,a.currentLength,a.longestLength,a.lastCountedDate,a.freezeTokens]),a}o(jt,"advanceScope");var Bt={plants_added:"select count(*)::int as v from plants\
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
                       ) then 1 else 0 end as v`};function Vs(e,t){return e.filter(r=>{let n=t.get(r.metric);return n!==void 0&&n>=r.gte})}o(Vs,"evaluateUnlocks");async function Yt(e,t){let{rows:r}=await e.
query(`select a.id, a.code, a.criteria
     from achievements a
     where a.is_active
       and not exists (
         select 1 from user_achievements ua
         where ua.user_id = $1 and ua.achievement_id = a.id and ua.unlocked_at is not null
       )`,[t]),n=[];for(let i of r){let u=i.criteria;typeof u?.metric=="string"&&typeof u?.gte=="number"&&Bt[u.metric]&&n.push({id:i.id,code:i.code,metric:u.metric,gte:u.gte})}if(n.length===0)return[];
let s=new Map;for(let i of new Set(n.map(u=>u.metric))){let u=Bt[i];if(!u)continue;let{rows:l}=await e.query(u,[t]);s.set(i,Number(l[0]?.v??0))}let a=Vs(n,s);for(let i of a)await e.query(`insert into \
user_achievements (user_id, achievement_id, unlocked_at, progress_pct)
       values ($1, $2, now(), 100)
       on conflict (user_id, achievement_id)
       do update set unlocked_at = coalesce(user_achievements.unlocked_at, now()), progress_pct = 100`,[t,i.id]);return a.map(i=>i.code)}o(Yt,"evaluateAchievements");var Ws={PLANT_CARE:`select (not ex\
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
              where user_id = $1 and local_date_str = $2 and deleted_at is null`};async function Gs(e,t,r){return R(async n=>{let{rows:s}=await n.query(Ws[t],[e,r]),a=s[0]?.met===!0;if(a){await jt(n,e,
t,r);let{rows:u}=await n.query(`select streak_type, last_counted_date from streaks
         where user_id = $1 and streak_type in ('PLANT_CARE', 'FITNESS', 'NUTRITION')
         order by streak_type
         for update`,[e]);u.length===3&&u.every(c=>c.last_counted_date===r)&&await jt(n,e,"OVERALL",r)}let i=await Yt(n,e);return{met:a,unlocked:i}})}o(Gs,"recordDailyLog");async function ye(e){try{let t=await R(
r=>Yt(r,e));t.length>0&&h.info({userId:e,unlocked:t},"achievements unlocked")}catch(t){h.warn({err:t,userId:e},"achievement evaluation failed (log write unaffected)")}}o(ye,"evaluateAchievementsSafe");
async function L(e,t,r){try{let{met:n,unlocked:s}=await Gs(e,t,r);s.length>0&&h.info({userId:e,scope:t,met:n,unlocked:s},"achievements unlocked")}catch(n){h.warn({err:n,userId:e,scope:t},"engagement u\
pdate failed (log write unaffected)")}}o(L,"recordDailyLogSafe");k();async function zt(e){let t=_(),{rows:r}=await t.query(`select p.id as plant_id, p.user_id, p.nickname, p.next_water_due_at
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
       )`,[e]);return r}o(zt,"findPlantsNeedingReminder");async function Qt(e){if(e.length===0)return 0;let t=_(),r=0;for(let n of e){let s=await t.query(`insert into reminders
         (user_id, reminder_type, target_entity_id, target_entity_type, title, body, due_at_utc)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, reminder_type, target_entity_id)
         where status = 'PENDING' and target_entity_id is not null
       do nothing`,[n.user_id,n.reminder_type,n.target_entity_id,n.target_entity_type,n.title,n.body,n.due_at_utc]);r+=s.rowCount??0}return r}o(Qt,"insertReminders");var js=["OFF","WINDOW","SCHEDULED_\
ONLY"];function Kt(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(Kt,"toWallClock");async function Xt(e){let t=new Map;if(e.length===0)return t;let r=_(),{rows:n}=await r.
query(`select user_id, timezone, quiet_hours_mode, quiet_start_time, quiet_end_time,
            daily_notification_cap
     from user_settings
     where user_id = any ($1::uuid[])`,[e]);for(let s of n)t.set(s.user_id,{timezone:s.timezone,quiet_hours_mode:js.includes(s.quiet_hours_mode)?s.quiet_hours_mode:"OFF",quiet_start_time:Kt(s.quiet_start_time),
quiet_end_time:Kt(s.quiet_end_time),daily_notification_cap:s.daily_notification_cap});return t}o(Xt,"findNotificationSettings");async function Jt(e,t,r=48){let n=new Map;if(e.length===0)return n;let s=_(),
{rows:a}=await s.query(`select user_id, sent_at
     from reminders
     where user_id = any ($1::uuid[])
       and status in ('SENT', 'DELIVERED')
       and sent_at is not null
       -- Bounded by the caller's now(), not the database's, so the count the
       -- engine sees is the count for the instant it is deciding about.
       and sent_at > $2::timestamptz - ($3 || ' hours')::interval
       and sent_at <= $2::timestamptz`,[e,t,r]);for(let i of a){let u=n.get(i.user_id);u?u.push(i.sent_at):n.set(i.user_id,[i.sent_at])}return n}o(Jt,"findRecentSentAt");async function Zt(e=200){let t=_(),
{rows:r}=await t.query(`select id, user_id, title, body, due_at_utc, attempts
     from reminders
     where status = 'PENDING' and due_at_utc <= now()
     order by due_at_utc asc
     limit $1`,[e]);return r}o(Zt,"findDuePending");async function en(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'DELIVERED', updated_at = now()
     where id = any ($1::uuid[]) and status = 'SENT'`,[e])}o(en,"markDelivered");async function tn(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'SENT', sent_at = now(), attempts = attempts + 1, updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(tn,"markSent");async function nn(e){if(e.length===0)return;await _().query(`update reminders
     set status = 'FAILED', last_error = 'delivery attempts exhausted', updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(nn,"markFailed");async function rn(e,t=50){let r=_(),{rows:n}=await r.query(`select id, reminder_type, target_entity_id, title, body, du\
e_at_utc, status, sent_at
     from reminders
     where user_id = $1
       and (status in ('PENDING', 'SENT')
            or (status = 'DELIVERED' and sent_at > now() - interval '7 days'))
     order by due_at_utc desc
     limit $2`,[e,t]);return n}o(rn,"listForUser");async function sn(e,t){return((await _().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where id = $1 and user_id = $2 and status in ('PENDING', 'SENT')`,[t,e])).rowCount??0)>0}o(sn,"dismiss");async function je(e,t){return(await _().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where user_id = $1 and target_entity_id = $2 and status in ('PENDING', 'SENT')`,[e,t])).rowCount??0}o(je,"cancelForTarget");k();var we=`id, nickname, species_id, status, next_water_due_at, effective_interval_days,
  photo_url, watering_factor_snapshot, light_exposure, placement, pot_material, soil_type,
  base_interval_days, min_interval_days, max_interval_days, last_watered_at, room,
  acquisition_date, created_at`;async function an(e){let t=_(),{rows:r}=await t.query(`SELECT ${we} FROM plants WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[e]);return r}o(an,"li\
stPlants");async function he(e,t){let r=_(),{rows:n}=await r.query(`SELECT ${we} FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[e,t]);return n[0]??null}o(he,"getPlant");async function un(e,t){
let r=_(),{rows:[n]}=await r.query(`INSERT INTO plants
       (user_id, nickname, species_id, room, acquisition_date, light_exposure, placement,
        pot_material, has_drainage, soil_type, indoor_climate, base_interval_days,
        min_interval_days, max_interval_days, photo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${we}`,[e,t.nickname,t.species_id??null,t.room??null,t.acquisition_date??null,t.light_exposure,t.placement,t.pot_material??null,t.has_drainage??null,t.soil_type??null,t.indoor_climate??
null,t.base_interval_days,t.min_interval_days,t.max_interval_days,t.photo_url??null]);return n}o(un,"createPlant");var Bs=new Set(["nickname","species_id","room","acquisition_date","light_exposure","p\
lacement","pot_material","has_drainage","soil_type","indoor_climate","base_interval_days","min_interval_days","max_interval_days","photo_url"]);async function ln(e,t,r){let n=Object.entries(r).filter(
([l,c])=>c!==void 0&&Bs.has(l));if(n.length===0)return he(e,t);let s=n.map(([l],c)=>`${l}=$${c+3}`).join(", "),a=n.map(([,l])=>l),i=_(),{rows:u}=await i.query(`UPDATE plants SET ${s}, updated_at=now()\

     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     RETURNING ${we}`,[e,t,...a]);return u[0]??null}o(ln,"updatePlant");async function cn(e,t){let r=_(),{rowCount:n}=await r.query("UPDATE plants SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND d\
eleted_at IS NULL",[e,t]);return(n??0)>0}o(cn,"softDeletePlant");async function Ee(e,t,r,n,s,a){await R(async i=>{let{rows:[u]}=await i.query(`SELECT base_interval_days, min_interval_days, max_interva\
l_days, light_exposure,
              placement, pot_material, pot_diameter_cm, soil_type, indoor_climate,
              has_drainage, effective_interval_days
       FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[t,e]);if(!u)throw Object.assign(new Error("Plant not found"),{__notFound:!0});if(((await i.query(`INSERT INTO plant_care_events
         (plant_id, user_id, action_type, note, local_date_str, interval_at_log_days, client_idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (client_idempotency_key) DO NOTHING`,[t,e,r,n??null,s,u.effective_interval_days??null,a??null])).rowCount??0)!==0&&r==="WATER"){let c=Ht(s,"NORTHERN"),d=Vt({baseIntervalDays:u.base_interval_days,
minIntervalDays:u.min_interval_days,maxIntervalDays:u.max_interval_days,season:c,lightExposure:u.light_exposure,placement:u.placement,potMaterial:u.pot_material,potDiameterCm:u.pot_diameter_cm,hasDrainage:u.
has_drainage,soilType:u.soil_type,indoorClimate:u.indoor_climate});await i.query(`UPDATE plants
         SET last_watered_at=now(),
             next_water_due_at=now() + ($1 || ' days')::interval,
             effective_interval_days=$1,
             watering_factor_snapshot=$2,
             updated_at=now()
         WHERE id=$3`,[d.effectiveIntervalDays,JSON.stringify(d),t])}})}o(Ee,"logCareEvent");async function dn(e,t,r=50){let n=_(),{rows:s}=await n.query(`SELECT id, plant_id, user_id, action_type, no\
te, logged_at_utc, local_date_str,
            interval_at_log_days, client_idempotency_key
     FROM plant_care_events WHERE plant_id=$1 AND user_id=$2 ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(dn,"listCareEvents");var _n=`id, plant_id, user_id, photo_url, photo_storage_key,\
 height_cm, note,
  logged_at_utc, local_date_str, created_at`,on=40;async function mn(e,t,r){let n=_(),{rows:s}=await n.query(`INSERT INTO growth_log_entries
       (plant_id, user_id, photo_url, photo_storage_key, height_cm, note, local_date_str)
     SELECT p.id, p.user_id, $3::text, $4::text, $5::numeric, $6::text, $7::text
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL
        AND (SELECT count(*) FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) < $8::int
     RETURNING ${_n}`,[t,e,r.photo_url,r.photo_storage_key,r.height_cm??null,r.note??null,r.local_date_str,on]),a=s[0];if(a)return{status:"CREATED",entry:a};let{rows:[i]}=await n.query(`SELECT (SELECT\
 count(*)::int FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) AS current
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL`,[t,e]);return i?{status:"LIMIT_EXCEEDED",current:i.current,ceiling:on}:{status:"NOT_FOUND"}}o(mn,"createGrowthEntry");async function pn(e,t,r=50){
let n=_(),{rows:s}=await n.query(`SELECT ${_n}
     FROM growth_log_entries
     WHERE plant_id=$1 AND user_id=$2 AND deleted_at IS NULL
     ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(pn,"listGrowthEntries");async function gn(e,t,r){let n=_(),{rowCount:s}=await n.query(`UPDATE growth_log_entries SET deleted_at=now()
     WHERE id=$1 AND plant_id=$2 AND user_id=$3 AND deleted_at IS NULL`,[e,t,r]);return(s??0)>0}o(gn,"softDeleteGrowthEntry");async function fn(e){let t=_();if(e){let{rows:n}=await t.query(`SELECT id,\
 common_name, scientific_name, base_interval_days, min_interval_days,
              max_interval_days, default_light, default_soil, care_notes, image_url
       FROM species WHERE lower(common_name) ILIKE $1 AND NOT is_custom ORDER BY common_name LIMIT 200`,[`%${e.toLowerCase()}%`]);return n}let{rows:r}=await t.query(`SELECT id, common_name, scientific\
_name, base_interval_days, min_interval_days,
            max_interval_days, default_light, default_soil, care_notes, image_url
     FROM species WHERE NOT is_custom ORDER BY common_name LIMIT 200`);return r}o(fn,"listSpecies");var yn=["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"],Ys=W.string().trim().max(2048).url().refine(e=>/^https?:\/\//i.test(e),"photo_url must be an http(s) URL"),Ks=W.object({photo_url:Ys,
photo_storage_key:W.string().trim().min(1).max(512).optional(),height_cm:W.number().min(0).max(5e3).optional(),note:W.string().trim().max(1e3).optional(),local_date_str:W.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).
strict(),zs=20;function Qs(e){return e.issues.slice(0,zs).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))}o(Qs,"detailsFor");function Re(e,t){let r=W.string().uuid().safeParse(e);if(!r.success)
throw x(`${t} must be a UUID.`,[{field:t,issue:"invalid"}]);return r.data}o(Re,"requireUuidParam");async function wn(e,t,r){try{let n=g(e),s=await an(n);t.json(s)}catch(n){r(n)}}o(wn,"list");async function hn(e,t,r){try{let n=g(e),s=await he(e.params.id,n);if(!s)throw N();t.json(s)}catch(n){r(n)}}o(
hn,"get");async function En(e,t,r){try{let n=g(e),s=e.body,a=typeof s.nickname=="string"?s.nickname.trim():"";if(!a||a.length>80)throw x("nickname must be 1\u201380 characters.",[{field:"nickname",issue:"\
invalid"}]);let i=Number(s.base_interval_days);if(!Number.isInteger(i)||i<1||i>365)throw x("base_interval_days must be 1\u2013365.",[{field:"base_interval_days",issue:"invalid"}]);let u=Number(s.min_interval_days),
l=Number(s.max_interval_days);if(u>l)throw x("min_interval_days must not exceed max_interval_days.",[{field:"min_interval_days",issue:"invalid"}]);let c=await un(n,s);t.status(201).json(c)}catch(n){r(
n)}}o(En,"create");async function Rn(e,t,r){try{let n=g(e),s=await ln(e.params.id,n,e.body);if(!s)throw N();t.json(s)}catch(n){r(n)}}o(Rn,"update");async function An(e,t,r){try{let n=g(e);if(!await cn(
e.params.id,n))throw N();await je(n,e.params.id).catch(()=>{}),t.json({status:"deleted"})}catch(n){r(n)}}o(An,"remove");async function Tn(e,t,r){try{let n=g(e),s=e.body,a=s.action_type;if(!a||!yn.includes(
a))throw x("action_type must be one of: "+yn.join(", "),[{field:"action_type",issue:"invalid"}]);let i=s.local_date_str;if(!i)throw x("local_date_str is required.",[{field:"local_date_str",issue:"requ\
ired"}]);try{await Ee(n,e.params.id,a,s.note,i,s.client_idempotency_key)}catch(u){throw u&&typeof u=="object"&&"__notFound"in u?N():u}a==="WATER"&&await je(n,e.params.id).catch(()=>{}),await L(n,"PLAN\
T_CARE",i),t.status(201).json({status:"logged"})}catch(n){r(n)}}o(Tn,"logCare");async function kn(e,t,r){try{let n=g(e),s=await dn(e.params.id,n);t.json(s)}catch(n){r(n)}}o(kn,"getCareHistory");async function bn(e,t,r){
try{let n=g(e),s=Re(e.params.id,"id"),a=Ks.safeParse(e.body);if(!a.success)throw x("The request failed validation.",Qs(a.error));let i=a.data,u=await mn(n,s,{photo_url:i.photo_url,photo_storage_key:i.
photo_storage_key??i.photo_url,...i.height_cm!==void 0?{height_cm:i.height_cm}:{},...i.note!==void 0?{note:i.note}:{},local_date_str:i.local_date_str});if(u.status==="NOT_FOUND")throw N();if(u.status===
"LIMIT_EXCEEDED")throw new m("CONFLICT",`This plant already has the maximum of ${u.ceiling} growth entries. Delete an older entry to add a new one.`,{details:[{field:"growth",issue:"limit_exceeded",current:u.
current,ceiling:u.ceiling}]});t.status(201).json(u.entry)}catch(n){r(n)}}o(bn,"logGrowth");async function xn(e,t,r){try{let n=g(e),s=Re(e.params.id,"id");if(!await he(s,n))throw N();t.json(await pn(s,
n))}catch(n){r(n)}}o(xn,"getGrowthHistory");async function In(e,t,r){try{let n=g(e),s=Re(e.params.id,"id"),a=Re(e.params.entryId,"entryId");if(!await gn(a,s,n))throw N();t.json({status:"deleted"})}catch(n){
r(n)}}o(In,"removeGrowthEntry");async function Dn(e,t,r){try{let n=await fn(e.query.q);t.json(n)}catch(n){r(n)}}o(Dn,"searchSpecies");var I=Xs();I.use(E);I.get("/species",Dn);I.get("/",wn);I.post("/",En);I.get("/:id",hn);I.put("/:id",Rn);I.delete("/:id",An);I.post("/:id/care",Tn);I.get("/:id/care",kn);I.post("/:id/growth",bn);I.get(
"/:id/growth",xn);I.delete("/:id/growth/:entryId",In);var Nn=I;import{Router as Zs}from"npm:express@4.21.2";k();async function vn(e){if(e.length===0)return new Map;let t=_(),{rows:r}=await t.query(`select workout_id, id, set_index, reps,
            weight_kg::float8        as weight_kg,
            volume_kg::float8        as volume_kg,
            estimated_1rm_kg::float8 as estimated_1rm_kg
     from workout_sets
     where workout_id = any($1)
     order by workout_id, set_index`,[e]),n=new Map;for(let s of r){let{workout_id:a,...i}=s,u=n.get(a)??[];u.push(i),n.set(a,u)}return n}o(vn,"fetchSetsForWorkouts");async function Sn(e,t=20,r=0){let n=_(),
{rows:s}=await n.query(`select id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where user_id = $1 and deleted_at is null
     order by logged_at_utc desc
     limit $2 offset $3`,[e,t,r]),a=await vn(s.map(i=>i.id));return s.map(i=>({...i,sets:a.get(i.id)??[]}))}o(Sn,"listWorkouts");async function On(e,t){let r=_(),{rows:n}=await r.query(`select id, use\
r_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where id = $1 and user_id = $2 and deleted_at is null`,[e,t]);if(!n[0])return null;let s=await vn([n[0].id]);return{...n[0],sets:s.get(n[0].id)??[]}}o(On,"getWorkout");async function Ae(e,t){return await R(
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
ow");a.push(l)}return{...s,sets:a}})}o(Ae,"createWorkout");async function Cn(e,t){let r=_(),{rows:n}=await r.query(`select local_date_str as date,
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
reduce((a,i)=>a+Number(i.duration_mins),0),total_calories:s.reduce((a,i)=>a+i.calories,0),total_steps:s.reduce((a,i)=>a+i.steps,0),by_day:s}}o(Cn,"getWeeklySummary");async function $n(e){let t=_(),{rows:r}=await t.
query(`select id, name, activity_type, met_value, is_strength, muscle_group, is_custom
     from exercises
     where ($1::text is null or lower(name) like '%' || lower($1) || '%')
       and (not is_custom or created_by is null)
     order by name
     limit 100`,[e??null]);return r}o($n,"listExercises");async function Ln(e){let t=_(),{rows:r}=await t.query(`select pr.id, pr.exercise_id, e.name as exercise_name, pr.record_type,
            pr.value, pr.source_workout_id, pr.achieved_at
     from personal_records pr
     join exercises e on e.id = pr.exercise_id
     where pr.user_id = $1
     order by e.name, pr.record_type`,[e]);return r}o(Ln,"getPersonalRecords");var z=g;async function Pn(e,t,r){try{let n=Number(e.query.limit??20),s=Number(e.query.offset??0),a=Number.isFinite(n)?Math.min(Math.max(1,Math.trunc(n)),100):20,i=Number.isFinite(s)?Math.max(0,Math.trunc(
s)):0,u=await Sn(z(e),a,i);t.json({workouts:u})}catch(n){r(n)}}o(Pn,"listWorkoutsHandler");async function Un(e,t,r){try{let n=await On(e.params.id,z(e));if(!n)throw N();t.json(n)}catch(n){r(n)}}o(Un,"\
getWorkoutHandler");var Js=new Set(["WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"]);async function Mn(e,t,r){try{let n=e.body;if(!n.activity_type||!Js.has(n.activity_type))throw x(
"activity_type is required and must be a valid type.",[{field:"activity_type",issue:"required_or_invalid"}]);let s=n.duration_mins;if(s!=null&&(typeof s!="number"||!Number.isInteger(s)||s<1||s>1440))throw x(
"duration_mins must be an integer between 1 and 1440.",[{field:"duration_mins",issue:"out_of_range"}]);if(!n.local_date_str||!/^\d{4}-\d{2}-\d{2}$/.test(n.local_date_str))throw x("local_date_str is re\
quired in YYYY-MM-DD format.",[{field:"local_date_str",issue:"required_or_invalid"}]);let i=(Array.isArray(n.sets)?n.sets:[]).map((y,b)=>{let T=Number(y.reps??0),D=Number(y.weight_kg??0);return{set_index:Number(
y.set_index??b+1),reps:T,weight_kg:D,volume_kg:ge(T,D),estimated_1rm_kg:pe(D,T)?me(D,T):void 0}}),u=fe(i.map(y=>({reps:y.reps,weightKg:y.weight_kg}))),l=n.met_value_at_log,c=n.body_mass_at_log_kg,d=n.
calories_burned;d===void 0&&typeof l=="number"&&typeof c=="number"&&typeof s=="number"&&s>0&&(d=_e(l,c,s));let f=await Ae(z(e),{exercise_id:n.exercise_id,activity_type:n.activity_type,duration_mins:s??
void 0,perceived_intensity:n.perceived_intensity,met_value_at_log:l,body_mass_at_log_kg:c,calories_burned:d,total_volume_kg:u,steps:n.steps,note:n.note,local_date_str:n.local_date_str,client_idempotency_key:typeof n.
client_idempotency_key=="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{12}$/i.test(n.client_idempotency_key)?n.client_idempotency_key:void 0,sets:i.length>0?i:void 0});await L(
z(e),"FITNESS",n.local_date_str),t.status(201).json(f)}catch(n){r(n)}}o(Mn,"logWorkout");async function qn(e,t,r){try{let n=e.query.week;if(!n||!/^\d{4}-\d{2}-\d{2}$/.test(n))throw x("week query param\
eter is required in YYYY-MM-DD format.",[{field:"week",issue:"required_or_invalid"}]);let s=await Cn(z(e),n);t.json(s)}catch(n){r(n)}}o(qn,"getSummary");async function Fn(e,t,r){try{let n=e.query.q,s=await $n(
n);t.json({exercises:s})}catch(n){r(n)}}o(Fn,"searchExercises");async function Hn(e,t,r){try{let n=await Ln(z(e));t.json({personal_records:n})}catch(n){r(n)}}o(Hn,"getPersonalRecordsHandler");var P=Zs();P.use(E);P.get("/exercises",Fn);P.get("/personal-records",Hn);P.get("/summary",qn);P.get("/",Pn);P.post("/",Mn);P.get("/:id",Un);var Vn=P;import{Router as so}from"npm:express@4.21.2";import{z as v}from"npm:zod@3.24.1";k();var Gn=`id, name, brand,
       kcal_per_100g::float8    as kcal_per_100g,
       protein_per_100g::float8 as protein_per_100g,
       carbs_per_100g::float8   as carbs_per_100g,
       fat_per_100g::float8     as fat_per_100g,
       default_serving_unit,
       default_serving_grams::float8 as default_serving_grams,
       is_custom`;async function jn(e,t){let r=_(),{rows:n}=await r.query(`select ${Gn}
     from foods
     where deleted_at is null
       and name ilike '%' || $1 || '%'
       and (is_custom = false or created_by = $2)
     order by (lower(name) = lower($1)) desc,
              (lower(name) like lower($1) || '%') desc,
              name asc
     limit 200`,[e,t]);return n}o(jn,"searchFoods");var Be=200,te=30;function Wn(e,t){return`created_by = ${e}::uuid and is_custom
            and (deleted_at is null
                 or deleted_at > now() - (${t}::int * interval '1 day'))`}o(Wn,"ceilingScopeSql");async function Bn(e,t){let r=_(),{rows:n}=await r.query(`insert into foods
       (name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        default_serving_unit, default_serving_grams, barcode, source, is_custom, created_by)
     select $1::text, $2::text, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
            $7::text, $8::numeric, $9::text, 'CUSTOM', true, $10::uuid
     where (select count(*) from foods
             where ${Wn("$10","$12")}) < $11::int
     returning ${Gn}`,[t.name,t.brand??null,t.kcal_per_100g,t.protein_per_100g,t.carbs_per_100g,t.fat_per_100g,t.default_serving_unit,t.default_serving_grams??null,t.barcode??null,e,Be,te]),s=n[0];if(s)
return{status:"CREATED",food:s};let{rows:[a]}=await r.query(`select count(*)::int                                        as current,
            count(*) filter (where deleted_at is not null)::int  as deleted
     from foods
     where ${Wn("$1","$2")}`,[e,te]);return{status:"LIMIT_EXCEEDED",current:a?.current??Be,ceiling:Be,deleted:a?.deleted??0}}o(Bn,"createCustomFood");async function Yn(e,t){let r=_(),{rowCount:n}=await r.
query(`update foods
        set deleted_at = now(), updated_at = now()
      where id = $1 and created_by = $2 and is_custom and deleted_at is null`,[e,t]);return(n??0)>0}o(Yn,"softDeleteCustomFood");var eo=2e3;async function Kn(e,t){let r=_(),{rows:n}=await r.query(`sel\
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
carbs_g:0,fat_g:0});return{meals:s,water_ml_total:Number(a?.water_ml_total??0),water_goal_ml:a?.water_goal_ml??eo,totals:i}}o(Kn,"getDailySummary");async function Te(e,t){return R(async r=>{let n=t.items.
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
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,[l.id,c.food_id??null,c.food_name_at_log,c.quantity,c.serving_unit,c.grams,c.kcal,c.protein_g,c.carbs_g,c.fat_g]);return l})}o(Te,"logMeal");
async function ke(e,t){let r=_(),{rows:n}=await r.query(`insert into water_logs (user_id, amount_ml, goal_ml_at_log, local_date_str, client_idempotency_key)
     values ($1, $2, $3, $4, $5)
     returning id, amount_ml`,[e,t.amount_ml,t.goal_ml_at_log??null,t.local_date_str,t.client_idempotency_key??null]),s=n[0];if(!s)throw new Error("water_logs insert returned no row");return s}o(ke,"l\
ogWater");var zn=["BREAKFAST","LUNCH","DINNER","SNACK"],Ye=["GRAM","MILLILITRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"];function to(){return new Date().toISOString().slice(0,10)}o(to,"todayUtcDateStr");function Ke(e){
return typeof e=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e)}o(Ke,"isValidDateStr");function no(e,t){let r=v.string().uuid().safeParse(e);if(!r.success)throw new m("VALIDATION_FAILED",`${t} must be a UUID\
.`,{details:[{field:t,issue:"invalid"}]});return r.data}o(no,"requireUuidParam");async function Qn(e,t,r){try{let n=e.query.q;if(n!==void 0&&typeof n!="string")throw new m("VALIDATION_FAILED","Query p\
arameter q must be a string.");let s=g(e),a=await jn((n??"").trim(),s);t.status(200).json({foods:a})}catch(n){r(n)}}o(Qn,"searchFoodsHandler");var ro=v.object({name:v.string().trim().min(1).max(120),brand:v.
string().trim().max(80).optional(),kcal_per_100g:v.number().min(0).max(9e3),protein_per_100g:v.number().min(0).max(100).default(0),carbs_per_100g:v.number().min(0).max(100).default(0),fat_per_100g:v.number().
min(0).max(100).default(0),default_serving_unit:v.enum(Ye).default("GRAM"),default_serving_grams:v.number().min(.1).max(5e3).optional(),barcode:v.string().regex(/^\d{8,14}$/,"must be 8 to 14 digits").
optional()}).strict();async function Xn(e,t,r){try{let n=g(e),s=ro.safeParse(e.body);if(!s.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).
map(u=>({field:u.path.join(".")||"(root)",issue:u.message}))});let a=s.data,i=await Bn(n,{...a,brand:a.brand?a.brand:void 0});if(i.status==="LIMIT_EXCEEDED")throw new m("CONFLICT",`You have reached yo\
ur limit of ${i.ceiling} custom foods. Deleting one frees its slot ${te} days later, when its retention window closes.`,{details:[{field:"foods",issue:"limit_exceeded",current:i.current,ceiling:i.ceiling,
deleted:i.deleted,retention_days:te}]});t.status(201).json(i.food)}catch(n){r(n)}}o(Xn,"createCustomFoodHandler");async function Jn(e,t,r){try{let n=g(e),s=no(e.params.id,"id");if(!await Yn(s,n))throw N();
t.json({status:"deleted"})}catch(n){r(n)}}o(Jn,"deleteCustomFoodHandler");async function Zn(e,t,r){try{let n=e.query.date??to();if(!Ke(n))throw new m("VALIDATION_FAILED","date must be YYYY-MM-DD.");let s=g(
e),a=await Kn(s,n);t.status(200).json(a)}catch(n){r(n)}}o(Zn,"getDailySummaryHandler");async function er(e,t,r){try{let n=e.body,s=[];if((!n.meal_type||!zn.includes(n.meal_type))&&s.push({field:"meal_\
type",issue:`must be one of ${zn.join(", ")}`}),Ke(n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),!Array.isArray(n.items)||n.items.length===0)s.push({field:"i\
tems",issue:"must be a non-empty array"});else for(let u=0;u<n.items.length;u++){let l=n.items[u];(!l.food_name_at_log||typeof l.food_name_at_log!="string")&&s.push({field:`items[${u}].food_name_at_lo\
g`,issue:"required"}),(typeof l.quantity!="number"||l.quantity<=0)&&s.push({field:`items[${u}].quantity`,issue:"must be a positive number"}),Ye.includes(l.serving_unit)||s.push({field:`items[${u}].ser\
ving_unit`,issue:`must be one of ${Ye.join(", ")}`}),(typeof l.grams!="number"||l.grams<=0)&&s.push({field:`items[${u}].grams`,issue:"must be a positive number"}),(typeof l.kcal!="number"||l.kcal<0)&&
s.push({field:`items[${u}].kcal`,issue:"must be a non-negative number"})}if(s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=g(e),i=await Te(a,{meal_type:n.
meal_type,note:typeof n.note=="string"?n.note:void 0,local_date_str:n.local_date_str,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:void 0,items:n.items.map(
u=>({food_id:typeof u.food_id=="string"?u.food_id:void 0,food_name_at_log:u.food_name_at_log,quantity:u.quantity,serving_unit:u.serving_unit,grams:u.grams,kcal:u.kcal,protein_g:typeof u.protein_g=="nu\
mber"?u.protein_g:0,carbs_g:typeof u.carbs_g=="number"?u.carbs_g:0,fat_g:typeof u.fat_g=="number"?u.fat_g:0}))});await L(a,"NUTRITION",n.local_date_str),t.status(201).json(i)}catch(n){r(n)}}o(er,"logM\
ealHandler");async function tr(e,t,r){try{let n=e.body,s=[];if((typeof n.amount_ml!="number"||n.amount_ml<1||n.amount_ml>5e3)&&s.push({field:"amount_ml",issue:"must be a number between 1 and 5000"}),Ke(
n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=g(e),i=await ke(a,
{amount_ml:n.amount_ml,local_date_str:n.local_date_str,goal_ml_at_log:typeof n.goal_ml_at_log=="number"?n.goal_ml_at_log:void 0,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:
void 0});await ye(a),t.status(201).json(i)}catch(n){r(n)}}o(tr,"logWaterHandler");var U=so();U.use(E);U.get("/foods/search",Qn);U.post("/foods",Xn);U.delete("/foods/:id",Jn);U.get("/summary",Zn);U.post("/meals",er);U.post("/water",tr);var nr=U;import{Router as ao}from"npm:express@4.21.2";k();var oo=1e4,rr=2e3;async function sr(e,t){let r=_(),[n,s,a,i,u]=await Promise.all([r.query(`select current_length, longest_length
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
id:y.id,title:y.nickname}))];return d<rr&&f.push({type:"LOG_MEAL",id:"log_meal",title:"Log a meal"}),{streak:{current:l?.current_length??0,longest:l?.longest_length??0},plants:{due_today:s.rows.length,
overdue:Number(a.rows[0]?.count??0)},fitness:{steps:c,goal:oo},nutrition:{calories_consumed:d,target:rr},today_list:f}}o(sr,"getDashboard");function io(){return new Date().toISOString().slice(0,10)}o(io,"todayUtcDateStr");async function or(e,t,r){try{let n=typeof e.query.date=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.query.date)?e.query.date:
io(),s=g(e),a=await sr(s,n);t.status(200).json(a)}catch(n){r(n)}}o(or,"getDashboardHandler");var ze=ao();ze.use(E);ze.get("/",or);var ir=ze;import{Router as uo}from"npm:express@4.21.2";k();async function ar(e){let t=_(),{rows:r}=await t.query(`select a.id as a_id, a.code, a.name, a.description, a.module, a.icon,
            a.tier, a.points, a.is_active,
            ua.id as ua_id, ua.unlocked_at, ua.progress_pct, ua.seen_at
     from achievements a
     left join user_achievements ua
       on ua.achievement_id = a.id and ua.user_id = $1
     where a.is_active
     order by a.module, a.points, a.name`,[e]);return r.map(n=>({id:n.ua_id??n.a_id,achievement_id:n.a_id,unlocked_at:n.unlocked_at,progress_pct:n.ua_id?n.progress_pct??0:0,seen_at:n.seen_at,achievement:{
id:n.a_id,code:n.code,name:n.name,description:n.description,module:n.module,icon:n.icon,tier:n.tier,points:n.points,is_active:n.is_active}}))}o(ar,"listForUser");async function ur(e){let t=_(),{rows:r}=await t.
query(`select streak_type, current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1
     order by streak_type`,[e]);return r}o(ur,"listStreaks");async function lr(e){return(await _().query(`update user_achievements
     set seen_at = now()
     where user_id = $1 and unlocked_at is not null and seen_at is null`,[e])).rowCount??0}o(lr,"markSeen");async function cr(e,t,r){try{let n=g(e),s=await ar(n);t.status(200).json(s)}catch(n){r(n)}}o(cr,"listAchievementsHandler");async function dr(e,t,r){try{let n=g(e),s=await ur(n);t.status(200).json({streaks:s})}catch(n){
r(n)}}o(dr,"listStreaksHandler");async function _r(e,t,r){try{let n=g(e),s=await lr(n);t.status(200).json({marked_seen:s})}catch(n){r(n)}}o(_r,"markSeenHandler");var ne=uo();ne.use(E);ne.get("/",cr);ne.get("/streaks",dr);ne.post("/seen",_r);var mr=ne;import{Router as lo}from"npm:express@4.21.2";var be=lo();be.use(E);be.get("/",async(e,t,r)=>{try{let n=await rn(g(e));t.status(200).json({reminders:n})}catch(n){r(n)}});be.post("/:id/dismiss",async(e,t,r)=>{try{let n=e.params.id;if(!n||!/^[0-9a-f-]{36}$/i.
test(n))throw new m("VALIDATION_FAILED","Reminder id must be a UUID.");if(!await sn(g(e),n))throw new m("NOT_FOUND","Reminder not found or already resolved.");t.status(200).json({status:"dismissed"})}catch(n){
r(n)}});var pr=be;import{Router as _o}from"npm:express@4.21.2";import{z as G}from"npm:zod@3.24.1";k();var co=5;async function fr(e,t){try{return await gr(e,t)}catch(r){if(typeof r=="object"&&r!==null&&r.code==="23505")return gr(e,t);throw r}}o(fr,"registerToken");async function gr(e,t){return R(async r=>{
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
       )`,[e,co]);let{rows:i}=await r.query(`select id, platform, device_label, app_version, permission_status, last_confirmed_at
       from device_push_tokens
       where user_id = $1 and status = 'ACTIVE'
       order by last_confirmed_at desc nulls last`,[e]);return{id:a,devices:i}})}o(gr,"registerTokenOnce");async function yr(e){if(e.length===0)return new Map;let t=_(),{rows:r}=await t.query(`select \
user_id, token
     from device_push_tokens
     where user_id = any ($1::uuid[])
       and status = 'ACTIVE'
       and permission_status = 'GRANTED'`,[e]),n=new Map;for(let s of r){let a=n.get(s.user_id);a?a.push(s.token):n.set(s.user_id,[s.token])}return n}o(yr,"activeTokensForUsers");async function wr(e,t){
if(e.length===0)return;await _().query(`update device_push_tokens
     set status = case when $2 = 'DEVICE_NOT_REGISTERED' then 'UNREGISTERED' else 'STALE' end,
         revoked_at = now(), revoke_reason = $2, updated_at = now()
     where token = any ($1::text[]) and status = 'ACTIVE'`,[e,t])}o(wr,"revokeTokens");var mo=G.object({expo_push_token:G.string().min(20).max(200).regex(/^Expo(nent)?PushToken\[.+\]$/),platform:G.enum(["IOS","ANDROID"]),client_installation_id:G.string().uuid(),device_label:G.string().max(
64).optional(),app_version:G.string().max(20).optional(),permission_status:G.enum(["GRANTED","DENIED","UNDETERMINED"])}).strict(),Qe=_o();Qe.use(E);Qe.post("/",async(e,t,r)=>{try{let n=mo.safeParse(e.
body);if(!n.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:n.error.issues.slice(0,10).map(i=>({field:i.path.join("."),issue:i.message}))});let{id:s,devices:a}=await fr(
g(e),{...n.data,device_label:n.data.device_label?.trim()||void 0});t.status(200).json({id:s,devices:a})}catch(n){r(n)}});var hr=Qe;import{Router as Io}from"npm:express@4.21.2";import{z as p}from"npm:zod@3.24.1";k();async function Er(e,t,r,n){let s=_(),{rows:a}=await s.query(`insert into sync_events (user_id, client_idempotency_key, entity_type, payload)
     values ($1, $2, $3, $4)
     on conflict (user_id, client_idempotency_key) do nothing
     returning id, client_idempotency_key, entity_type, status, result_entity_id, error_code`,[e,t,r,JSON.stringify(n)]),i=a[0];if(i)return{row:i,replay:!1};let{rows:u}=await s.query(`select id, clien\
t_idempotency_key, entity_type, status, result_entity_id, error_code
     from sync_events
     where user_id = $1 and client_idempotency_key = $2`,[e,t]),l=u[0];if(!l)throw new Error("sync_events upsert returned neither insert nor existing row");return{row:l,replay:!0}}o(Er,"recordEvent");
async function Xe(e,t){await _().query(`update sync_events
     set status = 'PROCESSED', result_entity_id = $2, processed_at = now()
     where id = $1`,[e,t])}o(Xe,"markProcessed");async function Rr(e,t,r){await _().query(`update sync_events
     set status = 'FAILED', error_code = $2, error_detail = $3, processed_at = now()
     where id = $1`,[e,t.slice(0,60),r.slice(0,500)])}o(Rr,"markFailed");async function Je(e,t,r){let n=_(),{rows:s}=await n.query(`select id from ${e} where user_id = $1 and client_idempotency_key = \
$2`,[t,r]);return s[0]?.id??null}o(Je,"findEntityIdByKey");var po=50,xe=p.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(e=>{let t=Date.parse(e);return t>Date.now()-366*864e5&&t<Date.now()+2*864e5},"local_date_str outside the accepted window"),go=p.object({plant_id:p.
string().uuid(),action_type:p.enum(["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"]),note:p.string().max(500).optional(),local_date_str:xe}).strict(),fo=p.object({set_index:p.number().int().
min(1).max(200).optional(),reps:p.number().int().min(0).max(1e3),weight_kg:p.number().min(0).max(1e3)}).strict(),yo=p.object({activity_type:p.string().min(1).max(40),duration_mins:p.number().int().min(
1).max(1440).optional(),perceived_intensity:p.enum(["LOW","MODERATE","VIGOROUS"]).optional(),met_value_at_log:p.number().min(1).max(23).optional(),body_mass_at_log_kg:p.number().min(20).max(400).optional(),
steps:p.number().int().min(0).max(2e5).optional(),note:p.string().max(500).optional(),local_date_str:xe,sets:p.array(fo).max(200).optional()}).strict(),wo=p.object({food_id:p.string().uuid().optional(),
food_name_at_log:p.string().min(1).max(200),quantity:p.number().positive().max(1e5),serving_unit:p.string().min(1).max(20),grams:p.number().positive().max(1e5),kcal:p.number().min(0).max(1e5),protein_g:p.
number().min(0).max(1e4),carbs_g:p.number().min(0).max(1e4),fat_g:p.number().min(0).max(1e4)}).strict(),ho=p.object({meal_type:p.enum(["BREAKFAST","LUNCH","DINNER","SNACK"]),note:p.string().max(500).optional(),
local_date_str:xe,items:p.array(wo).min(1).max(50)}).strict(),Eo=p.object({amount_ml:p.number().int().min(1).max(5e3),goal_ml_at_log:p.number().int().min(1).max(2e4).optional(),local_date_str:xe}).strict(),
Ro=p.object({client_idempotency_key:p.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),entity_type:p.enum(["PLANT_CARE_EVENT","WORKOUT","MEAL","WATER_LOG"]),payload:p.
unknown()}).strict(),Ao=p.object({events:p.array(Ro).min(1).max(po)}).strict();function To(e){return typeof e=="object"&&e!==null&&e.code==="23505"}o(To,"isUniqueViolation");var ko={PLANT_CARE_EVENT:"\
plant_care_events",WORKOUT:"workouts",MEAL:"meals",WATER_LOG:"water_logs"},bo={PLANT_CARE_EVENT:"PLANT_CARE",WORKOUT:"FITNESS",MEAL:"NUTRITION",WATER_LOG:null};async function xo(e,t,r,n){switch(r){case"\
PLANT_CARE_EVENT":{let s=go.parse(n);return await Ee(e,s.plant_id,s.action_type,s.note,s.local_date_str,t),Je("plant_care_events",e,t)}case"WORKOUT":{let s=yo.parse(n),a=(s.sets??[]).map((c,d)=>{let f=ge(
c.reps,c.weight_kg),y=pe(c.weight_kg,c.reps);return{set_index:c.set_index??d+1,reps:c.reps,weight_kg:c.weight_kg,volume_kg:f,...y?{estimated_1rm_kg:me(c.weight_kg,c.reps)}:{}}}),i=fe(a.map(c=>({reps:c.
reps,weightKg:c.weight_kg}))),u;return s.met_value_at_log!==void 0&&s.body_mass_at_log_kg!==void 0&&s.duration_mins!==void 0&&(u=_e(s.met_value_at_log,s.body_mass_at_log_kg,s.duration_mins)),(await Ae(
e,{activity_type:s.activity_type,duration_mins:s.duration_mins,perceived_intensity:s.perceived_intensity,met_value_at_log:s.met_value_at_log,body_mass_at_log_kg:s.body_mass_at_log_kg,calories_burned:u,
total_volume_kg:i,steps:s.steps,note:s.note,local_date_str:s.local_date_str,client_idempotency_key:t,sets:a.length>0?a:void 0})).id}case"MEAL":{let s=ho.parse(n);return(await Te(e,{...s,client_idempotency_key:t})).
id}case"WATER_LOG":{let s=Eo.parse(n);return(await ke(e,{...s,client_idempotency_key:t})).id}}}o(xo,"applyEvent");async function Ar(e,t,r){try{let n=g(e),s=Ao.safeParse(e.body);if(!s.success)throw new m(
"VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).map(i=>({field:i.path.join("."),issue:i.message}))});let a=[];for(let i of s.data.events){let u=i.client_idempotency_key.
toLowerCase(),{row:l,replay:c}=await Er(n,u,i.entity_type,i.payload);if(c&&l.status!=="PENDING"){a.push({client_idempotency_key:u,status:l.status==="FAILED"?"FAILED":"PROCESSED",replay:!0,entity_id:l.
result_entity_id,error_code:l.error_code});continue}try{let d=await xo(n,u,i.entity_type,i.payload);await Xe(l.id,d);let f=bo[i.entity_type],y=i.payload.local_date_str;f&&y?await L(n,f,y):i.entity_type===
"WATER_LOG"&&await ye(n),a.push({client_idempotency_key:u,status:"PROCESSED",replay:!1,entity_id:d,error_code:null})}catch(d){if(To(d)){let D=await Je(ko[i.entity_type],n,u);if(D){await Xe(l.id,D),a.push(
{client_idempotency_key:u,status:"PROCESSED",replay:!0,entity_id:D,error_code:null});continue}}let f=d instanceof p.ZodError,y=typeof d=="object"&&d!==null&&"__notFound"in d,b=f?"VALIDATION_FAILED":y?
"PARENT_NOT_FOUND":"INTERNAL_ERROR",T=d instanceof Error?d.message:String(d);await Rr(l.id,b,T),h.warn({key:u,entity_type:i.entity_type,code:b},"sync event failed"),a.push({client_idempotency_key:u,status:"\
FAILED",replay:!1,entity_id:null,error_code:b})}}t.status(200).json({results:a})}catch(n){r(n)}}o(Ar,"drainOutboxHandler");var Ze=Io();Ze.use(E);Ze.post("/outbox",Ar);var Tr=Ze;import{Router as $o}from"npm:express@4.21.2";import{z as No}from"npm:zod@3.24.1";k();var br=`timezone, hemisphere, locale, unit_system, theme, week_start_day,
  plant_care_enabled, fitness_enabled, nutrition_enabled, quiet_hours_mode,
  quiet_start_time, quiet_end_time,
  daily_notification_cap, reduce_motion, larger_text, high_contrast, analytics_opt_in`;function kr(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(kr,"normaliseTimeOfD\
ay");function xr(e){return{...e,quiet_start_time:kr(e.quiet_start_time),quiet_end_time:kr(e.quiet_end_time)}}o(xr,"normaliseSettingsRow");async function Ie(e){let t=_();await t.query("insert into user\
_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let{rows:r}=await t.query(`select ${br} from user_settings where user_id = $1`,[e]);return xr(r[0])}o(Ie,"getSettings");var Do=new Set(
["timezone","hemisphere","locale","unit_system","theme","week_start_day","plant_care_enabled","fitness_enabled","nutrition_enabled","quiet_hours_mode","quiet_start_time","quiet_end_time","daily_notifi\
cation_cap","reduce_motion","larger_text","high_contrast","analytics_opt_in"]);async function Ir(e,t){let r=Object.entries(t).filter(([u,l])=>l!==void 0&&Do.has(u));if(r.length===0)return Ie(e);let n=_();
await n.query("insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let s=r.map(([u],l)=>`${u}=$${l+2}`).join(", "),a=r.map(([,u])=>u),{rows:i}=await n.query(`update \
user_settings set ${s}, updated_at=now()
     where user_id=$1
     returning ${br}`,[e,...a]);return xr(i[0])}o(Ir,"updateSettings");var vo={hemisphere:["NORTHERN","SOUTHERN","EQUATORIAL"],unit_system:["METRIC","IMPERIAL"],theme:["LIGHT","DARK","SYSTEM"],week_start_day:["SUNDAY","MONDAY"],quiet_hours_mode:["OFF","WINDOW","SCHEDULED\
_ONLY"]},So=["plant_care_enabled","fitness_enabled","nutrition_enabled","reduce_motion","larger_text","high_contrast","analytics_opt_in"],Oo=No.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),Dr=[
"quiet_start_time","quiet_end_time"],Co=["quiet_hours_mode",...Dr];async function Nr(e,t,r){try{t.json(await Ie(g(e)))}catch(n){r(n)}}o(Nr,"getSettingsHandler");async function vr(e,t,r){try{let n=e.body??
{},s=[],a={};for(let[c,d]of Object.entries(vo)){let f=n[c];f!==void 0&&(typeof f!="string"||!d.includes(f)?s.push({field:c,issue:`must_be_one_of:${d.join(",")}`}):a[c]=f)}for(let c of So){let d=n[c];d!==
void 0&&(typeof d!="boolean"?s.push({field:c,issue:"must_be_boolean"}):a[c]=d)}for(let c of Dr){let d=n[c];if(d===void 0)continue;let f=Oo.safeParse(d);f.success?a[c]=f.data:s.push({field:c,issue:"mus\
t_be_hh_mm_24h_or_null"})}if(n.timezone!==void 0&&(typeof n.timezone!="string"||n.timezone.length>64?s.push({field:"timezone",issue:"must_be_string_max_64"}):a.timezone=n.timezone),n.locale!==void 0&&
(typeof n.locale!="string"||n.locale.length>20?s.push({field:"locale",issue:"must_be_string_max_20"}):a.locale=n.locale),n.daily_notification_cap!==void 0){let c=n.daily_notification_cap;typeof c!="nu\
mber"||!Number.isInteger(c)||c<1||c>20?s.push({field:"daily_notification_cap",issue:"must_be_integer_1_to_20"}):a.daily_notification_cap=c}if(s.length>0)throw new m("VALIDATION_FAILED","The request fa\
iled validation.",{details:s});let i=g(e),l={...await Ie(i),...a};if(!l.plant_care_enabled&&!l.fitness_enabled&&!l.nutrition_enabled)throw new m("VALIDATION_FAILED","At least one module must stay enab\
led.",{details:[{field:"modules",issue:"at_least_one_module_required"}]});if(Co.some(c=>c in a)&&l.quiet_hours_mode==="WINDOW"){if(l.quiet_start_time===null||l.quiet_end_time===null)throw new m("VALID\
ATION_FAILED","Quiet hours need both a start and an end time.",{details:[{field:"quiet_hours_mode",issue:"window_requires_start_and_end"}]});if(l.quiet_start_time===l.quiet_end_time)throw new m("VALID\
ATION_FAILED","Quiet hours need a different start and end time.",{details:[{field:"quiet_end_time",issue:"window_start_equals_end"}]})}t.json(await Ir(i,a))}catch(n){r(n)}}o(vr,"updateSettingsHandler");var De=$o();De.use(E);De.get("/",Nr);De.put("/",vr);var Sr=De;import{Router as qo}from"npm:express@4.21.2";import{z as et}from"npm:zod@3.24.1";k();var Lo=30,Or="PENDING_DELETION",re="status, deletion_requested_at, purge_after";async function Cr(e){let t=_(),{rows:r}=await t.query(`select ${re} from users where id = $1`,[e]);return r[0]??null}o(Cr,
"getAccountState");async function $r(e,t){return R(async r=>{let{rows:[n]}=await r.query(`select ${re} from users where id = $1 for update`,[e]);if(!n)return{kind:"missing"};if(n.status===Or)return{kind:"\
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
       returning ${re}`,[e,Lo]);return await r.query(`update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'DELETION_REQUESTED'
       where user_id = $1
         and status = 'ACTIVE'
         and ($2::uuid is null or id <> $2::uuid)`,[e,t]),await r.query(`update auth_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1
         and consumed_at is null
         and ($2::uuid is null or session_id <> $2::uuid)`,[e,t]),{kind:"scheduled",state:s}})}o($r,"requestDeletion");async function Lr(e){return R(async t=>{let{rows:[r]}=await t.query(`select ${re}\
 from users where id = $1 for update`,[e]);if(!r)return{kind:"missing"};if(r.status!==Or)return{kind:"not_pending",state:r};let{rows:[n]}=await t.query(`update users
       set status = case when email_verified_at is null then 'PENDING_VERIFICATION' else 'ACTIVE' end,
           deletion_requested_at = null,
           purge_after = null,
           updated_at = now()
       where id = $1 and status = 'PENDING_DELETION'
       returning ${re}`,[e]);return{kind:"cancelled",state:n}})}o(Lr,"cancelDeletion");var Po=et.object({password:et.string().min(1,"Your password is required to confirm deletion.")}).strict();function Uo(e){return new m("VALIDATION_FAILED","The request failed validation.",{details:e.issues.
slice(0,10).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))})}o(Uo,"validationError");function Mo(e){let t=e.sessionId,r=et.string().uuid().safeParse(t);return r.success?r.data:null}o(Mo,
"callerSessionId");function tt(e){let t=e.purge_after?.toISOString()??null;return{status:e.status,deletion_requested_at:e.deletion_requested_at?.toISOString()??null,purge_after:t,deletion_scheduled_at:t}}
o(tt,"toBody");function Ne(){return new m("AUTHENTICATION_REQUIRED","Authentication is required.")}o(Ne,"accountGone");async function Pr(e,t,r){try{let n=await Cr(g(e));if(!n)throw Ne();t.status(200).
json(tt(n))}catch(n){r(n)}}o(Pr,"getAccountHandler");async function Ur(e,t,r){try{let n=Po.safeParse(e.body??{});if(!n.success)throw Uo(n.error);let s=g(e),a=await Et(s);if(!a)throw Ne();if(a.password_hash===
null)throw new m("VALIDATION_FAILED","The request failed validation.",{details:[{field:"password",issue:"password_required_but_account_has_none"}]});if(!await le(n.data.password,a.password_hash))throw new m(
"INVALID_CREDENTIALS","That password is not right.");let i=await $r(s,Mo(e));if(i.kind==="missing")throw Ne();t.status(200).json({...tt(i.state),already_pending:i.kind==="already_pending"})}catch(n){r(
n)}}o(Ur,"requestDeletionHandler");async function Mr(e,t,r){try{let n=await Lr(g(e));if(n.kind==="missing")throw Ne();if(n.kind==="not_pending")throw new m("CONFLICT","This account is not scheduled fo\
r deletion.");t.status(200).json(tt(n.state))}catch(n){r(n)}}o(Mr,"cancelDeletionHandler");var se=qo();se.use(E);se.get("/",Pr);se.post("/deletion",Ur);se.delete("/deletion",Mr);var qr=se;import{ZodError as Wo}from"npm:zod@3.24.1";import{randomUUID as Fo}from"node:crypto";var Fr="x-request-id",Ho=64,Vo=/^[A-Za-z0-9._-]+$/,Hr=o((e,t,r)=>{let n=e.header(Fr),a=(n&&n.length<=Ho&&Vo.test(n)?n:void 0)??Fo();e.requestId=a,t.setHeader(Fr,a),r()},"requestId");function Vr(e){return e.
requestId??"unknown"}o(Vr,"getRequestId");var Go=50;function jo(e){return e.errors.slice(0,Go).map(t=>({field:t.path.join(".")||"(root)",issue:t.code,message:t.message}))}o(jo,"detailsFromZod");var Wr=o((e,t,r)=>{r(new m("NOT_FOUND",`No route\
 matches ${e.method} ${e.path}`))},"notFoundHandler");function Bo(e){if(!(e instanceof Error))return!1;let t=e;return t.__appError===!0&&typeof t.code=="string"&&t.code in oe}o(Bo,"isMarkedAppError");
var Gr=o((e,t,r,n)=>{let s=Vr(t),a=new Date().toISOString(),i;e instanceof m?i=e:e instanceof Wo?i=new m("VALIDATION_FAILED","The request failed validation.",{details:jo(e)}):e instanceof SyntaxError&&
"body"in e?i=new m("MALFORMED_REQUEST","The request body is not valid JSON."):Bo(e)?i=new m(e.code,e.message):i=new m("INTERNAL_ERROR","An unexpected error occurred.",{cause:e});let u={requestId:s,code:i.
code,status:i.status,method:t.method,path:t.path,context:i.context,err:i.status>=500?e:void 0};i.status>=500?h.error(u,i.message):h.warn(u,i.message);let l={error:{code:i.code,message:i.message,message_key:i.
messageKey,...i.details?{details:i.details}:{},request_id:s,timestamp:a}};r.status(i.status).json(l)},"errorHandler");function Br(e){let t=jr();t.set("trust proxy",1),t.disable("x-powered-by");let r=e.basePath?.replace(/\/+$/,"");return r&&t.use((n,s,a)=>{n.url===r?(n.url="/",n.originalUrl="/"):n.url.startsWith(`${r}\
/`)&&(n.url=n.url.slice(r.length),n.originalUrl=n.url),a()}),t.use(Hr),t.use(zo()),t.use(Yo({origin:e.corsOrigins,credentials:!0,exposedHeaders:["x-request-id"]})),t.use(jr.json({limit:e.bodyLimit??"1\
mb"})),t.use(Ko()),t.use("/api/auth",qt),t.use("/api/v1/plants",Nn),t.use("/api/v1/fitness",Vn),t.use("/api/v1/nutrition",nr),t.use("/api/v1/dashboard",ir),t.use("/api/v1/achievements",mr),t.use("/api\
/v1/reminders",pr),t.use("/api/v1/devices",hr),t.use("/api/v1/sync",Tr),t.use("/api/v1/settings",Sr),t.use("/api/v1/account",qr),t.get("/healthz",(n,s)=>{s.json({status:"ok",uptime_s:Math.round(process.
uptime())})}),t.get("/api/v1",(n,s)=>{s.json({name:"PlantPal+ API",version:"v1"})}),t.use(Wr),t.use(Gr),t}o(Br,"createApp");k();import ed from"npm:node-cron@4.6.0";k();import{createHmac as Qo}from"node:crypto";var nt=100,Yr=Object.freeze([{table:"profiles",column:"user_id"},{table:"user_settings",column:"user_id"},{table:"auth_sessions",column:"user_id"},{table:"auth_tokens",column:"user_id"},{table:"email_\
verification_tokens",column:"user_id"},{table:"password_reset_tokens",column:"user_id"},{table:"consent_records",column:"user_id"},{table:"device_push_tokens",column:"user_id"},{table:"plants",column:"\
user_id"},{table:"plant_care_events",column:"user_id"},{table:"growth_log_entries",column:"user_id"},{table:"workouts",column:"user_id"},{table:"personal_records",column:"user_id"},{table:"meals",column:"\
user_id"},{table:"water_logs",column:"user_id"},{table:"foods",column:"created_by"},{table:"reminders",column:"user_id"},{table:"streaks",column:"user_id"},{table:"user_achievements",column:"user_id"},
{table:"sync_events",column:"user_id"}]);async function Kr(e=nt){let{rows:t}=await _().query(`select id, email_normalised
       from users
      where status = 'PENDING_DELETION'
        and purge_after is not null
        and purge_after <= now()
      order by purge_after asc
      limit $1`,[e]);return t}o(Kr,"findAccountsDueForPurge");function Xo(e,t){return Qo("sha256",t).update(e).digest("hex")}o(Xo,"subjectHash");async function zr(e,t){return R(async r=>{let{rows:[n]}=await r.
query(`select id
         from users
        where id = $1
          and status = 'PENDING_DELETION'
          and purge_after is not null
          and purge_after <= now()
        for update`,[e.id]);if(!n)return{erased:!1,counts:{}};let s=Yr.map(({table:d,column:f},y)=>`(select count(*)::int from ${d} where ${f} = $1) as "t${y}"`).join(", "),{rows:[a]}=await r.query(`s\
elect ${s}`,[e.id]),i={};Yr.forEach(({table:d},f)=>{i[d]=a?.[`t${f}`]??0});let u=Xo(e.id,t),{rowCount:l}=await r.query(`update audit_events
          set user_id = null,
              payload = (payload - 'email' - 'email_normalised')
                        || jsonb_build_object('subject', $2::text)
        where user_id = $1`,[e.id,u]);i.audit_events_anonymised=l??0;let{rowCount:c}=await r.query("delete from login_attempts where email_normalised = $1",[e.email_normalised]);return i.login_attempts=
c??0,await r.query("delete from users where id = $1",[e.id]),i.users=1,await r.query(`insert into audit_events (user_id, event_type, payload)
       values (null, 'ACCOUNT_ERASED', $1::jsonb)`,[JSON.stringify({subject:u,rows:i,erased_at:new Date().toISOString()})]),{erased:!0,counts:i}})}o(zr,"purgeAccount");function Jo(){let e=F();return e.AUDIT_PEPPER??e.JWT_ACCESS_SECRET}o(Jo,"pepper");async function Qr(e=nt){let t=await Kr(e),r={due:t.length,erased:0,skipped:0,failed:0,counts:{}};if(t.length===0)return r;
let n=Jo();for(let s of t)try{let a=await zr(s,n);if(!a.erased){r.skipped++;continue}r.erased++;for(let[i,u]of Object.entries(a.counts))r.counts[i]=(r.counts[i]??0)+u}catch(a){r.failed++,h.error({err:a},
"account erasure failed; will retry on the next sweep")}return h.info(r,"account erasure sweep complete"),r}o(Qr,"runPurgePass");import _d from"npm:node-cron@4.6.0";var Zo="https://exp.host/--/api/v2/push/send",ei=100;function ti(e,t=ei){let r=[];for(let n=0;n<e.length;n+=t)r.push(e.slice(n,n+t));return r}o(ti,"chunkMessages");async function Xr(e){let t={delivered:[],
notRegistered:[],failed:[]};for(let r of ti(e))try{let n=await fetch(Zo,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(r)});if(!n.ok){t.failed.
push(...r.map(i=>i.to)),h.warn({status:n.status},"expo push batch rejected");continue}let a=(await n.json()).data??[];r.forEach((i,u)=>{let l=a[u];l?.status==="ok"?t.delivered.push(i.to):l?.details?.error===
"DeviceNotRegistered"?t.notRegistered.push(i.to):t.failed.push(i.to)})}catch(n){t.failed.push(...r.map(s=>s.to)),h.warn({err:n},"expo push batch failed")}return t}o(Xr,"sendPushMessages");function ts(e,t,r=24){let n=r*36e5;return t.filter(s=>s.next_water_due_at.getTime()-e.getTime()<=n).map(s=>({user_id:s.user_id,reminder_type:"WATER_PLANT",target_entity_id:s.plant_id,target_entity_type:"\
PLANT",title:`Water ${s.nickname}`,body:s.next_water_due_at.getTime()<=e.getTime()?`${s.nickname} is due for watering.`:`${s.nickname} needs water soon.`,due_at_utc:s.next_water_due_at.getTime()<e.getTime()?
e:s.next_water_due_at}))}o(ts,"planWateringReminders");var ni=5,ns={timezone:"UTC",quiet_hours_mode:"WINDOW",quiet_start_time:null,quiet_end_time:null,daily_notification_cap:12},Jr={hourCycle:"h23",year:"\
numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"},Zr=new Map;function ri(e){let t=Zr.get(e);if(t)return t;let r;try{r=new Intl.DateTimeFormat("en-US",{...Jr,timeZone:e})}catch{r=
new Intl.DateTimeFormat("en-US",{...Jr,timeZone:"UTC"})}return Zr.set(e,r),r}o(ri,"formatterFor");function rt(e,t){let r=ri(t).formatToParts(e),n=o(a=>r.find(i=>i.type===a)?.value??"00","part"),s=Number(
n("hour"))%24;return{dateKey:`${n("year")}-${n("month")}-${n("day")}`,minutes:s*60+Number(n("minute"))}}o(rt,"localClock");var si=1440;function es(e){if(e===null)return null;let t=/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.
exec(e.trim());if(!t)return null;let r=Number(t[1])*60+Number(t[2]);return r>=0&&r<si?r:null}o(es,"wallClockMinutes");function oi(e,t){if(t.quiet_hours_mode==="OFF")return!1;if(t.quiet_hours_mode==="S\
CHEDULED_ONLY")return!0;let r=es(t.quiet_start_time),n=es(t.quiet_end_time);if(r===null||n===null||r===n)return!1;let s=rt(e,t.timezone).minutes;return r<n?s>=r&&s<n:s>=r||s<n}o(oi,"isWithinQuietHours");
function ii(e,t,r){let n=rt(t,r).dateKey,s=0;for(let a of e)rt(a,r).dateKey===n&&(s+=1);return s}o(ii,"sentOnLocalDay");function ai(e){let t=e.daily_notification_cap;return!Number.isFinite(t)||t<1?ns.
daily_notification_cap:Math.floor(t)}o(ai,"capOf");function rs(e,t,r={}){let n={send:[],fail:[],defer:[]},s=t.filter(i=>i.due_at_utc.getTime()<=e.getTime()).sort((i,u)=>{let l=i.due_at_utc.getTime()-u.
due_at_utc.getTime();return l!==0?l:i.id<u.id?-1:i.id>u.id?1:0}),a=new Map;for(let i of s){if(i.attempts>=ni){n.fail.push(i.id);continue}let u=r.settings?.get(i.user_id)??ns;if(oi(e,u)){n.defer.push({
id:i.id,reason:"QUIET_HOURS"});continue}let l=a.get(i.user_id);if(l===void 0){let c=r.sentAt?.get(i.user_id)??[];l=Math.max(0,ai(u)-ii(c,e,u.timezone))}if(l===0){a.set(i.user_id,0),n.defer.push({id:i.
id,reason:"DAILY_CAP_REACHED"});continue}a.set(i.user_id,l-1),n.send.push(i.id)}return n}o(rs,"tick");var ss=24;async function ui(e){if(e.length===0)return 0;let t=await yr([...new Set(e.map(i=>i.user_id))]);if(t.size===0)return 0;let r=[],n=new Map;for(let i of e)for(let u of t.get(i.user_id)??[]){r.
push({to:u,title:i.title,body:i.body??"",data:{reminder_id:i.id}});let l=n.get(u);l?l.push(i.id):n.set(u,[i.id])}if(r.length===0)return 0;let s=await Xr(r);await wr(s.notRegistered,"DEVICE_NOT_REGISTE\
RED");let a=new Set;for(let i of s.delivered)for(let u of n.get(i)??[])a.add(u);return await en([...a]),a.size}o(ui,"deliverByPush");async function os(e=new Date){let t=await zt(ss),r=ts(e,t,ss),n=await Qt(
r),s=await Zt(),a=[...new Set(s.map(f=>f.user_id))],[i,u]=await Promise.all([Xt(a),Jt(a,e)]),l=rs(e,s,{settings:i,sentAt:u});await tn(l.send),await nn(l.fail);let c=new Set(l.send),d=await ui(s.filter(
f=>c.has(f.id)));return{scheduled:n,sent:l.send.length,delivered:d,failed:l.fail.length,deferred:l.defer.length}}o(os,"runReminderPass");var ve=Deno.env.get("SUPABASE_FUNCTION_SLUG")??"plantpal-api";function st(e){let t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_DB_URL");if(!t)throw new Error(
"No platform secret to derive from: set JWT_ACCESS_SECRET on the function explicitly.");return li("sha256",t).update(`plantpal:${e}`).digest("hex")}o(st,"derivedSecret");function Q(e,t){let r=Deno.env.
get(e);return r&&r.length>0?r:t}o(Q,"fromEdge");var is=Deno.env.get("DATABASE_URL")??Deno.env.get("SUPABASE_DB_URL");if(!is)throw new Error("Neither DATABASE_URL nor SUPABASE_DB_URL is set.");var as=new URL(
Deno.env.get("SUPABASE_URL")??"https://localhost").origin,us=Ce({...ci.env,NODE_ENV:"production",DATABASE_URL:is,JWT_ACCESS_SECRET:Q("JWT_ACCESS_SECRET",st("jwt-access")),AUDIT_PEPPER:Q("AUDIT_PEPPER",
st("audit-pepper")),LOG_LEVEL:Q("LOG_LEVEL","info"),CORS_ORIGINS:Q("CORS_ORIGINS",as),REFRESH_COOKIE_PATH:Q("REFRESH_COOKIE_PATH",`/functions/v1/${ve}`)});Pe(us.DATABASE_URL,3,{rejectUnauthorized:!1});
var _i=Q("TICK_SECRET",st("internal-tick")),mi=Br({corsOrigins:us.CORS_ORIGINS,basePath:`/${ve}`}),ot=di();ot.post(`/${ve}/internal/tick`,(e,t)=>{if(e.get("authorization")!==`Bearer ${_i}`){t.status(401).
json({error:{code:"AUTHENTICATION_REQUIRED"}});return}Promise.allSettled([os(),Qr()]).then(([r,n])=>{h.info({reminders:r.status==="fulfilled"?r.value:"failed",purge:n.status==="fulfilled"?n.value:"fai\
led"},"internal tick complete")}),t.status(202).json({status:"accepted"})});ot.use(mi);h.info({slug:ve,origin:as},"PlantPal+ API starting on Supabase Edge");ot.listen(8e3);
