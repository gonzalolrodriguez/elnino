/**
 * Página del mapa abierto que se carga dentro del WebView: Leaflet 1.9.4 + teselas de OpenStreetMap.
 *
 * Por qué Leaflet y no MapLibre GL: el mapa es de teselas rasterizadas (no hace falta vector ni 3D),
 * Leaflet pesa ~40 KB y no necesita WebGL, que falta o falla en muchos Android viejos y en WebViews
 * de gama baja (justo los teléfonos que más se usan en el interior). La web usa MapLibre; la
 * experiencia es la misma y la app no depende de la GPU del teléfono.
 *
 * Seguridad de la página (ver también la configuración del WebView en `MapaAbierto.tsx`):
 *  - Leaflet viene de unpkg con versión exacta y Subresource Integrity (`integrity` + `crossorigin`):
 *    si el archivo cambia, el navegador no lo ejecuta y la app muestra el respaldo en texto.
 *  - Content-Security-Policy: sin `connect-src` (la página no hace pedidos de datos), imágenes solo
 *    de las teselas de OSM y de unpkg, sin `frame-src` ni `object-src`. `'unsafe-inline'` es
 *    necesario para el script y los estilos en línea de esta página; nada de lo que llega de la app
 *    se interpreta como HTML (los textos entran por `textContent` / `createTextNode`).
 *  - `referrer` = `strict-origin-when-cross-origin`: OSM recibe el origen y no una ruta (misma
 *    política que la web; ver docs/seguridad.md, «Teselas de OpenStreetMap»).
 */
import { COLOR } from "@/components/tema";

export const LEAFLET_VERSION = "1.9.4";
export const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
export const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
/** SRI (sha256) calculado sobre los archivos publicados de leaflet@1.9.4. */
export const LEAFLET_JS_SRI = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
export const LEAFLET_CSS_SRI = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";

/** Origen base de la página: es el único que `onShouldStartLoadWithRequest` deja cargar. */
export const BASE_URL_MAPA = "https://localhost/";

export const ATRIBUCION_OSM = "© colaboradores de OpenStreetMap";

/**
 * Geometría y estima de la animación (sin DOM ni Leaflet). Es el mismo cálculo que `animacionRuta.ts`;
 * una prueba evalúa este texto y lo compara con la versión TypeScript para que no se separen.
 */
export const MOTOR_JS = `
var RT=6371000;
function rad(g){return g*Math.PI/180;}
function lim(x,a,b){return Math.min(b,Math.max(a,x));}
function haversine(a,b){var dl=rad(b[1]-a[1]),dn=rad(b[0]-a[0]);var h=Math.pow(Math.sin(dl/2),2)+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.pow(Math.sin(dn/2),2);return 2*RT*Math.asin(Math.min(1,Math.sqrt(h)));}
function rumbo(a,b){var f1=rad(a[1]),f2=rad(b[1]),dl=rad(b[0]-a[0]);var y=Math.sin(dl)*Math.cos(f2);var x=Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl);return ((Math.atan2(y,x)*180/Math.PI)%360+360)%360;}
function acumuladas(r){var ac=[],t=0;for(var i=0;i<r.length;i++){if(i>0)t+=haversine(r[i-1],r[i]);ac.push(t);}return ac;}
function largoTotal(ac){return ac.length?ac[ac.length-1]:0;}
function tramoDe(ac,d){var lo=0,hi=ac.length-2;while(lo<hi){var mid=(lo+hi+1)>>1;if(ac[mid]<=d)lo=mid;else hi=mid-1;}return lo;}
function puntoEn(r,ac,d){if(r.length===0)return [0,0];if(r.length===1)return r[0];var dd=lim(d,0,largoTotal(ac));var i=tramoDe(ac,dd);var l=ac[i+1]-ac[i];var t=l>0?(dd-ac[i])/l:0;return [r[i][0]+(r[i+1][0]-r[i][0])*t,r[i][1]+(r[i+1][1]-r[i][1])*t];}
function rumboEn(r,ac,d){if(r.length<2)return 0;var i=tramoDe(ac,lim(d,0,largoTotal(ac)));while(i<r.length-2&&ac[i+1]-ac[i]===0)i++;while(i>0&&ac[i+1]-ac[i]===0)i--;return rumbo(r[i],r[i+1]);}
function dividir(r,ac,d){if(r.length<2)return {recorrida:[],restante:r.slice()};var dd=lim(d,0,largoTotal(ac));var i=tramoDe(ac,dd);var c=puntoEn(r,ac,dd);return {recorrida:r.slice(0,i+1).concat([c]),restante:[c].concat(r.slice(i+1))};}
function estimarDistancia(p){var s=Math.max(0,p.transcurridoMs/1000);var u=p.maxSegundos===undefined||p.maxSegundos===null?s:Math.min(s,p.maxSegundos);var v=isFinite(p.velocidadKmh)&&p.velocidadKmh>0?p.velocidadKmh*1000/3600:0;return lim(p.base+v*u,0,p.largo);}
function suavizar(actual,objetivo,dt,tau,retro){tau=tau||700;retro=retro===undefined?150:retro;if(objetivo<actual&&actual-objetivo<=retro)return actual;var k=1-Math.exp(-Math.max(0,dt)/tau);var n=actual+(objetivo-actual)*k;return Math.abs(objetivo-n)<0.5?objetivo:n;}
`;

/** Lógica de la página: recibe mensajes de la app, dibuja capas y anima el vehículo con requestAnimationFrame. */
export const PAGINA_JS = `
(function(){
var enviar=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}};
if(typeof L==="undefined"){enviar({t:"error",mensaje:"No se pudo cargar el mapa"});return;}
window.onerror=function(m){enviar({t:"error",mensaje:String(m)});};
var mapa=L.map("m",{center:[-26.18,-58.17],zoom:12,zoomControl:true,attributionControl:false,tap:true});
L.control.attribution({prefix:false}).addTo(mapa).addAttribution("${ATRIBUCION_OSM}");
var cargadas=0,fallidas=0,avisado=false;
var teselas=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,crossOrigin:true});
teselas.on("tileload",function(){cargadas++;});
teselas.on("tileerror",function(){fallidas++;if(!avisado&&cargadas===0&&fallidas>=4){avisado=true;enviar({t:"sinTeselas"});}});
teselas.addTo(mapa);
var capas=L.layerGroup().addTo(mapa);
function ll(p){return [p[1],p[0]];}
function elemento(forma,color,txt){var e=document.createElement("div");e.setAttribute("role","img");e.setAttribute("aria-label",txt);e.style.cssText="width:18px;height:18px;background:"+color+";border:3px solid ${COLOR.papel};box-shadow:0 0 0 1px "+color+";"+(forma==="circulo"?"border-radius:50%;":forma==="rombo"?"transform:rotate(45deg);":"border-radius:3px;");return e;}
function colorOk(c){return /^#[0-9a-fA-F]{6}$/.test(c)?c:"${COLOR.primario}";}
function dibujarCapas(m){
  capas.clearLayers();
  (m.sectores||[]).forEach(function(s){
    var c=colorOk(s.color);
    var poly=L.polygon(s.anillo.map(ll),{color:c,weight:2,fillColor:c,fillOpacity:0.25}).addTo(capas);
    var t=document.createElement("span");t.textContent=s.etiqueta;
    poly.bindTooltip(t,{permanent:true,direction:"center",className:"et"});
  });
  (m.lineas||[]).forEach(function(l){
    if(!l.coordenadas||l.coordenadas.length<2)return;
    var c=colorOk(l.color),pts=l.coordenadas.map(ll);
    L.polyline(pts,{color:"${COLOR.papel}",weight:10,lineCap:"round",lineJoin:"round"}).addTo(capas);
    var tl=document.createElement("span");tl.textContent=l.etiqueta;
    L.polyline(pts,{color:c,weight:6,lineCap:"round",lineJoin:"round",dashArray:"2 10"}).addTo(capas).bindTooltip(tl,{sticky:true});
  });
  (m.puntos||[]).forEach(function(p){
    var e=elemento(p.forma,colorOk(p.color),p.etiqueta);
    L.marker([p.lat,p.lon],{icon:L.divIcon({html:e,className:"",iconSize:[18,18],iconAnchor:[9,9]}),title:p.etiqueta,keyboard:false}).addTo(capas);
  });
}
function encuadrar(puntos,zoomMax){
  if(!puntos||!puntos.length)return;
  if(puntos.length===1){mapa.setView(ll(puntos[0]),zoomMax||14);return;}
  mapa.fitBounds(L.latLngBounds(puntos.map(ll)),{padding:[30,30],maxZoom:zoomMax||16,animate:false});
}
/* Punto elegido */
var elegir=false,pin=null;
function ponerPin(lon,lat){
  if(pin){pin.setLatLng([lat,lon]);return;}
  var e=elemento("circulo","${COLOR.error}","Punto elegido");
  pin=L.marker([lat,lon],{draggable:true,icon:L.divIcon({html:e,className:"",iconSize:[18,18],iconAnchor:[9,9]}),title:"Punto elegido",keyboard:false}).addTo(mapa);
  pin.on("dragend",function(){var p=pin.getLatLng();enviar({t:"punto",lon:p.lng,lat:p.lat,origen:"arrastre"});});
}
function seleccion(m){
  elegir=!!m.elegir;
  if(m.punto){ponerPin(m.punto.lon,m.punto.lat);}
  else if(pin){mapa.removeLayer(pin);pin=null;}
  if(pin)pin.dragging[elegir?"enable":"disable"]();
}
mapa.on("click",function(e){if(!elegir)return;ponerPin(e.latlng.lng,e.latlng.lat);enviar({t:"punto",lon:e.latlng.lng,lat:e.latlng.lat,origen:"clic"});});
/* Ruta y vehículo */
${MOTOR_JS}
var R=null,reducido=false,seguir=false,raf=0,intervalo=0;
var HECHO="${COLOR.primario}";
function limpiarRuta(){
  if(R){mapa.removeLayer(R.resto);mapa.removeLayer(R.hecho);mapa.removeLayer(R.borde);mapa.removeLayer(R.marca);}
  R=null;if(raf){cancelAnimationFrame(raf);raf=0;}if(intervalo){clearInterval(intervalo);intervalo=0;}
}
function marcaVehiculo(){
  var e=document.createElement("div");e.setAttribute("role","img");e.setAttribute("aria-label","Cuadrilla en camino");e.style.cssText="position:relative;width:44px;height:44px;";
  var f=document.createElement("div");f.style.cssText="position:absolute;left:0;top:0;width:44px;height:44px;";
  var p=document.createElement("div");p.style.cssText="position:absolute;left:15px;top:-2px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${COLOR.error};";
  f.appendChild(p);
  var b=document.createElement("div");b.style.cssText="position:absolute;left:8px;top:8px;width:28px;height:28px;border-radius:50%;background:${COLOR.error};border:3px solid ${COLOR.papel};box-shadow:0 1px 5px rgba(0,0,0,.45);";
  e.appendChild(f);e.appendChild(b);
  return {el:e,flecha:f};
}
function rutaMsg(m){
  if(!m.ruta||!m.ruta.coordenadas||m.ruta.coordenadas.length<2){limpiarRuta();return;}
  var coords=m.ruta.coordenadas,ac=acumuladas(coords),largo=largoTotal(ac);
  var clave=coords.length+"|"+coords[0].join(",")+"|"+coords[coords.length-1].join(",");
  reducido=!!m.reducido;
  if(!R||R.clave!==clave){
    limpiarRuta();
    var v=marcaVehiculo();
    R={clave:clave,coords:coords,acum:ac,largo:largo,disp:0,base:0,t0:Date.now(),vel:0,hor:null,ini:false,angulo:0,ultLinea:0,ultAviso:0,flecha:v.flecha,
       borde:L.polyline([],{color:"${COLOR.papel}",weight:9,lineCap:"round"}).addTo(mapa),
       resto:L.polyline(coords.map(ll),{color:HECHO,weight:5,lineCap:"round"}).addTo(mapa),
       hecho:L.polyline([],{color:HECHO,weight:4,opacity:0.3,lineCap:"round"}).addTo(mapa),
       marca:L.marker(ll(coords[0]),{icon:L.divIcon({html:v.el,className:"",iconSize:[44,44],iconAnchor:[22,22]}),interactive:false,keyboard:false}).addTo(mapa)};
    R.borde.setLatLngs(coords.map(ll));R.resto.bringToFront();
  }
  R.base=lim(m.ruta.progreso,0,1)*R.largo;
  R.t0=Date.now();R.vel=m.ruta.velocidadKmh;R.hor=m.ruta.simulada?null:90;
  if(!R.ini){R.disp=R.base;R.ini=true;}
  paso(reducido?Infinity:0);
  arrancar();
}
function arrancar(){
  if(raf){cancelAnimationFrame(raf);raf=0;}if(intervalo){clearInterval(intervalo);intervalo=0;}
  if(!R)return;
  if(reducido){intervalo=setInterval(function(){paso(Infinity);},5000);return;}
  var previo=performance.now();
  var cuadro=function(t){var dt=t-previo;previo=t;if(R&&R.disp<R.largo)paso(dt);raf=requestAnimationFrame(cuadro);};
  raf=requestAnimationFrame(cuadro);
}
function paso(dt){
  if(!R)return;
  var ahora=Date.now();
  var obj=estimarDistancia({base:R.base,velocidadKmh:R.vel,transcurridoMs:ahora-R.t0,largo:R.largo,maxSegundos:R.hor});
  var antes=R.disp;
  R.disp=isFinite(dt)?suavizar(R.disp,obj,dt):obj;
  var pos=puntoEn(R.coords,R.acum,R.disp);
  R.marca.setLatLng(ll(pos));
  if(R.disp!==antes||R.ultLinea===0){var b=rumboEn(R.coords,R.acum,R.disp);R.angulo+=((b-R.angulo+540)%360)-180;R.flecha.style.transform="rotate("+R.angulo+"deg)";}
  if(ahora-R.ultLinea>=150||!isFinite(dt)){R.ultLinea=ahora;var d=dividir(R.coords,R.acum,R.disp);R.hecho.setLatLngs(d.recorrida.map(ll));R.resto.setLatLngs(d.restante.map(ll));}
  if(ahora-R.ultAviso>=1000||!isFinite(dt)||R.disp>=R.largo){R.ultAviso=ahora;enviar({t:"avance",restanteM:Math.max(0,R.largo-R.disp),largoM:R.largo});}
  if(seguir&&!reducido){var pt=mapa.latLngToContainerPoint(ll(pos)),sz=mapa.getSize();if(pt.x<sz.x*0.25||pt.x>sz.x*0.75||pt.y<sz.y*0.25||pt.y>sz.y*0.75)mapa.panTo(ll(pos),{animate:true,duration:0.9});}
}
function seguirMsg(m){
  var antes=seguir;seguir=!!m.seguir;
  if(!R||antes===seguir)return;
  if(seguir){mapa.setView(ll(puntoEn(R.coords,R.acum,R.disp)),Math.max(mapa.getZoom(),15),{animate:!reducido});}
  else{mapa.fitBounds(L.latLngBounds(R.coords.map(ll)),{padding:[30,30],maxZoom:16,animate:!reducido});}
}
/* Mensajes de la app: cada uno trae un número creciente; los repetidos (Android entrega por document y por window) se ignoran. */
var ultimo=0;
function recibir(ev){
  var o;try{o=JSON.parse(ev.data);}catch(e){return;}
  if(!o||typeof o.n!=="number"||o.n<=ultimo||!o.m)return;
  ultimo=o.n;var m=o.m;
  try{
    if(m.t==="capas")dibujarCapas(m);
    else if(m.t==="encuadre")encuadrar(m.puntos,m.zoomMax);
    else if(m.t==="vista")mapa.setView(ll(m.centro),m.zoom,{animate:false});
    else if(m.t==="seleccion")seleccion(m);
    else if(m.t==="ruta")rutaMsg(m);
    else if(m.t==="seguir")seguirMsg(m);
  }catch(e){enviar({t:"error",mensaje:String(e&&e.message||e)});}
}
window.addEventListener("message",recibir);
document.addEventListener("message",recibir);
enviar({t:"listo"});
})();
`;

/** HTML completo de la página del mapa (se pasa al WebView como `source.html`). */
export function construirHtml(): string {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://unpkg.com",
    "style-src 'unsafe-inline' https://unpkg.com",
    "img-src https://tile.openstreetmap.org https://unpkg.com data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>html,body,#m{height:100%;margin:0;padding:0;background:${COLOR.cielo}}.et{background:rgba(255,255,255,.85);border:0;box-shadow:none;font:700 12px sans-serif;color:${COLOR.tinta};padding:1px 4px}.et:before{display:none}.leaflet-container{font:12px sans-serif}</style>
</head><body>
<div id="m"></div>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>${PAGINA_JS}</script>
</body></html>`;
}
