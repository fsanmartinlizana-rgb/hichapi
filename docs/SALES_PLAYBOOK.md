# HiChapi — Sales Playbook & Product Training

> Documento maestro para entrenar a una IA (o a un vendedor humano) en sesiones de venta, pitches y objecion handling de HiChapi.
> Fuente: código en producción + guías internas. Actualizado 2026-04-22.

---

## 1. Elevator pitch (30 segundos)

> "HiChapi es la plataforma todo-en-uno que digitaliza tu restaurante **y** te trae clientes nuevos. Tu carta, tus mesas, tu cocina, tu caja y tu facturación DTE funcionando desde un solo panel. Además, apareces en **Chapi**, nuestro asistente IA que recomienda restaurantes en Santiago por barrio, presupuesto o dieta. Arrancas gratis, y solo pagas 1% por transacción registrada en la plataforma — sin importar el medio de pago. Sin permanencia, sin letra chica."

### Una línea para cada público
- **Dueño de restaurante pequeño**: "Reemplaza tu POS, tu carta impresa y tu lista en papel por un sistema que sí conversa con tus clientes."
- **Dueño de cadena**: "Operá 5 locales con un solo panel, inventario unificado y API pública."
- **Comensal**: "Decile a Chapi qué querés comer y te recomienda restaurantes reales con platos específicos."

---

## 2. Propuesta de valor — las 3 grandes promesas

### Promesa 1 — **Operación digital sin fricción**
Mesas, comandas, cocina, caja, DTE y delivery en un solo panel. Reemplaza 4–6 herramientas (POS, carta impresa, planilla de inventario, WhatsApp con cocina, lista de espera, emisor DTE).

### Promesa 2 — **Descubrimiento por IA (Chapi)**
No es solo un SaaS: cada restaurante aparece en el buscador conversacional. Los clientes hablan en lenguaje natural ("algo japonés sin gluten en Providencia por 20 lucas") y reciben recomendaciones con platos específicos. Esto es tráfico **nuevo** que no sale de Google Maps ni Instagram.

### Promesa 3 — **Modelo alineado al éxito**
- **Free** sin vencimiento: presencia digital, carta, perfil, aparece en Chapi.
- Planes pagos solo cuando necesitás operar.
- **Starter / Pro**: 1% por transacción registrada en la plataforma — sin importar el medio de pago (efectivo, tarjeta o digital).
- **Enterprise**: comisión digital escalonada según volumen del holding (1% / 0.7% / 0.5%) + precio por local que baja con la escala.

---

## 3. Target de clientes

### ICP (Ideal Customer Profile)
| Segmento | Tamaño | Plan típico | Por qué compran |
|---|---|---|---|
| Cafés y fast-casual | 1–5 mesas | Free → Starter | QR + caja sin pagar licencia POS |
| Restaurantes medianos | 15–40 mesas | Starter → Pro | Cocina en tiempo real + comandas + stock |
| Bares y pubs | 10–30 mesas | Pro | Inventario de licores + fidelización |
| Cadenas / franquicias | 2+ locales | Enterprise | Multi-local + API + geofencing |
| Food trucks / dark kitchens | 1 local | Starter | Delivery integrations + QR virtual |

### Anti-ICP (a quién NO venderle)
- Restaurantes sin conexión confiable (Chapi requiere internet para sincronizar tiempo real).
- Negocios que solo quieren facturación electrónica suelta (hay competidores más baratos si eso es lo único que necesitan).
- Dueños sin smartphone ni tablet (hay curva de adopción mínima).

---

## 4. Planes & pricing (fuente oficial: `lib/plans.ts`)

| Plan | Precio/mes | Comisión por transacción | Para quién |
|---|---|---|---|
| **Gratis** | $0 | — | Restaurante que quiere estar en Chapi sin costo |
| **Starter** | $29.990 | +1% | Restaurante chico que quiere digitalizar el salón |
| **Pro** ⭐ | $59.990 | +1% | Restaurante mediano con cocina + stock + loyalty |
| **Enterprise** | Desde $29.990 / local | Escalonada (1% / 0.7% / 0.5%) | Holdings de 2+ locales |

> Starter y Pro: el 1% aplica sobre toda transacción registrada en la plataforma, **sin importar el medio de pago** (efectivo, tarjeta o digital).
>
> Enterprise: el precio por local baja con la cantidad de locales (ver tramos abajo) y la comisión digital baja con el volumen total del holding.

### Enterprise — tramos de precio (NO se muestran en la landing)

Estos tramos **no aparecen públicamente**. Solo se conversan en venta directa con holdings.

| Tramo | Locales | Precio por local | Fee plataforma/mes | Total ejemplo |
|---|---|---|---|---|
| **Duo** | 2–4 | $49.990 | $0 | 3 locales = $149.970/mes |
| **Chain** | 5–14 | $39.990 | $150.000 | 8 locales = $469.920/mes |
| **Scale** | 15–49 | $29.990 | $150.000 | 20 locales = $749.800/mes |
| **Holding** | 50+ | $18.000 base (negociable) | $300.000 | 60 locales = $1.380.000/mes |

**Reglas clave**:
- Todos los locales del holding pagan el **mismo precio del tramo en que están**.
- Si un cliente sube de tramo (ej. de Chain a Scale al sumar el local 15), **todos sus locales bajan al precio del tramo nuevo el mismo mes**.
- El tramo Holding es **negociable**. El precio base es referencial — se cierra caso a caso.

### Enterprise — comisión digital escalonada

| Volumen mensual de ventas digitales del holding | Comisión |
|---|---|
| Hasta $30M CLP | 1.0% |
| $30M – $100M CLP | 0.7% |
| Sobre $100M CLP | 0.5% |

> Las tasas se aplican **por tramos** (no es una sola tasa sobre el total). Ej: holding que factura $50M digital paga 1% sobre los primeros $30M + 0.7% sobre los siguientes $20M = $300.000 + $140.000 = **$440.000 de comisión**.

**Punto de negociación con holdings grandes**: no es eliminar la comisión sino el **cap mensual** ("desde $X mensuales no cobramos más comisión, sin importar cuánto facturen").

### Qué incluye cada plan

**Gratis** (presencia digital eterna)
- Página pública `hichapi.cl/r/{slug}`
- Carta digital con fotos y tags
- Perfil público con ubicación, horarios, medios de pago
- Aparición en búsquedas de Chapi (descubrimiento IA)
- Configuración del restaurante

**Starter** (Gratis + operación del salón)
- Mesas + QR único por mesa
- Comandas en tiempo real (cocina + barra + sin preparación)
- Caja con apertura/cierre de turno
- Lista de espera digital (con notificación vía SMS/WhatsApp)
- Turnos del personal

**Pro** ⭐ más popular (Starter + inteligencia operativa)
- Stock con descuento automático + control de mermas
- Analytics unificado con reporte IA diario
- Dashboards configurables
- Fidelización y promociones (cupones, wallet, rewards)
- Chapi Insights: IA que analiza tus datos y sugiere acciones

**Enterprise** (Pro + escala — para holdings de 2+ locales)
- Multi-local sin límite (precio por local que **baja con la cantidad de locales**)
- **Dashboard consolidado** de todos los locales del holding
- **Transferencia de stock entre locales** con registro y trazabilidad
- **Importación de carta por IA sin tope** (Starter: 40/mes, Pro: 200/mes)
- Geofencing + check-in automático
- API pública con API keys y scopes
- Agente IA de soporte 24/7
- **Comisión digital escalonada** (1% / 0.7% / 0.5% según volumen del holding)

### Cómo hablar del 1%
- Frase canónica (Starter/Pro): **"1% por transacción registrada en la plataforma, sin importar el medio de pago — efectivo, tarjeta o digital."**
- Compara: "Uber Eats te cobra 20–30%, Rappi lo mismo. Nosotros 1% sobre TODA tu venta, no solo el delivery."
- Argumento: "Es justo y predecible. No te pedimos que adivines qué porcentaje será efectivo o tarjeta. Si vendiste $1M, pagas $10K. Punto."
- **Enterprise**: la comisión digital es **escalonada según volumen del holding** (1% / 0.7% / 0.5%). Punto de negociación con grandes: el cap máximo mensual, no la existencia de comisión.

---

## 5. Módulos y funcionalidades — catálogo completo

### 5.1 Cliente final (comensal)

| Módulo | Descripción | Dónde vive |
|---|---|---|
| **Chapi Chat (Discovery)** | IA en lenguaje natural. Filtra por barrio, presupuesto, dieta, tipo de cocina. Sugiere platos específicos, no solo restaurantes. | `/buscar` |
| **Búsqueda por mapa** | Mapbox GL con pines y filtros. | `/buscar` con toggle |
| **Perfil público restaurante** | Página SEO-friendly por restaurante con carta, fotos, horarios, medios de pago, tags. | `/r/{slug}` |
| **QR de mesa → chat** | Cliente escanea, habla con Chapi, pide y paga desde el celular. | `/{slug}/{tableId}` |
| **Lista de espera self-service** | El cliente se anota desde su celular escaneando un QR en la entrada. Ve su posición. | `/espera` |
| **Dividir cuenta** | 3 modos: parejo, por items, personalizado. Cada persona paga y recibe DTE. | modal en `/{slug}/{tableId}` |
| **Loyalty wallet** | El cliente acumula puntos y canjea cupones. | `/mi-wallet` |
| **Reclamar cupones** | Flujo de redención con código. | `/reclamar` |
| **Reservas** | Reservar mesa por fecha/hora/personas. | `/reservar` |
| **Review post-pago** | Encuesta automática al terminar de pagar (1–5 estrellas + comentario). | `/{slug}/review` |

### 5.2 Restaurante — Operación diaria

| Módulo | Plan mínimo | Descripción |
|---|---|---|
| **Dashboard** | Free | Ventas hoy, ticket promedio, top platos, ocupación, alertas |
| **Carta digital** | Free | Platos, categorías, fotos, tags, precios, costos, disponibilidad |
| **Importación IA de carta** | Free | Sube foto/PDF de tu carta actual, Claude Vision detecta platos, precios y categorías |
| **Importación Excel** | Free | Copy-paste desde Sheets/Excel con autodetección de columnas |
| **Mesas** | Starter | Plano del local, QR único por mesa, zonas (interior/terraza/barra), dividir mesas grandes en sub-mesas |
| **Comandas (KDS)** | Starter | Pantalla Kanban tiempo real: Recibida → En cocina → Lista → Entregada. Cross-local routing |
| **Caja** | Starter | Apertura/cierre de sesión, arqueo, cierre de turno, reporte |
| **Lista de espera** | Starter | Agregar manual o self-service, notificar SMS/WhatsApp, asignar a mesa |
| **Turnos** | Starter | Calendario del personal, horas trabajadas |
| **Stock** | Pro | Inventario con descuento automático por venta, alertas de mínimo, importación masiva |
| **Mermas** | Pro | Registro de mermas (motivo, responsable, valor), reporte |
| **Órdenes de compra** | Pro | Generación de OC, tracking, conciliación con proveedor |
| **Promociones** | Pro | Cupones, happy hour, 2x1, descuentos por volumen, rewards |
| **Fidelización** | Pro | Programa de puntos, tiers, cumpleaños, wallet del cliente |
| **Analytics + Reporte IA diario** | Pro | Reporte automático a las 23:59 con ventas, top platos, alertas, sugerencias |
| **Chapi Insights** | Pro | Agente IA conversacional que analiza tus datos y responde "qué plato subir de precio", "qué promocionar el jueves" |

### 5.3 Restaurante — Configuración y equipo

| Módulo | Descripción |
|---|---|
| **Equipo** | Invitar por email, roles múltiples por persona, desactivar |
| **Roles** | Owner/Admin · Supervisor · Garzón · Cocina · Anfitrión · Multi-rol soportado |
| **Mi restaurante** | Perfil público, fotos, ambientes, servicios, horarios, medios de pago, tags discovery (>70 opciones tipo Airbnb) |
| **Score de discovery** | 0–100: mide completitud de perfil. A mayor score, mejor ranking en Chapi |
| **Módulos y Plan** | Cambio de plan, ver módulos activos, feature flags por restaurant |
| **Configuración** | Datos tributarios (RUT, razón social, giro), zonas horarias |
| **Impresoras** | Configuración de impresoras térmicas por estación |
| **Tono de voz Chapi** | Customiza cómo responde Chapi en el QR de tu local (formal, cercano, divertido) |

### 5.4 Facturación electrónica (DTE — Chile)

| Feature | Descripción |
|---|---|
| **Emisión de boletas y facturas** | Boleta electrónica (39), factura electrónica (33), nota de crédito (61), nota de débito (56) |
| **Carga de CAF** | Subir el Código de Autorización de Folios directo en el panel |
| **Credenciales SII** | Gestión de certificado digital, ambiente certificación y producción |
| **Folios** | Control de folios disponibles/usados por tipo de documento |
| **Receptores** | Base de datos de clientes con RUT para factura |
| **AEC (Acuses)** | Gestión de acuses de recibo |
| **DTE incoming** | Recepción de documentos de proveedores |
| **Actividades SII (ACTECO)** | Selector oficial de códigos de actividad económica |
| **Ambiente certificación** | Flujo completo para certificarse en el SII |

### 5.5 Integraciones

| Plataforma | Uso |
|---|---|
| **PedidosYa** | Sync de menú + pedidos |
| **Rappi** | Sync de menú + pedidos |
| **Uber Eats** | Sync de menú + pedidos |
| **Justo** | Chile — sync de menú |
| **DiDi Food** | LATAM |
| **Cornershop** | LATAM |
| **Stripe** | Pagos de suscripción del SaaS |
| **Transbank / Mercado Pago** | Pago en caja (POS) |
| **Mapbox** | Geolocalización y mapa de discovery |
| **Claude (Anthropic)** | Chat con clientes + importación de carta + insights |
| **Supabase Realtime** | Sincronización tiempo real cocina-garzón |

### 5.6 Features Enterprise

- **Multi-local unificado**: un solo login, dashboard consolidado, inventario cross-local, traspasos entre sucursales, cross-local order routing (la cocina de un local puede tomar comandas de otro).
- **API pública**: endpoints REST con API keys, scopes granulares, rate limiting.
- **Geofencing**: check-in automático del staff cuando entra al local; detección de clientes cerca.
- **Soporte 24/7**: agente IA con acceso al contexto del restaurante + humano escalable.
- **Comisión digital escalonada**: 1% (≤$30M) / 0.7% ($30M–$100M) / 0.5% (>$100M).

---

## 6. Diferenciadores competitivos

### vs POS tradicional (Square, Toast, Uber POS)
- Ellos cobran hardware + licencia mensual. Nosotros corremos en cualquier tablet/celular con browser.
- Ellos no te traen clientes. Chapi sí (descubrimiento IA).
- Ellos no tienen DTE Chile nativo. Nosotros sí.

### vs Menú digital genérico (Menu.com.cl, DeliveryClub)
- Ellos son solo menú. Nosotros somos operación completa.
- Ellos no tienen stock, comandas, caja.

### vs Delivery apps (PedidosYa, Rappi, Uber Eats)
- Ellos cobran 20–30% sobre el delivery. Nosotros 1% sobre toda transacción registrada — y solo si la registras en HiChapi.
- Ellos son tu intermediario. Nosotros somos tu infraestructura (y nos integramos con ellos).

### vs software contable con POS (Defontana, Nubox, Bsale)
- Nosotros somos mucho mejores en frontend de cliente y experiencia (QR, chat IA, reviews).
- Ellos son más fuertes en contabilidad pura.
- Para un restaurante que quiere operación + discovery, nosotros ganamos.

### vs ChatGPT + Google Maps
- Chapi tiene **datos reales del menú** con precios, disponibilidad y tags. ChatGPT alucina.
- Chapi recomienda platos específicos, no solo restaurantes.

---

## 7. Discovery — preguntas de calificación

### Descubrir el dolor (Problem Discovery)
1. "¿Cómo toman los pedidos hoy? ¿Papel, POS, WhatsApp con cocina?"
2. "¿Cuánto tiempo les toma cerrar caja al final del día?"
3. "¿Cómo llegan clientes nuevos? ¿Instagram, boca a boca, Google?"
4. "¿Qué % de sus ventas es delivery vs salón?"
5. "¿Cuántos locales manejan? ¿Los datos están unificados?"
6. "¿Emiten DTE? ¿Con qué proveedor?"
7. "¿Tienen programa de fidelización? ¿Cómo miden cliente recurrente?"

### Calificar tamaño y plan (BANT)
- **Budget**: "¿Cuánto gastan hoy en software (POS + contable + DTE)?"
- **Authority**: "¿Usted toma la decisión final o lo conversa con el socio?"
- **Need**: identificar si operación está rota, si no traen clientes, o si pierden datos.
- **Timeline**: "¿Cuándo necesitan tenerlo funcionando? ¿Próxima temporada alta?"

### Preguntas abiertas poderosas
- "Si pudieras automatizar una cosa del restaurante, ¿cuál sería?"
- "¿Qué es lo que más te frustra del turno del viernes a las 9pm?"
- "Si un cliente te calificara 2 estrellas hoy, ¿te enterarías?"

---

## 8. Pitch por escenario

### Escenario A — Dueño de restaurante chico sin tecnología
> "Hoy tu carta es un PDF en WhatsApp y las comandas las gritas a la cocina. HiChapi te da carta digital con QR, comandas que se imprimen solas y caja que cierra en 3 clicks. Gratis para empezar. $30K/mes cuando estés listo para digitalizar el salón. Y ya por estar en HiChapi apareces en Chapi, que es como Google Maps pero conversacional — un cliente dice 'quiero algo rico por Ñuñoa' y Chapi te recomienda."

### Escenario B — Restaurante que ya tiene POS
> "No te pido que botes tu POS. HiChapi es complementario: el cliente escanea el QR, pide desde el celular, el pedido llega a cocina sin que el garzón tenga que anotar nada. Reduces errores 80%. Además apareces en Chapi para tráfico nuevo. Arrancas gratis, validas con 2 mesas, y si funciona lo escalas."

### Escenario C — Cadena de 3+ locales
> "Hoy cada local es una isla: inventarios separados, reportes por Excel, staff que no rota. Enterprise te da un solo panel para tus 3 locales, transferencia de stock entre ellos, staff que opera cualquier sucursal con su login, y API pública para conectar tu BI o contable. Cuestan $49.990 cada local — total $149.970/mes, baja a $39.990 cada uno cuando llegues al 5° local. Comisión digital empieza en 1% y baja a 0.7% cuando crucen los $30M digitales. ROI en el primer trimestre."

### Escenario D — Food truck / dark kitchen
> "No tienes salón, pero sí tienes clientes que no te encuentran. Plan gratis te da presencia en Chapi. Plan Starter te da QR virtual para que el cliente pida desde donde esté, integraciones con PedidosYa/Rappi y caja para cuadrar. Pagas 1% por cada transacción registrada — sin importar si te pagaron en efectivo, transferencia o tarjeta."

---

## 9. Objeciones — respuestas

### "Está caro."
> "Comparado con qué? Un POS tradicional te cobra $80K/mes + hardware + mantención. Nosotros $30K con QR, comandas y caja. El 1% sobre cada transacción es predecible: si vendiste $1M, pagas $10K — sin importar el medio de pago. Además arrancas gratis y pagas solo cuando estés listo."

### "No tengo tiempo para implementar."
> "Setup toma 20–30 minutos: subes la carta con foto (la IA la digitaliza por ti), generas los QR, invitas al equipo. El primer pedido sale el mismo día. Tenemos guía rápida y soporte por chat."

### "Mi equipo es mayor, no van a aprender."
> "La pantalla de cocina es 4 columnas con arrastrar y tocar. El garzón solo ve sus mesas en el celular. Los onboarding que hicimos en cafés de barrio con cocineros de 55+ años tomaron menos de una hora. Si no funciona, te devolvemos la plata del primer mes."

### "Ya tengo Defontana / Bsale / Nubox."
> "Perfecto, sigue usándolos para contabilidad. HiChapi no reemplaza eso — te da la capa de operación (mesas, comandas, QR, clientes) que ellos no tienen. Se complementan. Podemos exportarte datos a Excel para que los subas a tu contable."

### "No creo que venga gente nueva por un chat."
> "Chapi ya tiene +50 restaurantes en Santiago y tráfico creciente. Pero aunque vengan 0 clientes nuevos, tu plan Starter se justifica solo por reemplazar POS + carta + comandas + caja. El descubrimiento es un **bonus** que paga solo."

### "Quiero hablar con otro cliente tuyo."
> (Si tienes referencias) "Te conecto con Felipe de Osteria del Porto o Andrea de La Mesón." — (Si no) "Te mando 3 testimonios en video y te dejo 14 días de prueba gratis en el plan Pro completo para que valides vos mismo."

### "¿Qué pasa con mis datos si cancelo?"
> "Son tuyos 100%. Exportás todo en Excel desde el panel en cualquier momento. Si cancelás, la página gratuita sigue activa. Nunca vendemos ni compartimos data."

### "¿Funciona sin internet?"
> "Necesitás conexión para sincronizar en tiempo real cocina-garzón. La carta queda cacheada en el celular del cliente. Para locales con WiFi inestable recomendamos un router 4G de respaldo ($15K one-time)."

### "¿Cómo sé que la IA no se equivoca con mi carta?"
> "Revisás y editás todo antes de confirmar la importación. La IA hace el 80% del trabajo, vos validás el 20% crítico (precios)."

### "Ya uso Uber Eats / Rappi."
> "Buenísimo, lo integramos. Tu menú se sincroniza automáticamente. Pero el delivery sale 20–30% de comisión — HiChapi te da el canal directo (QR + pedido en mesa) que sale 1%. Lo usás como canal directo y mantenés delivery externo para domicilio."

---

## 10. Closing techniques

### Assumptive close
> "¿Empezamos con plan Starter este mes o prefieres arrancar gratis y subir cuando veas el primer pedido por QR?"

### Scarcity real
> "Estamos activando 10 restaurantes nuevos por semana en Santiago con onboarding 1-a-1. Si quieres que te lo configuremos nosotros, esta semana puedo agendarte."

### Risk reversal
> "30 días gratis en plan Pro. Si no te convence, no cobramos nada. Si te convence, sigues automáticamente."

### Pilot close (para cadenas)
> "Arranquemos con 1 local. Si a los 60 días los números cierran, lo escalamos a los otros 2."

---

## 11. Pricing objection — calculadora mental

Cuando el cliente dice "no sé si me conviene", muéstrale el ROI con números:

| Concepto | Antes HiChapi | Con HiChapi Starter |
|---|---|---|
| POS + licencia | $50–80K/mes | $0 |
| Menú impreso (impresión + cambios) | $30K/mes | $0 |
| Errores de comanda (platos que se rehacen) | ~$100K/mes | ~$20K/mes |
| Tiempo cierre de caja | 40 min | 5 min |
| Clientes nuevos de discovery | 0 | 5–15/semana |
| **Costo total** | **$180K+/mes** | **$30K + 1% por transacción** |

> "Ahorro bruto mínimo de $100K/mes + clientes nuevos. El pago del Starter se recupera la primera semana."

---

## 12. Términos que DEBES usar (vocabulary cheat sheet)

- **Chapi** (no "el bot") — nuestra IA de discovery, tiene nombre propio.
- **Descubrimiento conversacional** (no "SEO").
- **Comandas en tiempo real** (no "kitchen display system" — a menos que el cliente sea técnico).
- **Presencia digital** (no "listing").
- **Operación del salón** (no "frontend ops").
- **Fidelización** (no "loyalty" — en español).
- **1% por transacción registrada en la plataforma** (siempre con la aclaración "sin importar el medio de pago", NO "1% de comisión" suelto).
- **Sin permanencia** (tranquiliza al dueño).

## 13. Términos que DEBES evitar

- "Software" → di "plataforma" o "herramienta".
- "Stack" → di "sistema".
- "Integración con API" → di "conectamos con PedidosYa/Rappi".
- "Machine learning" → di "inteligencia artificial" o mejor solo "Chapi aprende".
- "Cloud" → di "en línea, sin instalar nada".

---

## 14. Social proof disponible

- **+50 restaurantes activos** en Santiago (cifra oficial landing).
- **12 barrios cubiertos**: Providencia, Ñuñoa, Bellavista, Barrio Italia, Las Condes, Vitacura, Santiago Centro, Lastarria, Bellas Artes, La Reina, Recoleta, Vitacura.
- Testimonios landing:
  - Camila R. (celíaca, Providencia): experiencia de discovery.
  - Felipe M. (Osteria del Porto): pedido directo a cocina sin errores.
  - Andrea L. (La Mesón): ROI del 1% + visibilidad.
- **Stack técnico premium**: Claude (Anthropic), Supabase, Mapbox, Next.js 16. (Útil si hablas con cliente técnico o inversionista.)

---

## 15. Demo script (20 minutos)

### Minuto 0–3: Descubrimiento (Chapi Discovery)
1. Abrir `hichapi.cl/buscar`.
2. Escribir: "algo sin gluten en Providencia por 20 lucas".
3. Mostrar resultados: 3 restaurantes con **platos específicos** + mapa.

### Minuto 3–6: Ficha pública del restaurante
1. Click en un restaurante → `/r/{slug}`.
2. Mostrar: fotos, carta, horarios, tags, reviews.
3. Resaltar: "Así te van a ver tus clientes. Es tu SEO moderno."

### Minuto 6–10: Panel del restaurante
1. Login a un restaurante demo.
2. Dashboard → ventas del día.
3. Carta digital → importar desde foto (mostrar magia de la IA).
4. Mesas → generar QR.

### Minuto 10–14: Flujo de pedido real
1. Escanear QR de mesa en el celular.
2. Pedir 2 items.
3. Mostrar en la pantalla de comandas cómo llega en vivo.
4. Marcar como "Listo" → mostrar en la vista del garzón.
5. Pagar → review automático.

### Minuto 14–17: Insights
1. Mostrar Chapi Insights con datos reales.
2. Preguntar: "¿qué plato debería promocionar esta semana?"
3. Leer la respuesta de la IA con datos del negocio.

### Minuto 17–20: Planes + cierre
1. Mostrar pantalla de planes.
2. Proponer plan según lo que vimos (Starter si chico, Pro si mediano).
3. Close con trial o implementación asistida.

---

## 16. Follow-up emails (templates)

### Email 1 — Post-demo
> **Asunto**: HiChapi para {Restaurante} — próximos pasos
>
> Hola {Nombre},
>
> Gracias por el tiempo de hoy. Como conversamos, vi 3 cosas que HiChapi puede resolver para {Restaurante}:
> 1. {dolor 1 del cliente}
> 2. {dolor 2}
> 3. {dolor 3}
>
> Te dejo:
> - Video grabado del demo: {link}
> - Pricing resumido: {link a landing}
> - Link para activar trial Pro de 30 días: {link}
>
> Si quieres que te ayude con el onboarding, tengo slot el {día} a las {hora}.
>
> Saludos,
> {Nombre}

### Email 2 — No respondió en 3 días
> **Asunto**: {Nombre}, ¿te sirvió el demo?
>
> Breve: te envié el material la semana pasada. No quiero molestar pero tampoco perderte.
>
> Si es "ahora no", me dices y te dejo tranquilo hasta el próximo trimestre.
> Si es "sí pero tengo dudas", dime cuáles y las respondo en 5 minutos.
> Si es "no me interesa", también me sirve saberlo.
>
> Gracias.

### Email 3 — Reactivación (3 meses después)
> **Asunto**: Novedades de HiChapi — {feature nuevo}
>
> Hola {Nombre}, hace 3 meses conversamos. Te aviso que lanzamos {feature relevante a su negocio}.
>
> ¿Vale la pena retomar la conversación?

---

## 17. KPIs de venta sugeridos

| Métrica | Target |
|---|---|
| Demos agendados/semana | 10 |
| Demo → trial activado | 40% |
| Trial → plan pago | 30% |
| Ciclo promedio (primer contacto → pago) | 14 días |
| Ticket mensual promedio | $45K (mix Starter/Pro) |
| Churn mensual | <5% |
| NPS post-onboarding | >50 |

---

## 18. Recursos

- **Guía rápida restaurante** — `docs/restorants/guia-rapida.md`
- **Guía por rol** — `docs/restorants/guia-roles.md`
- **Checklist onboarding** — `docs/restorants/checklist-onboarding.md`
- **Análisis hardware** — `docs/modelo-hardware/HiChapi_Analisis_V2_PlanesReales_Comision.docx`
- **Pricing fuente** — `lib/plans.ts`
- **Landing canónica** — `app/page.tsx`
- **Contacto ventas** — `hola@hichapi.cl`

---

## 19. Principios de venta HiChapi

1. **Vende resultado, no features**. Nadie compra "kitchen display system", compra "menos errores en cocina".
2. **Gratis es tu mejor herramienta**. Siempre arranca por "empieza gratis y ves si te sirve".
3. **El 1% es defendible**. Nunca lo escondas; preséntalo con contexto.
4. **Chapi es diferenciador irreplicable**. Ningún POS te trae clientes nuevos. Úsalo como gancho.
5. **Multi-rol + simplicidad**. El dueño, el garzón y la cocina usan la misma plataforma pero ven cosas distintas.
6. **El restaurante siempre tiene razón** cuando dice "mi equipo no va a aprender". Demuestra lo contrario con un pilot de 1 mesa.
7. **No sobrevendas Enterprise**. Si tiene 1 local, véndele Pro. Enterprise es para 2+ locales.
8. **Recompra = onboarding bien hecho**. El cliente que carga bien la carta y genera los QR en la primera sesión, queda.

---

*Documento vivo — actualizar con cada sprint. Última revisión: 2026-04-22.*
