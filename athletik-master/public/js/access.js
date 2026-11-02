/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — DROITS D'ACCÈS, PAIEMENTS, KIT, SUIVI HUMAIN (pur)
 * ────────────────────────────────────────────────────────────────────────────
 * Partagé entre le serveur (webhook Systeme.io, API, admin) et les tests.
 *
 * Dossier d'accès (Firestore masterAccess/{email}) :
 *   { email, plan: 'one_time'|'installments'|'unknown', installments: 3,
 *     payments: [{ id, at, amount }], refundedAt, revokedAt, source }
 *
 * Règles :
 *   - accès à la formation dès le PREMIER paiement confirmé par le serveur
 *     (jamais sur une simple redirection de page de confirmation) ;
 *   - paiement complet = 1 paiement en une fois, ou N échéances payées ;
 *   - kit physique = paiement complet ET 14 jours écoulés depuis le premier
 *     paiement (délai de rétractation) ET aucun remboursement ;
 *   - l'achat donne Athletik Hub STANDARD, jamais Premium automatiquement ;
 *   - Premium : 1 mois après le boss « Tout Donner » (grant), ou les droits
 *     déjà existants dans Athletik Hub.
 * ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AMAccess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 24 * 3600 * 1000;
  var RETRACTATION_DAYS = 14;

  function emailKey(email) {
    return String(email || '').trim().toLowerCase();
  }

  function summarize(rec, now) {
    if (!rec) return { status: 'none', active: false, fullyPaid: false, kit: { eligible: false, reason: 'no_access' } };
    var payments = (rec.payments || []).slice().sort(function (a, b) { return a.at - b.at; });
    var n = payments.length;
    var plan = rec.plan || 'unknown';
    var needed = plan === 'one_time' ? 1 : plan === 'installments' ? (rec.installments || 3) : Infinity;
    var refunded = !!rec.refundedAt;
    var revoked = !!rec.revokedAt;
    var active = n > 0 && !refunded && !revoked;
    var fullyPaid = n >= needed && !refunded;
    var firstAt = n ? payments[0].at : null;
    var fullyPaidAt = fullyPaid ? payments[needed - 1].at : null;
    var kit;
    if (!active) kit = { eligible: false, reason: refunded ? 'refunded' : 'no_access' };
    else if (!fullyPaid) kit = { eligible: false, reason: plan === 'unknown' ? 'plan_unknown' : 'installments_pending', paid: n, needed: needed };
    else {
      var eligibleAt = Math.max(fullyPaidAt, firstAt + RETRACTATION_DAYS * DAY);
      kit = now >= eligibleAt ? { eligible: true, eligibleAt: eligibleAt } : { eligible: false, reason: 'retractation', eligibleAt: eligibleAt };
    }
    return {
      status: refunded ? 'refunded' : revoked ? 'revoked' : active ? 'active' : 'none',
      active: active, plan: plan, paid: n, needed: needed === Infinity ? null : needed,
      fullyPaid: fullyPaid, firstPaymentAt: firstAt, fullyPaidAt: fullyPaidAt, kit: kit
    };
  }

  // Rôles. hubDoc = users/{uid} d'Athletik Hub (lecture seule, jamais modifié).
  function roles(opts) {
    var now = opts.now;
    var acc = summarize(opts.access, now);
    var hub = opts.hubDoc || null;
    var hubPremiumNative = !!(hub && (hub.hasBookAccess === true ||
      (hub.accessTier && (!hub.accessExpiresAt || toMs(hub.accessExpiresAt) > now))));
    var grantPremium = (opts.grants || []).some(function (g) {
      return g.type === 'hubPremium' && g.at + (g.months || 1) * 30 * DAY > now;
    });
    return {
      master: acc.active,
      hubStandard: acc.active || !!hub,
      hubPremium: hubPremiumNative || grantPremium,
      hubPremiumFromMaster: grantPremium,
      admin: !!opts.isAdmin
    };
  }

  function toMs(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    var p = Date.parse(v);
    return isNaN(p) ? 0 : p;
  }

  // ─── Webhook Systeme.io ───────────────────────────────────────────────────
  // Le format exact des webhooks Systeme.io doit être confirmé sur un VRAI
  // événement (voir README § Systeme.io). La lecture est donc tolérante : on
  // cherche l'email, l'identifiant, le montant et le type à plusieurs endroits,
  // et tout ce qui n'est pas reconnu est rangé en 'unknown' (journalisé, sans
  // effet sur les droits).
  function pick(obj, paths) {
    for (var i = 0; i < paths.length; i++) {
      var cur = obj, parts = paths[i].split('.');
      for (var j = 0; j < parts.length && cur != null; j++) cur = cur[parts[j]];
      if (cur != null && cur !== '') return cur;
    }
    return null;
  }

  var PAYMENT_TYPES = ['sale_new', 'new_sale', 'sale.created', 'order.paid', 'payment_succeeded', 'payment.succeeded', 'subscription_payment', 'installment_paid'];
  var REFUND_TYPES = ['sale_canceled', 'sale_cancelled', 'refund', 'sale_refunded', 'order.refunded', 'payment_refunded'];

  function normalizeEvent(payload, headers, cfg) {
    cfg = cfg || {};
    headers = headers || {};
    var type = String(pick(payload, ['type', 'event', 'event_type', 'eventType']) ||
      headers['x-webhook-event'] || headers['X-Webhook-Event'] || '').toLowerCase();
    var email = pick(payload, ['data.customer.email', 'data.contact.email', 'customer.email', 'contact.email', 'data.email', 'email']);
    var offerId = pick(payload, ['data.offer_price_plan.id', 'data.offerPricePlan.id', 'data.offer.id', 'offer_price_plan.id', 'offer.id', 'offer_id']);
    var orderId = pick(payload, ['data.order.id', 'order.id', 'data.id', 'id', 'data.transaction.id']);
    var paymentId = pick(payload, ['data.payment.id', 'data.transaction.id', 'payment.id', 'transaction_id']) || orderId;
    var amount = pick(payload, ['data.order.amount', 'data.amount', 'amount', 'data.payment.amount']);
    var at = toMs(pick(payload, ['data.created_at', 'created_at', 'data.order.created_at', 'createdAt'])) || cfg.now;

    var kind = 'unknown';
    if (PAYMENT_TYPES.indexOf(type) >= 0) kind = 'payment';
    else if (REFUND_TYPES.indexOf(type) >= 0) kind = 'refund';

    var plan = 'unknown';
    var plans = cfg.offerPlans || {};
    if (offerId != null && plans[String(offerId)]) plan = plans[String(offerId)];

    return {
      kind: kind, type: type, email: email ? emailKey(email) : null,
      offerId: offerId != null ? String(offerId) : null,
      orderId: orderId != null ? String(orderId) : null,
      paymentId: paymentId != null ? String(paymentId) + (type === 'subscription_payment' || type === 'installment_paid' ? ':' + at : '') : null,
      amount: typeof amount === 'number' ? amount : (amount != null ? Number(amount) || null : null),
      at: at, plan: plan
    };
  }

  // Applique un événement normalisé à un dossier d'accès (idempotent par paymentId).
  function applyEvent(rec, ev, cfg) {
    cfg = cfg || {};
    var r = rec ? JSON.parse(JSON.stringify(rec)) : { email: ev.email, plan: 'unknown', installments: cfg.installments || 3, payments: [], source: 'systemeio' };
    if (ev.plan && ev.plan !== 'unknown') r.plan = ev.plan;
    if (ev.kind === 'payment') {
      var id = ev.paymentId || ('p' + ev.at);
      if (!r.payments.some(function (p) { return p.id === id; })) {
        r.payments.push({ id: id, at: ev.at, amount: ev.amount });
      }
    } else if (ev.kind === 'refund') {
      r.refundedAt = r.refundedAt || ev.at;
    }
    return r;
  }

  // ─── Moments humains (jour 30 / jour 60) ──────────────────────────────────
  // Fenêtre « à contacter » : de J-2 à J+5 autour de l'échéance, puis « en
  // retard » tant que ce n'est pas marqué comme fait.
  function humanTouch(startedAt, days, contacted, now) {
    contacted = contacted || {};
    return (days || [30, 60]).map(function (d) {
      var dueAt = startedAt + (d - 1) * DAY;
      var done = contacted['d' + d] || null;
      var st;
      if (done) st = 'done';
      else if (now < dueAt - 2 * DAY) st = 'upcoming';
      else if (now <= dueAt + 5 * DAY) st = 'due';
      else st = 'late';
      return { day: d, dueAt: dueAt, status: st, doneAt: done };
    });
  }


  // ─── Résumé d'un participant pour l'espace admin ──────────────────────────
  // p = { uid, name, email, state, access, contacted }
  function participantSummary(engine, p, now) {
    var st = p.state;
    var acc = summarize(p.access, now);
    if (!st) {
      return { uid: p.uid || null, name: p.name || '', email: p.email, started: false, access: acc };
    }
    var v = engine.view(st, now);
    var validated = engine.content.missions.filter(function (m) { return v.items[m.id].status === 'validated'; });
    var arena = v.currentArena ? engine.arenaById[v.currentArena] : null;
    var lastAt = 0;
    validated.forEach(function (m) { if (v.items[m.id].validatedAt > lastAt) lastAt = v.items[m.id].validatedAt; });
    return {
      uid: p.uid, name: p.name || '', email: p.email, started: true,
      startedAt: st.startedAt, endAt: v.endAt, day: v.day, finished: v.finished,
      progress: v.progress, validatedCount: v.validatedCount, totalCount: v.totalCount,
      currentArena: arena ? (arena.label + ' — ' + arena.name) : (v.finished ? 'Terminé' : '—'),
      next: v.next ? engine.mission(v.next).num + ' ' + engine.mission(v.next).title : null,
      missionsValidated: validated.filter(function (m) { return m.kind !== 'boss'; }).map(function (m) { return m.num; }),
      bossesWon: validated.filter(function (m) { return m.kind === 'boss'; }).map(function (m) { return engine.arenaById[m.arena].name; }),
      habits: v.habits.map(function (h) { return { title: engine.habitById[h.id].title, streak: h.streak }; }),
      rank: v.rank, rewards: v.rewards.map(function (r) { return r.title; }),
      grants: st.grants || [],
      lastActivityAt: lastAt || null,
      touch: humanTouch(st.startedAt, engine.settings.humanTouchDays, p.contacted, now),
      access: acc
    };
  }

  return {
    DAY: DAY,
    participantSummary: participantSummary,
    RETRACTATION_DAYS: RETRACTATION_DAYS,
    emailKey: emailKey,
    summarize: summarize,
    roles: roles,
    normalizeEvent: normalizeEvent,
    applyEvent: applyEvent,
    humanTouch: humanTouch,
    toMs: toMs
  };
});
