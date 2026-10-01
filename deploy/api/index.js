// GENERATED FILE — do not edit, and do not review as source.
// Built from apps/api/edge/index.ts by apps/api/edge/build.mjs.
// Committed deliberately: the deployed edge function loads it from this
// repository over a CDN. See deploy/README.md.
var dt=Object.defineProperty;var o=(e,t)=>dt(e,"name",{value:t,configurable:!0});var As=(e,t)=>()=>(e&&(t=e(e=0)),t);var Ts=(e,t)=>{for(var r in t)dt(e,r,{get:t[r],enumerable:!0})};var wt={};Ts(wt,{getPool:()=>d,initPool:()=>Me,setPoolForTesting:()=>Ls,transaction:()=>R});import Cs from"npm:pg@8.13.1";function Me(e,t=10,r){return B=new Cs.Pool({connectionString:e,max:t,idleTimeoutMillis:3e4,
connectionTimeoutMillis:15e3,...r===void 0?{}:{ssl:r}}),B.on("error",n=>{console.error({err:n},"postgres pool client error")}),B}function d(){if(!B)throw new Error("Database pool not initialised. Call\
 initPool() at boot.");return B}async function R(e){let t=await d().connect();try{await t.query("BEGIN");let r=await e(t);return await t.query("COMMIT"),r}catch(r){try{await t.query("ROLLBACK")}catch{}
throw r}finally{t.release()}}function Ls(e){B=e}var B,b=As(()=>{"use strict";o(Me,"initPool");o(d,"getPool");o(R,"transaction");o(Ls,"setPoolForTesting")});import{Buffer as gs}from"node:buffer";import{createHmac as xi,timingSafeEqual as Di}from"node:crypto";import Ni from"node:process";import vi from"npm:express@4.21.2";import di from"npm:cors@2.8.5";import _i from"npm:cookie-parser@1.4.7";import es from"npm:express@4.21.2";import mi from"npm:helmet@8.0.0";import{Router as Fs}from"npm:express@4.21.2";import{createHash as Ps}from"node:crypto";import{z as C}from"npm:zod@3.24.1";var bs=C.object({NODE_ENV:C.enum(["development","test","production"]).default("development"),PORT:C.coerce.number().int().min(1).max(65535).default(3e3),DATABASE_URL:C.string().url().describe("Postgre\
SQL connection string"),JWT_ACCESS_SECRET:C.string().min(32,"JWT_ACCESS_SECRET must be at least 32 characters"),AUDIT_PEPPER:C.string().min(32,"AUDIT_PEPPER must be at least 32 characters").optional(),
CORS_ORIGINS:C.string().default("http://localhost:5173").transform(e=>e.split(",").map(t=>t.trim()).filter(Boolean)),LOG_LEVEL:C.enum(["fatal","error","warn","info","debug","trace"]).default("info"),REFRESH_COOKIE_PATH:C.
string().startsWith("/").default("/api/auth"),REQUIRE_EMAIL_VERIFICATION:C.enum(["true","false","1","0"]).default("false").transform(e=>e==="true"||e==="1")}),ie;function _t(e=process.env){let t=bs.safeParse(
e);if(!t.success){let r=t.error.errors.map(n=>`  - ${n.path.join(".")||"(root)"}: ${n.message}`).join(`
`);throw new Error(`Invalid environment configuration:
${r}`)}if(t.data.NODE_ENV==="production"&&t.data.CORS_ORIGINS.includes("*"))throw new Error('CORS_ORIGINS must not contain "*" in production (NFR-SEC-06)');return t.data}o(_t,"loadEnv");function mt(e=process.
env){return ie=_t(e),ie}o(mt,"configureEnv");function S(){return ie??=_t(),ie}o(S,"env");var ae={VALIDATION_FAILED:{status:422,messageKey:"errors.validation_failed"},MALFORMED_REQUEST:{status:400,messageKey:"errors.malformed_request"},AUTHENTICATION_REQUIRED:{status:401,messageKey:"errors\
.authentication_required"},INVALID_CREDENTIALS:{status:401,messageKey:"errors.invalid_credentials"},TOKEN_EXPIRED:{status:401,messageKey:"errors.token_expired"},TOKEN_INVALID:{status:401,messageKey:"e\
rrors.token_invalid"},TOKEN_REUSE_DETECTED:{status:401,messageKey:"errors.token_reuse_detected"},EMAIL_NOT_VERIFIED:{status:403,messageKey:"errors.email_not_verified"},FORBIDDEN:{status:403,messageKey:"\
errors.forbidden"},ACCOUNT_LOCKED:{status:403,messageKey:"errors.account_locked"},ACC_UNDERAGE:{status:403,messageKey:"errors.acc_underage"},NOT_FOUND:{status:404,messageKey:"errors.not_found"},CONFLICT:{
status:409,messageKey:"errors.conflict"},CURSOR_EXPIRED:{status:410,messageKey:"errors.cursor_expired"},PAYLOAD_TOO_LARGE:{status:413,messageKey:"errors.payload_too_large"},UNSUPPORTED_MEDIA_TYPE:{status:415,
messageKey:"errors.unsupported_media_type"},RATE_LIMITED:{status:429,messageKey:"errors.rate_limited"},ACC_ACCOUNT_LOCKED:{status:429,messageKey:"errors.rate_limited"},INTERNAL_ERROR:{status:500,messageKey:"\
errors.internal_error"},UPSTREAM_ERROR:{status:502,messageKey:"errors.upstream_error"},SERVICE_UNAVAILABLE:{status:503,messageKey:"errors.service_unavailable"},UPSTREAM_TIMEOUT:{status:504,messageKey:"\
errors.upstream_timeout"}},m=class extends Error{static{o(this,"AppError")}code;status;messageKey;details;context;constructor(t,r,n){super(r,n?.cause!==void 0?{cause:n.cause}:void 0),this.name="AppErr\
or",this.code=t,this.status=ae[t].status,this.messageKey=ae[t].messageKey,this.details=n?.details,this.context=n?.context}},T=o((e,t)=>new m("VALIDATION_FAILED",e,t?{details:t}:void 0),"badRequest");var v=o((e="That resource could not be found.")=>new m("NOT_FOUND",e),"notFound");import ks from"npm:pino@9.5.0";var Is=typeof globalThis.Deno<"u",xs=Is?{write(e){console.log(e.endsWith(`
`)?e.slice(0,-1):e)}}:void 0,h=ks({level:process.env.LOG_LEVEL??"info",redact:{paths:["password","passwordHash","password_hash","*.password","*.passwordHash","*.password_hash","refreshToken","refresh_\
token","*.refreshToken","*.refresh_token","authorization","req.headers.authorization","req.headers.cookie"],censor:"[redacted]"},base:{service:"plantpal-api"}},xs);import{createHash as Ds,randomBytes as Ns,timingSafeEqual as Gi}from"node:crypto";import Pe from"npm:jsonwebtoken@9.0.2";var vs=900,Ss=720*60*60,Os=32,pt=10,gt="plantpal-api",ft="plantpal-clients";function Ue(e,t,r,n=1,s=Math.floor(Date.now()/1e3)){let a={sub:e,sid:t,ver:n,jti:crypto.randomUUID(),iss:gt,aud:ft,iat:s,exp:s+
vs};return Pe.sign(a,r,{algorithm:"HS256"})}o(Ue,"signAccessToken");function yt(e,t){try{let r=Pe.verify(e,t,{algorithms:["HS256"]});return r.iss!==void 0&&r.iss!==gt||r.aud!==void 0&&r.aud!==ft?{ok:!1,
reason:"invalid"}:{ok:!0,claims:r}}catch(r){return r instanceof Pe.TokenExpiredError?{ok:!1,reason:"expired"}:{ok:!1,reason:"invalid"}}}o(yt,"verifyAccessToken");function ue(){let e=Ns(Os).toString("b\
ase64url");return{token:e,digest:V(e)}}o(ue,"issueRefreshToken");function V(e){return Ds("sha256").update(e,"utf8").digest("hex")}o(V,"digestRefreshToken");function le(e=new Date){return new Date(e.getTime()+Ss*1e3)}o(le,"refreshTokenExpiresAt");b();async function ht(e){return await R(async t=>{let{rows:[r]}=await t.query(`insert into users (email, email_normalised, password_hash, minimum_age_confirmed, status)
       values ($1, lower(trim($1)), $2, $3, $4)
       on conflict (email_normalised) do nothing
       returning id, email, status`,[e.email,e.passwordHash,e.confirmedAge,e.status??"PENDING_VERIFICATION"]);if(!r)throw Object.assign(new Error("That email address is already registered."),{code:"CO\
NFLICT",status:409,__appError:!0});let n=e.email.split("@")[0].slice(0,60);return await t.query(`insert into profiles (user_id, display_name)
       values ($1, $2)`,[r.id,n]),await t.query("insert into user_settings (user_id) values ($1)",[r.id]),r})}o(ht,"createUser");async function Et(e){let t=d(),{rows:r}=await t.query(`select id, email\
, status, password_hash, token_version,
            failed_login_count, locked_until, created_at,
            email_verified_at, deletion_requested_at, purge_after
     from users where email_normalised = $1 and status <> 'DELETED'`,[e]);return r[0]??null}o(Et,"findUserForAuth");async function Rt(e){let t=d(),{rows:r}=await t.query("select id, email, status from\
 users where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(Rt,"findUserById");async function qe(e,t){if(!t)return R(c=>qe(e,c));let r=t,n=le(),s=e.installationId,a=crypto.randomUUID(),{token:i,
digest:u}=ue(),{rows:[l]}=await r.query(`select count(*)::text from auth_sessions
     where user_id = $1 and status = 'ACTIVE'`,[e.userId]);return Number(l?.count??0)>=pt&&await r.query(`update auth_sessions
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
     values ($1, $2, $3, null, 1, $4, $5, now())`,[e.userId,a,s,u,n]),{sessionId:a,tokenFamilyId:s,refreshToken:i,refreshTokenDigest:u}}o(qe,"createSession");async function At(e,t){await(t??d()).query(
`update users set failed_login_count = 0, locked_until = null, last_login_at = now()
     where id = $1`,[e])}o(At,"recordLoginSuccess");async function U(e,t,r){await d().query(`insert into login_attempts (email_normalised, ip_prefix, outcome)
     values ($1, $2, $3)`,[e,t,r])}o(U,"recordLoginAttempt");async function Tt(e){let t=d(),{rows:[r]}=await t.query(`select count(*)::text as failures, max(attempted_at)::text as last_failure_at
     from login_attempts
     where email_normalised = $1
       and outcome in ('BAD_PASSWORD', 'NO_ACCOUNT')
       and attempted_at > coalesce(
         (select max(attempted_at) from login_attempts
          where email_normalised = $1 and outcome = 'SUCCESS'),
         now() - interval '24 hours'
       )
       and attempted_at > now() - interval '24 hours'`,[e]),n=Number(r?.failures??"0"),s=r?.last_failure_at?new Date(r.last_failure_at):null,a=n>=5?Math.min(60*Math.pow(2,n-5),1800):0;return{failures:n,
lockSeconds:a,lastFailureAt:s}}o(Tt,"computeLockoutState");async function Fe(e){await d().query(`update users set failed_login_count = failed_login_count + 1
     where email_normalised = $1`,[e])}o(Fe,"recordFailedLogin");async function bt(e,t){let r=t??d(),{rows:n}=await r.query(`select t.id, t.session_id as "sessionId", t.token_family_id as "tokenFamily\
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
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(bt,"findActiveTokenByDigest");async function kt(e,t){let r=t??d(),{rows:n}=await r.query(`select t.id, t.session_i\
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
       and (u.purge_after is null or u.purge_after > now())`,[e]);return n[0]??null}o(kt,"findTokenByDigestAnyState");async function It(e){let t=d(),{rows:r}=await t.query("select password_hash from u\
sers where id = $1 and status <> 'DELETED'",[e]);return r[0]??null}o(It,"findPasswordHashById");async function xt(e,t,r,n){let s=await R(async a=>{let{rowCount:i}=await a.query(`update auth_tokens
       set consumed_at = now()
       where id = $1 and consumed_at is null`,[e]);if(i===0){let{rows:[_]}=await a.query(`select (now() - consumed_at) <= interval '15 seconds' as in_grace, generation
         from auth_tokens where id = $1`,[e]);if(_?.in_grace){let{rows:p}=await a.query(`update auth_tokens set consumed_at = now()
           where parent_id = $1 and consumed_at is null
           returning id`,[e]);if(p.length>0){let y=le(),{token:k}=ue(),I=V(k);return await a.query(`insert into auth_tokens
               (user_id, session_id, token_family_id, parent_id, generation,
                refresh_token_digest, expires_at, family_created_at)
             values ($1, $2, $3, $4,
                     (select generation + 1 from auth_tokens where id = $4),
                     $5, $6,
                     (select family_created_at from auth_tokens where id = $4))`,[n,r,t,e,I,y]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:k,refreshTokenDigest:I}}}}return await $s(a,
t,r,"REUSE_DETECTED"),{kind:"reuse"}}let u=le(),{token:l}=ue(),c=V(l);return await a.query(`insert into auth_tokens
         (user_id, session_id, token_family_id, parent_id, generation,
          refresh_token_digest, expires_at, family_created_at)
       values ($1, $2, $3, $4,
               (select generation + 1 from auth_tokens where id = $4),
               $5, $6,
               (select family_created_at from auth_tokens where id = $4 for share))`,[n,r,t,e,c,u]),await a.query(`update auth_sessions set last_used_at = now()
       where id = $1 and (last_used_at is null or last_used_at < now() - interval '60 seconds')`,[r]),{kind:"ok",session:{sessionId:r,tokenFamilyId:t,refreshToken:l,refreshTokenDigest:c}}});if(s.kind===
"reuse")throw Object.assign(new Error("Token reuse detected. All sessions on this device have been signed out."),{code:"TOKEN_REUSE_DETECTED",status:401,__appError:!0});return s.session}o(xt,"consumeA\
ndRotateToken");async function $s(e,t,r,n){await e.query(`update auth_sessions
     set status = 'REVOKED', revoked_at = now(), revoke_reason = $2
     where token_family_id = $1 and status = 'ACTIVE'`,[t,n]),await e.query(`update auth_tokens
     set consumed_at = coalesce(consumed_at, now())
     where token_family_id = $1 and consumed_at is null`,[t])}o($s,"revokeTokenFamily");var Dt="$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";import St from"npm:bcryptjs@2.4.3";var Nt=12,vt=128,Y=Object.freeze({memoryCost:19456,timeCost:2,parallelism:1,outputLen:32,saltLength:16}),Ot=12,J;async function Ct(){if(J!==void 0)return J;try{J=await import("npm:@node-rs/argon2@2.0.2"),h.info(
{backend:"argon2id",params:Y},"password hashing backend selected")}catch{J=null,h.warn({backend:"bcrypt",cost:Ot},"Argon2 unavailable, using the documented bcrypt fallback of NFR-SEC-03")}return J}o(Ct,
"getArgon2");var ce=class extends Error{static{o(this,"PasswordPolicyError")}};function He(e){let t=[...e].length;if(t<Nt)throw new ce(`Password must be at least ${Nt} characters.`);if(t>vt)throw new ce(
`Password must be at most ${vt} characters.`)}o(He,"assertPasswordPolicy");async function Lt(e){He(e);let t=await Ct();return t?t.hash(e,{memoryCost:Y.memoryCost,timeCost:Y.timeCost,parallelism:Y.parallelism,
outputLen:Y.outputLen,saltLength:Y.saltLength}):St.hash(e,Ot)}o(Lt,"hashPassword");async function de(e,t){try{if(t.startsWith("$argon2")){let r=await Ct();return r?await r.verify(t,e):(h.error("an Arg\
on2 hash was stored but no Argon2 backend is available"),!1)}return t.startsWith("$2")?await St.compare(e,t):(h.error("stored password hash is in an unrecognised format"),!1)}catch{return!1}}o(de,"ver\
ifyPassword");function $t(e){return e.trim().toLowerCase()}o($t,"normaliseEmail");function Us(e){let t=e.ip??"0.0.0.0";return t.includes(":")?t.split(":").slice(0,3).join(":")+"::":t.split(".").slice(0,3).join(".")+
".0"}o(Us,"ipPrefix");function Ms(e){let t=e.header("x-plantpal-device");return t&&t.replace(/[\x00-\x1f]/g,"").replace(/\s+/g," ").trim().slice(0,120)||null}o(Ms,"deviceLabel");function Ve(e){let t=e.
header("x-plantpal-client");return t==="IOS"||t==="ANDROID"||t==="WEB"?t:"WEB"}o(Ve,"platform");function We(){return S().JWT_ACCESS_SECRET}o(We,"accessSecret");var qs=250;async function Pt(e,t=qs){let r=t-
(Date.now()-e);r>0&&await new Promise(n=>setTimeout(n,r))}o(Pt,"enforceTimingFloor");function Ut(){return{httpOnly:!0,secure:!0,sameSite:"none",path:S().REFRESH_COOKIE_PATH,maxAge:720*60*60*1e3}}o(Ut,
"refreshCookieOptions");function Mt(e){if(!!!e.cookies?.refresh_token)return;let r=e.get("origin");if(!r){let n=e.get("referer");if(n)try{r=new URL(n).origin}catch{r=void 0}}if(!r||!S().CORS_ORIGINS.includes(
r))throw new m("FORBIDDEN","Cross-origin session request refused.")}o(Mt,"assertTrustedOriginForCookieAuth");async function qt(e,t,r){let n=Date.now();try{let{email:s,password:a,confirmed_age:i}=e.body,
u=[],l=s?$t(s):"";if((!s||s.length<5||s.length>254||!s.includes("@"))&&u.push({field:"email",issue:"invalid"}),!a)u.push({field:"password",issue:"required"});else try{He(a)}catch{u.push({field:"passwo\
rd",issue:"policy_violation"})}if(i!==!0&&u.push({field:"confirmed_age",issue:"must_be_confirmed"}),u.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:u});let c=await Lt(
a),_=S().REQUIRE_EMAIL_VERIFICATION;try{await ht({email:s,passwordHash:c,confirmedAge:i,status:_?"PENDING_VERIFICATION":"ACTIVE"})}catch(p){if(!(p&&typeof p=="object"&&"__appError"in p))throw p}h.info(
{email_digest:Ps("sha256").update(l).digest("hex").slice(0,16)},"registration attempt"),await Pt(n),t.status(202).json({status:"registered",verification_required:_,message:_?"Check your email for a co\
nfirmation link.":"Your account is ready. Sign in to continue."})}catch(s){r(s)}}o(qt,"register");async function Ft(e,t,r){let n=Date.now();try{let{email:s,password:a}=e.body;if(!s||!a)throw new m("VA\
LIDATION_FAILED","Email and password are required.",{details:[...s?[]:[{field:"email",issue:"required"}],...a?[]:[{field:"password",issue:"required"}]]});let i=$t(s),u=Us(e),l=await Tt(i);if(l.failures>=
5){let N=(l.lastFailureAt?.getTime()??Date.now())+l.lockSeconds*1e3;if(N>Date.now()){let X=Math.ceil((N-Date.now())/1e3);throw await U(i,u,"LOCKED_OUT"),t.setHeader("Retry-After",String(X)),new m("ACC\
_ACCOUNT_LOCKED",`Too many attempts. Try again in ${X} seconds.`,{context:{retry_after_seconds:X}})}}let c=await Et(i),_=c?.password_hash??Dt,p=await de(a,_);if(await Pt(n),!c||!c.password_hash)throw await U(
i,u,"NO_ACCOUNT"),i&&await Fe(i),new m("INVALID_CREDENTIALS","That email or password is not right.");if(!p)throw await U(i,u,"BAD_PASSWORD"),await Fe(i),new m("INVALID_CREDENTIALS","That email or pass\
word is not right.");let y=new Date;if(c.locked_until&&c.locked_until>y)throw await U(i,u,"LOCKED_OUT"),new m("ACCOUNT_LOCKED","Account is locked.");if(c.purge_after&&c.purge_after<=y)throw await U(i,
u,"NO_ACCOUNT"),new m("INVALID_CREDENTIALS","That email or password is not right.");if(c.status==="PENDING_VERIFICATION"&&S().REQUIRE_EMAIL_VERIFICATION&&c.created_at.getTime()+6048e5<y.getTime())throw await U(
i,u,"UNVERIFIED"),new m("EMAIL_NOT_VERIFIED","Confirm your email address to sign in.",{context:{resend_available:!0}});let k=crypto.randomUUID(),I=await qe({userId:c.id,platform:Ve(e),installationId:k,
deviceLabel:Ms(e),ipAddressHash:u,userAgent:(e.get("user-agent")??"").slice(0,200)});await At(c.id),await U(i,u,"SUCCESS");let L={access_token:Ue(c.id,I.sessionId,We(),c.token_version),token_type:"Bea\
rer",expires_in:900,user:{id:c.id,email:c.email,status:c.status}};Ve(e)==="WEB"?t.cookie("refresh_token",I.refreshToken,Ut()):L.refresh_token=I.refreshToken,c.status==="PENDING_DELETION"&&(L.account_pending_deletion=
!0,L.deletion_scheduled_at=c.purge_after?.toISOString()),t.status(200).json(L)}catch(s){r(s)}}o(Ft,"login");async function Ht(e,t,r){try{Mt(e);let n=e.cookies?.refresh_token??e.body?.refresh_token;if(!n)
throw new m("AUTHENTICATION_REQUIRED","No refresh token provided.");let s=V(n),a=await bt(s)??await kt(s);if(!a)throw new m("TOKEN_EXPIRED","Session expired. Please sign in again.");let i=await xt(a.id,
a.tokenFamilyId,a.sessionId,a.userId),u=Ue(a.userId,a.sessionId,We(),a.tokenVersion),l=Ve(e)==="WEB",c={access_token:u,token_type:"Bearer",expires_in:900};l?t.cookie("refresh_token",i.refreshToken,Ut()):
c.refresh_token=i.refreshToken,t.status(200).json(c)}catch(n){r(n)}}o(Ht,"refresh");async function Vt(e,t,r){try{Mt(e);let n=e.cookies?.refresh_token??e.body?.refresh_token;if(n){let s=V(n),a=(await Promise.resolve().then(()=>(b(),wt))).
getPool();await a.query(`update auth_tokens
         set consumed_at = coalesce(consumed_at, now())
         where refresh_token_digest = $1 and consumed_at is null`,[s]),await a.query(`update auth_sessions s
         set status = 'REVOKED', revoked_at = now(), revoke_reason = 'USER_LOGOUT'
         from auth_tokens t
         where t.session_id = s.id
           and t.refresh_token_digest = $1
           and s.status = 'ACTIVE'`,[s])}t.clearCookie("refresh_token",{path:S().REFRESH_COOKIE_PATH}),t.status(200).json({status:"logged_out"})}catch(n){r(n)}}o(Vt,"logout");async function Wt(e,t,r){
try{let n=e.userId,s=n?await Rt(n):null;if(!s)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");t.status(200).json({user:s})}catch(n){r(n)}}o(Wt,"me");async function E(e,t,r){try{let n=e.
header("authorization");if(!n?.startsWith("Bearer "))throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");let s=n.slice(7),a=We(),i=yt(s,a);if(!i.ok)throw new m(i.reason==="expired"?"T\
OKEN_EXPIRED":"TOKEN_INVALID",i.reason==="expired"?"Access token expired. Refresh to continue.":"Invalid access token.");e.userId=i.claims.sub,e.sessionId=i.claims.sid,r()}catch(n){r(n)}}o(E,"authenti\
cate");function Ge(e){let t=new Map;return o(function(n,s,a){let i=Date.now();if(t.size>1e4)for(let[c,_]of t)_.resetAt<=i&&t.delete(c);let u=n.ip??"unknown",l=t.get(u);if(!l||l.resetAt<=i){t.set(u,{count:1,resetAt:i+
e.windowMs}),a();return}if(l.count+=1,l.count>e.max){s.setHeader("Retry-After",String(Math.ceil((l.resetAt-i)/1e3))),a(new m("RATE_LIMITED","Too many requests. Slow down."));return}a()},"rateLimitMidd\
leware")}o(Ge,"rateLimit");var K=Fs(),Gt=o((e,t,r)=>r(),"passThrough"),jt=process.env.NODE_ENV==="test",Bt=jt?Gt:Ge({windowMs:6e4,max:30}),je=jt?Gt:Ge({windowMs:6e4,max:300});K.post("/register",Bt,qt);K.post("/login",Bt,Ft);K.post(
"/refresh",je,Ht);K.post("/logout",je,Vt);K.get("/me",je,E,Wt);var Yt=K;import{Router as lo}from"npm:express@4.21.2";import{z as W}from"npm:zod@3.24.1";function f(e){let t=e.userId;if(typeof t!="string"||t.length===0)throw new m("AUTHENTICATION_REQUIRED","Authentication is required.");return t}o(f,"getUserId");function A(...e){return Object.freeze(Object.fromEntries(e.map(t=>[t,t])))}o(A,"asEnum");var Be=A("NORTHERN","SOUTHERN","EQUATORIAL"),w=A("SPRING","SUMMER","AUTUMN","WINTER","YEAR_ROUND"),ba=A("METRIC",
"IMPERIAL"),Z=A("LOW","MEDIUM","BRIGHT_INDIRECT","DIRECT_SUN"),M=A("FABRIC","TERRACOTTA","CONCRETE","CERAMIC_GLAZED","METAL","PLASTIC","OTHER"),$=A("ORCHID_BARK","CACTUS_SUCCULENT","GARDEN_SOIL","STAN\
DARD_POTTING","PEAT_BASED","COCO_COIR","SEMI_HYDRO_LECA","OTHER"),_e=A("INDOOR","OUTDOOR"),ee=A("NONE","HEATED_DRY_WINTER","AIR_CONDITIONED","HUMID_ROOM"),ka=A("THRIVING","NEEDS_ATTENTION","CRITICAL",
"DORMANT"),Ia=A("WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"),xa=A("LOW","MODERATE","VIGOROUS"),Da=A("HEAVIEST_WEIGHT","BEST_ESTIMATED_1RM","BEST_REP_COUNT"),Na=A("BREAKFAST","\
LUNCH","DINNER","SNACK"),me=A("MALE","FEMALE","PREFER_NOT_TO_SAY"),z=A("SEDENTARY","LIGHTLY_ACTIVE","MODERATELY_ACTIVE","VERY_ACTIVE","EXTRA_ACTIVE"),va=A("LOSE","MAINTAIN","GAIN"),Sa=A("GRAM","MILLIL\
ITRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"),Oa=A("SYNCED","PENDING","SYNCING","FAILED"),Ca=A("PENDING","SENT","DELIVERED","FAILED","SUPPRESSED","CANCELLED");function Ye(e){if(!Number.isFinite(e))throw new RangeError(`roundHalfUp expected a finite number, received ${e}`);return Math.sign(e)*Math.floor(Math.abs(e)+.5)}o(Ye,"roundHalfUp");function Q(e,t){if(!Number.
isFinite(e))throw new RangeError(`roundTo expected a finite number, received ${e}`);if(!Number.isInteger(t)||t<0||t>10)throw new RangeError(`roundTo expected 0..10 decimals, received ${t}`);let r=10**
t;return Math.sign(e)*Math.floor(Math.abs(e)*r+.5)/r}o(Q,"roundTo");function Kt(e,t,r){if(t>r)throw new RangeError(`clamp received an inverted range: min ${t} exceeds max ${r}`);return Math.min(Math.max(
e,t),r)}o(Kt,"clamp");var Hs=[w.WINTER,w.WINTER,w.SPRING,w.SPRING,w.SPRING,w.SUMMER,w.SUMMER,w.SUMMER,w.AUTUMN,w.AUTUMN,w.AUTUMN,w.WINTER],Vs=Object.freeze({[w.WINTER]:w.SUMMER,[w.SUMMER]:w.WINTER,[w.SPRING]:w.AUTUMN,[w.AUTUMN]:w.
SPRING,[w.YEAR_ROUND]:w.YEAR_ROUND});function Ws(e,t){if(t===Be.EQUATORIAL)return w.YEAR_ROUND;let r=Hs[e-1];if(r===void 0)throw new RangeError(`seasonForMonth expected a month in 1..12, received ${e}`);
return t===Be.NORTHERN?r:Vs[r]}o(Ws,"seasonForMonth");function zt(e,t){let r=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!r?.[2])throw new RangeError(`seasonForLocalDate expected a YYYY-MM-DD date, receive\
d "${e}"`);let n=Number(r[2]);if(n<1||n>12)throw new RangeError(`seasonForLocalDate received an out-of-range month in "${e}"`);return Ws(n,t)}o(zt,"seasonForLocalDate");var Gs=Object.freeze({[w.SPRING]:.95,[w.SUMMER]:.8,[w.AUTUMN]:1.15,[w.WINTER]:1.4,[w.YEAR_ROUND]:1}),js=Object.freeze({[Z.LOW]:1.25,[Z.MEDIUM]:1.1,[Z.BRIGHT_INDIRECT]:1,[Z.DIRECT_SUN]:.85}),Bs=Object.
freeze({[M.FABRIC]:.75,[M.TERRACOTTA]:.8,[M.CONCRETE]:.9,[M.CERAMIC_GLAZED]:1,[M.OTHER]:1,[M.METAL]:1.05,[M.PLASTIC]:1.1}),Ys=Object.freeze({[$.ORCHID_BARK]:.75,[$.CACTUS_SUCCULENT]:.85,[$.GARDEN_SOIL]:.95,
[$.STANDARD_POTTING]:1,[$.OTHER]:1,[$.PEAT_BASED]:1.1,[$.COCO_COIR]:1.1,[$.SEMI_HYDRO_LECA]:1.3}),Ks=Object.freeze({[_e.INDOOR]:1,[_e.OUTDOOR]:.85}),zs=Object.freeze({[ee.HEATED_DRY_WINTER]:.85,[ee.AIR_CONDITIONED]:.9,
[ee.NONE]:1,[ee.HUMID_ROOM]:1.2});function Qs(e){if(e==null)return 1;if(!Number.isFinite(e)||e<=0)throw new RangeError(`potDiameterFactor expected a positive diameter, received ${e}`);return e<10?.8:e<
15?.9:e<20?1:e<30?1.15:e<40?1.3:1.45}o(Qs,"potDiameterFactor");function Xs(e){return e===!1?1.15:1}o(Xs,"drainageFactor");function Qt(e){let{baseIntervalDays:t,minIntervalDays:r,maxIntervalDays:n,season:s,
lightExposure:a,placement:i}=e;if(!Number.isFinite(t)||t<=0)throw new RangeError(`baseIntervalDays must be positive, received ${t}`);if(r>n)throw new RangeError(`species bounds are inverted: min ${r} \
exceeds max ${n}`);let u=Gs[s],l=js[a],c=e.potMaterial?Bs[e.potMaterial]:1,_=Qs(e.potDiameterCm),p=Xs(e.hasDrainage),y=c*_*p,k=Ks[i],I=e.soilType?Ys[e.soilType]:1,x=i===_e.OUTDOOR?1:e.indoorClimate?zs[e.
indoorClimate]:1,L=k*I*x,P=t*u*l*y*L,N=Ye(P),X=Kt(N,r,n),Rs=Math.max(X,1),$e=null;return N<r?$e="MIN":N>n&&($e="MAX"),{baseIntervalDays:t,season:s,fSeason:u,lightExposure:a,fLight:l,fPot:y,fMaterial:c,
fDiameter:_,fDrainage:p,fEnv:L,fPlacement:k,fSoil:I,fClimate:x,rawInterval:P,effectiveIntervalDays:Rs,clamped:$e}}o(Qt,"computeWateringInterval");var Ya=Object.freeze({protein:4,carbohydrate:4,fat:9});var Ka=Object.freeze({[me.MALE]:5,[me.FEMALE]:-161,[me.PREFER_NOT_TO_SAY]:-78}),za=Object.freeze({[z.SEDENTARY]:1.2,[z.LIGHTLY_ACTIVE]:1.375,[z.MODERATELY_ACTIVE]:1.55,[z.VERY_ACTIVE]:1.725,[z.EXTRA_ACTIVE]:1.9}),
Qa=Object.freeze({bodyMassKg:{min:30,max:400},heightCm:{min:100,max:250},ageYears:{min:16,max:120}});function pe(e,t,r){if(!Number.isFinite(e)||e<1||e>23)throw new RangeError(`metValue must be between 1.0 and 23.0, received ${e}`);if(!Number.isFinite(t)||t<=0)throw new RangeError(`bodyMassKg must be \
positive, received ${t}`);if(!Number.isFinite(r)||r<=0)throw new RangeError(`durationMinutes must be positive, received ${r}`);return Q(e*t*r/60,1)}o(pe,"workoutEnergyKcal");var Xt=Object.freeze({min:1,
max:12});function ge(e,t){if(!Number.isFinite(e)||e<0)throw new RangeError(`weightKg must be non-negative, received ${e}`);if(!Number.isInteger(t)||t<1)throw new RangeError(`reps must be a positive in\
teger, received ${t}`);if(e===0)return 0;let r=t===1?e:e*(1+t/30);return Q(r,1)}o(ge,"estimatedOneRepMax");function fe(e,t){return e>0&&Number.isInteger(t)&&t>=Xt.min&&t<=Xt.max}o(fe,"isEligibleForOne\
RepMaxRecord");function ye(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError(`reps must be a non-negative integer, received ${e}`);if(!Number.isFinite(t)||t<0)throw new RangeError(`weightKg must \
be non-negative, received ${t}`);return Q(e*t,1)}o(ye,"setVolumeKg");function we(e){let t=e.reduce((r,n)=>r+n.reps*n.weightKg,0);return Q(t,1)}o(we,"totalVolumeKg");var Ke=/^\d{4}-\d{2}-\d{2}$/;function Js(e,t){if(!Ke.test(e)||!Ke.test(t))throw new RangeError("local dates must be YYYY-MM-DD");return Math.round((Date.parse(t)-Date.parse(e))/864e5)}o(Js,"localDateD\
iffDays");function Jt(e,t){if(!Ke.test(t))throw new RangeError("todayLocalDate must be YYYY-MM-DD");if(e.lastCountedDate===null)return{...e,currentLength:1,longestLength:Math.max(e.longestLength,1),lastCountedDate:t};
let r=Js(e.lastCountedDate,t);if(r<=0)return e;if(r===1){let s=e.currentLength+1;return{...e,currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t}}let n=r-1;if(n<=e.freezeTokens){
let s=e.currentLength+1;return{currentLength:s,longestLength:Math.max(e.longestLength,s),lastCountedDate:t,freezeTokens:e.freezeTokens-n}}return{...e,currentLength:1,longestLength:Math.max(e.longestLength,
1),lastCountedDate:t}}o(Jt,"advanceStreakOnLog");b();function Zs(e){return{currentLength:e?.current_length??0,longestLength:e?.longest_length??0,lastCountedDate:e?.last_counted_date??null,freezeTokens:e?.freeze_tokens??0}}o(Zs,"toState");async function Zt(e,t,r,n){
await e.query(`insert into streaks (user_id, streak_type)
     values ($1, $2)
     on conflict (user_id, streak_type) do nothing`,[t,r]);let{rows:s}=await e.query(`select current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1 and streak_type = $2
     for update`,[t,r]),a=Jt(Zs(s[0]),n);return await e.query(`update streaks
     set current_length = $3, longest_length = $4, last_counted_date = $5,
         freeze_tokens = $6, updated_at = now()
     where user_id = $1 and streak_type = $2`,[t,r,a.currentLength,a.longestLength,a.lastCountedDate,a.freezeTokens]),a}o(Zt,"advanceScope");var en={plants_added:"select count(*)::int as v from plants\
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
                       ) then 1 else 0 end as v`};function eo(e,t){return e.filter(r=>{let n=t.get(r.metric);return n!==void 0&&n>=r.gte})}o(eo,"evaluateUnlocks");async function tn(e,t){let{rows:r}=await e.
query(`select a.id, a.code, a.criteria
     from achievements a
     where a.is_active
       and not exists (
         select 1 from user_achievements ua
         where ua.user_id = $1 and ua.achievement_id = a.id and ua.unlocked_at is not null
       )`,[t]),n=[];for(let i of r){let u=i.criteria;typeof u?.metric=="string"&&typeof u?.gte=="number"&&en[u.metric]&&n.push({id:i.id,code:i.code,metric:u.metric,gte:u.gte})}if(n.length===0)return[];
let s=new Map;for(let i of new Set(n.map(u=>u.metric))){let u=en[i];if(!u)continue;let{rows:l}=await e.query(u,[t]);s.set(i,Number(l[0]?.v??0))}let a=eo(n,s);for(let i of a)await e.query(`insert into \
user_achievements (user_id, achievement_id, unlocked_at, progress_pct)
       values ($1, $2, now(), 100)
       on conflict (user_id, achievement_id)
       do update set unlocked_at = coalesce(user_achievements.unlocked_at, now()), progress_pct = 100`,[t,i.id]);return a.map(i=>i.code)}o(tn,"evaluateAchievements");var to={PLANT_CARE:`select (not ex\
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
              where user_id = $1 and local_date_str = $2 and deleted_at is null`};async function no(e,t,r){return R(async n=>{let{rows:s}=await n.query(to[t],[e,r]),a=s[0]?.met===!0;if(a){await Zt(n,e,
t,r);let{rows:u}=await n.query(`select streak_type, last_counted_date from streaks
         where user_id = $1 and streak_type in ('PLANT_CARE', 'FITNESS', 'NUTRITION')
         order by streak_type
         for update`,[e]),{rows:[l]}=await n.query(`select plant_care_enabled, fitness_enabled, nutrition_enabled
         from user_settings where user_id = $1`,[e]),c=[["PLANT_CARE",l?.plant_care_enabled??!0],["FITNESS",l?.fitness_enabled??!0],["NUTRITION",l?.nutrition_enabled??!0]].filter(([,y])=>y).map(([y])=>y),
_=new Set(u.filter(y=>y.last_counted_date===r).map(y=>y.streak_type));c.length>0&&c.every(y=>_.has(y))&&await Zt(n,e,"OVERALL",r)}let i=await tn(n,e);return{met:a,unlocked:i}})}o(no,"recordDailyLog");
async function he(e){try{let t=await R(r=>tn(r,e));t.length>0&&h.info({userId:e,unlocked:t},"achievements unlocked")}catch(t){h.warn({err:t,userId:e},"achievement evaluation failed (log write unaffect\
ed)")}}o(he,"evaluateAchievementsSafe");async function q(e,t,r){try{let{met:n,unlocked:s}=await no(e,t,r);s.length>0&&h.info({userId:e,scope:t,met:n,unlocked:s},"achievements unlocked")}catch(n){h.warn(
{err:n,userId:e,scope:t},"engagement update failed (log write unaffected)")}}o(q,"recordDailyLogSafe");b();async function rn(e){let t=d(),{rows:r}=await t.query(`select p.id as plant_id, p.user_id, p.nickname, p.next_water_due_at
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
       )`,[e]);return r}o(rn,"findPlantsNeedingReminder");async function sn(e){if(e.length===0)return 0;let t=d(),r=0;for(let n of e){let s=await t.query(`insert into reminders
         (user_id, reminder_type, target_entity_id, target_entity_type, title, body, due_at_utc)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, reminder_type, target_entity_id)
         where status = 'PENDING' and target_entity_id is not null
       do nothing`,[n.user_id,n.reminder_type,n.target_entity_id,n.target_entity_type,n.title,n.body,n.due_at_utc]);r+=s.rowCount??0}return r}o(sn,"insertReminders");var ro=["OFF","WINDOW","SCHEDULED_\
ONLY"];function nn(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(nn,"toWallClock");async function on(e){let t=new Map;if(e.length===0)return t;let r=d(),{rows:n}=await r.
query(`select user_id, timezone, quiet_hours_mode, quiet_start_time, quiet_end_time,
            daily_notification_cap
     from user_settings
     where user_id = any ($1::uuid[])`,[e]);for(let s of n)t.set(s.user_id,{timezone:s.timezone,quiet_hours_mode:ro.includes(s.quiet_hours_mode)?s.quiet_hours_mode:"OFF",quiet_start_time:nn(s.quiet_start_time),
quiet_end_time:nn(s.quiet_end_time),daily_notification_cap:s.daily_notification_cap});return t}o(on,"findNotificationSettings");async function an(e,t,r=48){let n=new Map;if(e.length===0)return n;let s=d(),
{rows:a}=await s.query(`select user_id, sent_at
     from reminders
     where user_id = any ($1::uuid[])
       and status in ('SENT', 'DELIVERED')
       and sent_at is not null
       -- Bounded by the caller's now(), not the database's, so the count the
       -- engine sees is the count for the instant it is deciding about.
       and sent_at > $2::timestamptz - ($3 || ' hours')::interval
       and sent_at <= $2::timestamptz`,[e,t,r]);for(let i of a){let u=n.get(i.user_id);u?u.push(i.sent_at):n.set(i.user_id,[i.sent_at])}return n}o(an,"findRecentSentAt");async function un(e=200){let t=d(),
{rows:r}=await t.query(`select id, user_id, title, body, due_at_utc, attempts
     from reminders
     where status = 'PENDING' and due_at_utc <= now()
     order by due_at_utc asc
     limit $1`,[e]);return r}o(un,"findDuePending");async function ln(e){if(e.length===0)return;await d().query(`update reminders
     set status = 'DELIVERED', updated_at = now()
     where id = any ($1::uuid[]) and status = 'SENT'`,[e])}o(ln,"markDelivered");async function cn(e){if(e.length===0)return;await d().query(`update reminders
     set status = 'SENT', sent_at = now(), attempts = attempts + 1, updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(cn,"markSent");async function dn(e){if(e.length===0)return;await d().query(`update reminders
     set status = 'FAILED', last_error = 'delivery attempts exhausted', updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,[e])}o(dn,"markFailed");async function _n(e,t=50){let r=d(),{rows:n}=await r.query(`select id, reminder_type, target_entity_id, title, body, du\
e_at_utc, status, sent_at
     from reminders
     where user_id = $1
       and (status in ('PENDING', 'SENT')
            or (status = 'DELIVERED' and sent_at > now() - interval '7 days'))
     order by due_at_utc desc
     limit $2`,[e,t]);return n}o(_n,"listForUser");async function mn(e,t){return((await d().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where id = $1 and user_id = $2 and status in ('PENDING', 'SENT')`,[t,e])).rowCount??0)>0}o(mn,"dismiss");async function ze(e,t){return(await d().query(`update reminders
     set status = 'CANCELLED', updated_at = now()
     where user_id = $1 and target_entity_id = $2 and status in ('PENDING', 'SENT')`,[e,t])).rowCount??0}o(ze,"cancelForTarget");b();var Ee=`id, nickname, species_id, status, next_water_due_at, effective_interval_days,
  photo_url, watering_factor_snapshot, light_exposure, placement, pot_material, soil_type,
  base_interval_days, min_interval_days, max_interval_days, last_watered_at, room,
  acquisition_date, created_at`;async function gn(e){let t=d(),{rows:r}=await t.query(`SELECT ${Ee} FROM plants WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,[e]);return r}o(gn,"li\
stPlants");async function Re(e,t){let r=d(),{rows:n}=await r.query(`SELECT ${Ee} FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[e,t]);return n[0]??null}o(Re,"getPlant");async function fn(e,t){
let r=d(),{rows:[n]}=await r.query(`INSERT INTO plants
       (user_id, nickname, species_id, room, acquisition_date, light_exposure, placement,
        pot_material, has_drainage, soil_type, indoor_climate, base_interval_days,
        min_interval_days, max_interval_days, photo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${Ee}`,[e,t.nickname,t.species_id??null,t.room??null,t.acquisition_date??null,t.light_exposure,t.placement,t.pot_material??null,t.has_drainage??null,t.soil_type??null,t.indoor_climate??
null,t.base_interval_days,t.min_interval_days,t.max_interval_days,t.photo_url??null]);return n}o(fn,"createPlant");var so=new Set(["nickname","species_id","room","acquisition_date","light_exposure","p\
lacement","pot_material","has_drainage","soil_type","indoor_climate","base_interval_days","min_interval_days","max_interval_days","photo_url"]);async function yn(e,t,r){let n=Object.entries(r).filter(
([l,c])=>c!==void 0&&so.has(l));if(n.length===0)return Re(e,t);let s=n.map(([l],c)=>`${l}=$${c+3}`).join(", "),a=n.map(([,l])=>l),i=d(),{rows:u}=await i.query(`UPDATE plants SET ${s}, updated_at=now()\

     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     RETURNING ${Ee}`,[e,t,...a]);return u[0]??null}o(yn,"updatePlant");async function wn(e,t){let r=d(),{rowCount:n}=await r.query("UPDATE plants SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND d\
eleted_at IS NULL",[e,t]);return(n??0)>0}o(wn,"softDeletePlant");async function Ae(e,t,r,n,s,a){await R(async i=>{let{rows:[u]}=await i.query(`SELECT base_interval_days, min_interval_days, max_interva\
l_days, light_exposure,
              placement, pot_material, pot_diameter_cm, soil_type, indoor_climate,
              has_drainage, effective_interval_days
       FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,[t,e]);if(!u)throw Object.assign(new Error("Plant not found"),{__notFound:!0});if(((await i.query(`INSERT INTO plant_care_events
         (plant_id, user_id, action_type, note, local_date_str, interval_at_log_days, client_idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (client_idempotency_key) DO NOTHING`,[t,e,r,n??null,s,u.effective_interval_days??null,a??null])).rowCount??0)!==0&&r==="WATER"){let c=zt(s,"NORTHERN"),_=Qt({baseIntervalDays:u.base_interval_days,
minIntervalDays:u.min_interval_days,maxIntervalDays:u.max_interval_days,season:c,lightExposure:u.light_exposure,placement:u.placement,potMaterial:u.pot_material,potDiameterCm:u.pot_diameter_cm,hasDrainage:u.
has_drainage,soilType:u.soil_type,indoorClimate:u.indoor_climate});await i.query(`UPDATE plants
         SET last_watered_at=now(),
             next_water_due_at=now() + make_interval(days => $1::int),
             effective_interval_days=$1::int,
             watering_factor_snapshot=$2,
             updated_at=now()
         WHERE id=$3`,[_.effectiveIntervalDays,JSON.stringify(_),t])}})}o(Ae,"logCareEvent");async function hn(e,t,r=50){let n=d(),{rows:s}=await n.query(`SELECT id, plant_id, user_id, action_type, no\
te, logged_at_utc, local_date_str,
            interval_at_log_days, client_idempotency_key
     FROM plant_care_events WHERE plant_id=$1 AND user_id=$2 ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(hn,"listCareEvents");var En=`id, plant_id, user_id, photo_url, photo_storage_key,\
 height_cm, note,
  logged_at_utc, local_date_str, created_at`,pn=40;async function Rn(e,t,r){let n=d(),{rows:s}=await n.query(`INSERT INTO growth_log_entries
       (plant_id, user_id, photo_url, photo_storage_key, height_cm, note, local_date_str)
     SELECT p.id, p.user_id, $3::text, $4::text, $5::numeric, $6::text, $7::text
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL
        AND (SELECT count(*) FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) < $8::int
     RETURNING ${En}`,[t,e,r.photo_url,r.photo_storage_key,r.height_cm??null,r.note??null,r.local_date_str,pn]),a=s[0];if(a)return{status:"CREATED",entry:a};let{rows:[i]}=await n.query(`SELECT (SELECT\
 count(*)::int FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) AS current
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL`,[t,e]);return i?{status:"LIMIT_EXCEEDED",current:i.current,ceiling:pn}:{status:"NOT_FOUND"}}o(Rn,"createGrowthEntry");async function An(e,t,r=50){
let n=d(),{rows:s}=await n.query(`SELECT ${En}
     FROM growth_log_entries
     WHERE plant_id=$1 AND user_id=$2 AND deleted_at IS NULL
     ORDER BY logged_at_utc DESC LIMIT $3`,[e,t,r]);return s}o(An,"listGrowthEntries");async function Tn(e,t,r){let n=d(),{rowCount:s}=await n.query(`UPDATE growth_log_entries SET deleted_at=now()
     WHERE id=$1 AND plant_id=$2 AND user_id=$3 AND deleted_at IS NULL`,[e,t,r]);return(s??0)>0}o(Tn,"softDeleteGrowthEntry");async function bn(e){let t=d();if(e){let{rows:n}=await t.query(`SELECT id,\
 common_name, scientific_name, base_interval_days, min_interval_days,
              max_interval_days, default_light, default_soil, care_notes, image_url
       FROM species WHERE lower(common_name) ILIKE $1 AND NOT is_custom ORDER BY common_name LIMIT 200`,[`%${e.toLowerCase()}%`]);return n}let{rows:r}=await t.query(`SELECT id, common_name, scientific\
_name, base_interval_days, min_interval_days,
            max_interval_days, default_light, default_soil, care_notes, image_url
     FROM species WHERE NOT is_custom ORDER BY common_name LIMIT 200`);return r}o(bn,"listSpecies");var kn=["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"],oo=W.string().trim().max(2048).url().refine(e=>/^https?:\/\//i.test(e),"photo_url must be an http(s) URL"),io=W.object({photo_url:oo,
photo_storage_key:W.string().trim().min(1).max(512).optional(),height_cm:W.number().min(0).max(5e3).optional(),note:W.string().trim().max(1e3).optional(),local_date_str:W.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).
strict(),ao=20;function uo(e){return e.issues.slice(0,ao).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))}o(uo,"detailsFor");function Te(e,t){let r=W.string().uuid().safeParse(e);if(!r.success)
throw T(`${t} must be a UUID.`,[{field:t,issue:"invalid"}]);return r.data}o(Te,"requireUuidParam");async function In(e,t,r){try{let n=f(e),s=await gn(n);t.json(s)}catch(n){r(n)}}o(In,"list");async function xn(e,t,r){try{let n=f(e),s=await Re(e.params.id,n);if(!s)throw v();t.json(s)}catch(n){r(n)}}o(
xn,"get");async function Dn(e,t,r){try{let n=f(e),s=e.body,a=typeof s.nickname=="string"?s.nickname.trim():"";if(!a||a.length>80)throw T("nickname must be 1\u201380 characters.",[{field:"nickname",issue:"\
invalid"}]);let i=Number(s.base_interval_days);if(!Number.isInteger(i)||i<1||i>365)throw T("base_interval_days must be 1\u2013365.",[{field:"base_interval_days",issue:"invalid"}]);let u=Number(s.min_interval_days),
l=Number(s.max_interval_days);if(u>l)throw T("min_interval_days must not exceed max_interval_days.",[{field:"min_interval_days",issue:"invalid"}]);let c=await fn(n,s);t.status(201).json(c)}catch(n){r(
n)}}o(Dn,"create");async function Nn(e,t,r){try{let n=f(e),s=await yn(e.params.id,n,e.body);if(!s)throw v();t.json(s)}catch(n){r(n)}}o(Nn,"update");async function vn(e,t,r){try{let n=f(e);if(!await wn(
e.params.id,n))throw v();await ze(n,e.params.id).catch(()=>{}),t.json({status:"deleted"})}catch(n){r(n)}}o(vn,"remove");async function Sn(e,t,r){try{let n=f(e),s=e.body,a=s.action_type;if(!a||!kn.includes(
a))throw T("action_type must be one of: "+kn.join(", "),[{field:"action_type",issue:"invalid"}]);let i=s.local_date_str;if(!i)throw T("local_date_str is required.",[{field:"local_date_str",issue:"requ\
ired"}]);try{await Ae(n,e.params.id,a,s.note,i,s.client_idempotency_key)}catch(u){throw u&&typeof u=="object"&&"__notFound"in u?v():u}a==="WATER"&&await ze(n,e.params.id).catch(()=>{}),await q(n,"PLAN\
T_CARE",i),t.status(201).json({status:"logged"})}catch(n){r(n)}}o(Sn,"logCare");async function On(e,t,r){try{let n=f(e),s=await hn(e.params.id,n);t.json(s)}catch(n){r(n)}}o(On,"getCareHistory");async function Cn(e,t,r){
try{let n=f(e),s=Te(e.params.id,"id"),a=io.safeParse(e.body);if(!a.success)throw T("The request failed validation.",uo(a.error));let i=a.data,u=await Rn(n,s,{photo_url:i.photo_url,photo_storage_key:i.
photo_storage_key??i.photo_url,...i.height_cm!==void 0?{height_cm:i.height_cm}:{},...i.note!==void 0?{note:i.note}:{},local_date_str:i.local_date_str});if(u.status==="NOT_FOUND")throw v();if(u.status===
"LIMIT_EXCEEDED")throw new m("CONFLICT",`This plant already has the maximum of ${u.ceiling} growth entries. Delete an older entry to add a new one.`,{details:[{field:"growth",issue:"limit_exceeded",current:u.
current,ceiling:u.ceiling}]});t.status(201).json(u.entry)}catch(n){r(n)}}o(Cn,"logGrowth");async function Ln(e,t,r){try{let n=f(e),s=Te(e.params.id,"id");if(!await Re(s,n))throw v();t.json(await An(s,
n))}catch(n){r(n)}}o(Ln,"getGrowthHistory");async function $n(e,t,r){try{let n=f(e),s=Te(e.params.id,"id"),a=Te(e.params.entryId,"entryId");if(!await Tn(a,s,n))throw v();t.json({status:"deleted"})}catch(n){
r(n)}}o($n,"removeGrowthEntry");async function Pn(e,t,r){try{let n=await bn(e.query.q);t.json(n)}catch(n){r(n)}}o(Pn,"searchSpecies");var D=lo();D.use(E);D.get("/species",Pn);D.get("/",In);D.post("/",Dn);D.get("/:id",xn);D.put("/:id",Nn);D.delete("/:id",vn);D.post("/:id/care",Sn);D.get("/:id/care",On);D.post("/:id/growth",Cn);D.get(
"/:id/growth",Ln);D.delete("/:id/growth/:entryId",$n);var Un=D;import{Router as fo}from"npm:express@4.21.2";b();async function Mn(e){if(e.length===0)return new Map;let t=d(),{rows:r}=await t.query(`select workout_id, id, set_index, reps,
            weight_kg::float8        as weight_kg,
            volume_kg::float8        as volume_kg,
            estimated_1rm_kg::float8 as estimated_1rm_kg
     from workout_sets
     where workout_id = any($1)
     order by workout_id, set_index`,[e]),n=new Map;for(let s of r){let{workout_id:a,...i}=s,u=n.get(a)??[];u.push(i),n.set(a,u)}return n}o(Mn,"fetchSetsForWorkouts");async function qn(e,t=20,r=0){let n=d(),
{rows:s}=await n.query(`select id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where user_id = $1 and deleted_at is null
     order by logged_at_utc desc
     limit $2 offset $3`,[e,t,r]),a=await Mn(s.map(i=>i.id));return s.map(i=>({...i,sets:a.get(i.id)??[]}))}o(qn,"listWorkouts");async function Fn(e,t){let r=d(),{rows:n}=await r.query(`select id, use\
r_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log::float8      as met_value_at_log,
            body_mass_at_log_kg::float8   as body_mass_at_log_kg,
            calories_burned::float8       as calories_burned,
            total_volume_kg::float8       as total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where id = $1 and user_id = $2 and deleted_at is null`,[e,t]);if(!n[0])return null;let s=await Mn([n[0].id]);return{...n[0],sets:s.get(n[0].id)??[]}}o(Fn,"getWorkout");async function be(e,t){return await R(
async r=>{let{rows:n}=await r.query(`insert into workouts
         (user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
          met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
          steps, note, local_date_str, client_idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
                 met_value_at_log::float8    as met_value_at_log,
                 body_mass_at_log_kg::float8 as body_mass_at_log_kg,
                 calories_burned::float8     as calories_burned,
                 total_volume_kg::float8     as total_volume_kg,
                 steps, note, logged_at_utc, local_date_str, client_idempotency_key`,[e,t.exercise_id??null,t.activity_type,t.duration_mins??null,t.perceived_intensity??null,t.met_value_at_log??null,t.
body_mass_at_log_kg??null,t.calories_burned??null,t.total_volume_kg,t.steps??null,t.note??null,t.local_date_str,t.client_idempotency_key??null]),s=n[0];if(!s)throw new Error("workout insert returned n\
o row");let a=[];if(t.sets&&t.sets.length>0)for(let i of t.sets){let{rows:u}=await r.query(`insert into workout_sets (workout_id, set_index, reps, weight_kg, volume_kg, estimated_1rm_kg)
           values ($1,$2,$3,$4,$5,$6)
           returning id, set_index, reps,
               weight_kg::float8        as weight_kg,
               volume_kg::float8        as volume_kg,
               estimated_1rm_kg::float8 as estimated_1rm_kg`,[s.id,i.set_index,i.reps,i.weight_kg,i.volume_kg,i.estimated_1rm_kg??null]),l=u[0];if(!l)throw new Error("workout_sets insert returned no r\
ow");a.push(l)}return{...s,sets:a}})}o(be,"createWorkout");async function Hn(e,t){let r=d(),{rows:n}=await r.query(`select local_date_str as date,
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
reduce((a,i)=>a+Number(i.duration_mins),0),total_calories:s.reduce((a,i)=>a+i.calories,0),total_steps:s.reduce((a,i)=>a+i.steps,0),by_day:s}}o(Hn,"getWeeklySummary");async function Vn(e){let t=d(),{rows:r}=await t.
query(`select id, name, activity_type, met_value, is_strength, muscle_group, is_custom
     from exercises
     where ($1::text is null or lower(name) like '%' || lower($1) || '%')
       and (not is_custom or created_by is null)
     order by name
     limit 100`,[e??null]);return r}o(Vn,"listExercises");async function Wn(e){let t=d(),{rows:r}=await t.query(`select pr.id, pr.exercise_id, e.name as exercise_name, pr.record_type,
            pr.value, pr.source_workout_id, pr.achieved_at
     from personal_records pr
     join exercises e on e.id = pr.exercise_id
     where pr.user_id = $1
     order by e.name, pr.record_type`,[e]);return r}o(Wn,"getPersonalRecords");b();var co=70,_o={WALK:[2.8,3.5,5],RUN:[6,9.8,12.3],CYCLE:[4,8,12],SWIM:[4.8,7,10],STRENGTH:[3.5,5,6],YOGA:[2.5,3,4],HIIT:[6,8,10],SPORT:[4,6.5,9],OTHER:[3,4.5,6]},mo={LOW:0,MODERATE:1,VIGOROUS:2};function ke(e,t){
let r=_o[e];if(r)return r[mo[t??"MODERATE"]??1]}o(ke,"activityMet");async function Ie(e){let{rows:t}=await d().query("select current_body_mass_kg::float8 as kg from profiles where user_id = $1",[e]),r=t[0]?.
kg;return typeof r=="number"&&Number.isFinite(r)&&r>0?r:co}o(Ie,"resolveBodyMassKg");var G=f;async function Gn(e,t,r){try{let n=Number(e.query.limit??20),s=Number(e.query.offset??0),a=Number.isFinite(n)?Math.min(Math.max(1,Math.trunc(n)),100):20,i=Number.isFinite(s)?Math.max(0,Math.trunc(
s)):0,u=await qn(G(e),a,i);t.json({workouts:u})}catch(n){r(n)}}o(Gn,"listWorkoutsHandler");async function jn(e,t,r){try{let n=await Fn(e.params.id,G(e));if(!n)throw v();t.json(n)}catch(n){r(n)}}o(jn,"\
getWorkoutHandler");var po=new Set(["WALK","RUN","CYCLE","SWIM","STRENGTH","YOGA","HIIT","SPORT","OTHER"]),go=new Set(["LOW","MODERATE","VIGOROUS"]);async function Bn(e,t,r){try{let n=e.body;if(!n.activity_type||
!po.has(n.activity_type))throw T("activity_type is required and must be a valid type.",[{field:"activity_type",issue:"required_or_invalid"}]);let s=n.duration_mins;if(s!=null&&(typeof s!="number"||!Number.
isInteger(s)||s<1||s>1440))throw T("duration_mins must be an integer between 1 and 1440.",[{field:"duration_mins",issue:"out_of_range"}]);if(!n.local_date_str||!/^\d{4}-\d{2}-\d{2}$/.test(n.local_date_str))
throw T("local_date_str is required in YYYY-MM-DD format.",[{field:"local_date_str",issue:"required_or_invalid"}]);if(n.perceived_intensity!==void 0&&n.perceived_intensity!==null&&!go.has(n.perceived_intensity))
throw T("perceived_intensity must be LOW, MODERATE or VIGOROUS.",[{field:"perceived_intensity",issue:"invalid"}]);if(n.steps!==void 0&&n.steps!==null&&(typeof n.steps!="number"||!Number.isInteger(n.steps)||
n.steps<0||n.steps>2e5))throw T("steps must be a whole number between 0 and 200000.",[{field:"steps",issue:"out_of_range"}]);if(n.note!==void 0&&n.note!==null&&(typeof n.note!="string"||n.note.length>
500))throw T("note must be text of at most 500 characters.",[{field:"note",issue:"too_long"}]);let i=(Array.isArray(n.sets)?n.sets:[]).map((x,L)=>{let P=Number(x.reps??0),N=Number(x.weight_kg??0);return{
set_index:Number(x.set_index??L+1),reps:P,weight_kg:N,volume_kg:ye(P,N),estimated_1rm_kg:fe(N,P)?ge(N,P):void 0}}),u=we(i.map(x=>({reps:x.reps,weightKg:x.weight_kg}))),l=n.met_value_at_log;if(l!=null&&
(typeof l!="number"||!(l>=1&&l<=23)))throw T("met_value_at_log must be a number between 1 and 23.",[{field:"met_value_at_log",issue:"out_of_range"}]);let c=n.body_mass_at_log_kg;if(c!=null&&(typeof c!=
"number"||!(c>=20&&c<=635)))throw T("body_mass_at_log_kg must be a number between 20 and 635.",[{field:"body_mass_at_log_kg",issue:"out_of_range"}]);let _=typeof s=="number"&&s>0,p=l??(_?ke(n.activity_type,
n.perceived_intensity):void 0),y=c??(_&&p!==void 0?await Ie(G(e)):void 0),k=n.calories_burned;k===void 0&&p!==void 0&&y!==void 0&&_&&(k=pe(p,y,s));let I=await be(G(e),{exercise_id:n.exercise_id,activity_type:n.
activity_type,duration_mins:s??void 0,perceived_intensity:n.perceived_intensity,met_value_at_log:p,body_mass_at_log_kg:y,calories_burned:k,total_volume_kg:u,steps:n.steps,note:n.note,local_date_str:n.
local_date_str,client_idempotency_key:typeof n.client_idempotency_key=="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{12}$/i.test(n.client_idempotency_key)?n.client_idempotency_key:
void 0,sets:i.length>0?i:void 0});await q(G(e),"FITNESS",n.local_date_str),t.status(201).json(I)}catch(n){r(n)}}o(Bn,"logWorkout");async function Yn(e,t,r){try{let n=e.query.week;if(!n||!/^\d{4}-\d{2}-\d{2}$/.
test(n))throw T("week query parameter is required in YYYY-MM-DD format.",[{field:"week",issue:"required_or_invalid"}]);let s=await Hn(G(e),n);t.json(s)}catch(n){r(n)}}o(Yn,"getSummary");async function Kn(e,t,r){
try{let n=e.query.q,s=await Vn(n);t.json({exercises:s})}catch(n){r(n)}}o(Kn,"searchExercises");async function zn(e,t,r){try{let n=await Wn(G(e));t.json({personal_records:n})}catch(n){r(n)}}o(zn,"getPe\
rsonalRecordsHandler");var F=fo();F.use(E);F.get("/exercises",Kn);F.get("/personal-records",zn);F.get("/summary",Yn);F.get("/",Gn);F.post("/",Bn);F.get("/:id",jn);var Qn=F;import{Router as Ro}from"npm:express@4.21.2";import{z as O}from"npm:zod@3.24.1";b();var Jn=`id, name, brand,
       kcal_per_100g::float8    as kcal_per_100g,
       protein_per_100g::float8 as protein_per_100g,
       carbs_per_100g::float8   as carbs_per_100g,
       fat_per_100g::float8     as fat_per_100g,
       default_serving_unit,
       default_serving_grams::float8 as default_serving_grams,
       is_custom`;async function Zn(e,t){let r=d(),{rows:n}=await r.query(`select ${Jn}
     from foods
     where deleted_at is null
       and name ilike '%' || $1 || '%'
       and (is_custom = false or created_by = $2)
     order by (lower(name) = lower($1)) desc,
              (lower(name) like lower($1) || '%') desc,
              name asc
     limit 200`,[e,t]);return n}o(Zn,"searchFoods");var Qe=200,te=30;function Xn(e,t){return`created_by = ${e}::uuid and is_custom
            and (deleted_at is null
                 or deleted_at > now() - (${t}::int * interval '1 day'))`}o(Xn,"ceilingScopeSql");async function er(e,t){let r=d(),{rows:n}=await r.query(`insert into foods
       (name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        default_serving_unit, default_serving_grams, barcode, source, is_custom, created_by)
     select $1::text, $2::text, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
            $7::text, $8::numeric, $9::text, 'CUSTOM', true, $10::uuid
     where (select count(*) from foods
             where ${Xn("$10","$12")}) < $11::int
     returning ${Jn}`,[t.name,t.brand??null,t.kcal_per_100g,t.protein_per_100g,t.carbs_per_100g,t.fat_per_100g,t.default_serving_unit,t.default_serving_grams??null,t.barcode??null,e,Qe,te]),s=n[0];if(s)
return{status:"CREATED",food:s};let{rows:[a]}=await r.query(`select count(*)::int                                        as current,
            count(*) filter (where deleted_at is not null)::int  as deleted
     from foods
     where ${Xn("$1","$2")}`,[e,te]);return{status:"LIMIT_EXCEEDED",current:a?.current??Qe,ceiling:Qe,deleted:a?.deleted??0}}o(er,"createCustomFood");async function tr(e,t){let r=d(),{rowCount:n}=await r.
query(`update foods
        set deleted_at = now(), updated_at = now()
      where id = $1 and created_by = $2 and is_custom and deleted_at is null`,[e,t]);return(n??0)>0}o(tr,"softDeleteCustomFood");var yo=2e3;async function nr(e,t){let r=d(),{rows:n}=await r.query(`sel\
ect id, meal_type,
            total_kcal::float8      as total_kcal,
            total_protein_g::float8 as total_protein_g,
            total_carbs_g::float8   as total_carbs_g,
            total_fat_g::float8     as total_fat_g,
            note
     from meals
     where user_id = $1 and local_date_str = $2 and deleted_at is null
     order by logged_at_utc asc`,[e,t]),s=n.map(u=>({...u,items:[]}));if(s.length>0){let u=s.map(_=>_.id),{rows:l}=await r.query(`select mi.meal_id, mi.id, mi.food_id, mi.food_name_at_log,
              mi.quantity::float8  as quantity,
              mi.serving_unit,
              mi.grams::float8     as grams,
              mi.kcal::float8      as kcal,
              mi.protein_g::float8 as protein_g,
              mi.carbs_g::float8   as carbs_g,
              mi.fat_g::float8     as fat_g
       from meal_items mi
       where mi.meal_id = any ($1::uuid[])
       order by mi.created_at asc`,[u]),c=new Map;for(let{meal_id:_,...p}of l){let y=c.get(_);y?y.push(p):c.set(_,[p])}for(let _ of s)_.items=c.get(_.id)??[]}let{rows:[a]}=await r.query(`select coales\
ce(sum(amount_ml), 0)::text as water_ml_total,
            max(goal_ml_at_log)               as water_goal_ml
     from water_logs
     where user_id = $1 and local_date_str = $2`,[e,t]),i=s.reduce((u,l)=>(u.kcal+=l.total_kcal,u.protein_g+=l.total_protein_g,u.carbs_g+=l.total_carbs_g,u.fat_g+=l.total_fat_g,u),{kcal:0,protein_g:0,
carbs_g:0,fat_g:0});return{meals:s,water_ml_total:Number(a?.water_ml_total??0),water_goal_ml:a?.water_goal_ml??yo,totals:i}}o(nr,"getDailySummary");async function xe(e,t){return R(async r=>{let n=t.items.
reduce((c,_)=>c+_.kcal,0),s=t.items.reduce((c,_)=>c+_.protein_g,0),a=t.items.reduce((c,_)=>c+_.carbs_g,0),i=t.items.reduce((c,_)=>c+_.fat_g,0),{rows:u}=await r.query(`insert into meals
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
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,[l.id,c.food_id??null,c.food_name_at_log,c.quantity,c.serving_unit,c.grams,c.kcal,c.protein_g,c.carbs_g,c.fat_g]);return l})}o(xe,"logMeal");
async function De(e,t){let r=d(),{rows:n}=await r.query(`insert into water_logs (user_id, amount_ml, goal_ml_at_log, local_date_str, client_idempotency_key)
     values ($1, $2, $3, $4, $5)
     returning id, amount_ml`,[e,t.amount_ml,t.goal_ml_at_log??null,t.local_date_str,t.client_idempotency_key??null]),s=n[0];if(!s)throw new Error("water_logs insert returned no row");return s}o(De,"l\
ogWater");var rr=["BREAKFAST","LUNCH","DINNER","SNACK"],Xe=["GRAM","MILLILITRE","PIECE","CUP","TABLESPOON","SLICE","CUSTOM"];function wo(){return new Date().toISOString().slice(0,10)}o(wo,"todayUtcDateStr");function Je(e){
return typeof e=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e)}o(Je,"isValidDateStr");function ho(e,t){let r=O.string().uuid().safeParse(e);if(!r.success)throw new m("VALIDATION_FAILED",`${t} must be a UUID\
.`,{details:[{field:t,issue:"invalid"}]});return r.data}o(ho,"requireUuidParam");async function sr(e,t,r){try{let n=e.query.q;if(n!==void 0&&typeof n!="string")throw new m("VALIDATION_FAILED","Query p\
arameter q must be a string.");let s=f(e),a=await Zn((n??"").trim(),s);t.status(200).json({foods:a})}catch(n){r(n)}}o(sr,"searchFoodsHandler");var Eo=O.object({name:O.string().trim().min(1).max(120),brand:O.
string().trim().max(80).optional(),kcal_per_100g:O.number().min(0).max(9e3),protein_per_100g:O.number().min(0).max(100).default(0),carbs_per_100g:O.number().min(0).max(100).default(0),fat_per_100g:O.number().
min(0).max(100).default(0),default_serving_unit:O.enum(Xe).default("GRAM"),default_serving_grams:O.number().min(.1).max(5e3).optional(),barcode:O.string().regex(/^\d{8,14}$/,"must be 8 to 14 digits").
optional()}).strict();async function or(e,t,r){try{let n=f(e),s=Eo.safeParse(e.body);if(!s.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).
map(u=>({field:u.path.join(".")||"(root)",issue:u.message}))});let a=s.data,i=await er(n,{...a,brand:a.brand?a.brand:void 0});if(i.status==="LIMIT_EXCEEDED")throw new m("CONFLICT",`You have reached yo\
ur limit of ${i.ceiling} custom foods. Deleting one frees its slot ${te} days later, when its retention window closes.`,{details:[{field:"foods",issue:"limit_exceeded",current:i.current,ceiling:i.ceiling,
deleted:i.deleted,retention_days:te}]});t.status(201).json(i.food)}catch(n){r(n)}}o(or,"createCustomFoodHandler");async function ir(e,t,r){try{let n=f(e),s=ho(e.params.id,"id");if(!await tr(s,n))throw v();
t.json({status:"deleted"})}catch(n){r(n)}}o(ir,"deleteCustomFoodHandler");async function ar(e,t,r){try{let n=e.query.date??wo();if(!Je(n))throw new m("VALIDATION_FAILED","date must be YYYY-MM-DD.");let s=f(
e),a=await nr(s,n);t.status(200).json(a)}catch(n){r(n)}}o(ar,"getDailySummaryHandler");async function ur(e,t,r){try{let n=e.body,s=[];if((!n.meal_type||!rr.includes(n.meal_type))&&s.push({field:"meal_\
type",issue:`must be one of ${rr.join(", ")}`}),Je(n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),!Array.isArray(n.items)||n.items.length===0)s.push({field:"i\
tems",issue:"must be a non-empty array"});else for(let u=0;u<n.items.length;u++){let l=n.items[u];(!l.food_name_at_log||typeof l.food_name_at_log!="string")&&s.push({field:`items[${u}].food_name_at_lo\
g`,issue:"required"}),(typeof l.quantity!="number"||l.quantity<=0)&&s.push({field:`items[${u}].quantity`,issue:"must be a positive number"}),Xe.includes(l.serving_unit)||s.push({field:`items[${u}].ser\
ving_unit`,issue:`must be one of ${Xe.join(", ")}`}),(typeof l.grams!="number"||l.grams<=0)&&s.push({field:`items[${u}].grams`,issue:"must be a positive number"}),(typeof l.kcal!="number"||l.kcal<0)&&
s.push({field:`items[${u}].kcal`,issue:"must be a non-negative number"})}if(s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=f(e),i=await xe(a,{meal_type:n.
meal_type,note:typeof n.note=="string"?n.note:void 0,local_date_str:n.local_date_str,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:void 0,items:n.items.map(
u=>({food_id:typeof u.food_id=="string"?u.food_id:void 0,food_name_at_log:u.food_name_at_log,quantity:u.quantity,serving_unit:u.serving_unit,grams:u.grams,kcal:u.kcal,protein_g:typeof u.protein_g=="nu\
mber"?u.protein_g:0,carbs_g:typeof u.carbs_g=="number"?u.carbs_g:0,fat_g:typeof u.fat_g=="number"?u.fat_g:0}))});await q(a,"NUTRITION",n.local_date_str),t.status(201).json(i)}catch(n){r(n)}}o(ur,"logM\
ealHandler");async function lr(e,t,r){try{let n=e.body,s=[];if((typeof n.amount_ml!="number"||n.amount_ml<1||n.amount_ml>5e3)&&s.push({field:"amount_ml",issue:"must be a number between 1 and 5000"}),Je(
n.local_date_str)||s.push({field:"local_date_str",issue:"required, must be YYYY-MM-DD"}),s.length)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s});let a=f(e),i=await De(a,
{amount_ml:n.amount_ml,local_date_str:n.local_date_str,goal_ml_at_log:typeof n.goal_ml_at_log=="number"?n.goal_ml_at_log:void 0,client_idempotency_key:typeof n.client_idempotency_key=="string"?n.client_idempotency_key:
void 0});await he(a),t.status(201).json(i)}catch(n){r(n)}}o(lr,"logWaterHandler");var H=Ro();H.use(E);H.get("/foods/search",sr);H.post("/foods",or);H.delete("/foods/:id",ir);H.get("/summary",ar);H.post("/meals",ur);H.post("/water",lr);var cr=H;import{Router as bo}from"npm:express@4.21.2";b();var Ao=1e4,dr=2e3;async function _r(e,t){let r=d(),[n,s,a,i,u]=await Promise.all([r.query(`select current_length, longest_length
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
         where user_id = $1 and local_date_str = $2 and deleted_at is null`,[e,t])]),l=n.rows[0],c=Number(i.rows[0]?.steps??0),_=Number(u.rows[0]?.calories??0),p=[...s.rows.map(y=>({type:"PLANT_WATER",
id:y.id,title:y.nickname}))];return _<dr&&p.push({type:"LOG_MEAL",id:"log_meal",title:"Log a meal"}),{streak:{current:l?.current_length??0,longest:l?.longest_length??0},plants:{due_today:s.rows.length,
overdue:Number(a.rows[0]?.count??0)},fitness:{steps:c,goal:Ao},nutrition:{calories_consumed:_,target:dr},today_list:p}}o(_r,"getDashboard");function To(){return new Date().toISOString().slice(0,10)}o(To,"todayUtcDateStr");async function mr(e,t,r){try{let n=typeof e.query.date=="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.query.date)?e.query.date:
To(),s=f(e),a=await _r(s,n);t.status(200).json(a)}catch(n){r(n)}}o(mr,"getDashboardHandler");var Ze=bo();Ze.use(E);Ze.get("/",mr);var pr=Ze;import{Router as ko}from"npm:express@4.21.2";b();async function gr(e){let t=d(),{rows:r}=await t.query(`select a.id as a_id, a.code, a.name, a.description, a.module, a.icon,
            a.tier, a.points, a.is_active,
            ua.id as ua_id, ua.unlocked_at, ua.progress_pct, ua.seen_at
     from achievements a
     left join user_achievements ua
       on ua.achievement_id = a.id and ua.user_id = $1
     where a.is_active
     order by a.module, a.points, a.name`,[e]);return r.map(n=>({id:n.ua_id??n.a_id,achievement_id:n.a_id,unlocked_at:n.unlocked_at,progress_pct:n.ua_id?n.progress_pct??0:0,seen_at:n.seen_at,achievement:{
id:n.a_id,code:n.code,name:n.name,description:n.description,module:n.module,icon:n.icon,tier:n.tier,points:n.points,is_active:n.is_active}}))}o(gr,"listForUser");async function fr(e){let t=d(),{rows:r}=await t.
query(`select streak_type, current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1
     order by streak_type`,[e]);return r}o(fr,"listStreaks");async function yr(e){return(await d().query(`update user_achievements
     set seen_at = now()
     where user_id = $1 and unlocked_at is not null and seen_at is null`,[e])).rowCount??0}o(yr,"markSeen");async function wr(e,t,r){try{let n=f(e),s=await gr(n);t.status(200).json(s)}catch(n){r(n)}}o(wr,"listAchievementsHandler");async function hr(e,t,r){try{let n=f(e),s=await fr(n);t.status(200).json({streaks:s})}catch(n){
r(n)}}o(hr,"listStreaksHandler");async function Er(e,t,r){try{let n=f(e),s=await yr(n);t.status(200).json({marked_seen:s})}catch(n){r(n)}}o(Er,"markSeenHandler");var ne=ko();ne.use(E);ne.get("/",wr);ne.get("/streaks",hr);ne.post("/seen",Er);var Rr=ne;import{Router as Io}from"npm:express@4.21.2";var Ne=Io();Ne.use(E);Ne.get("/",async(e,t,r)=>{try{let n=await _n(f(e));t.status(200).json({reminders:n})}catch(n){r(n)}});Ne.post("/:id/dismiss",async(e,t,r)=>{try{let n=e.params.id;if(!n||!/^[0-9a-f-]{36}$/i.
test(n))throw new m("VALIDATION_FAILED","Reminder id must be a UUID.");if(!await mn(f(e),n))throw new m("NOT_FOUND","Reminder not found or already resolved.");t.status(200).json({status:"dismissed"})}catch(n){
r(n)}});var Ar=Ne;import{Router as Do}from"npm:express@4.21.2";import{z as j}from"npm:zod@3.24.1";b();var xo=5;async function br(e,t){try{return await Tr(e,t)}catch(r){if(typeof r=="object"&&r!==null&&r.code==="23505")return Tr(e,t);throw r}}o(br,"registerToken");async function Tr(e,t){return R(async r=>{
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
       )`,[e,xo]);let{rows:i}=await r.query(`select id, platform, device_label, app_version, permission_status, last_confirmed_at
       from device_push_tokens
       where user_id = $1 and status = 'ACTIVE'
       order by last_confirmed_at desc nulls last`,[e]);return{id:a,devices:i}})}o(Tr,"registerTokenOnce");async function kr(e){if(e.length===0)return new Map;let t=d(),{rows:r}=await t.query(`select \
user_id, token
     from device_push_tokens
     where user_id = any ($1::uuid[])
       and status = 'ACTIVE'
       and permission_status = 'GRANTED'`,[e]),n=new Map;for(let s of r){let a=n.get(s.user_id);a?a.push(s.token):n.set(s.user_id,[s.token])}return n}o(kr,"activeTokensForUsers");async function Ir(e,t){
if(e.length===0)return;await d().query(`update device_push_tokens
     set status = case when $2 = 'DEVICE_NOT_REGISTERED' then 'UNREGISTERED' else 'STALE' end,
         revoked_at = now(), revoke_reason = $2, updated_at = now()
     where token = any ($1::text[]) and status = 'ACTIVE'`,[e,t])}o(Ir,"revokeTokens");var No=j.object({expo_push_token:j.string().min(20).max(200).regex(/^Expo(nent)?PushToken\[.+\]$/),platform:j.enum(["IOS","ANDROID"]),client_installation_id:j.string().uuid(),device_label:j.string().max(
64).optional(),app_version:j.string().max(20).optional(),permission_status:j.enum(["GRANTED","DENIED","UNDETERMINED"])}).strict(),et=Do();et.use(E);et.post("/",async(e,t,r)=>{try{let n=No.safeParse(e.
body);if(!n.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:n.error.issues.slice(0,10).map(i=>({field:i.path.join("."),issue:i.message}))});let{id:s,devices:a}=await br(
f(e),{...n.data,device_label:n.data.device_label?.trim()||void 0});t.status(200).json({id:s,devices:a})}catch(n){r(n)}});var xr=et;import{Router as Wo}from"npm:express@4.21.2";import{z as g}from"npm:zod@3.24.1";b();async function Dr(e,t,r,n){let s=d(),{rows:a}=await s.query(`insert into sync_events (user_id, client_idempotency_key, entity_type, payload)
     values ($1, $2, $3, $4)
     on conflict (user_id, client_idempotency_key) do nothing
     returning id, client_idempotency_key, entity_type, status, result_entity_id, error_code`,[e,t,r,JSON.stringify(n)]),i=a[0];if(i)return{row:i,replay:!1};let{rows:u}=await s.query(`select id, clien\
t_idempotency_key, entity_type, status, result_entity_id, error_code
     from sync_events
     where user_id = $1 and client_idempotency_key = $2`,[e,t]),l=u[0];if(!l)throw new Error("sync_events upsert returned neither insert nor existing row");return{row:l,replay:!0}}o(Dr,"recordEvent");
async function tt(e,t){await d().query(`update sync_events
     set status = 'PROCESSED', result_entity_id = $2, processed_at = now()
     where id = $1`,[e,t])}o(tt,"markProcessed");async function Nr(e,t,r){await d().query(`update sync_events
     set status = 'FAILED', error_code = $2, error_detail = $3, processed_at = now()
     where id = $1`,[e,t.slice(0,60),r.slice(0,500)])}o(Nr,"markFailed");async function nt(e,t,r){let n=d(),{rows:s}=await n.query(`select id from ${e} where user_id = $1 and client_idempotency_key = \
$2`,[t,r]);return s[0]?.id??null}o(nt,"findEntityIdByKey");var vo=50,ve=g.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(e=>{let t=Date.parse(e);return t>Date.now()-366*864e5&&t<Date.now()+2*864e5},"local_date_str outside the accepted window"),So=g.object({plant_id:g.
string().uuid(),action_type:g.enum(["WATER","FERTILIZE","PRUNE","REPOT","MIST","ROTATE","TREAT"]),note:g.string().max(500).optional(),local_date_str:ve}).strict(),Oo=g.object({set_index:g.number().int().
min(1).max(200).optional(),reps:g.number().int().min(0).max(1e3),weight_kg:g.number().min(0).max(1e3)}).strict(),Co=g.object({activity_type:g.string().min(1).max(40),duration_mins:g.number().int().min(
1).max(1440).optional(),perceived_intensity:g.enum(["LOW","MODERATE","VIGOROUS"]).optional(),met_value_at_log:g.number().min(1).max(23).optional(),body_mass_at_log_kg:g.number().min(20).max(400).optional(),
steps:g.number().int().min(0).max(2e5).optional(),note:g.string().max(500).optional(),local_date_str:ve,sets:g.array(Oo).max(200).optional()}).strict(),Lo=g.object({food_id:g.string().uuid().optional(),
food_name_at_log:g.string().min(1).max(200),quantity:g.number().positive().max(1e5),serving_unit:g.string().min(1).max(20),grams:g.number().positive().max(1e5),kcal:g.number().min(0).max(1e5),protein_g:g.
number().min(0).max(1e4),carbs_g:g.number().min(0).max(1e4),fat_g:g.number().min(0).max(1e4)}).strict(),$o=g.object({meal_type:g.enum(["BREAKFAST","LUNCH","DINNER","SNACK"]),note:g.string().max(500).optional(),
local_date_str:ve,items:g.array(Lo).min(1).max(50)}).strict(),Po=g.object({amount_ml:g.number().int().min(1).max(5e3),goal_ml_at_log:g.number().int().min(1).max(2e4).optional(),local_date_str:ve}).strict(),
Uo=g.object({client_idempotency_key:g.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),entity_type:g.enum(["PLANT_CARE_EVENT","WORKOUT","MEAL","WATER_LOG"]),payload:g.
unknown()}).strict(),Mo=g.object({events:g.array(Uo).min(1).max(vo)}).strict();function qo(e){return typeof e=="object"&&e!==null&&e.code==="23505"}o(qo,"isUniqueViolation");var Fo={PLANT_CARE_EVENT:"\
plant_care_events",WORKOUT:"workouts",MEAL:"meals",WATER_LOG:"water_logs"},Ho={PLANT_CARE_EVENT:"PLANT_CARE",WORKOUT:"FITNESS",MEAL:"NUTRITION",WATER_LOG:null};async function Vo(e,t,r,n){switch(r){case"\
PLANT_CARE_EVENT":{let s=So.parse(n);return await Ae(e,s.plant_id,s.action_type,s.note,s.local_date_str,t),nt("plant_care_events",e,t)}case"WORKOUT":{let s=Co.parse(n),a=(s.sets??[]).map((p,y)=>{let k=ye(
p.reps,p.weight_kg),I=fe(p.weight_kg,p.reps);return{set_index:p.set_index??y+1,reps:p.reps,weight_kg:p.weight_kg,volume_kg:k,...I?{estimated_1rm_kg:ge(p.weight_kg,p.reps)}:{}}}),i=we(a.map(p=>({reps:p.
reps,weightKg:p.weight_kg}))),u=s.met_value_at_log??(s.duration_mins!==void 0?ke(s.activity_type,s.perceived_intensity):void 0),l=s.body_mass_at_log_kg??(s.duration_mins!==void 0&&u!==void 0?await Ie(
e):void 0),c;return u!==void 0&&l!==void 0&&s.duration_mins!==void 0&&(c=pe(u,l,s.duration_mins)),(await be(e,{activity_type:s.activity_type,duration_mins:s.duration_mins,perceived_intensity:s.perceived_intensity,
met_value_at_log:u,body_mass_at_log_kg:l,calories_burned:c,total_volume_kg:i,steps:s.steps,note:s.note,local_date_str:s.local_date_str,client_idempotency_key:t,sets:a.length>0?a:void 0})).id}case"MEAL":{
let s=$o.parse(n);return(await xe(e,{...s,client_idempotency_key:t})).id}case"WATER_LOG":{let s=Po.parse(n);return(await De(e,{...s,client_idempotency_key:t})).id}}}o(Vo,"applyEvent");async function vr(e,t,r){
try{let n=f(e),s=Mo.safeParse(e.body);if(!s.success)throw new m("VALIDATION_FAILED","The request failed validation.",{details:s.error.issues.slice(0,20).map(i=>({field:i.path.join("."),issue:i.message}))});
let a=[];for(let i of s.data.events){let u=i.client_idempotency_key.toLowerCase(),{row:l,replay:c}=await Dr(n,u,i.entity_type,i.payload);if(c&&l.status!=="PENDING"){a.push({client_idempotency_key:u,status:l.
status==="FAILED"?"FAILED":"PROCESSED",replay:!0,entity_id:l.result_entity_id,error_code:l.error_code});continue}try{let _=await Vo(n,u,i.entity_type,i.payload);await tt(l.id,_);let p=Ho[i.entity_type],
y=i.payload.local_date_str;p&&y?await q(n,p,y):i.entity_type==="WATER_LOG"&&await he(n),a.push({client_idempotency_key:u,status:"PROCESSED",replay:!1,entity_id:_,error_code:null})}catch(_){if(qo(_)){let x=await nt(
Fo[i.entity_type],n,u);if(x){await tt(l.id,x),a.push({client_idempotency_key:u,status:"PROCESSED",replay:!0,entity_id:x,error_code:null});continue}}let p=_ instanceof g.ZodError,y=typeof _=="object"&&
_!==null&&"__notFound"in _,k=p?"VALIDATION_FAILED":y?"PARENT_NOT_FOUND":"INTERNAL_ERROR",I=_ instanceof Error?_.message:String(_);await Nr(l.id,k,I),h.warn({key:u,entity_type:i.entity_type,code:k},"sy\
nc event failed"),a.push({client_idempotency_key:u,status:"FAILED",replay:!1,entity_id:null,error_code:k})}}t.status(200).json({results:a})}catch(n){r(n)}}o(vr,"drainOutboxHandler");var rt=Wo();rt.use(E);rt.post("/outbox",vr);var Sr=rt;import{Router as Qo}from"npm:express@4.21.2";import{z as jo}from"npm:zod@3.24.1";b();var Cr=`timezone, hemisphere, locale, unit_system, theme, week_start_day,
  plant_care_enabled, fitness_enabled, nutrition_enabled, quiet_hours_mode,
  quiet_start_time, quiet_end_time,
  daily_notification_cap, reduce_motion, larger_text, high_contrast, analytics_opt_in`;function Or(e){return e===null?null:/^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(e)?.[1]??e}o(Or,"normaliseTimeOfD\
ay");function Lr(e){return{...e,quiet_start_time:Or(e.quiet_start_time),quiet_end_time:Or(e.quiet_end_time)}}o(Lr,"normaliseSettingsRow");async function Se(e){let t=d();await t.query("insert into user\
_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let{rows:r}=await t.query(`select ${Cr} from user_settings where user_id = $1`,[e]);return Lr(r[0])}o(Se,"getSettings");var Go=new Set(
["timezone","hemisphere","locale","unit_system","theme","week_start_day","plant_care_enabled","fitness_enabled","nutrition_enabled","quiet_hours_mode","quiet_start_time","quiet_end_time","daily_notifi\
cation_cap","reduce_motion","larger_text","high_contrast","analytics_opt_in"]);async function $r(e,t){let r=Object.entries(t).filter(([u,l])=>l!==void 0&&Go.has(u));if(r.length===0)return Se(e);let n=d();
await n.query("insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing",[e]);let s=r.map(([u],l)=>`${u}=$${l+2}`).join(", "),a=r.map(([,u])=>u),{rows:i}=await n.query(`update \
user_settings set ${s}, updated_at=now()
     where user_id=$1
     returning ${Cr}`,[e,...a]);return Lr(i[0])}o($r,"updateSettings");var Bo={hemisphere:["NORTHERN","SOUTHERN","EQUATORIAL"],unit_system:["METRIC","IMPERIAL"],theme:["LIGHT","DARK","SYSTEM"],week_start_day:["SUNDAY","MONDAY"],quiet_hours_mode:["OFF","WINDOW","SCHEDULED\
_ONLY"]},Yo=["plant_care_enabled","fitness_enabled","nutrition_enabled","reduce_motion","larger_text","high_contrast","analytics_opt_in"],Ko=jo.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),Pr=[
"quiet_start_time","quiet_end_time"],zo=["quiet_hours_mode",...Pr];async function Ur(e,t,r){try{t.json(await Se(f(e)))}catch(n){r(n)}}o(Ur,"getSettingsHandler");async function Mr(e,t,r){try{let n=e.body??
{},s=[],a={};for(let[c,_]of Object.entries(Bo)){let p=n[c];p!==void 0&&(typeof p!="string"||!_.includes(p)?s.push({field:c,issue:`must_be_one_of:${_.join(",")}`}):a[c]=p)}for(let c of Yo){let _=n[c];_!==
void 0&&(typeof _!="boolean"?s.push({field:c,issue:"must_be_boolean"}):a[c]=_)}for(let c of Pr){let _=n[c];if(_===void 0)continue;let p=Ko.safeParse(_);p.success?a[c]=p.data:s.push({field:c,issue:"mus\
t_be_hh_mm_24h_or_null"})}if(n.timezone!==void 0&&(typeof n.timezone!="string"||n.timezone.length>64?s.push({field:"timezone",issue:"must_be_string_max_64"}):a.timezone=n.timezone),n.locale!==void 0&&
(typeof n.locale!="string"||n.locale.length>20?s.push({field:"locale",issue:"must_be_string_max_20"}):a.locale=n.locale),n.daily_notification_cap!==void 0){let c=n.daily_notification_cap;typeof c!="nu\
mber"||!Number.isInteger(c)||c<1||c>20?s.push({field:"daily_notification_cap",issue:"must_be_integer_1_to_20"}):a.daily_notification_cap=c}if(s.length>0)throw new m("VALIDATION_FAILED","The request fa\
iled validation.",{details:s});let i=f(e),l={...await Se(i),...a};if(!l.plant_care_enabled&&!l.fitness_enabled&&!l.nutrition_enabled)throw new m("VALIDATION_FAILED","At least one module must stay enab\
led.",{details:[{field:"modules",issue:"at_least_one_module_required"}]});if(zo.some(c=>c in a)&&l.quiet_hours_mode==="WINDOW"){if(l.quiet_start_time===null||l.quiet_end_time===null)throw new m("VALID\
ATION_FAILED","Quiet hours need both a start and an end time.",{details:[{field:"quiet_hours_mode",issue:"window_requires_start_and_end"}]});if(l.quiet_start_time===l.quiet_end_time)throw new m("VALID\
ATION_FAILED","Quiet hours need a different start and end time.",{details:[{field:"quiet_end_time",issue:"window_start_equals_end"}]})}t.json(await $r(i,a))}catch(n){r(n)}}o(Mr,"updateSettingsHandler");var Oe=Qo();Oe.use(E);Oe.get("/",Ur);Oe.put("/",Mr);var qr=Oe;import{Router as ti}from"npm:express@4.21.2";import{z as st}from"npm:zod@3.24.1";b();var Xo=30,Fr="PENDING_DELETION",re="status, deletion_requested_at, purge_after";async function Hr(e){let t=d(),{rows:r}=await t.query(`select ${re} from users where id = $1`,[e]);return r[0]??null}o(Hr,
"getAccountState");async function Vr(e,t){return R(async r=>{let{rows:[n]}=await r.query(`select ${re} from users where id = $1 for update`,[e]);if(!n)return{kind:"missing"};if(n.status===Fr)return{kind:"\
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
       returning ${re}`,[e,Xo]);return await r.query(`update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'DELETION_REQUESTED'
       where user_id = $1
         and status = 'ACTIVE'
         and ($2::uuid is null or id <> $2::uuid)`,[e,t]),await r.query(`update auth_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1
         and consumed_at is null
         and ($2::uuid is null or session_id <> $2::uuid)`,[e,t]),{kind:"scheduled",state:s}})}o(Vr,"requestDeletion");async function Wr(e){return R(async t=>{let{rows:[r]}=await t.query(`select ${re}\
 from users where id = $1 for update`,[e]);if(!r)return{kind:"missing"};if(r.status!==Fr)return{kind:"not_pending",state:r};let{rows:[n]}=await t.query(`update users
       set status = case when email_verified_at is null and $2 then 'PENDING_VERIFICATION' else 'ACTIVE' end,
           deletion_requested_at = null,
           purge_after = null,
           updated_at = now()
       where id = $1 and status = 'PENDING_DELETION'
       returning ${re}`,[e,S().REQUIRE_EMAIL_VERIFICATION]);return{kind:"cancelled",state:n}})}o(Wr,"cancelDeletion");var Jo=st.object({password:st.string().min(1,"Your password is required to confirm deletion.")}).strict();function Zo(e){return new m("VALIDATION_FAILED","The request failed validation.",{details:e.issues.
slice(0,10).map(t=>({field:t.path.join(".")||"(root)",issue:t.message}))})}o(Zo,"validationError");function ei(e){let t=e.sessionId,r=st.string().uuid().safeParse(t);return r.success?r.data:null}o(ei,
"callerSessionId");function ot(e){let t=e.purge_after?.toISOString()??null;return{status:e.status,deletion_requested_at:e.deletion_requested_at?.toISOString()??null,purge_after:t,deletion_scheduled_at:t}}
o(ot,"toBody");function Ce(){return new m("AUTHENTICATION_REQUIRED","Authentication is required.")}o(Ce,"accountGone");async function Gr(e,t,r){try{let n=await Hr(f(e));if(!n)throw Ce();t.status(200).
json(ot(n))}catch(n){r(n)}}o(Gr,"getAccountHandler");async function jr(e,t,r){try{let n=Jo.safeParse(e.body??{});if(!n.success)throw Zo(n.error);let s=f(e),a=await It(s);if(!a)throw Ce();if(a.password_hash===
null)throw new m("VALIDATION_FAILED","The request failed validation.",{details:[{field:"password",issue:"password_required_but_account_has_none"}]});if(!await de(n.data.password,a.password_hash))throw new m(
"INVALID_CREDENTIALS","That password is not right.");let i=await Vr(s,ei(e));if(i.kind==="missing")throw Ce();t.status(200).json({...ot(i.state),already_pending:i.kind==="already_pending"})}catch(n){r(
n)}}o(jr,"requestDeletionHandler");async function Br(e,t,r){try{let n=await Wr(f(e));if(n.kind==="missing")throw Ce();if(n.kind==="not_pending")throw new m("CONFLICT","This account is not scheduled fo\
r deletion.");t.status(200).json(ot(n.state))}catch(n){r(n)}}o(Br,"cancelDeletionHandler");var se=ti();se.use(E);se.get("/",Gr);se.post("/deletion",jr);se.delete("/deletion",Br);var Yr=se;b();import{ZodError as oi}from"npm:zod@3.24.1";import{randomUUID as ni}from"node:crypto";var Kr="x-request-id",ri=64,si=/^[A-Za-z0-9._-]+$/,zr=o((e,t,r)=>{let n=e.header(Kr),a=(n&&n.length<=ri&&si.test(n)?n:void 0)??ni();e.requestId=a,t.setHeader(Kr,a),r()},"requestId");function Qr(e){return e.
requestId??"unknown"}o(Qr,"getRequestId");var ii=50;function ai(e){return e.errors.slice(0,ii).map(t=>({field:t.path.join(".")||"(root)",issue:t.code,message:t.message}))}o(ai,"detailsFromZod");var Jr=o((e,t,r)=>{r(new m("NOT_FOUND",`No route\
 matches ${e.method} ${e.path}`))},"notFoundHandler"),Xr={"22P02":{code:"VALIDATION_FAILED",issue:"invalid_format"},22001:{code:"VALIDATION_FAILED",issue:"too_long"},22003:{code:"VALIDATION_FAILED",issue:"\
out_of_range"},22007:{code:"VALIDATION_FAILED",issue:"invalid_format"},22008:{code:"VALIDATION_FAILED",issue:"out_of_range"},23502:{code:"VALIDATION_FAILED",issue:"required"},23503:{code:"VALIDATION_F\
AILED",issue:"unknown_reference"},23514:{code:"VALIDATION_FAILED",issue:"invalid"},23505:{code:"CONFLICT",issue:"duplicate"}};function ui(e){if(!(e instanceof Error))return!1;let t=e;return typeof t.code==
"string"&&/^[0-9A-Z]{5}$/.test(t.code)&&typeof t.severity=="string"}o(ui,"isPgError");function li(e){if(e.column)return e.column;if(e.constraint){let t=e.constraint;if(e.table&&t.startsWith(`${e.table}\
_`)&&(t=t.slice(e.table.length+1)),t=t.replace(/_(check|fkey|key|not_null)$/,""),/^[a-z_]+$/.test(t))return t}return"(request)"}o(li,"fieldFromPgError");function ci(e){if(!(e instanceof Error))return!1;
let t=e;return t.__appError===!0&&typeof t.code=="string"&&t.code in ae}o(ci,"isMarkedAppError");var Zr=o((e,t,r,n)=>{let s=Qr(t),a=new Date().toISOString(),i;if(e instanceof m)i=e;else if(e instanceof
oi)i=new m("VALIDATION_FAILED","The request failed validation.",{details:ai(e)});else if(e instanceof SyntaxError&&"body"in e)i=new m("MALFORMED_REQUEST","The request body is not valid JSON.");else if(ui(
e)&&Xr[e.code]){let c=Xr[e.code],_=li(e);i=new m(c.code,c.code==="CONFLICT"?"That already exists.":_==="(request)"?"The request contains a value in the wrong format.":`The value for ${_} is not allowe\
d.`,{details:[{field:_,issue:c.issue}],context:{sqlstate:e.code,constraint:e.constraint??null}})}else ci(e)?i=new m(e.code,e.message):i=new m("INTERNAL_ERROR","An unexpected error occurred.",{cause:e});
let u={requestId:s,code:i.code,status:i.status,method:t.method,path:t.path,context:i.context,err:i.status>=500?e:void 0};i.status>=500?h.error(u,i.message):h.warn(u,i.message);let l={error:{code:i.code,
message:i.message,message_key:i.messageKey,...i.details?{details:i.details}:{},request_id:s,timestamp:a}};r.status(i.status).json(l)},"errorHandler");function ts(e){let t=es();t.set("trust proxy",1),t.disable("x-powered-by");let r=e.basePath?.replace(/\/+$/,"");r&&t.use((s,a,i)=>{s.url===r?(s.url="/",s.originalUrl="/"):s.url.startsWith(`${r}/`)&&(s.
url=s.url.slice(r.length),s.originalUrl=s.url),i()}),t.use(zr),t.use(mi()),t.use(di({origin:e.corsOrigins,credentials:!0,exposedHeaders:["x-request-id"]})),t.use(es.json({limit:e.bodyLimit??"1mb"})),t.
use(_i()),t.use("/api/auth",Yt),t.use("/api/v1/plants",Un),t.use("/api/v1/fitness",Qn),t.use("/api/v1/nutrition",cr),t.use("/api/v1/dashboard",pr),t.use("/api/v1/achievements",Rr),t.use("/api/v1/remin\
ders",Ar),t.use("/api/v1/devices",xr),t.use("/api/v1/sync",Sr),t.use("/api/v1/settings",qr),t.use("/api/v1/account",Yr),t.get("/healthz",(s,a)=>{a.json({status:"ok",uptime_s:Math.round(process.uptime())})});
let n;return t.get("/readyz",async(s,a)=>{let i=Date.now();if(!n||i-n.at>3e4){let u=!1;try{await d().query("select 1"),u=!0}catch{u=!1}n={ok:u,at:i}}a.set("cache-control","no-store"),a.status(n.ok?200:
503).json({status:n.ok?"ready":"unavailable",database:n.ok?"up":"down"})}),t.get("/api/v1",(s,a)=>{a.json({name:"PlantPal+ API",version:"v1"})}),t.use(Jr),t.use(Zr),t}o(ts,"createApp");b();import Nd from"npm:node-cron@4.6.0";b();import{createHmac as pi}from"node:crypto";var it=100,ns=Object.freeze([{table:"profiles",column:"user_id"},{table:"user_settings",column:"user_id"},{table:"auth_sessions",column:"user_id"},{table:"auth_tokens",column:"user_id"},{table:"email_\
verification_tokens",column:"user_id"},{table:"password_reset_tokens",column:"user_id"},{table:"consent_records",column:"user_id"},{table:"device_push_tokens",column:"user_id"},{table:"plants",column:"\
user_id"},{table:"plant_care_events",column:"user_id"},{table:"growth_log_entries",column:"user_id"},{table:"workouts",column:"user_id"},{table:"personal_records",column:"user_id"},{table:"meals",column:"\
user_id"},{table:"water_logs",column:"user_id"},{table:"foods",column:"created_by"},{table:"reminders",column:"user_id"},{table:"streaks",column:"user_id"},{table:"user_achievements",column:"user_id"},
{table:"sync_events",column:"user_id"}]);async function rs(e=it){let{rows:t}=await d().query(`select id, email_normalised
       from users
      where status = 'PENDING_DELETION'
        and purge_after is not null
        and purge_after <= now()
      order by purge_after asc
      limit $1`,[e]);return t}o(rs,"findAccountsDueForPurge");function gi(e,t){return pi("sha256",t).update(e).digest("hex")}o(gi,"subjectHash");async function ss(e,t){return R(async r=>{let{rows:[n]}=await r.
query(`select id
         from users
        where id = $1
          and status = 'PENDING_DELETION'
          and purge_after is not null
          and purge_after <= now()
        for update`,[e.id]);if(!n)return{erased:!1,counts:{}};let s=ns.map(({table:_,column:p},y)=>`(select count(*)::int from ${_} where ${p} = $1) as "t${y}"`).join(", "),{rows:[a]}=await r.query(`s\
elect ${s}`,[e.id]),i={};ns.forEach(({table:_},p)=>{i[_]=a?.[`t${p}`]??0});let u=gi(e.id,t),{rowCount:l}=await r.query(`update audit_events
          set user_id = null,
              payload = (payload - 'email' - 'email_normalised')
                        || jsonb_build_object('subject', $2::text)
        where user_id = $1`,[e.id,u]);i.audit_events_anonymised=l??0;let{rowCount:c}=await r.query("delete from login_attempts where email_normalised = $1",[e.email_normalised]);return i.login_attempts=
c??0,await r.query("delete from users where id = $1",[e.id]),i.users=1,await r.query(`insert into audit_events (user_id, event_type, payload)
       values (null, 'ACCOUNT_ERASED', $1::jsonb)`,[JSON.stringify({subject:u,rows:i,erased_at:new Date().toISOString()})]),{erased:!0,counts:i}})}o(ss,"purgeAccount");function fi(){let e=S();return e.AUDIT_PEPPER??e.JWT_ACCESS_SECRET}o(fi,"pepper");async function os(e=it){let t=await rs(e),r={due:t.length,erased:0,skipped:0,failed:0,counts:{}};if(t.length===0)return r;
let n=fi();for(let s of t)try{let a=await ss(s,n);if(!a.erased){r.skipped++;continue}r.erased++;for(let[i,u]of Object.entries(a.counts))r.counts[i]=(r.counts[i]??0)+u}catch(a){r.failed++,h.error({err:a},
"account erasure failed; will retry on the next sweep")}return h.info(r,"account erasure sweep complete"),r}o(os,"runPurgePass");import Hd from"npm:node-cron@4.6.0";var yi="https://exp.host/--/api/v2/push/send",wi=100;function hi(e,t=wi){let r=[];for(let n=0;n<e.length;n+=t)r.push(e.slice(n,n+t));return r}o(hi,"chunkMessages");async function is(e){let t={delivered:[],
notRegistered:[],failed:[]};for(let r of hi(e))try{let n=await fetch(yi,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(r)});if(!n.ok){t.failed.
push(...r.map(i=>i.to)),h.warn({status:n.status},"expo push batch rejected");continue}let a=(await n.json()).data??[];r.forEach((i,u)=>{let l=a[u];l?.status==="ok"?t.delivered.push(i.to):l?.details?.error===
"DeviceNotRegistered"?t.notRegistered.push(i.to):t.failed.push(i.to)})}catch(n){t.failed.push(...r.map(s=>s.to)),h.warn({err:n},"expo push batch failed")}return t}o(is,"sendPushMessages");function cs(e,t,r=24){let n=r*36e5;return t.filter(s=>s.next_water_due_at.getTime()-e.getTime()<=n).map(s=>({user_id:s.user_id,reminder_type:"WATER_PLANT",target_entity_id:s.plant_id,target_entity_type:"\
PLANT",title:`Water ${s.nickname}`,body:s.next_water_due_at.getTime()<=e.getTime()?`${s.nickname} is due for watering.`:`${s.nickname} needs water soon.`,due_at_utc:s.next_water_due_at.getTime()<e.getTime()?
e:s.next_water_due_at}))}o(cs,"planWateringReminders");var Ei=5,ds={timezone:"UTC",quiet_hours_mode:"WINDOW",quiet_start_time:null,quiet_end_time:null,daily_notification_cap:12},as={hourCycle:"h23",year:"\
numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"},us=new Map;function Ri(e){let t=us.get(e);if(t)return t;let r;try{r=new Intl.DateTimeFormat("en-US",{...as,timeZone:e})}catch{r=
new Intl.DateTimeFormat("en-US",{...as,timeZone:"UTC"})}return us.set(e,r),r}o(Ri,"formatterFor");function at(e,t){let r=Ri(t).formatToParts(e),n=o(a=>r.find(i=>i.type===a)?.value??"00","part"),s=Number(
n("hour"))%24;return{dateKey:`${n("year")}-${n("month")}-${n("day")}`,minutes:s*60+Number(n("minute"))}}o(at,"localClock");var Ai=1440;function ls(e){if(e===null)return null;let t=/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.
exec(e.trim());if(!t)return null;let r=Number(t[1])*60+Number(t[2]);return r>=0&&r<Ai?r:null}o(ls,"wallClockMinutes");function Ti(e,t){if(t.quiet_hours_mode==="OFF")return!1;if(t.quiet_hours_mode==="S\
CHEDULED_ONLY")return!0;let r=ls(t.quiet_start_time),n=ls(t.quiet_end_time);if(r===null||n===null||r===n)return!1;let s=at(e,t.timezone).minutes;return r<n?s>=r&&s<n:s>=r||s<n}o(Ti,"isWithinQuietHours");
function bi(e,t,r){let n=at(t,r).dateKey,s=0;for(let a of e)at(a,r).dateKey===n&&(s+=1);return s}o(bi,"sentOnLocalDay");function ki(e){let t=e.daily_notification_cap;return!Number.isFinite(t)||t<1?ds.
daily_notification_cap:Math.floor(t)}o(ki,"capOf");function _s(e,t,r={}){let n={send:[],fail:[],defer:[]},s=t.filter(i=>i.due_at_utc.getTime()<=e.getTime()).sort((i,u)=>{let l=i.due_at_utc.getTime()-u.
due_at_utc.getTime();return l!==0?l:i.id<u.id?-1:i.id>u.id?1:0}),a=new Map;for(let i of s){if(i.attempts>=Ei){n.fail.push(i.id);continue}let u=r.settings?.get(i.user_id)??ds;if(Ti(e,u)){n.defer.push({
id:i.id,reason:"QUIET_HOURS"});continue}let l=a.get(i.user_id);if(l===void 0){let c=r.sentAt?.get(i.user_id)??[];l=Math.max(0,ki(u)-bi(c,e,u.timezone))}if(l===0){a.set(i.user_id,0),n.defer.push({id:i.
id,reason:"DAILY_CAP_REACHED"});continue}a.set(i.user_id,l-1),n.send.push(i.id)}return n}o(_s,"tick");var ms=24;async function Ii(e){if(e.length===0)return 0;let t=await kr([...new Set(e.map(i=>i.user_id))]);if(t.size===0)return 0;let r=[],n=new Map;for(let i of e)for(let u of t.get(i.user_id)??[]){r.
push({to:u,title:i.title,body:i.body??"",data:{reminder_id:i.id}});let l=n.get(u);l?l.push(i.id):n.set(u,[i.id])}if(r.length===0)return 0;let s=await is(r);await Ir(s.notRegistered,"DEVICE_NOT_REGISTE\
RED");let a=new Set;for(let i of s.delivered)for(let u of n.get(i)??[])a.add(u);return await ln([...a]),a.size}o(Ii,"deliverByPush");async function ps(e=new Date){let t=await rn(ms),r=cs(e,t,ms),n=await sn(
r),s=await un(),a=[...new Set(s.map(p=>p.user_id))],[i,u]=await Promise.all([on(a),an(a,e)]),l=_s(e,s,{settings:i,sentAt:u});await cn(l.send),await dn(l.fail);let c=new Set(l.send),_=await Ii(s.filter(
p=>c.has(p.id)));return{scheduled:n,sent:l.send.length,delivered:_,failed:l.fail.length,deferred:l.defer.length}}o(ps,"runReminderPass");var lt=Deno.env.get("SUPABASE_FUNCTION_SLUG")??"plantpal-api";function ut(e){let t=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_DB_URL");if(!t)throw new Error(
"No platform secret to derive from: set JWT_ACCESS_SECRET on the function explicitly.");return xi("sha256",t).update(`plantpal:${e}`).digest("hex")}o(ut,"derivedSecret");function Le(e,t){let r=Deno.env.
get(e);return r&&r.length>0?r:t}o(Le,"fromEdge");var Si=(Deno.env.get("EXTRA_CORS_ORIGINS")??Deno.env.get("CORS_ORIGINS")??"").split(",").map(e=>e.trim()).filter(Boolean),ws=Deno.env.get("DATABASE_URL")??
Deno.env.get("SUPABASE_DB_URL");if(!ws)throw new Error("Neither DATABASE_URL nor SUPABASE_DB_URL is set.");var hs=new URL(Deno.env.get("SUPABASE_URL")??"https://localhost").origin,Es=mt({...Ni.env,NODE_ENV:"\
production",DATABASE_URL:ws,JWT_ACCESS_SECRET:Le("JWT_ACCESS_SECRET",ut("jwt-access")),AUDIT_PEPPER:Le("AUDIT_PEPPER",ut("audit-pepper")),LOG_LEVEL:Le("LOG_LEVEL","info"),CORS_ORIGINS:[hs,...Si].join(
","),REFRESH_COOKIE_PATH:Le("REFRESH_COOKIE_PATH","/")});Me(Es.DATABASE_URL,3,{rejectUnauthorized:!1});var fs=Deno.env.get("TICK_SECRET")||void 0,ys=ut("internal-tick"),oe;async function Oi(){if(fs)return fs;
if(!(oe&&(oe.value!==null||Date.now()-oe.at<6e4)))try{let{rows:t}=await d().query(`select decrypted_secret as secret
           from vault.decrypted_secrets
          where name = 'plantpal_tick_secret'
          limit 1`);oe={value:t[0]?.secret??null,at:Date.now()}}catch(t){return h.warn({err:t},"internal tick: Vault lookup failed, using the derived secret"),ys}return oe?.value??ys}o(Oi,"tickSecret");
function Ci(e,t){let r=gs.from(e),n=gs.from(t);return r.length===n.length&&Di(r,n)}o(Ci,"sameSecret");var Li=ts({corsOrigins:Es.CORS_ORIGINS,basePath:`/${lt}`}),ct=vi();ct.post(`/${lt}/internal/tick`,
async(e,t)=>{let r=(e.get("authorization")??"").replace(/^Bearer\s+/i,""),n=!1;try{n=r.length>0&&Ci(r,await Oi())}catch{n=!1}if(!n){t.status(401).json({error:{code:"AUTHENTICATION_REQUIRED"}});return}
let s=Promise.allSettled([ps(),os()]).then(([a,i])=>{h.info({reminders:a.status==="fulfilled"?a.value:"failed",purge:i.status==="fulfilled"?i.value:"failed"},"internal tick complete")});typeof EdgeRuntime<
"u"&&EdgeRuntime?.waitUntil?.(s),t.status(202).json({status:"accepted"})});ct.use(Li);h.info({slug:lt,origin:hs},"PlantPal+ API starting on Supabase Edge");ct.listen(8e3);
