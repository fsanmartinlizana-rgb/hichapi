# Roadmap HiChapi — Fases y arquitectura de usuarios

## El flywheel completo

```
Usuario guarda preferencias
        ↓
Chapi Discovery recomienda mejor (personalizado)
        ↓
Restaurante recibe más covers en horarios muertos
        ↓
Restaurante genera más datos → mejores métricas
        ↓
Chapi mejora sus recomendaciones
        ↓ (ciclo)
```

---

## Arquitectura de cuentas

### 3 tipos de usuarios

| Tipo | Auth | Fricción | Datos que guardamos |
|------|------|----------|---------------------|
| **Cliente anónimo** | session_token (cookie) | Cero | intents de búsqueda, órdenes at-table |
| **Cliente registrado** | Magic link / Google OAuth | Mínima | preferencias, historial, favoritos |
| **Restaurante** | Email + password + 2FA | Normal | cuenta segura, suscripción, equipo |

---

## Sistema de preferencias (clientes)

Guardamos progresivamente — nunca preguntamos todo de golpe:

### Paso 1 — Inferido automáticamente (sin registro)
- Zonas buscadas frecuentemente
- Tipos de cocina más buscados
- Rango de presupuesto habitual
- Restricciones detectadas en mensajes ("sin gluten", "vegano")

### Paso 2 — Al registrarse (magic link post-búsqueda)
Prompt: "¿Quieres que recuerde tus preferencias?"
- Restricciones dietéticas confirmadas
- Barrio donde vive/trabaja

### Paso 3 — Acumulado con el uso
- Restaurantes marcados como favoritos
- Historial de órdenes at-table
- NPS que dieron

### Cómo usa Chapi las preferencias
```
Sistema: "Este usuario es vegano, vive en Providencia,
          presupuesto habitual $15-20k, ha pedido
          japonesa 3 veces este mes."
→ Chapi prioriza opciones veganas en Providencia
  sin que el usuario tenga que repetirlo cada vez
```

---

## Sistema de horarios muertos + promociones

### Cómo identificamos horarios muertos

Cada domingo a las 02:00 (cron Sonnet batch):
```
Para cada restaurante:
  1. Toma daily_summaries de las últimas 4 semanas
  2. Agrupa revenue_by_hour por día de semana
  3. Calcula percentil 25 de ocupación por slot
  4. Slots bajo el percentil 25 = "horario muerto"
  5. Guarda en dead_time_slots con confianza (semanas de datos)
```

Ejemplo output:
```
Martes 15:00-17:00 → ocupación 18% (muerto)
Jueves 16:00-18:00 → ocupación 22% (muerto)
Sábado 11:00-13:00 → ocupación 31% (muerto)
```

### Lo que puede hacer el restaurante
- Ver sus horarios muertos en el panel (gráfico + tabla)
- Crear una "promoción de horario": descuento, plato estrella, combo especial
- Activar/desactivar con un switch
- Ver métricas: cuántos covers generó cada promoción

### Cómo Chapi usa las promociones
En Discovery chat, si hay una promoción activa en el horario actual:
```
Usuario: "Quiero comer pasta en Providencia"
Chapi: "Te tengo opciones! El Rincón de Don José tiene
        pasta arrabiata a $11k hasta las 17:00
        (oferta de tarde) — normalmente sale $15k"
→ Restaurante aparece primero en resultados
```

---

## Seguridad restaurante — capas

### Autenticación
- Email + password (mínimo 12 chars, 1 número, 1 especial)
- Verificación de email obligatoria antes de activar cuenta
- 2FA opcional vía TOTP (Google Authenticator)
- Rate limiting: 5 intentos fallidos → bloqueo 15 min

### Sesiones
- JWT de Supabase con refresh token rotation
- Session fingerprint (user-agent + IP hash) — alerta si cambia
- Logout de todos los dispositivos con un click
- Lista de sesiones activas visible en el panel

### Acceso por rol dentro del restaurante
| Rol | Puede hacer |
|-----|-------------|
| `owner` | Todo, incluyendo billing y eliminar cuenta |
| `admin` | Panel completo excepto billing |
| `supervisor` | Ver reportes + aprobar órdenes |
| `waiter` | Solo comandas de su turno |

### Auditoría
- Tabla `audit_log`: quién hizo qué y cuándo
- Eventos críticos: login, cambio de password, cambio de precio, aprobación de comanda
- Retención 90 días

---

## Fases de construcción pendientes

### Fase 3a — Auth + seguridad (AHORA)
- [ ] Login restaurante (email + password)
- [ ] Register restaurante (con verificación email)
- [ ] Middleware de protección de rutas /dashboard, /comandas, /mesas
- [ ] Logout + sesiones activas
- [ ] Tabla `team_members` (roles del equipo)

### Fase 3b — Preferencias cliente
- [ ] Perfil cliente (magic link)
- [ ] Tabla `user_preferences`
- [ ] Chapi usa preferencias en search context
- [ ] Historial de búsquedas/favoritos

### Fase 3c — Carta digital
- [ ] CRUD de menu_items desde el panel
- [ ] Upload de fotos (Supabase Storage)
- [ ] Toggle available/unavailable en tiempo real

### Fase 3d — Horarios muertos + promociones
- [ ] Vista "Inteligencia de horarios" en panel
- [ ] Tabla `dead_time_slots` + `promotions`
- [ ] Cron dominical de análisis (Sonnet batch)
- [ ] Chapi Discovery consume promociones activas

### Fase 4 — Stripe + pagos
- [ ] Suscripción restaurante (Free / Pro / Enterprise)
- [ ] Split de cuenta real (Stripe PaymentIntent)
- [ ] Webhooks
