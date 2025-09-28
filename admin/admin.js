    // Afficher des skeletons dans le tableau pendant le chargement
    function showLoadingSkeleton(count = 10) {
        const tbody = document.getElementById('tickets-list');
        if (!tbody) return;
        tbody.innerHTML = '';
        const cols = 7;
        for (let i = 0; i < count; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                const bar = document.createElement('div');
                bar.className = 'skeleton-bar';
                td.appendChild(bar);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }

    // Modale d'édition de commande (client + adresses)
    function openEditOrderModal(orderId) {
        if (!authToken) return logout();
        const root = ensureModalRoot();
        root.style.display = 'flex';
        root.innerHTML = '';
        const modal = document.createElement('div');
        modal.className = 'cpf-modal';
        modal.style.maxWidth = '1024px';
        modal.style.width = '95vw';
        modal.style.maxHeight = '90vh';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.innerHTML = `
          <div class="cpf-modal-header">
            <div class="icon"><i class="fas fa-pen"></i></div>
            <div class="cpf-modal-title">Modifier la commande</div>
          </div>
          <div class="cpf-modal-body co-order-modal-body">
            <style>
              .co-order-modal-body { flex: 1; overflow: auto; padding-right: 4px; }
              .co-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
              .co-section { margin-top:10px; }
              .co-section h4 { margin:6px 0; font-size:14px; }
              .co-inline { display:flex; align-items:center; gap:8px; }
              .co-field { display:flex; flex-direction:column; gap:4px; }
              .co-field label { font-size:12px; color:#374151; }
              .co-field input, .co-field select { height:36px; border:1px solid #d1d5db; border-radius:8px; padding:6px 10px; }
              .co-field input:focus, .co-field select:focus { outline:none; border-color:#93c5fd; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
              .quick-date { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
              .quick-date .qd, .quick-date .qd-clear { background:#f9fafb; border:1px solid #d1d5db; border-radius:8px; height:32px; padding:0 8px; cursor:pointer; }
              @media (max-width: 640px) { .co-grid-2 { grid-template-columns: 1fr; } }
            </style>
            <div class="co-section">
              <h4>Coordonnées de facturation</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="ed-bill-name">Nom complet</label><input id="ed-bill-name" type="text" /></div>
                <div class="co-field"><label for="ed-bill-company">Société (optionnel)</label><input id="ed-bill-company" type="text" /></div>
                <div class="co-field"><label for="ed-bill-email">Email</label><input id="ed-bill-email" type="email" /></div>
                <div class="co-field"><label for="ed-bill-phone">Téléphone</label><input id="ed-bill-phone" type="text" /></div>
                <div class="co-field"><label for="ed-bill-address1">Adresse 1</label><input id="ed-bill-address1" type="text" /></div>
                <div class="co-field"><label for="ed-bill-address2">Adresse 2</label><input id="ed-bill-address2" type="text" /></div>
                <div class="co-field"><label for="ed-bill-city">Ville</label><input id="ed-bill-city" type="text" /></div>
                <div class="co-field"><label for="ed-bill-postcode">Code postal</label><input id="ed-bill-postcode" type="text" /></div>
                <div class="co-field"><label for="ed-bill-country">Pays</label><input id="ed-bill-country" type="text" /></div>
              </div>
            </div>
            <div class="co-section">
              <h4>Adresse de livraison</h4>
              <div class="co-inline" style="margin-bottom:6px;">
                <input id="ed-ship-same" type="checkbox" />
                <label for="ed-ship-same">Identique à la facturation</label>
              </div>
              <div class="co-grid-2" id="ed-ship-grid">
                <div class="co-field"><label for="ed-ship-name">Nom complet</label><input id="ed-ship-name" type="text" /></div>
                <div class="co-field"><label for="ed-ship-company">Société (optionnel)</label><input id="ed-ship-company" type="text" /></div>
                <div class="co-field"><label for="ed-ship-phone">Téléphone</label><input id="ed-ship-phone" type="text" /></div>
                <div class="co-field"><label for="ed-ship-address1">Adresse 1</label><input id="ed-ship-address1" type="text" /></div>
                <div class="co-field"><label for="ed-ship-address2">Adresse 2</label><input id="ed-ship-address2" type="text" /></div>
                <div class="co-field"><label for="ed-ship-city">Ville</label><input id="ed-ship-city" type="text" /></div>
                <div class="co-field"><label for="ed-ship-postcode">Code postal</label><input id="ed-ship-postcode" type="text" /></div>
                <div class="co-field"><label for="ed-ship-country">Pays</label><input id="ed-ship-country" type="text" /></div>
              </div>
              <div class="co-field" style="margin-top:6px;">
                <label for="ed-estimated">Livraison estimée (optionnel)</label>
                <div class="co-inline">
                  <input id="ed-estimated" type="date" />
                  <div class="quick-date">
                    <button type="button" class="qd" data-add="0">Aujourd’hui</button>
                    <button type="button" class="qd" data-add="1">+1 j</button>
                    <button type="button" class="qd" data-add="3">+3 j</button>
                    <button type="button" class="qd" data-add="5">+5 j</button>
                    <button type="button" class="qd" data-add="7">+7 j</button>
                    <button type="button" class="qd-clear">Effacer</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="co-section">
              <div class="co-field" style="margin-top:6px;">
                <label for="co-estimated">Livraison estimée (optionnel)</label>
                <input id="co-estimated" type="date" />
              </div>
            </div>
            <div class="co-section">
              <h4>Référence technique</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="co-engine">Cylindrée moteur</label><input id="co-engine" type="text" placeholder="Ex: 1.4" /></div>
                <div class="co-field"><label for="co-tcu">Référence TCU</label><input id="co-tcu" type="text" placeholder="Ex: 0AM927769D" /></div>
              </div>
              <div class="co-inline" style="margin-top:6px;">
                <input id="co-tech-req" type="checkbox" />
                <label for="co-tech-req">Référence requise</label>
              </div>
            </div>
            <div class="co-section">
              <h4>Véhicule</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="co-vin">VIN / Plaque (optionnel)</label><input id="co-vin" type="text" placeholder="Ex: VF3XXXXXXXXXXXXXX ou AB-123-CD" /></div>
              </div>
            </div>
            <div class="co-section">
              <h4>Référence technique</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="ed-engine">Cylindrée moteur</label><input id="ed-engine" type="text" placeholder="Ex: 1.4" /></div>
                <div class="co-field"><label for="ed-tcu">Référence TCU</label><input id="ed-tcu" type="text" placeholder="Ex: 0AM927769D" /></div>
              </div>
              <div class="co-inline" style="margin-top:6px;">
                <input id="ed-tech-req" type="checkbox" />
                <label for="ed-tech-req">Référence requise</label>
              </div>
            </div>
            <div id="ed-error" class="login-error" style="display:none;"></div>
          </div>
          <div class="cpf-modal-actions">
            <button class="cpf-btn" data-action="cancel">Annuler</button>
            <button class="cpf-btn cpf-btn-primary" data-action="confirm">Enregistrer</button>
          </div>
        `;
        const onCleanup = () => { root.style.display = 'none'; root.innerHTML=''; root.removeEventListener('click', onOverlayClick); };
        const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
        root.addEventListener('click', onOverlayClick);
        root.appendChild(modal);

        const errEl = modal.querySelector('#ed-error');
        const vinEl = modal.querySelector('#ed-vin');
        const estEl = modal.querySelector('#ed-estimated');
        const edEngineEl = modal.querySelector('#ed-engine');
        const edTcuEl = modal.querySelector('#ed-tcu');
        const edReqEl = modal.querySelector('#ed-tech-req');
        // Boutons rapides (édition)
        try {
          const setByOffset = (input, days) => {
            if (!input) return;
            const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days);
            input.value = d.toISOString().slice(0,10);
          };
          modal.querySelectorAll('.quick-date .qd').forEach(btn => {
            btn.addEventListener('click', () => {
              const add = parseInt(btn.dataset.add || '0', 10) || 0;
              setByOffset(estEl, add);
            });
          });
          const clearBtn = modal.querySelector('.quick-date .qd-clear');
          if (clearBtn) clearBtn.addEventListener('click', () => { if (estEl) estEl.value = ''; });
        } catch {}
        const shipSame = modal.querySelector('#ed-ship-same');
        const bill = {
            name: modal.querySelector('#ed-bill-name'), company: modal.querySelector('#ed-bill-company'),
            email: modal.querySelector('#ed-bill-email'), phone: modal.querySelector('#ed-bill-phone'),
            address1: modal.querySelector('#ed-bill-address1'), address2: modal.querySelector('#ed-bill-address2'),
            city: modal.querySelector('#ed-bill-city'), postcode: modal.querySelector('#ed-bill-postcode'), country: modal.querySelector('#ed-bill-country')
        };
        const ship = {
            name: modal.querySelector('#ed-ship-name'), company: modal.querySelector('#ed-ship-company'), phone: modal.querySelector('#ed-ship-phone'),
            address1: modal.querySelector('#ed-ship-address1'), address2: modal.querySelector('#ed-ship-address2'),
            city: modal.querySelector('#ed-ship-city'), postcode: modal.querySelector('#ed-ship-postcode'), country: modal.querySelector('#ed-ship-country')
        };
        function copyBillToShipEd() { Object.keys(ship).forEach(k => { if (bill[k]) ship[k].value = bill[k].value || ''; }); }
        function setShipDisabledEd(disabled) { Object.values(ship).forEach(el => { el.disabled = disabled; el.closest('.co-field').style.opacity = disabled ? 0.6 : 1; }); }

        // Pré-remplir depuis la commande
        fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { headers: { 'Authorization': `Basic ${authToken}` } })
          .then(r => r.json()).then(d => {
            if (!d || !d.success || !d.order) return;
            const o = d.order;
            // Billing/customer
            bill.name.value = (o.customer?.name || o.billing?.address?.name || '')
            bill.company.value = (o.billing?.address?.company || '')
            bill.email.value = (o.customer?.email || '')
            bill.phone.value = (o.customer?.phone || '')
            bill.address1.value = (o.billing?.address?.address1 || '')
            bill.address2.value = (o.billing?.address?.address2 || '')
            bill.city.value = (o.billing?.address?.city || '')
            bill.postcode.value = (o.billing?.address?.postcode || '')
            bill.country.value = (o.billing?.address?.country || '')
            // VIN / Plaque
            if (vinEl) vinEl.value = (o.meta && o.meta.vinOrPlate) ? String(o.meta.vinOrPlate) : '';
            // Référence technique
            try {
              if (edEngineEl) edEngineEl.value = (o.meta && o.meta.engineDisplacement) ? String(o.meta.engineDisplacement) : '';
              if (edTcuEl) edTcuEl.value = (o.meta && o.meta.tcuReference) ? String(o.meta.tcuReference) : '';
              if (edReqEl) edReqEl.checked = !!(o.meta && o.meta.technicalRefRequired);
            } catch {}
            // Livraison estimée
            try {
              if (estEl && o.shipping && o.shipping.estimatedDeliveryAt) {
                const d = new Date(o.shipping.estimatedDeliveryAt);
                if (!isNaN(d.getTime())) estEl.value = d.toISOString().slice(0,10);
              }
            } catch {}
            // Shipping
            const same = !o.shipping?.address || (
              (o.shipping.address.address1||'') === (o.billing?.address?.address1||'') &&
              (o.shipping.address.city||'') === (o.billing?.address?.city||'') &&
              (o.shipping.address.postcode||'') === (o.billing?.address?.postcode||'') &&
              (o.shipping.address.country||'') === (o.billing?.address?.country||'')
            );
            shipSame.checked = same;
            if (same) {
              copyBillToShipEd();
              setShipDisabledEd(true);
            } else {
              ship.name.value = (o.shipping?.address?.name || o.customer?.name || '')
              ship.company.value = (o.shipping?.address?.company || '')
              ship.phone.value = (o.shipping?.address?.phone || '')
              ship.address1.value = (o.shipping?.address?.address1 || '')
              ship.address2.value = (o.shipping?.address?.address2 || '')
              ship.city.value = (o.shipping?.address?.city || '')
              ship.postcode.value = (o.shipping?.address?.postcode || '')
              ship.country.value = (o.shipping?.address?.country || '')
              setShipDisabledEd(false);
            }
          }).catch(() => {});

        if (shipSame) {
          shipSame.addEventListener('change', () => {
            const same = !!shipSame.checked;
            if (same) copyBillToShipEd();
            setShipDisabledEd(same);
          });
          Object.values(bill).forEach(el => el.addEventListener('input', () => { if (shipSame.checked) copyBillToShipEd(); }));
        }

        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        cancelBtn.addEventListener('click', onCleanup);
        confirmBtn.addEventListener('click', async () => {
          try {
            errEl.style.display = 'none'; errEl.textContent = '';
            const emailVal = (bill.email?.value || '').trim();
            if (!emailVal) { errEl.textContent = 'Email client requis'; errEl.style.display = 'block'; return; }
            confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement…';
            const payload = {
              customer: { name: (bill.name?.value || '').trim(), email: emailVal, phone: (bill.phone?.value || '').trim() },
              billing: { address: {
                name: (bill.name?.value || '').trim(), company: (bill.company?.value || '').trim(),
                address1: (bill.address1?.value || '').trim(), address2: (bill.address2?.value || '').trim(),
                city: (bill.city?.value || '').trim(), postcode: (bill.postcode?.value || '').trim(), country: (bill.country?.value || '').trim()
              } },
              shipping: { address: {
                name: (ship.name?.value || '').trim(), company: (ship.company?.value || '').trim(), phone: (ship.phone?.value || '').trim(),
                address1: (ship.address1?.value || '').trim(), address2: (ship.address2?.value || '').trim(),
                city: (ship.city?.value || '').trim(), postcode: (ship.postcode?.value || '').trim(), country: (ship.country?.value || '').trim()
              } },
              meta: { vinOrPlate: (vinEl?.value || '').trim() }
            };
            // Ajouter la date estimée si fournie
            const estVal = (estEl?.value || '').trim();
            if (estVal) payload.shipping.estimatedDeliveryAt = estVal;
            // Ajouter Référence technique
            const engVal = (edEngineEl?.value || '').trim();
            const tcuVal = (edTcuEl?.value || '').trim();
            const reqVal = !!(edReqEl?.checked);
            payload.meta = payload.meta || {};
            payload.meta.engineDisplacement = engVal;
            payload.meta.tcuReference = tcuVal;
            payload.meta.technicalRefRequired = reqVal;
            const r = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
              method: 'PUT',
              headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success) throw new Error(d.message || 'Échec de la mise à jour');
            onCleanup();
            showToast('Commande mise à jour', 'success');
            await loadOrdersList(1);
            try { if (d.order && d.order._id) setTimeout(() => openOrderDetails(d.order._id), 150); } catch(_) {}
          } catch (e) {
            errEl.textContent = e.message || 'Erreur de mise à jour';
            errEl.style.display = 'block';
          } finally {
            confirmBtn.disabled = false; confirmBtn.innerHTML = 'Enregistrer';
          }
        });
    }

    // ================= Notifications (In‑app) =================
    let notifPollIntervalId = null;
    let lastRenderedNotifIds = new Set();
    // Références globales des éléments UI de notifications, initialisées dans initAdminApp()
    let notifBtn, notifBadge, notifDropdown, notifList, notifEmpty, notifMarkAll;

    function updateNotifBadge(unread) {
        if (!notifBadge) return;
        if (unread && unread > 0) {
            notifBadge.textContent = String(unread);
            notifBadge.classList.add('is-visible');
            notifBadge.setAttribute('aria-label', `${unread} notification(s) non lue(s)`);
        } else {
            notifBadge.textContent = '';
            notifBadge.classList.remove('is-visible');
            notifBadge.removeAttribute('aria-label');
        }
    }

    function iconForType(t) {
        if (t === 'assignment') return 'fa-user-check';
        if (t === 'assistance') return 'fa-life-ring';
        if (t === 'escalation') return 'fa-exclamation-triangle';
        return 'fa-bell';
    }

    async function fetchNotifications(limit = 20) {
        if (!authToken) return { notifications: [], unreadCount: 0 };
        const url = `/api/admin/notifications?limit=${encodeURIComponent(limit)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Basic ${authToken}` } });
        if (!res.ok) {
            if (res.status === 401) logout();
            return { notifications: [], unreadCount: 0 };
        }
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.notifications) ? data.notifications : [];
        const unread = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
        return { notifications: list, unreadCount: unread };
    }

    async function markNotificationsRead({ ids = [], all = false } = {}) {
        if (!authToken) return { success: false };
        const res = await fetch('/api/admin/notifications/mark-read', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, all })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401) logout();
            return { success: false, unreadCount: 0 };
        }
        return { success: !!data.success, unreadCount: data.unreadCount || 0 };
    }

    function renderNotifications(notifs, unreadCount) {
        updateNotifBadge(unreadCount);
        if (!notifList || !notifEmpty) return;
        notifList.innerHTML = '';
        if (!Array.isArray(notifs) || notifs.length === 0) {
            notifEmpty.hidden = false;
            return;
        }
        notifEmpty.hidden = true;
        const frag = document.createDocumentFragment();
        lastRenderedNotifIds = new Set();
        for (const n of notifs) {
            if (!n || !n._id) continue;
            lastRenderedNotifIds.add(n._id);
            const li = document.createElement('div');
            li.className = 'notif-item' + (!n.isRead ? ' unread' : '');
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            const createdAt = n.createdAt ? new Date(n.createdAt) : null;
            const when = createdAt ? createdAt.toLocaleString('fr-FR') : '';
            const icon = iconForType(n.type);
            const title = n.title || 'Notification';
            const msg = n.message || '';
            li.innerHTML = `
                <div class="icon"><i class="fas ${icon}"></i></div>
                <div class="content">
                  <div class="title">${title}</div>
                  <div class="message">${msg}</div>
                  <div class="meta">${when}</div>
                </div>
                <div class="actions">
                  ${n.isRead ? '' : '<button class="link-btn" data-action="mark">Marquer comme lu</button>'}
                </div>
            `;
            // Ouvrir le ticket lié au clic
            li.addEventListener('click', async () => {
                try {
                    if (n.ticketId) viewTicket(n.ticketId);
                    if (!n.isRead) {
                        const r = await markNotificationsRead({ ids: [n._id] });
                        if (r && r.success) updateNotifBadge(r.unreadCount);
                    }
                } catch (_) {}
            });
            // Accessibilité clavier
            li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
            // Action "marquer comme lu" sans ouvrir
            const mk = li.querySelector('[data-action="mark"]');
            if (mk) {
                mk.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const r = await markNotificationsRead({ ids: [n._id] });
                        if (r && r.success) {
                            li.classList.remove('unread');
                            updateNotifBadge(r.unreadCount);
                        }
                    } catch (_) {}
                });
            }
            frag.appendChild(li);
        }
        notifList.appendChild(frag);
    }

    async function refreshNotificationsUI() {
        const { notifications, unreadCount } = await fetchNotifications(20);
        renderNotifications(notifications, unreadCount);
    }

    function openNotifDropdown() {
        if (!notifDropdown) return;
        notifDropdown.hidden = false;
        document.addEventListener('click', outsideCloseHandler, { capture: true });
        document.addEventListener('keydown', escCloseHandler);
        // rafraîchir le contenu à l'ouverture
        refreshNotificationsUI();
    }
    function closeNotifDropdown() {
        if (!notifDropdown) return;
        notifDropdown.hidden = true;
        document.removeEventListener('click', outsideCloseHandler, { capture: true });
        document.removeEventListener('keydown', escCloseHandler);
    }
    function outsideCloseHandler(e) {
        if (!notifDropdown || !notifBtn) return;
        const t = e.target;
        if (!notifDropdown.contains(t) && !notifBtn.contains(t)) {
            closeNotifDropdown();
        }
    }
    function escCloseHandler(e) {
        if (e.key === 'Escape') closeNotifDropdown();
    }

    // (écouteurs de notifications attachés plus bas, après les déclarations des éléments)

    window.startNotificationsPolling = function() {
        if (notifPollIntervalId) return;
        // première récupération immédiate
        refreshNotificationsUI();
        notifPollIntervalId = setInterval(refreshNotificationsUI, 30000);
    };
    window.stopNotificationsPolling = function() {
        if (notifPollIntervalId) {
            clearInterval(notifPollIntervalId);
            notifPollIntervalId = null;
        }
    };
// Rendre certaines variables et fonctions accessibles globalement pour kanban.js
window.authToken = localStorage.getItem('authToken');

// Traduction des types de pièces (globale)
window.partTypeTranslations = {
    'boite_vitesses': 'Boîte de vitesses',
    'moteur': 'Moteur',
    'mecatronique': 'Mécatronique',
    'boite_transfert': 'Boîte de transfert',
    'pont': 'Pont',
    'autres': 'Autres pièces'
};

// Prévisualisation des résultats (sécurisée).
// Sert actuellement à rafraîchir les compteurs de filtres rapides sans requête API.
window.previewFilterResults = function() {
    try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
};

// Traductions des statuts (globale)
window.statusTranslations = {
    'nouveau': 'Nouveau',
    'en_analyse': 'En analyse',
    'info_complementaire': 'Info complémentaire',
    'validé': 'Validé',
    'refusé': 'Refusé',
    'en_cours_traitement': 'En traitement',
    'expédié': 'Expédié',
    'clôturé': 'Clôturé'
};

// Traductions des priorités (globale)
window.priorityTranslations = {
    'urgent': 'Urgent',
    'élevé': 'Élevé',
    'moyen': 'Moyen',
    'faible': 'Faible'
};

// Fonction pour formater une date (globale)
window.formatDate = function(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
};

// Fonction pour supprimer un ticket (globale)
window.deleteTicket = async function(ticketId, ticketNumber, event) {
    // Si l'événement est fourni, empêcher le comportement par défaut
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        console.log('Suppression du ticket:', ticketId, ticketNumber);
        
        // Vérifier que l'ID du ticket est valide
        if (!ticketId) {
            throw new Error('ID du ticket manquant');
        }
        
        // Demander confirmation avant de supprimer
        const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer le ticket ${ticketNumber} ? Cette action est irréversible.`);
        
        if (!confirmed) {
            return false; // Annuler si l'utilisateur n'a pas confirmé
        }
        
        console.log('Envoi de la requête DELETE pour le ticket:', ticketId);
        
        // Utiliser une URL relative qui fonctionnera sur n'importe quel domaine
        const deleteUrl = `/api/admin/tickets/${ticketId}`;
        console.log('URL de suppression (relative):', deleteUrl);
        
        try {
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Content-Type': 'application/json'
                },
                // Ajouter des options pour s'assurer que les cookies sont envoyés
                credentials: 'same-origin'
            });
            
            console.log('Statut de la réponse:', response.status);
            
            // Gérer les réponses non-JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Réponse non-JSON reçue:', text);
                throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Cas spécifique pour les tickets non trouvés
                    showNotification('error', `Le ticket ${ticketNumber} n'existe plus dans la base de données. La page va être rechargée.`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    return false;
                } else if (response.status === 401) {
                    throw new Error('Accès non autorisé. Veuillez vous reconnecter.');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la suppression du ticket');
                }
            }
        } catch (fetchError) {
            console.error('Erreur lors de la requête fetch:', fetchError);
            console.error('Message d\'erreur:', fetchError.message);
            console.error('Stack trace:', fetchError.stack);
            
            if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
                showNotification('error', 'Erreur de connexion au serveur. Vérifiez que le serveur est en cours d\'exécution sur le port 3000.');
                throw new Error('Erreur de connexion au serveur');
            }
            
            // Afficher une notification avec le message d'erreur
            showNotification('error', `Erreur: ${fetchError.message || 'Erreur inconnue lors de la suppression'}`);
            throw fetchError;
        }
        
        // Afficher une notification de succès
        window.showNotification(`Le ticket ${ticketNumber} a été supprimé avec succès`, 'success');
        
        // Éviter tout rechargement automatique de la page
        
        // Vérifier quelle vue est actuellement active
        const isKanbanActive = document.getElementById('kanban-view') && 
                            window.getComputedStyle(document.getElementById('kanban-view')).display !== 'none';
        const isListActive = document.getElementById('list-view') && 
                          window.getComputedStyle(document.getElementById('list-view')).display !== 'none';
        
        console.log('Vue active:', isKanbanActive ? 'Kanban' : (isListActive ? 'Liste' : 'Inconnue'));
        
        // Si nous sommes dans la vue Kanban, rafraîchir la vue
        if (isKanbanActive) {
            console.log('Vue Kanban détectée, rafraîchissement...');
            if (typeof refreshKanbanView === 'function') {
                refreshKanbanView();
            }
        } else {
            console.log('Vue liste détectée, suppression de la ligne...');
            console.log('ID du ticket à supprimer:', ticketId);
            
            // Afficher toutes les lignes de tickets disponibles pour débogage
            const allRows = document.querySelectorAll('tr.ticket-row');
            console.log('Nombre total de lignes de tickets:', allRows.length);
            allRows.forEach(row => {
                console.log('Ligne trouvée avec ID:', row.getAttribute('data-ticket-id'), 
                          'Contenu:', row.textContent.substring(0, 30) + '...');
            });
            
            // Trouver la ligne du ticket dans le tableau (plusieurs sélecteurs possibles)
            let ticketRow = document.querySelector(`tr[data-ticket-id="${ticketId}"]`);
            console.log('Résultat de recherche avec tr[data-ticket-id]:', ticketRow);
            
            if (!ticketRow) {
                ticketRow = document.querySelector(`.ticket-row[data-id="${ticketId}"]`);
                console.log('Résultat de recherche avec .ticket-row[data-id]:', ticketRow);
            }
            
            if (!ticketRow) {
                console.log('Recherche par contenu textuel...');
                // Essayer de trouver par le numéro de ticket
                const rows = document.querySelectorAll('tr');
                for (const row of rows) {
                    if (row.textContent.includes(ticketNumber)) {
                        ticketRow = row;
                        console.log('Ligne trouvée par contenu textuel:', row);
                        break;
                    }
                }
            }
            
            if (ticketRow) {
                console.log('Ligne de ticket trouvée:', ticketRow);
                // Désactiver tous les boutons d'action dans cette ligne
                const actionButtons = ticketRow.querySelectorAll('button');
                actionButtons.forEach(button => {
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                });
                
                // Animation de suppression
                ticketRow.style.transition = 'all 0.5s ease';
                ticketRow.style.backgroundColor = '#ffcccc';
                
                setTimeout(() => {
                    ticketRow.style.opacity = '0';
                    ticketRow.style.height = '0';
                    ticketRow.style.overflow = 'hidden';
                    
                    setTimeout(() => {
                        ticketRow.remove();
                        // Mettre à jour les compteurs
                        if (typeof updateTicketCounters === 'function') {
                            updateTicketCounters();
                        }
                    }, 500);
                }, 300);
            } else {
                console.log('Ligne du ticket non trouvée dans le DOM');
            }
        }
        
    } catch (error) {
        console.error('Erreur lors de la suppression du ticket:', error);
        console.error('Message d\'erreur:', error.message);
        console.error('Stack trace:', error.stack);
        showNotification('error', `Erreur lors de la suppression du ticket ${ticketNumber}: ${error.message || 'Erreur inconnue'}`);
        if (error.message === 'Unauthorized') {
            logout();
        }
        return false;
    }
    
    // Succès
    return true;
};

// Fonction auxiliaire pour mettre à jour les compteurs de tickets
window.updateTicketCounters = function() {
    // Récupérer tous les tickets actuellement affichés
    const tickets = document.querySelectorAll('.ticket-row');
    
    // Compteurs
    let pendingCount = 0;
    let resolvedCount = 0;
    let urgentCount = 0;
    
    // Analyser chaque ticket
    tickets.forEach(ticket => {
        const status = ticket.getAttribute('data-status');
        const normPriority = ticket.getAttribute('data-priority');

        // Groupes de statuts (alignés avec loadStats)
        const pendingStatuses = ['nouveau', 'en_analyse', 'info_complementaire', 'en_cours_traitement'];
        const resolvedStatuses = ['validé', 'expédié', 'clôturé', 'refusé'];

        if (resolvedStatuses.includes(status)) {
            resolvedCount++;
        } else {
            // Tout ce qui n'est pas dans "résolus" est considéré comme en attente côté liste
            pendingCount++;
        }

        // Urgent uniquement basé sur la priorité normalisée
        if (normPriority === 'urgent') urgentCount++;
    });
    
    // Mettre à jour les compteurs dans l'interface
    const pendingElement = document.getElementById('pending-tickets');
    const resolvedElement = document.getElementById('resolved-tickets');
    const urgentElement = document.getElementById('urgent-tickets');

    if (pendingElement) pendingElement.textContent = pendingCount;
    if (resolvedElement) resolvedElement.textContent = resolvedCount;
    // Mettre à jour le compteur Urgent pour qu'il varie comme les autres, selon les filtres affichés
    if (urgentElement) urgentElement.textContent = urgentCount;
};

// Met à jour les compteurs sur les filtres rapides (barre au-dessus de la liste)
window.updateQuickFilterCounts = function() {
    try {
        const btnAwaiting = document.getElementById('qf-awaiting');
        const btnUrgent = document.getElementById('qf-urgent');
        // Si la barre n'est pas présente, ne rien faire
        if (!btnAwaiting && !btnUrgent) return;

        const rows = Array.from(document.querySelectorAll('tr.ticket-row'));
        const updatesMap = (window.__clientUpdatesMap instanceof Map) ? window.__clientUpdatesMap : null;

        let awaitingCount = 0;
        let urgentCount = 0;

        for (const row of rows) {
            const id = row.getAttribute('data-ticket-id');
            const priority = row.getAttribute('data-priority');
            if (updatesMap && id && updatesMap.has(id)) awaitingCount++;
            if (priority === 'urgent') urgentCount++;
        }

        if (btnAwaiting) {
            const base = '<i class="fas fa-comment-dots"></i> En attente réponse';
            btnAwaiting.innerHTML = base; // Ne plus afficher de compteur pour éviter la confusion
        }
        if (btnUrgent) {
            const base = '<i class="fas fa-bolt"></i> Priorité urgente';
            btnUrgent.innerHTML = base; // Ne plus afficher de compteur pour éviter la confusion
        }
    } catch (_) { /* noop */ }
};

// Fonction pour afficher les détails d'un ticket (globale)
window.viewTicket = async function(ticketId) {
    try {
        window.currentTicketId = ticketId;
        
        // Récupérer les détails du ticket
        const response = await fetch(`/api/admin/tickets/${ticketId}`, {
            headers: {
                'Authorization': `Basic ${window.authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error('Erreur lors de la récupération des détails du ticket');
        }
        
        const data = await response.json();
        const ticket = (data && typeof data === 'object' && 'ticket' in data) ? data.ticket : data;
        const statusHistory = (data && typeof data === 'object' && Array.isArray(data.statusHistory)) ? data.statusHistory : undefined;
        
        // Masquer la liste des tickets et afficher les détails
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('ticket-details').style.display = 'block';
        
        // Remplir les détails du ticket (et l'historique si présent)
        window.displayTicketDetails(ticket, statusHistory);
        
    } catch (error) {
        console.error('Erreur lors de la récupération des détails du ticket:', error);
        if (error.message === 'Unauthorized') {
            logout();
        }
        window.showNotification('Erreur lors de la récupération des détails du ticket', 'error');
    }
};

// Fonction pour afficher les détails d'un ticket (globale)
window.displayTicketDetails = function(ticket, statusHistory) {
    // Mettre à jour le fil d'Ariane
    document.getElementById('breadcrumb-ticket-number').textContent = ticket.ticketNumber;
    
    // Informations générales
    document.getElementById('detail-ticket-number').textContent = ticket.ticketNumber;
    
    // Afficher la priorité actuelle
    console.log('Mise à jour de la priorité');
    const priorityElement = document.getElementById('detail-ticket-priority');
    const currentPriorityElement = document.getElementById('detail-ticket-current-priority');
    
    // Débuggage détaillé
    console.log('Détails du ticket pour la priorité:', ticket);
    console.log('Elément priorité trouvé dans le DOM:', priorityElement ? 'Oui' : 'Non');
    console.log('Elément priorité caché trouvé dans le DOM:', currentPriorityElement ? 'Oui' : 'Non');
    
    // Définir une priorité à utiliser (depuis le ticket ou par défaut)
    const ticketPriority = ticket.priority || 'moyen';
    console.log('Priorité du ticket utilisée:', ticketPriority);
    
    // Mettre à jour l'élément d'affichage de la priorité
    if (priorityElement) {
        const priorityText = window.priorityTranslations[ticketPriority] || ticketPriority;
        priorityElement.textContent = `Priorité: ${priorityText}`;
        priorityElement.className = `priority-badge priority-${ticketPriority}`;
        priorityElement.style.display = 'inline-block';
    } else {
        console.error('L\'\u00e9lément priorité est introuvable dans le DOM');
    }
    
    // Dictionnaire de traduction des priorités
    const priorityTranslations = {
        'eleve': 'Élevée',
        'moyen': 'Moyenne',
        'faible': 'Faible'
    };
    
    // Stocker la priorité actuelle dans l'élément caché et mettre à jour l'indicateur visible
    if (currentPriorityElement) {
        currentPriorityElement.textContent = ticketPriority;
        currentPriorityElement.setAttribute('data-priority', ticketPriority);
        console.log('Priorité actuelle stockée dans l\'\u00e9lément caché:', ticketPriority);
        console.log('Vérification de l\'attribut data-priority:', currentPriorityElement.getAttribute('data-priority'));
    } else {
        console.error('L\'\u00e9lément caché pour la priorité est introuvable');
    }
    
    // Mise à jour de l'indicateur visible de priorité (qu'on ait trouvé l'élément caché ou non)
    const visiblePriorityElement = document.getElementById('visible-current-priority');
    if (visiblePriorityElement) {
        const priorityText = priorityTranslations[ticketPriority] || ticketPriority;
        visiblePriorityElement.textContent = priorityText;
        visiblePriorityElement.className = `priority-${ticketPriority}`;
        console.log('Indicateur de priorité visible mis à jour avec:', priorityText);
    } else {
        console.error('L\'\u00e9lément visible-current-priority n\'existe pas dans le DOM');
    }
    
    // Stocker le statut actuel du ticket dans l'élément invisible et mettre à jour l'indicateur visible
    const statusElement = document.getElementById('detail-ticket-status');
    const visibleStatusElement = document.getElementById('visible-current-status');
    
    // Dictionnaire de traduction des statuts
    const statusTranslations = {
        'nouveau': 'Nouveau',
        'en_cours': 'En cours de traitement',
        'en_attente_client': 'En attente du client',
        'en_attente_fournisseur': 'En attente du fournisseur',
        'resolu': 'Résolu',
        'ferme': 'Fermé',
        'info_complementaire': 'Informations complémentaires requises'
    };
    
    // Déduire un statut effectif si currentStatus manque
    let effectiveStatus = ticket && ticket.currentStatus ? ticket.currentStatus : null;
    if (!effectiveStatus && Array.isArray(statusHistory) && statusHistory.length > 0) {
        try {
            const sorted = [...statusHistory].sort((a, b) => new Date(a.updatedAt || a.date || 0) - new Date(b.updatedAt || b.date || 0));
            const last = sorted[sorted.length - 1] || {};
            effectiveStatus = last.status || last.value || null;
        } catch (_) { /* noop */ }
    }
    console.log('Mise à jour du statut visible (effectif):', effectiveStatus);
    
    if (statusElement) {
        // Vérifions que currentStatus existe et n'est pas vide
        if (effectiveStatus) {
            const translatedStatus = statusTranslations[effectiveStatus] || effectiveStatus;
            statusElement.textContent = translatedStatus;
            statusElement.setAttribute('data-status', effectiveStatus);
            console.log('Statut actuel stocké dans l\'élément:', effectiveStatus);
            console.log('Statut traduit:', translatedStatus);
            
            // Mise à jour de l'indicateur visible
            if (visibleStatusElement) {
                visibleStatusElement.textContent = translatedStatus;
                visibleStatusElement.className = `status-${effectiveStatus}`;
                console.log('Indicateur de statut visible mis à jour avec:', translatedStatus);
            } else {
                console.error('L\'élément visible-current-status n\'existe pas dans le DOM');
            }
        } else {
            console.error('Le ticket n\'a pas de currentStatus valide (même après repli):', ticket);
            if (visibleStatusElement) {
                visibleStatusElement.textContent = 'Non défini';
            }
        }
    } else {
        console.error('L\'élément detail-ticket-status n\'existe pas dans le DOM');
    }
    
    // Informations client
    document.getElementById('detail-client-name').textContent = `${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}`;
    document.getElementById('detail-client-email').textContent = ticket.clientInfo.email;
    document.getElementById('detail-client-phone').textContent = ticket.clientInfo.phone;
    document.getElementById('detail-order-number').textContent = ticket.orderInfo.orderNumber;
    
    // Informations véhicule
    document.getElementById('detail-vehicle-vin').textContent = ticket.vehicleInfo.vin || 'Non spécifié';
    document.getElementById('detail-installation-date').textContent = ticket.vehicleInfo.installationDate ? formatDate(ticket.vehicleInfo.installationDate) : 'Non spécifié';
    
    // Informations pièce et problème
    document.getElementById('detail-part-type').textContent = partTypeTranslations[ticket.partInfo.partType] || ticket.partInfo.partType;
    document.getElementById('detail-symptom').textContent = ticket.partInfo.symptom || 'Non spécifié';
    document.getElementById('detail-failure-time').textContent = ticket.partInfo.failureTime || 'Non spécifié';
    document.getElementById('detail-error-codes').textContent = ticket.partInfo.errorCodes || 'Non spécifié';
    document.getElementById('detail-pro-installation').textContent = ticket.partInfo.professionalInstallation ? 'Oui' : 'Non';
    document.getElementById('detail-oil-filled').textContent = ticket.partInfo.oilFilled ? 'Oui' : 'Non';
    document.getElementById('detail-oil-quantity').textContent = ticket.partInfo.oilQuantity ? `${ticket.partInfo.oilQuantity} L` : 'Non spécifié';
    document.getElementById('detail-oil-reference').textContent = ticket.partInfo.oilReference || 'Non spécifié';
    document.getElementById('detail-new-parts').textContent = ticket.partInfo.newParts ? 'Oui' : 'Non';
    document.getElementById('detail-parts-details').textContent = ticket.partInfo.newPartsDetails || 'Non spécifié';
    
    // Notes internes
    document.getElementById('internal-notes').value = ticket.internalNotes || '';
    

    // Aide contextuelle désactivée
};

// Fonction de notification (globale)
window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    // Inline styles to ensure visibility above fixed header and without external CSS
    const baseBg = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#0ea5e9';
    notification.style.cssText = `
        position: fixed;
        top: 84px; /* below header */
        right: 20px;
        background: ${baseBg};
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        z-index: 5000;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity .2s ease, transform .2s ease;
        cursor: default;
        max-width: 70vw;
    `;
    document.body.appendChild(notification);
    // animate in
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });
    // animate out
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-8px)';
        setTimeout(() => notification.remove(), 250);
    }, 3000);
};

// (contextual help removed)

// --- Client response polling & UI feedback ---
(function setupClientUpdatesSystem() {
    // Global storage for unseen client updates
    window.__clientUpdatesMap = window.__clientUpdatesMap || new Map(); // ticketId -> lastUpdate ISO
    // Helpers to persist/restore the map across reloads
    function saveClientUpdatesCache() {
        try {
            if (!(window.__clientUpdatesMap instanceof Map)) return;
            const obj = Object.fromEntries(window.__clientUpdatesMap.entries());
            localStorage.setItem('__clientUpdatesCache', JSON.stringify(obj));
        } catch (_) { /* noop */ }
    }
    (function loadClientUpdatesCache() {
        try {
            const raw = localStorage.getItem('__clientUpdatesCache');
            if (!raw) return;
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') {
                window.__clientUpdatesMap = new Map(Object.entries(obj));
                try { if (typeof window.refreshClientUpdatesBadge === 'function') window.refreshClientUpdatesBadge(); } catch (_) {}
            }
        } catch (_) { /* noop */ }
    })();
    let pollIntervalId = null;
    let lastPollAt = null;
    let lastAwaitingFetchAt = 0;

    // Ensure a simple badge exists on the Tickets tab
    function ensureTicketsBadge() {
        const tabLink = document.querySelector('a[href="#tickets"]');
        if (!tabLink) return null;
        let badge = tabLink.querySelector('.tickets-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'tickets-badge';
            tabLink.appendChild(badge);
        }
        return badge;
    }

    function updateBadge() {
        const badge = ensureTicketsBadge();
        if (!badge) return;
        const count = window.__clientUpdatesMap.size;
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.add('is-visible');
            badge.setAttribute('aria-label', `${count} mise(s) à jour client`);
        } else {
            badge.textContent = '';
            badge.classList.remove('is-visible');
            badge.removeAttribute('aria-label');
        }
    }

    // Expose a global helper to refresh the badge when map is seeded externally
    window.refreshClientUpdatesBadge = function() {
        try { updateBadge(); } catch (_) {}
    };

    // Highlight a ticket row in the list
    function highlightRow(ticketId) {
        const row = document.querySelector(`tr.ticket-row[data-ticket-id="${ticketId}"]`);
        if (row) {
            row.classList.add('client-updated');
            // Ajouter un badge visuel dans la première cellule (N° ticket)
            const firstCell = row.querySelector('td:first-child');
            if (firstCell && !firstCell.querySelector('.client-replied-badge')) {
                const badge = document.createElement('span');
                badge.className = 'client-replied-badge';
                badge.textContent = 'Réponse client';
                firstCell.appendChild(badge);
            }
        }
    }

    // Inject minimal CSS for highlight if not present
    (function ensureHighlightStyle() {
        let style = document.getElementById('client-updated-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'client-updated-style';
            document.head.appendChild(style);
        }
        style.textContent = `.client-updated{background:#fffbe6 !important;}
        .client-updated td:first-child{position:relative}
        .client-updated td:first-child:after{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:#1e90ff;border-radius:2px}
        .client-replied-badge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:12px;line-height:1;background:#e6f2ff;color:#0b64d1;border:1px solid #bcdcff}
        .overdue-awaiting{background:#fff0f0 !important;}
        .overdue-awaiting td:first-child{position:relative}
        .overdue-awaiting td:first-child:after{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:#e74c3c;border-radius:2px}
        .overdue-badge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:12px;line-height:1;background:#fdecea;color:#b21f2d;border:1px solid #f5c6cb}
        .overdue-badge i{margin-right:6px}`;
    })();

    // Play a short ping sound (Web Audio API)
    function playPing() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(880, ctx.currentTime);
            g.gain.setValueAtTime(0.001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            o.connect(g).connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.25);
        } catch (e) {
            // ignore audio errors
        }
    }

    function maybeShowBrowserNotification(payload) {
        try {
            if (!('Notification' in window)) return;
            const body = `Client: ${payload.clientFirstName || ''} ${payload.clientLastName || ''} • ${payload.comment || ''}`.trim();
            const title = `Réponse client sur ${payload.ticketNumber}`;
            const show = () => {
                const n = new Notification(title, { body });
                n.onclick = () => {
                    window.focus();
                    if (payload.ticketId) {
                        viewTicket(payload.ticketId);
                    }
                    n.close();
                };
            };
            if (Notification.permission === 'granted') {
                show();
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => { if (p === 'granted') show(); });
            }
        } catch (_) { /* noop */ }
    }

    // Sync: rafraîchir la liste des tickets en attente de réponse agent depuis le backend
    async function syncAwaitingFromBackend() {
        try {
            if (!window.authToken) return;
            const res = await fetch('/api/admin/tickets/awaiting-agent-response', {
                headers: { 'Authorization': `Basic ${window.authToken}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const list = Array.isArray(data.awaiting) ? data.awaiting : [];
            if (!window.__clientUpdatesMap || !(window.__clientUpdatesMap instanceof Map)) {
                window.__clientUpdatesMap = new Map();
            }
            const ids = new Set(list.map(it => String(it.ticketId)));
            let changed = false;
            // Supprimer les entrées qui ne sont plus "en attente"
            try {
                for (const [id] of window.__clientUpdatesMap.entries()) {
                    if (!ids.has(String(id))) {
                        window.__clientUpdatesMap.delete(id);
                        changed = true;
                    }
                }
            } catch (_) {}
            // Fusionner/mettre à jour les timestamps depuis le backend
            for (const item of list) {
                if (!item || !item.ticketId) continue;
                const prev = window.__clientUpdatesMap.get(item.ticketId);
                const newStamp = item.updatedAt || new Date().toISOString();
                const prevTime = prev ? new Date(prev).getTime() : 0;
                const newTime = new Date(newStamp).getTime();
                if (!prev || newTime > prevTime) {
                    window.__clientUpdatesMap.set(item.ticketId, newStamp);
                    changed = true;
                }
            }
            if (changed) {
                updateBadge();
                try { saveClientUpdatesCache(); } catch (_) {}
                try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
                try { if (typeof window.updateOverdueBadgesForVisibleRows === 'function') window.updateOverdueBadgesForVisibleRows(); } catch (_) {}
            }
        } catch (_) { /* noop */ }
    }

    // Public: acknowledge a ticket (called when opening the ticket)
    window.acknowledgeClientUpdate = function(ticketId) {
        if (window.__clientUpdatesMap.has(ticketId)) {
            window.__clientUpdatesMap.delete(ticketId);
            try { saveClientUpdatesCache(); } catch (_) {}
            updateBadge();
            try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
            const row = document.querySelector(`tr.ticket-row[data-ticket-id="${ticketId}"]`);
            if (row) {
                row.classList.remove('client-updated');
                const badgeEl = row.querySelector('.client-replied-badge');
                if (badgeEl) badgeEl.remove();
                // Retirer également l'alerte >24h si présente
                row.classList.remove('overdue-awaiting');
                const overdueEl = row.querySelector('.overdue-badge');
                if (overdueEl) overdueEl.remove();
            }
        }
    };

    // Recalcule et applique/retire les badges "+24h" pour toutes les lignes visibles
    window.updateOverdueBadgesForVisibleRows = function() {
        try {
            const now = Date.now();
            const rows = document.querySelectorAll('tr.ticket-row');
            rows.forEach(row => {
                const id = row.getAttribute('data-ticket-id');
                const firstCell = row.querySelector('td:first-child');
                if (!id || !firstCell) return;
                const stamp = (window.__clientUpdatesMap instanceof Map) ? window.__clientUpdatesMap.get(id) : null;
                if (stamp) {
                    const updatedTime = new Date(stamp).getTime();
                    const diffH = (now - updatedTime) / (1000 * 60 * 60);
                    if (diffH >= 24) {
                        row.classList.add('overdue-awaiting');
                        if (!firstCell.querySelector('.overdue-badge')) {
                            const overdue = document.createElement('span');
                            overdue.className = 'overdue-badge';
                            overdue.innerHTML = '<i class="fas fa-exclamation-triangle"></i> +24h';
                            overdue.title = 'Client en attente de réponse depuis plus de 24h';
                            firstCell.appendChild(overdue);
                        }
                    } else {
                        row.classList.remove('overdue-awaiting');
                        const overdueEl = firstCell.querySelector('.overdue-badge');
                        if (overdueEl) overdueEl.remove();
                    }
                } else {
                    // Si le ticket n'est plus dans la map, retirer d'éventuels restes
                    row.classList.remove('overdue-awaiting');
                    const overdueEl = firstCell.querySelector('.overdue-badge');
                    if (overdueEl) overdueEl.remove();
                }
            });
        } catch (_) { /* noop */ }
    };

    async function pollOnce() {
        if (!authToken) return;
        if (!lastPollAt) {
            lastPollAt = new Date().toISOString();
            return; // start from now, avoid historical spam on first run
        }
        try {
            const url = `/api/admin/tickets/client-updates?since=${encodeURIComponent(lastPollAt)}`;
            const res = await fetch(url, { headers: { 'Authorization': `Basic ${authToken}` } });
            const nowIso = new Date().toISOString();
            if (!res.ok) {
                if (res.status === 401) logout();
                return;
            }
            const data = await res.json();
            const updates = Array.isArray(data.updates) ? data.updates : [];
            if (updates.length > 0) {
                // register updates
                let anyNew = false;
                for (const u of updates) {
                    const prevIso = window.__clientUpdatesMap.get(u.ticketId);
                    const prevTime = prevIso ? new Date(prevIso).getTime() : 0;
                    const stamp = u.updatedAt || u.createdAt || nowIso;
                    const newTime = stamp ? new Date(stamp).getTime() : 0;
                    const isNewer = !prevIso || (newTime > prevTime);
                    if (isNewer) {
                        anyNew = true;
                        window.__clientUpdatesMap.set(u.ticketId, stamp);
                        // toast with link
                        const message = `Réponse client sur ${u.ticketNumber}. Cliquer pour ouvrir.`;
                        // Clickable toast: reuse showNotification but make it clickable
                        const clickable = document.createElement('div');
                        clickable.textContent = message;
                        clickable.style.cssText = `
                            position: fixed;
                            top: 84px;
                            right: 20px;
                            background: #0ea5e9;
                            color: #fff;
                            padding: 12px 16px;
                            border-radius: 8px;
                            font-size: 14px;
                            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
                            z-index: 5000;
                            opacity: 0;
                            transform: translateY(-8px);
                            transition: opacity .2s ease, transform .2s ease;
                            cursor: pointer;
                            max-width: 70vw;
                        `;
                        clickable.addEventListener('click', () => {
                            viewTicket(u.ticketId);
                            clickable.remove();
                        });
                        document.body.appendChild(clickable);
                        // animate in
                        requestAnimationFrame(() => {
                            clickable.style.opacity = '1';
                            clickable.style.transform = 'translateY(0)';
                        });
                        // animate out
                        setTimeout(() => {
                            clickable.style.opacity = '0';
                            clickable.style.transform = 'translateY(-8px)';
                            setTimeout(()=>clickable.remove(), 250);
                        }, 5000);

                        // highlight
                        highlightRow(u.ticketId);
                        // browser notification
                        maybeShowBrowserNotification(u);
                    }
                }
                updateBadge();
                try { saveClientUpdatesCache(); } catch (_) {}
                try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
                if (anyNew) playPing();
            }
            lastPollAt = nowIso;
            // Rafraîchir périodiquement la liste "en attente" depuis le backend (≈ toutes les 2 min)
            try {
                if (Date.now() - lastAwaitingFetchAt > 120000) {
                    await syncAwaitingFromBackend();
                    lastAwaitingFetchAt = Date.now();
                }
            } catch (_) {}
            // Après polling, mettre à jour les badges "+24h" pour tenir compte du temps écoulé
            try { if (typeof window.updateOverdueBadgesForVisibleRows === 'function') window.updateOverdueBadgesForVisibleRows(); } catch (_) {}
        } catch (e) {
            // silent fail
        }
    }

    window.startClientUpdatesPolling = function() {
        if (pollIntervalId) return; // already started
        lastPollAt = null; // reset
        // initial seed and interval
        pollOnce();
        pollIntervalId = setInterval(pollOnce, 30000);
    };

    window.stopClientUpdatesPolling = function() {
        if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
        }
    };
})();
// Fonction pour initialiser le volet latéral des filtres
function initFiltersSidebar() {
    const toggleBtn = document.getElementById('toggle-filters-sidebar');
    const filtersSidebar = document.getElementById('filters-sidebar');
    const mainContent = document.querySelector('.dashboard-main-content');
    
    // Vérifier si les éléments existent
    if (toggleBtn && filtersSidebar) {
        // Gérer le clic sur le bouton de bascule
        toggleBtn.addEventListener('click', function() {
            // Basculer la classe 'collapsed' sur la sidebar
            filtersSidebar.classList.toggle('collapsed');
            
            // Modifier l'icône du bouton
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (filtersSidebar.classList.contains('collapsed')) {
                    icon.className = 'fas fa-chevron-right';
                    console.log('Volet fermé, icône changée en chevron-right');
                } else {
                    icon.className = 'fas fa-chevron-left';
                    console.log('Volet ouvert, icône changée en chevron-left');
                }
            }
            
            // Ajuster le padding du contenu principal si nécessaire
            if (mainContent) {
                mainContent.style.transition = 'padding-left 0.3s ease';
            }
            
            // Débug
            console.log('Toggle sidebar - État collapsed:', filtersSidebar.classList.contains('collapsed'));
        });
        
        // Ajouter un bouton mobile pour les écrans plus petits
        if (window.innerWidth <= 992) {
            const mobileToggle = document.createElement('button');
            mobileToggle.className = 'filters-sidebar-toggle-mobile';
            mobileToggle.innerHTML = '<i class="fas fa-filter"></i>';
            document.body.appendChild(mobileToggle);
            
            mobileToggle.addEventListener('click', function() {
                filtersSidebar.classList.toggle('active');
            });
        }
    }
    
    // Fermer la sidebar en cliquant en dehors (pour les appareils mobiles)
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 992 && filtersSidebar && filtersSidebar.classList.contains('active')) {
            if (!filtersSidebar.contains(e.target) && e.target.id !== 'toggle-filters-sidebar' && !e.target.closest('.filters-sidebar-toggle-mobile')) {
                filtersSidebar.classList.remove('active');
            }
        }
    });
}

function initCollapsibleFilters() {
    const toggleFilters = document.getElementById('toggle-filters');
    const filtersContent = document.getElementById('filters-content');
    const toggleIcon = document.querySelector('.toggle-icon i');
    
    // Vérifier si les éléments existent
    if (!toggleFilters || !filtersContent || !toggleIcon) return;
    
    // Récupérer l'état précédent des filtres (ouvert ou fermé)
    const isCollapsed = localStorage.getItem('filtersCollapsed') === 'true';
    
    // Appliquer l'état initial
    if (isCollapsed) {
        filtersContent.classList.add('collapsed');
        toggleIcon.classList.remove('fa-chevron-down');
        toggleIcon.classList.add('fa-chevron-right');
    }
    
    // Ajouter l'événement de clic pour basculer l'état
    toggleFilters.addEventListener('click', function() {
        filtersContent.classList.toggle('collapsed');
        
        // Mettre à jour l'icône
        const isCollapsed = filtersContent.classList.contains('collapsed');
        toggleIcon.classList.toggle('fa-chevron-down', !isCollapsed);
        toggleIcon.classList.toggle('fa-chevron-right', isCollapsed);
        
        // Sauvegarder l'état dans le localStorage
        localStorage.setItem('filtersCollapsed', isCollapsed);
    });
    
    // Initialiser les onglets de filtres
    initFilterTabs();
}

// Fonction pour initialiser les onglets de filtres
function initFilterTabs() {
    const tabButtons = document.querySelectorAll('.filter-tab-btn');
    const tabContents = document.querySelectorAll('.filter-tab-content');
    
    // Vérifier si les éléments existent
    if (!tabButtons.length || !tabContents.length) return;
    
    // Récupérer l'onglet actif précédent
    const activeTab = localStorage.getItem('activeFilterTab') || 'basic';
    
    // Activer l'onglet par défaut ou celui sauvegardé
    activateTab(activeTab);
    
    // Ajouter les événements de clic pour chaque bouton d'onglet
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            activateTab(tabName);
            
            // Sauvegarder l'onglet actif dans le localStorage
            localStorage.setItem('activeFilterTab', tabName);
        });
    });
    
    // Synchroniser les filtres entre les onglets
    setupFilterSync();
    
    // Fonction pour activer un onglet spécifique
    function activateTab(tabName) {
        // Désactiver tous les onglets
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Activer l'onglet sélectionné
        const selectedButton = document.querySelector(`.filter-tab-btn[data-tab="${tabName}"]`);
        const selectedContent = document.getElementById(`tab-${tabName}`);
        
        if (selectedButton && selectedContent) {
            selectedButton.classList.add('active');
            selectedContent.classList.add('active');
        }
    }
}

// Revenir à la liste avec restauration du scroll et nettoyage des handlers
function goBackToList() {
    try {
        // Cibler explicitement les éléments pour éviter les problèmes de portée
        const detailsEl = document.getElementById('ticket-details');
        if (detailsEl) detailsEl.style.display = 'none';
        const dashboard = document.getElementById('admin-dashboard');
        if (dashboard) dashboard.style.display = 'block';
        const settings = document.getElementById('admin-settings');
        if (settings) settings.style.display = 'none';
        if (detailsKeydownHandler) {
            document.removeEventListener('keydown', detailsKeydownHandler);
            detailsKeydownHandler = null;
        }
        if (typeof lastListScrollY === 'number') {
            try { window.scrollTo({ top: lastListScrollY, left: 0, behavior: 'auto' }); } catch(_) { window.scrollTo(0, lastListScrollY || 0); }
        }
        // Synchroniser l'état de navigation (hash) pour éviter les incohérences de route
        try {
            if (window.location.hash !== '#tickets') {
                window.location.hash = '#tickets';
            } else {
                // Si le hash ne change pas, appliquer explicitement la route
                if (typeof handleHashRoute === 'function') handleHashRoute();
            }
        } catch (_) {}
    } catch (e) {
        console.warn('goBackToList error', e);
    }
}

// Fonction pour synchroniser les filtres entre les onglets
function setupFilterSync() {
    // Synchroniser les filtres de statut
    const statusFilter = document.getElementById('status-filter');
    const statusFilterFull = document.getElementById('status-filter-full');
    
    if (statusFilter && statusFilterFull) {
        statusFilter.addEventListener('change', function() {
            statusFilterFull.value = this.value;
        });
        
        statusFilterFull.addEventListener('change', function() {
            statusFilter.value = this.value;
        });
        try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
        try { if (typeof window.updateTicketCounters === 'function') window.updateTicketCounters(); } catch (_) {}
    }
    
    // Synchroniser les filtres de type de pièce
    const partFilter = document.getElementById('part-filter');
    const partFilterFull = document.getElementById('part-filter-full');
    
    if (partFilter && partFilterFull) {
        partFilter.addEventListener('change', function() {
            partFilterFull.value = this.value;
        });
        
        partFilterFull.addEventListener('change', function() {
            partFilter.value = this.value;
        });
    }
}    

function initAdminApp() {
    // Initialiser le volet des filtres latéral
    initFiltersSidebar();
    
    // Initialiser les filtres collapsibles
    initCollapsibleFilters();
    
    // Gestion des onglets dans la vue détaillée
    function initTabsSystem() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Désactiver tous les onglets
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activer l'onglet sélectionné
                button.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }
    
    // Initialisation des variables globales
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const adminLogin = document.getElementById('admin-login');
    const ticketDetails = document.getElementById('ticket-details');
    const logoutBtn = document.getElementById('logout-btn');
    const backToListBtn = document.getElementById('back-to-list');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const partFilter = document.getElementById('part-filter');
    const ticketsList = document.getElementById('tickets-list');
    const pagination = document.getElementById('pagination');
    // Paramètres / Gestion utilisateurs
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminSettings = document.getElementById('admin-settings');
    const userManagementSection = document.getElementById('user-management-section');
    const usersListEl = document.getElementById('users-list');
    const userFormCard = document.getElementById('user-form-card');
    const userForm = document.getElementById('user-form');
    const usersFeedback = document.getElementById('users-feedback');
    const userIdInput = document.getElementById('user-id');
    const userFirstNameInput = document.getElementById('user-firstName');
    const userLastNameInput = document.getElementById('user-lastName');
    const userEmailInput = document.getElementById('user-email');
    const userRoleSelect = document.getElementById('user-role');
    const userPasswordInput = document.getElementById('user-password');
    const userPasswordConfirmInput = document.getElementById('user-password-confirm');
    const userIsActiveCheckbox = document.getElementById('user-isActive');
    const addUserBtn = document.getElementById('add-user-btn');
    const refreshUsersBtn = document.getElementById('refresh-users-btn');
    const cancelUserBtn = document.getElementById('cancel-user-btn');
    const userFormError = document.getElementById('user-form-error');
    const userFormTitle = document.getElementById('user-form-title');
    const navTicketsLink = document.querySelector('.horizontal-nav a[href="#tickets"]');
    const navSettingsLink = document.querySelector('.horizontal-nav a[href="#settings"]');
    const navDocsLink = document.querySelector('.horizontal-nav a[href="#docs"]');
    // Notifications (UI header)
    notifBtn = document.getElementById('notif-btn');
    notifBadge = document.getElementById('notif-badge');
    notifDropdown = document.getElementById('notif-dropdown');
    notifList = document.getElementById('notif-list');
    notifEmpty = document.getElementById('notif-empty');
    notifMarkAll = document.getElementById('notif-mark-all');
    
    // Attacher les écouteurs de notifications APRÈS l'initialisation des éléments
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.debug('notif-btn click');
            if (notifDropdown && notifDropdown.hidden) openNotifDropdown();
            else closeNotifDropdown();
        });
    }
    if (notifMarkAll) {
        notifMarkAll.addEventListener('click', async (e) => {
            e.stopPropagation();
            const r = await markNotificationsRead({ all: true });
            if (r && r.success) {
                updateNotifBadge(r.unreadCount);
                refreshNotificationsUI();
            }
        });
    }
    // Gestion Documentation (édition admin)
    const docsSection = document.getElementById('docs-admin-section');
    const docsFilesEl = document.getElementById('docs-files');
    const docsFilterInput = document.getElementById('docs-filter');
    const docsCurrentPathInput = document.getElementById('docs-current-path');
    const docsEditorTextarea = document.getElementById('docs-editor');
    const refreshDocsBtn = document.getElementById('refresh-docs-btn');
    const newDocBtn = document.getElementById('new-doc-btn');
    const saveDocBtn = document.getElementById('save-doc-btn');
    const deleteDocBtn = document.getElementById('delete-doc-btn');
    const docsFeedbackEl = document.getElementById('docs-feedback');
    let cachedDocsFiles = [];
    let currentDocPath = '';
    // Ces éléments seront initialisés plus tard quand le DOM sera prêt
    let updateStatusForm = null;
    let newStatusSelect = null;
    let additionalInfoGroup = null;
    let saveNotesBtn = null;
    let cachedUsers = [];
    // Améliorations UX: mémoriser le scroll de la liste et le key handler des détails
    let lastListScrollY = 0;
    let detailsKeydownHandler = null;
    // Titres/aria des boutons globaux si présents
    if (backToListBtn) {
        backToListBtn.title = 'Retour à la liste (Échap)';
        backToListBtn.setAttribute('aria-label', 'Retour à la liste');
    }
    const deleteDetailBtnInit = document.getElementById('delete-ticket-detail');
    if (deleteDetailBtnInit) {
        deleteDetailBtnInit.title = 'Supprimer le ticket';
        deleteDetailBtnInit.setAttribute('aria-label', 'Supprimer le ticket');
    }
    
    // Variables globales
    let currentPage = 1;
    let totalPages = 1;
    let currentTicketId = null;
    let authToken = window.authToken;
    let currentUserRole = null;
    let currentUserId = null;
    let currentUserEmail = null;

    // Récupérer le rôle et l'identité de l'utilisateur courant
    async function fetchCurrentUser() {
        try {
            const res = await fetch('/api/admin/me', { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!res.ok) {
                if (res.status === 401) logout();
                return;
            }
            const me = await res.json();
            if (me && me.success) {
                currentUserRole = me.role || null;
                currentUserId = me.id || null;
                currentUserEmail = me.email || null;
            }
        } catch (e) {
            console.warn('Impossible de récupérer /api/admin/me', e);
        }
    }

    // Charger les utilisateurs assignables (admin uniquement)
    async function loadAssignableUsers() {
        if (currentUserRole !== 'admin') return [];
        try {
            const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!res.ok) {
                if (res.status === 401) logout();
                return [];
            }
            const data = await res.json();
            const users = Array.isArray(data.users) ? data.users : [];
            // Filtrer admins/agents actifs
            return users.filter(u => (u.role === 'admin' || u.role === 'agent') && u.isActive !== false);
        } catch (e) {
            console.error('Erreur chargement utilisateurs:', e);
            return [];
        }
    }

    // Appliquer la visibilité des boutons selon le rôle et l'état du ticket
    function applyRoleBasedUIForTicket(ticket) {
        try {
            const btnAssign = document.getElementById('btn-assign-ticket');
            const btnAssist = document.getElementById('btn-request-assistance');
            const btnEsc = document.getElementById('btn-escalate-ticket');
            const role = currentUserRole;
            // Valeurs par défaut: masquer tous si rôle inconnu
            if (!role) {
                if (btnAssign) btnAssign.style.display = 'none';
                if (btnAssist) btnAssist.style.display = 'none';
                if (btnEsc) btnEsc.style.display = 'none';
                return;
            }
            if (role === 'admin') {
                if (btnAssign) btnAssign.style.display = '';
                if (btnAssist) btnAssist.style.display = '';
                if (btnEsc) btnEsc.style.display = ticket && ticket.isEscalated ? 'none' : '';
            } else if (role === 'agent') {
                if (btnAssign) btnAssign.style.display = '';
                if (btnAssist) btnAssist.style.display = '';
                if (btnEsc) btnEsc.style.display = 'none';
            } else {
                if (btnAssign) btnAssign.style.display = 'none';
                if (btnAssist) btnAssist.style.display = 'none';
                if (btnEsc) btnEsc.style.display = 'none';
            }
        } catch (e) {
            console.warn('applyRoleBasedUIForTicket error', e);
        }
    }

    // Appels API d'action
    async function assignTicket(ticketId, userId) {
        const res = await fetch(`/api/admin/tickets/${ticketId}/assign`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            if (res.status === 401) logout();
            throw new Error(data && data.message ? data.message : 'Échec de l\'assignation');
        }
        return data;
    }

    async function requestAssistance(ticketId, message = '') {
        const res = await fetch(`/api/admin/tickets/${ticketId}/assistance`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            if (res.status === 401) logout();
            throw new Error(data && data.message ? data.message : 'Échec de la demande d\'assistance');
        }
        return data;
    }

    async function escalateTicket(ticketId, reason) {
        const res = await fetch(`/api/admin/tickets/${ticketId}/escalate`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            if (res.status === 401) logout();
            throw new Error(data && data.message ? data.message : 'Échec de l\'escalade');
        }
        return data;
    }

    // Modales d'action
    async function openAssignModal() {
        try {
            if (!currentUserRole || !currentUserId) await fetchCurrentUser();
            if (currentUserRole === 'agent') {
                const ok = await showConfirmModal({
                    title: 'Assigner le ticket',
                    message: `Voulez-vous vous assigner ce ticket ?`,
                    confirmText: 'Oui, m\'assigner',
                    cancelText: 'Annuler'
                });
                if (!ok) return;
                await assignTicket(currentTicketId, currentUserId);
                showToast('success', 'Ticket assigné');
                try { if (currentTicketId) viewTicket(currentTicketId); } catch(_) {}
                return;
            }
            if (currentUserRole !== 'admin') {
                showToast('error', 'Action non autorisée');
                return;
            }
            const users = await loadAssignableUsers();
            const root = ensureModalRoot();
            root.style.display = 'flex';
            root.innerHTML = '';
            const modal = document.createElement('div');
            modal.className = 'cpf-modal';
            modal.innerHTML = `
              <div class="cpf-modal-header">
                <div class="icon"><i class="fas fa-user-check"></i></div>
                <div class="cpf-modal-title">Assigner le ticket</div>
              </div>
              <div class="cpf-modal-body">
                <label for="assign-user-select">Sélectionner un utilisateur</label>
                <select id="assign-user-select" style="width:100%; margin-top:6px;">
                  <option value="">-- Choisir --</option>
                  ${users.map(u => {
                      const name = `${(u.firstName||'').trim()} ${(u.lastName||'').trim()}`.trim();
                      const label = name ? `${name} (${u.email})` : u.email;
                      return `<option value="${u._id}">${label} · ${u.role}</option>`;
                  }).join('')}
                </select>
                <div id="assign-error" style="color:#b91c1c; margin-top:8px; display:none;"></div>
              </div>
              <div class="cpf-modal-actions">
                <button class="cpf-btn" data-action="cancel">Annuler</button>
                <button class="cpf-btn cpf-btn-primary" data-action="confirm">Assigner</button>
              </div>
            `;
            const onCleanup = () => { root.style.display = 'none'; root.innerHTML = ''; root.removeEventListener('click', onOverlayClick); };
            const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
            root.addEventListener('click', onOverlayClick);
            root.appendChild(modal);
            const cancelBtn = modal.querySelector('[data-action="cancel"]');
            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            cancelBtn.addEventListener('click', onCleanup);
            confirmBtn.addEventListener('click', async () => {
                const select = modal.querySelector('#assign-user-select');
                const val = select ? select.value : '';
                if (!val) {
                    const err = modal.querySelector('#assign-error');
                    if (err) { err.textContent = 'Veuillez sélectionner un utilisateur.'; err.style.display = 'block'; }
                    return;
                }
                try {
                    await assignTicket(currentTicketId, val);
                    onCleanup();
                    showToast('success', 'Ticket assigné');
                    try { if (currentTicketId) viewTicket(currentTicketId); } catch(_) {}
                } catch (e) {
                    const err = modal.querySelector('#assign-error');
                    if (err) { err.textContent = e.message || 'Erreur'; err.style.display = 'block'; }
                }
            });
        } catch (e) {
            console.error('openAssignModal error:', e);
            showToast('error', 'Impossible d\'ouvrir la modale d\'assignation');
        }
    }

    async function openAssistanceModal() {
        try {
            if (!currentUserRole) await fetchCurrentUser();
            if (!(currentUserRole === 'admin' || currentUserRole === 'agent')) {
                showToast('error', 'Action non autorisée');
                return;
            }
            const root = ensureModalRoot();
            root.style.display = 'flex';
            root.innerHTML = '';
            const modal = document.createElement('div');
            modal.className = 'cpf-modal';
            modal.innerHTML = `
              <div class="cpf-modal-header">
                <div class="icon"><i class="fas fa-life-ring"></i></div>
                <div class="cpf-modal-title">Demander assistance</div>
              </div>
              <div class="cpf-modal-body">
                <label for="assistance-message">Message (optionnel)</label>
                <textarea id="assistance-message" rows="4" style="width:100%; margin-top:6px;" placeholder="Décrivez votre besoin..."></textarea>
              </div>
              <div class="cpf-modal-actions">
                <button class="cpf-btn" data-action="cancel">Annuler</button>
                <button class="cpf-btn cpf-btn-primary" data-action="confirm">Envoyer</button>
              </div>
            `;
            const onCleanup = () => { root.style.display = 'none'; root.innerHTML = ''; root.removeEventListener('click', onOverlayClick); };
            const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
            root.addEventListener('click', onOverlayClick);
            root.appendChild(modal);
            const cancelBtn = modal.querySelector('[data-action="cancel"]');
            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            cancelBtn.addEventListener('click', onCleanup);
            confirmBtn.addEventListener('click', async () => {
                const ta = modal.querySelector('#assistance-message');
                const msg = ta ? String(ta.value || '').trim() : '';
                try {
                    await requestAssistance(currentTicketId, msg);
                    onCleanup();
                    showToast('success', 'Demande d\'assistance envoyée');
                } catch (e) {
                    showToast('error', e.message || 'Erreur lors de l\'envoi');
                }
            });
        } catch (e) {
            console.error('openAssistanceModal error:', e);
        }
    }

    async function openEscalateModal() {
        try {
            if (!currentUserRole) await fetchCurrentUser();
            if (currentUserRole !== 'admin') {
                showToast('error', 'Action réservée aux administrateurs');
                return;
            }
            const root = ensureModalRoot();
            root.style.display = 'flex';
            root.innerHTML = '';
            const modal = document.createElement('div');
            modal.className = 'cpf-modal';
            modal.innerHTML = `
              <div class="cpf-modal-header">
                <div class="icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="cpf-modal-title">Escalader le ticket</div>
              </div>
              <div class="cpf-modal-body">
                <label for="escalate-reason">Raison (obligatoire)</label>
                <textarea id="escalate-reason" rows="4" style="width:100%; margin-top:6px;" placeholder="Expliquez la raison de l'escalade..."></textarea>
                <div id="escalate-error" style="color:#b91c1c; margin-top:8px; display:none;"></div>
              </div>
              <div class="cpf-modal-actions">
                <button class="cpf-btn" data-action="cancel">Annuler</button>
                <button class="cpf-btn cpf-btn-primary" data-action="confirm">Escalader</button>
              </div>
            `;
            const onCleanup = () => { root.style.display = 'none'; root.innerHTML = ''; root.removeEventListener('click', onOverlayClick); };
            const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
            root.addEventListener('click', onOverlayClick);
            root.appendChild(modal);
            const cancelBtn = modal.querySelector('[data-action="cancel"]');
            const confirmBtn = modal.querySelector('[data-action="confirm"]');
            cancelBtn.addEventListener('click', onCleanup);
            confirmBtn.addEventListener('click', async () => {
                const ta = modal.querySelector('#escalate-reason');
                const reason = ta ? String(ta.value || '').trim() : '';
                if (!reason) {
                    const err = modal.querySelector('#escalate-error');
                    if (err) { err.textContent = 'La raison est obligatoire.'; err.style.display = 'block'; }
                    return;
                }
                try {
                    await escalateTicket(currentTicketId, reason);
                    onCleanup();
                    showToast('success', 'Ticket escaladé');
                    try { if (currentTicketId) viewTicket(currentTicketId); } catch(_) {}
                } catch (e) {
                    const err = modal.querySelector('#escalate-error');
                    if (err) { err.textContent = e.message || 'Erreur'; err.style.display = 'block'; }
                }
            });
        } catch (e) {
            console.error('openEscalateModal error:', e);
        }
    }

    // Démarrer la récupération du rôle dès l'initialisation
    fetchCurrentUser();
    
    // Traduction des types de pièces
    const partTypeTranslations = {
        'boite_vitesses': 'Boîte de vitesses',
        'moteur': 'Moteur',
        'mecatronique': 'Mécatronique',
        'boite_transfert': 'Boîte de transfert',
        'pont': 'Pont',
        'autres': 'Autres pièces'
    };
    
    // Traductions des statuts et types de pièces
    const statusTranslations = {
        'nouveau': 'Nouveau',
        'en_analyse': 'En analyse',
        'info_complementaire': 'Info complémentaire',
        'validé': 'Validé',
        'refusé': 'Refusé',
        'en_cours_traitement': 'En traitement',
        'expédié': 'Expédié',
        'clôturé': 'Clôturé'
    };
    
    // Traductions des priorités
    const priorityTranslations = {
        'faible': 'Faible',
        'moyen': 'Moyenne',
        'élevé': 'Élevée',
        'urgent': 'Urgente'
    };
    
    // Icônes pour les statuts
    const statusIcons = {
        'nouveau': 'fa-file',
        'en_analyse': 'fa-magnifying-glass',
        'info_complementaire': 'fa-circle-question',
        'validé': 'fa-check',
        'refusé': 'fa-xmark',
        'en_cours_traitement': 'fa-gear',
        'expédié': 'fa-truck',
        'clôturé': 'fa-flag-checkered'
    };
    
    // Icônes pour les types de documents
    const documentTypeIcons = {
        'lecture_obd': 'fa-microchip',
        'photo_piece': 'fa-image',
        'factures_pieces': 'fa-receipt',
        'media_transmission': 'fa-film',
        'factures_transmission': 'fa-file-invoice-dollar',
        'photos_moteur': 'fa-camera',
        'factures_entretien': 'fa-wrench',
        'documents_autres': 'fa-file'
    };
    
    // Traductions pour les types de documents
    const documentTypeTranslations = {
        'lecture_obd': 'Lecture OBD',
        'photo_piece': 'Photos de la pièce',
        'factures_pieces': 'Factures des pièces',
        'media_transmission': 'Vidéo symptôme',
        'factures_transmission': 'Factures de transmission',
        'photos_moteur': 'Photos du moteur',
        'factures_entretien': 'Factures d\'entretien',
        'documents_autres': 'Autres documents'
    };
    
    // Ordre d'affichage des types de documents
    const documentTypeOrder = [
        'factures_pieces',
        'factures_transmission',
        'factures_entretien',
        'lecture_obd',
        'media_transmission',
        'photo_piece',
        'photos_moteur',
        'documents_autres'
    ];
    
    // Fonction pour formater une date
    function formatDate(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    }
    
    // Récupérer le rôle de l'utilisateur courant
    async function fetchCurrentUserRole() {
        try {
            const res = await fetch('/api/admin/me', { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized');
                if (res.status === 403) throw new Error('Forbidden');
                throw new Error('Erreur lors de la récupération du profil');
            }
            const data = await res.json().catch(() => ({}));
            currentUserRole = data && data.role ? data.role : null;
        } catch (e) {
            console.error('fetchCurrentUserRole error:', e);
            if (e && e.message === 'Unauthorized') {
                logout();
            }
        }
    }
    
// Appliquer l'affichage conditionnel selon le rôle
function applyRoleBasedUI() {
    try {
        if (typeof document !== 'undefined') {
            // Gestion utilisateurs
            if (typeof userManagementSection !== 'undefined' && userManagementSection) {
                if (currentUserRole === 'agent') {
                    userManagementSection.style.display = 'none';
                } else {
                    userManagementSection.style.display = '';
                }
            }
            // Édition docs admin
            const docsAdmin = document.getElementById('docs-admin-section');
            if (docsAdmin) {
                const onDocs = (typeof window !== 'undefined' && window.location && window.location.hash === '#docs');
                if (currentUserRole === 'admin' && onDocs) {
                    docsAdmin.style.display = '';
                } else {
                    docsAdmin.style.display = 'none';
                }
            }
        }
    } catch (_) {}
}
    
// Vérifier si l'utilisateur est connecté
async function checkAuth() {
    if (authToken) {
        adminLogin.style.display = 'none';
        if (!currentUserRole) {
            await fetchCurrentUserRole();
        }
        applyRoleBasedUI();
        // Laisser le routeur décider de l'écran
        try { if (typeof handleHashRoute === 'function') handleHashRoute(); } catch(_) {}
        // Charger le tableau de bord si on est sur les tickets (ou aucun hash)
        if (!window.location.hash || window.location.hash === '#tickets') {
            loadDashboard();
        }
    } else {
        // Autoriser la doc sans connexion
        if (window.location.hash === '#docs') {
            adminLogin.style.display = 'none';
            if (!currentUserRole) {
                await fetchCurrentUserRole();
            }
            applyRoleBasedUI();
            // Laisser le routeur décider de l'écran
            try { if (typeof handleHashRoute === 'function') handleHashRoute(); } catch(_) {}
            // Charger le tableau de bord si on est sur les tickets (ou aucun hash)
            if (!window.location.hash || window.location.hash === '#tickets') {
                loadDashboard();
            }
        } else {
            // Autoriser la doc sans connexion
            if (window.location.hash === '#docs') {
                adminLogin.style.display = 'none';
                showDocs();
            } else {
                adminLogin.style.display = 'flex';
                if (adminDashboard) adminDashboard.style.display = 'none';
                if (adminSettings) adminSettings.style.display = 'none';
                if (ticketDetails) ticketDetails.style.display = 'none';
            }
        }
    }
}
    async function login(username, password) {
        try {
            // Créer le token Basic Auth (en supprimant d'éventuels espaces parasites)
            const u = String(username || '').trim();
            const p = String(password || '');
            const token = btoa(`${u}:${p}`);
            
            // Vérifier l'authentification via une route légère qui ne dépend pas de la base de données
            const response = await fetch('/api/admin/me', {
                headers: {
                    'Authorization': `Basic ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) throw new Error('Identifiants incorrects');
                if (response.status === 403) throw new Error('Accès refusé');
                throw new Error('Erreur serveur, veuillez réessayer plus tard');
            }
            
            // Stocker le token et synchroniser les contextes global/local
            localStorage.setItem('authToken', token);
            authToken = token;
            window.authToken = token;
            
            // Charger le rôle et mettre à jour l'UI
            await fetchCurrentUserRole();
            if (loginError) { loginError.style.display = 'none'; loginError.textContent = ''; }
            await checkAuth();
        } catch (error) {
            loginError.textContent = (error && error.message) ? error.message : 'Échec de la connexion';
            loginError.style.display = 'block';
        }
    }
    
    // Fonction de déconnexion
    function logout() {
        localStorage.removeItem('authToken');
        authToken = null;
        window.authToken = null;
        try { if (typeof window.stopNotificationsPolling === 'function') window.stopNotificationsPolling(); } catch (_) {}
        checkAuth();
    }
    
    // Charger le tableau de bord
    // Fonction simplifiée pour charger uniquement les tickets et statistiques de base
    async function loadDashboard() {
        try {
            // 1) Seed map of awaiting agent responses from backend
            try {
                if (window.authToken) {
                    const res = await fetch('/api/admin/tickets/awaiting-agent-response', {
                        headers: { 'Authorization': `Basic ${window.authToken}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const list = Array.isArray(data.awaiting) ? data.awaiting : [];
                        if (!window.__clientUpdatesMap || !(window.__clientUpdatesMap instanceof Map)) {
                            window.__clientUpdatesMap = new Map();
                        }
                        // Nettoyage des entrées qui ne sont plus en attente
                        const ids = new Set(list.map(it => String(it.ticketId)));
                        try {
                            for (const [id] of window.__clientUpdatesMap.entries()) {
                                if (!ids.has(String(id))) {
                                    window.__clientUpdatesMap.delete(id);
                                }
                            }
                        } catch (_) {}
                        // Mise à jour/merge des timestamps pour les tickets en attente
                        const nowIso = new Date().toISOString();
                        for (const item of list) {
                            if (item && item.ticketId) {
                                const prev = window.__clientUpdatesMap.get(item.ticketId);
                                const newStamp = item.updatedAt || nowIso;
                                const prevTime = prev ? new Date(prev).getTime() : 0;
                                const newTime = new Date(newStamp).getTime();
                                if (!prev || newTime > prevTime) {
                                    window.__clientUpdatesMap.set(item.ticketId, newStamp);
                                }
                            }
                        }
                        try { if (typeof window.refreshClientUpdatesBadge === 'function') window.refreshClientUpdatesBadge(); } catch (_) {}
                        try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
                        try { if (typeof window.updateOverdueBadgesForVisibleRows === 'function') window.updateOverdueBadgesForVisibleRows(); } catch (_) {}
                        try { saveClientUpdatesCache(); } catch (_) {}
                        try { lastAwaitingFetchAt = Date.now(); } catch (_) {}
                    } else if (res.status === 401) {
                        throw new Error('Unauthorized');
                    }
                }
            } catch (_) { /* seeding is best-effort */ }

            // 2) Restore 'awaiting agent' filter state and load tickets
            try {
                const savedAwaiting = localStorage.getItem('awaitingAgentOnly') === '1';
                const awaitingEl = document.getElementById('awaiting-agent-filter');
                if (awaitingEl) awaitingEl.checked = savedAwaiting;
                const qfAwaiting = document.getElementById('qf-awaiting');
                if (qfAwaiting) {
                    qfAwaiting.classList.toggle('active', savedAwaiting);
                    qfAwaiting.setAttribute('aria-pressed', savedAwaiting ? 'true' : 'false');
                }
            } catch (_) {}
            await loadTickets(1, collectFilters());
            await loadStats();
            // Start client update polling after initial load
            if (typeof window.startClientUpdatesPolling === 'function') {
                window.startClientUpdatesPolling();
            }
            // Démarrer le polling des notifications
            if (typeof window.startNotificationsPolling === 'function') {
                window.startNotificationsPolling();
            }
        } catch (error) {
            console.error('Erreur lors du chargement des tickets:', error);
            if (error.message === 'Unauthorized') {
                logout();
            }
        }
    }
    
    // Récupérer tous les tickets (toutes pages) pour des stats globales
    async function fetchAllTicketsForStats(query = {}) {
        const limit = 200; // batch size raisonnable
        let page = 1;
        let pages = 1;
        const all = [];
        do {
            // Construire l'URL avec paramètres facultatifs (ex: { priority: 'urgent' })
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
            }
            const url = `/api/admin/tickets?${params.toString()}`;
            const res = await fetch(url, { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized');
                throw new Error('Erreur lors de la récupération des tickets (stats)');
            }
            const data = await res.json();
            if (Array.isArray(data.tickets)) all.push(...data.tickets);
            pages = (data.pagination && data.pagination.pages) ? data.pagination.pages : 1;
            page++;
        } while (page <= pages);
        return all;
    }

    // Normaliser la priorité d'un ticket en une chaîne standardisée
    function normalizePriority(ticket) {
        // Champs alternatifs fréquemment rencontrés
        if (ticket?.isUrgent === true) return 'urgent';
        if (ticket?.urgent === true) return 'urgent';
        if (ticket?.flags && ticket.flags.urgent === true) return 'urgent';
        if (Array.isArray(ticket?.labels) && ticket.labels.some(l => String(l).toLowerCase().includes('urgent'))) return 'urgent';
        // Niveaux explicites
        if (typeof ticket?.priorityLevel === 'number') {
            if (ticket.priorityLevel >= 3) return 'urgent';
            if (ticket.priorityLevel <= 1) return 'faible';
            return 'moyen';
        }
        if (typeof ticket?.priorityLevel === 'string') {
            const pl = ticket.priorityLevel.trim().toLowerCase();
            if (['3','high','haute','élevée','elevee','very_high','p0','p1'].includes(pl) || pl.includes('high') || pl.includes('urgent')) return 'urgent';
            if (['1','low','faible','basse','p3'].includes(pl) || pl.includes('low')) return 'faible';
            return 'moyen';
        }

        let p = ticket?.priority;
        if (p == null) return 'moyen';
        // Si l'API renvoie un objet, tenter les champs usuels
        if (typeof p === 'object') {
            p = p.code || p.value || p.name || p.label || p.level || '';
        }
        // Si nombre (ex: 1=bas,2=moyen,3=urgent)
        if (typeof p === 'number') {
            if (p >= 3) return 'urgent';
            if (p <= 1) return 'faible';
            return 'moyen';
        }
        // Chaîne
        if (typeof p === 'string') {
            const s = p.trim().toLowerCase();
            // Variantes courantes
            if (['urgent','urgente','priorite_urgent','priorité_urgent','priority_urgent','high','haute','elevée','élevée','haut','haute_priorité','priorité_haute'].includes(s)) return 'urgent';
            if (['low','faible','basse'].includes(s)) return 'faible';
            if (['medium','moyen','moyenne','normal','normale'].includes(s)) return 'moyen';
            // Classes CSS possibles: priority-urgent, priority-high
            if (s.includes('urgent')) return 'urgent';
            if (s.includes('high')) return 'urgent';
            if (s.includes('low')) return 'faible';
            return s;
        }
        return 'moyen';
    }

    // Charger les statistiques
    async function loadStats() {
        try {
            // Récupérer l'ensemble des tickets (toutes pages)
            const allTickets = await fetchAllTicketsForStats();
            // Compter les tickets par statut
            let totalTickets = allTickets.length;
            let pendingTickets = 0;
            let resolvedTickets = 0;
            // Urgents: aligner sur la même logique que les autres stats (calcul local sur l'ensemble)
            let urgentTickets = 0;
            let otherStatusTickets = 0;
            const seenPriorities = new Set();
            const rawPriorities = new Set();
            
            // Définir les statuts pour chaque catégorie
            const pendingStatuses = ['nouveau', 'en_analyse', 'info_complementaire', 'en_cours_traitement'];
            const resolvedStatuses = ['validé', 'expédié', 'clôturé', 'refusé'];
            
            // Log pour débogage
            console.log(`Nombre total de tickets (toutes pages): ${totalTickets}`);
            
            allTickets.forEach(ticket => {
                // Log pour débogage
                console.log(`Ticket ${ticket.ticketNumber} - Statut: ${ticket.currentStatus} - Priorité: ${ticket.priority ?? ticket.priorityLevel ?? ticket.isUrgent ?? 'non définie'}`);
                
                // Compter par catégorie de statut
                if (pendingStatuses.includes(ticket.currentStatus)) {
                    pendingTickets++;
                } else if (resolvedStatuses.includes(ticket.currentStatus)) {
                    resolvedTickets++;
                } else {
                    otherStatusTickets++;
                    console.log(`Ticket avec statut non catégorisé: ${ticket.ticketNumber} - ${ticket.currentStatus}`);
                }
                
                // Urgents: aligner avec le filtre rapide (priorité 'urgent' normalisée)
                if (ticket && 'priority' in ticket) rawPriorities.add(typeof ticket.priority === 'object' ? JSON.stringify(ticket.priority) : String(ticket.priority));
                if (ticket && 'priorityLevel' in ticket) rawPriorities.add(`level:${ticket.priorityLevel}`);
                if (ticket && 'isUrgent' in ticket) rawPriorities.add(`isUrgent:${ticket.isUrgent}`);
                if (ticket && 'urgent' in ticket) rawPriorities.add(`urgent:${ticket.urgent}`);
                const normP = normalizePriority(ticket);
                seenPriorities.add(normP);
                if (normP === 'urgent') urgentTickets++;
            });

            // Debug: afficher les priorités rencontrées pour affiner la normalisation si besoin
            try {
                console.log('Priorités rencontrées (normalisées):', Array.from(seenPriorities));
                console.log('Priorités brutes rencontrées:', Array.from(rawPriorities));
            } catch(_) {}
            
            // Vérifier la cohérence des statistiques
            const calculatedTotal = pendingTickets + resolvedTickets + otherStatusTickets;
            console.log(`Statistiques calculées: En attente=${pendingTickets}, Résolus=${resolvedTickets}, Autres=${otherStatusTickets}, Total calculé=${calculatedTotal}, Total reçu=${totalTickets}`);
            
            if (calculatedTotal !== totalTickets) {
                console.warn(`Incohérence dans les statistiques: Total calculé (${calculatedTotal}) != Total reçu (${totalTickets})`);
            }
            
            // Utiliser le total calculé pour plus de cohérence (avec garde si certains éléments n'existent pas)
            const totalEl = document.getElementById('total-tickets');
            if (totalEl) totalEl.textContent = totalTickets;
            const pendingEl = document.getElementById('pending-tickets');
            if (pendingEl) pendingEl.textContent = pendingTickets;
            const resolvedEl = document.getElementById('resolved-tickets');
            if (resolvedEl) resolvedEl.textContent = resolvedTickets;
            const urgentEl = document.getElementById('urgent-tickets');
            if (urgentEl) urgentEl.textContent = urgentTickets;
            
            // Afficher un message dans la console pour les statuts non catégorisés
            if (otherStatusTickets > 0) {
                console.warn(`Attention: ${otherStatusTickets} tickets ont un statut qui n'est ni "en attente" ni "résolu".`);
            }
            
        } catch (error) {
            console.error('Erreur lors du chargement des statistiques:', error);
            throw error;
        }
    }
    
    // --- Navigation & Helpers (Tickets <-> Paramètres) ---
    function setActiveNav(key) {
        const lis = document.querySelectorAll('.horizontal-nav li');
        lis.forEach(li => li.classList.remove('active'));
        const target = document.querySelector(`.horizontal-nav a[href="#${key}"]`);
        if (target && target.parentElement) target.parentElement.classList.add('active');
    }
    
    function showDashboard() {
        if (adminDashboard) adminDashboard.style.display = 'block';
        if (adminSettings) adminSettings.style.display = 'none';
        if (ticketDetails) ticketDetails.style.display = 'none';
        setActiveNav('tickets');
    }
    
    function showSettings() {
        if (adminDashboard) adminDashboard.style.display = 'none';
        if (ticketDetails) ticketDetails.style.display = 'none';
        if (adminSettings) adminSettings.style.display = 'block';
        setActiveNav('settings');
    }
    
    // Afficher la Documentation
    function showDocs() {
        const dashboard = document.getElementById('admin-dashboard');
        const settings = document.getElementById('admin-settings');
        const details = document.getElementById('ticket-details');
        const docs = document.getElementById('admin-docs');
        if (dashboard) dashboard.style.display = 'none';
        if (settings) settings.style.display = 'none';
        if (details) details.style.display = 'none';
        if (docs) docs.style.display = 'block';
        // Masquer l'écran de connexion si présent afin d'afficher la documentation sans gêne
        try { if (typeof adminLogin !== 'undefined' && adminLogin) adminLogin.style.display = 'none'; } catch(_) {}
        setActiveNav('docs');
        // Charger la sidebar publique dynamiquement (une seule fois)
        try {
            const side = document.getElementById('docs-sidebar-dynamic');
            if (typeof loadPublicDocsSidebar === 'function' && side && !side.dataset.loaded) {
                loadPublicDocsSidebar();
            }
        } catch(_) {}
        // Optionnel: si aucun document chargé, afficher un message par défaut
        const art = document.getElementById('docs-content-article');
        if (art && !art.dataset.loaded) {
            art.innerHTML = '<p>Sélectionnez un document dans le menu de gauche pour l’afficher ici.</p>';
        }
    }
    
    // Afficher la section Commandes
    function showOrders() {
        const dashboard = document.getElementById('admin-dashboard');
        const settings = document.getElementById('admin-settings');
        const details = document.getElementById('ticket-details');
        const docs = document.getElementById('admin-docs');
        const orders = document.getElementById('admin-orders');
        if (dashboard) dashboard.style.display = 'none';
        if (settings) settings.style.display = 'none';
        if (details) details.style.display = 'none';
        if (docs) docs.style.display = 'none';
        if (orders) orders.style.display = 'block';
        setActiveNav('orders');
        try { initOrdersUIOnce(); } catch(_) {}
        try { loadOrdersList(1); } catch(_) {}
    }

    function formatMoney(amount, currency) {
        const value = isNaN(Number(amount)) ? 0 : Number(amount);
        const cur = (currency || 'EUR').toString();
        try {
            return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(value);
        } catch(_) {
            return `${value.toFixed(2)} ${cur}`;
        }
    }

    // Helpers d'échappement HTML (sécurité XSS + erreurs esc/escAttr)
    if (!window.esc || !window.escAttr || !window.stripTags) {
        const _replacements = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
        };
        window.esc = function esc(input) {
            const s = (input === null || input === undefined) ? '' : String(input);
            return s.replace(/[&<>"'`=\/]/g, (c) => _replacements[c] || c);
        };
        window.escAttr = function escAttr(input) {
            const s = (input === null || input === undefined) ? '' : String(input);
            // Échapper aussi les sauts de ligne et guillemets doubles pour attributs
            return s.replace(/[&<>"'`=\/\n]/g, (c) => _replacements[c] || (c === '\n' ? '&#10;' : c));
        };
        window.stripTags = function stripTags(input) {
            const s = (input === null || input === undefined) ? '' : String(input);
            return s.replace(/<[^>]*>/g, '');
        };
    }

    let ordersUIInitialized = false;
    function initOrdersUIOnce() {
        if (ordersUIInitialized) return;
        ordersUIInitialized = true;
        const createBtn = document.getElementById('orders-create-btn');
        const refreshBtn = document.getElementById('orders-refresh-btn');
        const syncBtn = document.getElementById('orders-sync-btn');
        const syncWooAllBtn = document.getElementById('orders-sync-woo-all-btn');
        const rebuildTechBtn = document.getElementById('orders-rebuild-techref-btn');
        const searchInput = document.getElementById('orders-search-input');
        const providerSel = document.getElementById('orders-provider-filter');
        const statusSel = document.getElementById('orders-status-filter');
        const typeSel = document.getElementById('orders-type-filter');
        const fromInput = document.getElementById('orders-from');
        const toInput = document.getElementById('orders-to');
        const sortSel = document.getElementById('orders-sort');
        const exportBtn = document.getElementById('orders-export-btn');
        const tbody = document.getElementById('orders-list');
        
        if (createBtn) createBtn.addEventListener('click', () => openCreateOrderModal());
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadOrdersList(1));
        const missingRefCbx = document.getElementById('orders-missing-techref');
        if (missingRefCbx) missingRefCbx.addEventListener('change', () => loadOrdersList(1));
        if (typeSel) typeSel.addEventListener('change', () => loadOrdersList(1));
        if (rebuildTechBtn) rebuildTechBtn.addEventListener('click', async () => {
            if (!authToken) return logout();
            try {
                rebuildTechBtn.disabled = true;
                rebuildTechBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recalcul…';
                const r = await fetch('/api/admin/orders/rebuild-technical-refs', { method: 'POST', headers: { 'Authorization': `Basic ${authToken}` } });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.success) throw new Error(d.message || 'Échec du recalcul');
                showToast(`Références recalculées: ${d.updated} mise(s) à jour sur ${d.scanned} commande(s)`, 'success');
                await loadOrdersList(1);
            } catch (e) {
                showToast(e.message || 'Erreur lors du recalcul', 'error');
            } finally {
                rebuildTechBtn.disabled = false;
                rebuildTechBtn.innerHTML = '<i class="fas fa-wrench"></i> Recalculer Réf techniques';
            }
        });
        if (syncBtn) syncBtn.addEventListener('click', async () => {
            if (!authToken) return logout();
            try {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synchronisation...';
                const r = await fetch('/api/admin/orders/sync-now', {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${authToken}` }
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.success) throw new Error(d.message || 'Échec de la synchronisation');
                await loadOrdersList(1);
                showToast('Synchronisation terminée', 'success');
            } catch (e) {
                showToast(e.message || 'Erreur de synchronisation', 'error');
            } finally {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Synchroniser (Woo+Mollie)';
            }
        });
        if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadOrdersList(1); });
        if (providerSel) providerSel.addEventListener('change', () => loadOrdersList(1));
        if (statusSel) statusSel.addEventListener('change', () => loadOrdersList(1));
        if (fromInput) fromInput.addEventListener('change', () => loadOrdersList(1));
        if (toInput) toInput.addEventListener('change', () => loadOrdersList(1));
        if (sortSel) sortSel.addEventListener('change', () => loadOrdersList(1));
        if (exportBtn) exportBtn.addEventListener('click', () => exportOrdersCsv());
        if (syncWooAllBtn) syncWooAllBtn.addEventListener('click', async () => {
            if (!authToken) return logout();
            const ok = confirm('Importer toutes les commandes WooCommerce ? Cela peut prendre plusieurs minutes.');
            if (!ok) return;
            try {
                syncWooAllBtn.disabled = true;
                syncWooAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Import en cours...';
                const r = await fetch('/api/admin/orders/sync-woo-all', {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${authToken}` }
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.success) throw new Error(d.message || 'Échec de la synchro complète');
                await loadOrdersList(1);
                showToast(`Import terminé (${d.processed || 0} commandes)`, 'success');
            } catch (e) {
                showToast(e.message || 'Erreur de synchro complète', 'error');
            } finally {
                syncWooAllBtn.disabled = false;
                syncWooAllBtn.innerHTML = '<i class="fas fa-database"></i> Importer toutes les commandes Woo';
            }
        });
        if (tbody) tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) {
                // Ignorer les clics sur les cases à cocher de sélection
                const cb = e.target.closest('input.order-select');
                if (cb) {
                    e.stopPropagation();
                    return;
                }
                // Si clic sur une ligne (hors boutons), ouvrir détails
                const row = e.target.closest('tr.order-row');
                if (row && row.dataset.id) {
                    openOrderDetails(row.dataset.id);
                }
                return;
            }
            const action = btn.dataset.action;
            if (action === 'copy-vin') {
                try {
                    const val = (btn.dataset.vin || '').trim();
                    if (val) {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(val);
                        } else {
                            const ta = document.createElement('textarea');
                            ta.value = val;
                            ta.style.position = 'fixed';
                            ta.style.left = '-9999px';
                            document.body.appendChild(ta);
                            ta.focus(); ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                        showToast('VIN / Plaque copié', 'success');
                    }
                } catch (_) {
                    showToast('Impossible de copier', 'error');
                }
                return; // ne pas ouvrir les détails
            }
            const id = btn.dataset.id;
            if (!id || !action) return;
            try {
                if (action === 'ship') {
                    openShipModal(id);
                } else if (action === 'delete') {
                    const ok = window.confirm('Supprimer définitivement cette commande ?');
                    if (!ok) return;
                    let prevHtml = btn.innerHTML;
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Basic ${authToken}` }
                        });
                        const d = await r.json().catch(() => ({}));
                        if (!r.ok || !d.success) {
                            if (r.status === 403) throw new Error('Accès refusé: suppression réservée aux administrateurs');
                            throw new Error(d.message || 'Suppression impossible');
                        }
                        showToast('Commande supprimée', 'success');
                        await loadOrdersList(1);
                    } catch (err) {
                        showToast(err.message || 'Erreur lors de la suppression', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = prevHtml || "<i class='fas fa-trash'></i>";
                    }
                } else if (action === 'ref-mini') {
                    // Fermer tout popover existant
                    try { document.querySelectorAll('.mini-pop').forEach(p => p.remove()); } catch {}
                    const popover = document.createElement('div');
                    popover.className = 'mini-pop';
                    popover.innerHTML = `
                      <div class="row" style="width:100%">
                        <input type="text" id="ref-engine" placeholder="Cylindrée (ex: 1.4)" style="flex:1 1 auto; min-width:120px; height:32px; border:1px solid #d1d5db; border-radius:8px; padding:4px 8px;" />
                        <input type="text" id="ref-tcu" placeholder="Réf TCU (ex: 0AM927769D)" style="flex:1 1 auto; min-width:160px; height:32px; border:1px solid #d1d5db; border-radius:8px; padding:4px 8px;" />
                      </div>
                      <div class="row" style="width:100%">
                        <label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#374151;">
                          <input type="checkbox" id="ref-required" /> Référence requise
                        </label>
                        <span style="flex:1 1 auto;"></span>
                        <button class="qd qd-clear" data-act="clear">Effacer refs</button>
                        <button class="ok" data-act="ok">OK</button>
                      </div>
                    `;
                    const rect = btn.getBoundingClientRect();
                    document.body.appendChild(popover);
                    const popRect = popover.getBoundingClientRect();
                    const vw = document.documentElement.clientWidth;
                    const vh = document.documentElement.clientHeight;
                    let left = window.scrollX + rect.left;
                    if (left + popRect.width > window.scrollX + vw - 8) left = window.scrollX + rect.right - popRect.width;
                    if (left < window.scrollX + 8) left = window.scrollX + 8;
                    let top = window.scrollY + rect.top + rect.height + 6;
                    if (top + popRect.height > window.scrollY + vh - 8) top = window.scrollY + rect.top - popRect.height - 6;
                    if (top < window.scrollY + 8) top = window.scrollY + 8;
                    popover.style.left = `${left}px`;
                    popover.style.top = `${top}px`;
                    const engEl = popover.querySelector('#ref-engine');
                    const tcuEl = popover.querySelector('#ref-tcu');
                    const reqEl = popover.querySelector('#ref-required');
                    if (engEl) engEl.value = btn.dataset.engine || '';
                    if (tcuEl) tcuEl.value = btn.dataset.tcu || '';
                    if (reqEl) reqEl.checked = (btn.dataset.required === '1');
                    const cleanup = () => { try { popover.remove(); document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); } catch {} };
                    const onDocClick = (ev) => { if (!popover.contains(ev.target) && ev.target !== btn) cleanup(); };
                    const onKey = (ev) => { if (ev.key === 'Escape') cleanup(); if (ev.key === 'Enter') doSave(); };
                    document.addEventListener('mousedown', onDocClick);
                    document.addEventListener('keydown', onKey);
                    const doSave = async () => {
                        const payload = {
                            engineDisplacement: (engEl?.value || '').trim(),
                            tcuReference: (tcuEl?.value || '').trim(),
                            technicalRefRequired: !!(reqEl?.checked)
                        };
                        await updateTechnicalRef(id, payload);
                        cleanup();
                    };
                    popover.querySelector('[data-act="ok"]').addEventListener('click', doSave);
                    popover.querySelector('[data-act="clear"]').addEventListener('click', async () => {
                        if (engEl) engEl.value = '';
                        if (tcuEl) tcuEl.value = '';
                        await updateTechnicalRef(id, { engineDisplacement: '', tcuReference: '', technicalRefRequired: !!(reqEl?.checked) });
                        cleanup();
                    });
                } else if (action === 'est-mini') {
                    // Fermer tout popover existant
                    try { document.querySelectorAll('.mini-pop').forEach(p => p.remove()); } catch {}
                    const popover = document.createElement('div');
                    popover.className = 'mini-pop';
                    popover.innerHTML = `
                      <div class="row">
                        <button class="qd" data-est="0">Aujourd'hui</button>
                        <button class="qd" data-est="1">+1 j</button>
                        <button class="qd" data-est="3">+3 j</button>
                        <button class="qd" data-est="5">+5 j</button>
                        <button class="qd" data-est="7">+7 j</button>
                      </div>
                      <div class="row">
                        <input type="date" id="est-date" value="" />
                      </div>
                      <div class="row">
                        <button class="qd qd-clear" data-est="clear">Effacer</button>
                        <button class="ok" data-est="ok">OK</button>
                      </div>
                    `;
                    const rect = btn.getBoundingClientRect();
                    // Ajouter d'abord, puis mesurer pour éviter les débordements
                    document.body.appendChild(popover);
                    const popRect = popover.getBoundingClientRect();
                    const vw = document.documentElement.clientWidth;
                    const vh = document.documentElement.clientHeight;
                    let left = window.scrollX + rect.left;
                    // Si dépasse à droite, aligner sur la droite du bouton
                    if (left + popRect.width > window.scrollX + vw - 8) {
                        left = window.scrollX + rect.right - popRect.width;
                    }
                    // Clamp sur la gauche
                    if (left < window.scrollX + 8) left = window.scrollX + 8;
                    let top = window.scrollY + rect.top + rect.height + 6; // par défaut, en dessous
                    // Si dépasse en bas, afficher au-dessus
                    if (top + popRect.height > window.scrollY + vh - 8) {
                        top = window.scrollY + rect.top - popRect.height - 6;
                    }
                    // Clamp haut
                    if (top < window.scrollY + 8) top = window.scrollY + 8;
                    popover.style.left = `${left}px`;
                    popover.style.top = `${top}px`;
                    const input = popover.querySelector('#est-date');
                    const today = new Date();
                    input.value = today.toISOString().slice(0,10);
                    const cleanup = () => { try { popover.remove(); document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); } catch {} };
                    const onDocClick = (ev) => { if (!popover.contains(ev.target) && ev.target !== btn) cleanup(); };
                    const onKey = (ev) => { if (ev.key === 'Escape') cleanup(); };
                    document.addEventListener('mousedown', onDocClick);
                    document.addEventListener('keydown', onKey);
                    popover.querySelectorAll('.qd').forEach(qd => {
                        qd.addEventListener('click', () => {
                            const est = qd.dataset.est;
                            if (est === 'clear') { input.value = ''; return; }
                            const days = parseInt(est || '0', 10) || 0;
                            const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days);
                            input.value = d.toISOString().slice(0,10);
                        });
                    });
                    popover.querySelector('.ok').addEventListener('click', async () => {
                        const val = (input.value || '').trim();
                        if (!val) { await updateEstimatedDelivery(id, ''); cleanup(); return; }
                        const iso = `${val}T00:00:00.000Z`;
                        await updateEstimatedDelivery(id, iso);
                        cleanup();
                    });
                    input.addEventListener('keydown', async (ev) => {
                        if (ev.key === 'Enter') {
                            const val = (input.value || '').trim();
                            if (!val) { await updateEstimatedDelivery(id, ''); cleanup(); return; }
                            const iso = `${val}T00:00:00.000Z`;
                            await updateEstimatedDelivery(id, iso);
                            cleanup();
                        }
                    });
                }
            } catch (e2) {
                showToast(e2.message || 'Erreur action', 'error');
            }
        });
    }

    async function loadOrdersList(page = 1) {
        try {
            if (!authToken) return logout();
            const tbody = document.getElementById('orders-list');
            const pag = document.getElementById('orders-pagination');
            const q = (document.getElementById('orders-search-input')?.value || '').trim();
            const provider = (document.getElementById('orders-provider-filter')?.value || '').trim();
            const status = (document.getElementById('orders-status-filter')?.value || '').trim();
            const productType = (document.getElementById('orders-type-filter')?.value || '').trim();
            const from = (document.getElementById('orders-from')?.value || '').trim();
            const to = (document.getElementById('orders-to')?.value || '').trim();
            const sortVal = (document.getElementById('orders-sort')?.value || 'date_desc');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9">Chargement…</td></tr>';
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '25');
            if (q) params.set('q', q);
            if (provider) params.set('provider', provider);
            if (status) params.set('status', status);
            if (productType) params.set('productType', productType);
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const missingRefCbx = document.getElementById('orders-missing-techref');
            if (missingRefCbx && missingRefCbx.checked) params.set('missingTechRef', '1');
            const [sort, dir] = parseSort(sortVal);
            if (sort) params.set('sort', sort);
            if (dir) params.set('dir', dir);
            const res = await fetch(`/api/admin/orders?${params.toString()}`, { headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.message || 'Erreur chargement');
            renderOrdersList(data);
            // pagination
            if (pag) {
                const total = Number(data.total || 0);
                const limit = Number(data.limit || 25);
                const cur = Number(data.page || 1);
                const pages = Math.max(1, Math.ceil(total / limit));
                pag.innerHTML = '';
                const info = document.createElement('span');
                info.textContent = `Page ${cur} / ${pages} — ${total} commande(s)`;
                const prev = document.createElement('button');
                prev.className = 'btn-secondary';
                prev.textContent = 'Précédent';
                prev.disabled = cur <= 1;
                prev.addEventListener('click', () => loadOrdersList(cur - 1));
                const next = document.createElement('button');
                next.className = 'btn-secondary';
                next.textContent = 'Suivant';
                next.disabled = cur >= pages;
                next.addEventListener('click', () => loadOrdersList(cur + 1));
                pag.appendChild(prev);
                pag.appendChild(info);
                pag.appendChild(next);
            }
        } catch (e) {
            showToast(e.message || 'Erreur lors du chargement des commandes', 'error');
        }
    }

    function renderOrdersList(data) {
        const tbody = document.getElementById('orders-list');
        if (!tbody) return;
        const selectAll = document.getElementById('orders-select-all');
        const bulkBar = document.getElementById('orders-bulk-actions');
        const bulkCount = document.getElementById('orders-bulk-count');
        const bulkDeleteBtn = document.getElementById('orders-bulk-delete');
        window.__ordersSelected = window.__ordersSelected || new Set();
        const orders = Array.isArray(data.orders) ? data.orders : [];
        updateOrdersMetrics(data.metrics, orders);
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">Aucune commande</td></tr>';
            if (bulkBar) { bulkBar.style.display = 'none'; }
            return;
        }
        // Styles compacts pour le mini-popover (injectés une seule fois)
        try {
            if (!document.getElementById('mini-est-styles')) {
                const st = document.createElement('style');
                st.id = 'mini-est-styles';
                st.textContent = `
                  .btn-icon { padding: 0 8px; min-width: 32px; }
                  .mini-pop { position: absolute; z-index: 9999; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 4px 18px rgba(0,0,0,0.08); padding:8px; width: 240px; max-width: calc(100vw - 16px); }
                  .mini-pop .row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
                  .mini-pop input[type=date] { height:32px; border:1px solid #d1d5db; border-radius:8px; padding:4px 8px; flex:1 1 auto; }
                  .mini-pop .qd { background:#f9fafb; border:1px solid #d1d5db; border-radius:6px; height:28px; padding:0 8px; cursor:pointer; font-size:12px; }
                  .mini-pop .qd-clear { background:#fff5f5; border:1px solid #fecaca; color:#b91c1c; }
                  .mini-pop .ok { height:28px; padding:0 10px; border-radius:6px; border:1px solid #d1d5db; background:#eef2ff; }
                  .ref-dot { width:10px; height:10px; border-radius:50%; border:1px solid #e5e7eb; display:inline-block; margin: auto 2px; }
                  .ref-dot.ok { background:#10b981; }
                  .ref-dot.missing { background:#ef4444; }
                `;
                document.head.appendChild(st);
            }
        } catch {}
        const frag = document.createDocumentFragment();
        orders.forEach(o => {
            const tr = document.createElement('tr');
            const num = o.number || (o.provider ? (o.provider + '#' + String(o._id || '').slice(-6)) : (String(o._id || '').slice(-6)));
            const srcCreated = (o.meta && o.meta.sourceCreatedAt) ? o.meta.sourceCreatedAt : o.createdAt;
            const srcUpdated = (o.meta && o.meta.sourceUpdatedAt) ? o.meta.sourceUpdatedAt : o.updatedAt;
            const created = srcCreated ? new Date(srcCreated).toLocaleString('fr-FR') : '';
            const updated = srcUpdated ? new Date(srcUpdated).toLocaleString('fr-FR') : '';
            const client = (o.customer && (o.customer.name || o.customer.email)) ? `${o.customer.name || ''} ${o.customer.email ? `<small>${o.customer.email}</small>` : ''}` : '—';
            const src = o.provider || '—';
            const hasNotes = Array.isArray(o.events) && o.events.some(ev => ev && ev.type === 'note');
            const vinOrPlate = (o.meta && typeof o.meta.vinOrPlate === 'string' && o.meta.vinOrPlate.trim()) ? o.meta.vinOrPlate.trim().toUpperCase() : '—';
            const vinCell = (vinOrPlate && vinOrPlate !== '—')
                ? `<button class="vin-copy-btn" data-action="copy-vin" data-vin="${vinOrPlate}" title="Cliquer pour copier">${vinOrPlate}</button>`
                : '—';
            const ptypeRaw = (o.meta && o.meta.productType) ? String(o.meta.productType) : '';
            const ptypeMap = {
                'mecatronique_tcu': 'Mécatronique/TCU',
                'pont': 'Pont',
                'boite_transfert': 'Boîte de transfert',
                'moteur': 'Moteur',
                'autres': 'Autres'
            };
            const ptype = ptypeMap[ptypeRaw] || '';
            const st = renderStatusBadge(o.status || '—');
            const amt = formatMoney((o.totals && o.totals.amount) || 0, (o.totals && o.totals.currency) || 'EUR');
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '6px';
            const btnShip = document.createElement('button');
            btnShip.className = 'btn-secondary';
            btnShip.textContent = 'Expédier';
            btnShip.dataset.action = 'ship';
            btnShip.dataset.id = o._id;
            // Pastille état Réf technique (si requise)
            const techReq = !!(o.meta && o.meta.technicalRefRequired);
            const engine = (o.meta && o.meta.engineDisplacement ? String(o.meta.engineDisplacement).trim() : '');
            const tcu = (o.meta && o.meta.tcuReference ? String(o.meta.tcuReference).trim() : '');
            const techMissing = techReq && (!engine || !tcu);
            let dot = null;
            if (techReq) {
                dot = document.createElement('span');
                dot.className = 'ref-dot ' + (techMissing ? 'missing' : 'ok');
                dot.title = techMissing ? 'Réf manquante' : 'Réf OK';
            }
            // Bouton Réf (mini-popover)
            const btnRef = document.createElement('button');
            btnRef.className = 'btn-secondary btn-icon';
            btnRef.innerHTML = "<i class='fas fa-key'></i>";
            btnRef.title = 'Référence technique';
            btnRef.dataset.action = 'ref-mini';
            btnRef.dataset.id = o._id;
            btnRef.dataset.engine = engine;
            btnRef.dataset.tcu = tcu;
            btnRef.dataset.required = techReq ? '1' : '0';
            const btnEst = document.createElement('button');
            btnEst.className = 'btn-secondary btn-icon';
            btnEst.innerHTML = "<i class='fas fa-calendar-plus'></i>";
            btnEst.dataset.action = 'est-mini';
            btnEst.dataset.id = o._id;
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-secondary btn-icon';
            btnDel.innerHTML = "<i class='fas fa-trash'></i>";
            btnDel.title = 'Supprimer';
            btnDel.dataset.action = 'delete';
            btnDel.dataset.id = o._id;
            try {
                if (o.shipping && o.shipping.estimatedDeliveryAt) {
                    btnEst.title = 'Livraison estimée: ' + new Date(o.shipping.estimatedDeliveryAt).toLocaleDateString('fr-FR');
                } else {
                    btnEst.title = 'Définir livraison estimée';
                }
            } catch { btnEst.title = 'Définir livraison estimée'; }
            actions.appendChild(btnShip);
            if (dot) actions.appendChild(dot);
            actions.appendChild(btnRef);
            actions.appendChild(btnEst);
            actions.appendChild(btnDel);
            const noteBadge = hasNotes ? '<span class="orders-note-badge" title="Note interne disponible"><i class="fas fa-sticky-note"></i></span>' : '';
            const checkedAttr = window.__ordersSelected.has(o._id) ? ' checked' : '';
            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" class="order-select" data-id="${escAttr(o._id)}"${checkedAttr}></td>
                <td>${num} ${noteBadge}</td>
                <td>${created}</td>
                <td>${client}</td>
                <td>${vinCell}</td>
                <td>${src}</td>
                <td>${ptype}</td>
                <td>${st}</td>
                <td>${amt}</td>
                <td></td>
            `;
            const tdActions = tr.querySelector('td:last-child');
            tdActions.appendChild(actions);
            tr.classList.add('order-row');
            tr.dataset.id = o._id;
            frag.appendChild(tr);
        });
        tbody.innerHTML = '';
        tbody.appendChild(frag);

        // Mettre à jour barre d'actions groupées
        const updateBulkUI = () => {
            if (!bulkBar || !bulkCount) return;
            const n = window.__ordersSelected.size;
            bulkCount.textContent = `${n} sélectionnée(s)`;
            bulkBar.style.display = n > 0 ? 'flex' : 'none';
            if (selectAll) {
                const totalRows = tbody.querySelectorAll('input.order-select').length;
                const checkedRows = tbody.querySelectorAll('input.order-select:checked').length;
                selectAll.indeterminate = checkedRows > 0 && checkedRows < totalRows;
                selectAll.checked = totalRows > 0 && checkedRows === totalRows;
            }
        };

        // Gestion sélection lignes
        tbody.querySelectorAll('input.order-select').forEach(cb => {
            // Stopper la propagation pour éviter d'ouvrir les détails
            cb.addEventListener('click', (ev) => { ev.stopPropagation(); });
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) window.__ordersSelected.add(id);
                else window.__ordersSelected.delete(id);
                updateBulkUI();
            });
        });

        // Tout sélectionner
        if (selectAll && !selectAll.__bound) {
            selectAll.__bound = true;
            selectAll.addEventListener('change', (e) => {
                const all = Array.from(tbody.querySelectorAll('input.order-select'));
                all.forEach(cb => { cb.checked = e.target.checked; const id = cb.getAttribute('data-id'); if (e.target.checked) window.__ordersSelected.add(id); else window.__ordersSelected.delete(id); });
                updateBulkUI();
            });
        }

        // Suppression groupée
        if (bulkDeleteBtn && !bulkDeleteBtn.__bound) {
            bulkDeleteBtn.__bound = true;
            bulkDeleteBtn.addEventListener('click', async () => {
                const ids = Array.from(window.__ordersSelected);
                if (!ids.length) return;
                if (!confirm(`Supprimer ${ids.length} commande(s) ?`)) return;
                const authToken = localStorage.getItem('authToken');
                try {
                    const r = await fetch('/api/admin/orders/bulk-delete', {
                        method: 'POST',
                        headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids })
                    });
                    if (!r.ok) throw new Error('Échec suppression');
                    const js = await r.json();
                    showToast(`Supprimées: ${js.deleted || ids.length}`,'success');
                    window.__ordersSelected.clear();
                    // Recharger la page actuelle
                    await loadOrdersList(1);
                } catch (e) {
                    showToast(e.message || 'Erreur suppression groupée', 'error');
                }
            });
        }

        updateBulkUI();
    }

    function updateOrdersMetrics(metricData, orders) {
        const missingRefEl = document.getElementById('orders-metric-missing-ref');
        const missingVinEl = document.getElementById('orders-metric-missing-vin');
        const awaitingShipEl = document.getElementById('orders-metric-awaiting-ship');
        const awaitingPayEl = document.getElementById('orders-metric-awaiting-pay');

        if (metricData && typeof metricData === 'object') {
            if (missingRefEl) missingRefEl.textContent = String(metricData.missingRef ?? 0);
            if (missingVinEl) missingVinEl.textContent = String(metricData.missingVin ?? 0);
            if (awaitingShipEl) awaitingShipEl.textContent = String(metricData.awaitingShipment ?? 0);
            if (awaitingPayEl) awaitingPayEl.textContent = String(metricData.awaitingPayment ?? 0);
            return;
        }

        let missingRef = 0;
        let missingVin = 0;
        let awaitingShipment = 0;
        let awaitingPayment = 0;

        const awaitingShipmentStatuses = new Set(['processing', 'paid', 'awaiting_shipment']);
        const awaitingPaymentStatuses = new Set(['pending_payment', 'awaiting_transfer', 'pending', 'on-hold']);

        orders.forEach((order) => {
            const meta = order.meta || {};
            const status = String(order.status || '').toLowerCase();
            const trim = (val) => (typeof val === 'string' ? val.trim() : '');

            const tcu = trim(meta.tcuReference);
            const engine = trim(meta.engineDisplacement);
            const vin = trim(meta.vinOrPlate);
            const technicalRequired = meta.technicalRefRequired;

            const needsTechnicalRef = technicalRequired !== false && (!tcu || !engine);
            if (needsTechnicalRef) missingRef += 1;

            if (!vin) missingVin += 1;

            if (awaitingShipmentStatuses.has(status)) awaitingShipment += 1;
            if (awaitingPaymentStatuses.has(status)) awaitingPayment += 1;
        });

        if (missingRefEl) missingRefEl.textContent = String(missingRef);
        if (missingVinEl) missingVinEl.textContent = String(missingVin);
        if (awaitingShipEl) awaitingShipEl.textContent = String(awaitingShipment);
        if (awaitingPayEl) awaitingPayEl.textContent = String(awaitingPayment);
    }

    function parseSort(val) {
        switch (val) {
            case 'date_desc': return ['date', 'desc'];
            case 'date_asc': return ['date', 'asc'];
            case 'amount_desc': return ['amount', 'desc'];
            case 'amount_asc': return ['amount', 'asc'];
            case 'number_desc': return ['number', 'desc'];
            case 'number_asc': return ['number', 'asc'];
            case 'status_asc': return ['status', 'asc'];
            case 'status_desc': return ['status', 'desc'];
            case 'type_asc': return ['type', 'asc'];
            case 'type_desc': return ['type', 'desc'];
            default: return ['date', 'desc'];
        }
    }

    async function updateEstimatedDelivery(orderId, isoOrEmpty) {
        if (!authToken) return logout();
        try {
            // normaliser: si ISO fourni, on n'envoie que YYYY-MM-DD pour simplifier
            let payloadVal = '';
            if (typeof isoOrEmpty === 'string') {
                if (isoOrEmpty === '') payloadVal = '';
                else payloadVal = (isoOrEmpty.length >= 10) ? isoOrEmpty.slice(0,10) : isoOrEmpty;
            }
            const r = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
                method: 'PUT',
                headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipping: { estimatedDeliveryAt: payloadVal } })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success) throw new Error(d.message || 'Échec mise à jour livraison estimée');
            showToast('Livraison estimée mise à jour', 'success');
            await loadOrdersList(1);
        } catch (e) {
            showToast(e.message || 'Erreur', 'error');
        }
    }

    async function updateTechnicalRef(orderId, fields) {
        if (!authToken) return logout();
        try {
            const payload = { meta: {} };
            const engineVal = typeof fields.engineDisplacement === 'string' ? fields.engineDisplacement : undefined;
            const tcuVal = typeof fields.tcuReference === 'string' ? fields.tcuReference : undefined;
            if (typeof engineVal === 'string') payload.meta.engineDisplacement = engineVal;
            if (typeof tcuVal === 'string') payload.meta.tcuReference = tcuVal;
            const hasEngine = typeof engineVal === 'string' && engineVal.trim().length > 0;
            const hasTcu = typeof tcuVal === 'string' && tcuVal.trim().length > 0;
            if (hasEngine && hasTcu) {
                payload.meta.technicalRefRequired = false;
            } else if (typeof fields.technicalRefRequired === 'boolean') {
                payload.meta.technicalRefRequired = fields.technicalRefRequired;
            }
            const r = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
                method: 'PUT',
                headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success) throw new Error(d.message || 'Échec mise à jour référence technique');
            showToast('Référence technique mise à jour', 'success');
            await loadOrdersList(1);
        } catch (e) {
            showToast(e.message || 'Erreur', 'error');
        }
    }

    function exportOrdersCsv() {
        if (!authToken) return logout();
        const q = (document.getElementById('orders-search-input')?.value || '').trim();
        const provider = (document.getElementById('orders-provider-filter')?.value || '').trim();
        const status = (document.getElementById('orders-status-filter')?.value || '').trim();
        const productType = (document.getElementById('orders-type-filter')?.value || '').trim();
        const from = (document.getElementById('orders-from')?.value || '').trim();
        const to = (document.getElementById('orders-to')?.value || '').trim();
        const sortVal = (document.getElementById('orders-sort')?.value || 'date_desc');
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (provider) params.set('provider', provider);
        if (status) params.set('status', status);
        if (productType) params.set('productType', productType);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const [sort, dir] = parseSort(sortVal);
        if (sort) params.set('sort', sort);
        if (dir) params.set('dir', dir);
        // Utiliser un téléchargement direct (les credentials ne sont pas nécessaires car Authorization Basic est requis; on ouvre dans le même domaine, donc le navigateur enverra l'en-tête? Non pour Basic manuel) -> on génère un fetch blob pour inclure l'auth.
        fetch(`/api/admin/orders/export.csv?${params.toString()}`, { headers: { 'Authorization': `Basic ${authToken}` } })
            .then(r => r.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'orders-export.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            })
            .catch(() => showToast('Erreur export CSV', 'error'));
    }

    function renderStatusBadge(status) {
        const s = String(status || '').toLowerCase();
        const styles = {
            'pending_payment': 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
            'awaiting_transfer': 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
            'pending': 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
            'on-hold': 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
            'paid': 'background:#dcfce7;color:#166534;border:1px solid #86efac;',
            'processing': 'background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;',
            'completed': 'background:#e9d5ff;color:#6b21a8;border:1px solid #d8b4fe;',
            'fulfilled': 'background:#e9d5ff;color:#6b21a8;border:1px solid #d8b4fe;',
            'cancelled': 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
            'failed': 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
            'refunded': 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;',
            'disputed': 'background:#fde68a;color:#92400e;border:1px solid #fcd34d;',
            'draft': 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;'
        };
        const labelMap = {
            'pending_payment': 'En attente de paiement',
            'awaiting_transfer': 'En attente virement',
            'pending': 'En attente',
            'on-hold': 'En attente',
            'paid': 'Payée',
            'processing': 'En traitement',
            'completed': 'Terminée',
            'fulfilled': 'Expédiée',
            'cancelled': 'Annulée',
            'failed': 'Échec',
            'refunded': 'Remboursée',
            'disputed': 'Litige',
            'draft': 'Brouillon'
        };
        const style = styles[s] || 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
        const label = labelMap[s] || (status || '—').toString();
        return `<span style="display:inline-block;padding:2px 6px;border-radius:12px;font-size:12px;${style}">${label}</span>`;
    }

    function openOrderDetails(id) {
        if (!authToken) return logout();
        const panel = document.getElementById('order-details-panel');
        const content = document.getElementById('order-details-content');
        const btnClose = document.getElementById('order-details-close');
        if (!panel || !content) return;
        panel.classList.add('open');
        panel.style.display = 'block';
        panel.setAttribute('aria-hidden', 'false');
        content.innerHTML = '<div class="od-loading"><i class="fas fa-spinner fa-spin"></i> Chargement des détails…</div>';
        if (btnClose) {
            btnClose.onclick = () => {
                panel.classList.remove('open');
                panel.style.display = '';
                panel.setAttribute('aria-hidden', 'true');
                content.innerHTML = '';
            };
        }
        fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { headers: { 'Authorization': `Basic ${authToken}` } })
            .then(r => r.json())
            .then(async d => {
                if (!d || !d.success || !d.order) throw new Error('Introuvable');
                const order = d.order;
                const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const escAttr = (s) => esc(s).replace(/'/g, '&#39;');
                const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, '');
                const formatDateTime = (val) => val ? new Date(val).toLocaleString('fr-FR') : '—';
                const formatDate = (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '—';

                const orderNumber = order.number || id;
                const currency = (order.totals && order.totals.currency) || 'EUR';
                const totalAmount = formatMoney((order.totals && order.totals.amount) || 0, currency);
                const created = formatDateTime(order.meta?.sourceCreatedAt || order.createdAt);
                const updated = formatDateTime(order.meta?.sourceUpdatedAt || order.updatedAt);
                const statusBadge = renderStatusBadge(order.status || '—');

                const customer = order.customer || {};
                const billing = order.billing?.address || {};
                const shipping = order.shipping?.address || {};
                const shippingInfo = order.shipping || {};
                const payment = order.payment || {};
                const items = Array.isArray(order.items) ? order.items : [];
                const events = Array.isArray(order.events) ? order.events : [];

                const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
                const latestEvent = events.length ? events[events.length - 1] : null;
                const paidLabel = payment.paidAt ? `Payée le ${formatDateTime(payment.paidAt)}` : 'En attente de paiement';
                const paidIcon = payment.paidAt ? 'fa-circle-check' : 'fa-clock';
                const providerLabel = order.provider ? esc(order.provider) : 'Source manuelle';
                const totalSummary = `${items.length} article${items.length > 1 ? 's' : ''} · ${totalQty} unité${totalQty > 1 ? 's' : ''}`;
                const paymentMethod = payment.method ? esc(payment.method) : '—';

                const vinStr = order.meta?.vinOrPlate ? String(order.meta.vinOrPlate) : '';
                const tags = [];
                if (order.provider) tags.push(`<span class="od-tag od-tag--link" data-provider="${escAttr(order.provider)}"><i class="fas fa-store"></i>${esc(order.provider)}</span>`);
                if (order.meta?.technicalRefRequired) tags.push('<span class="od-tag od-tag--warning"><i class="fas fa-exclamation-triangle"></i>Réf. technique requise</span>');
                if (!vinStr) tags.push('<span class="od-tag od-tag--warning"><i class="fas fa-id-card"></i>VIN / Plaque manquant</span>');
                if (payment.paidAt) tags.push('<span class="od-tag od-tag--success"><i class="fas fa-euro-sign"></i>Payée</span>');

                const shipmentGrid = `
                    <div class="od-grid od-grid--2">
                        <div class="od-field"><div class="od-label">Transporteur</div><div class="od-value">${esc(shippingInfo.carrier || '—')}</div></div>
                        <div class="od-field"><div class="od-label">N° de suivi</div><div class="od-value">${shippingInfo.trackingNumber ? `<span>${esc(shippingInfo.trackingNumber)}</span> <button class="od-copy" data-copy="${escAttr(shippingInfo.trackingNumber)}"><i class="fas fa-copy"></i></button>` : '—'}</div></div>
                        <div class="od-field"><div class="od-label">Expédiée le</div><div class="od-value">${formatDateTime(shippingInfo.shippedAt)}</div></div>
                        <div class="od-field"><div class="od-label">Livraison estimée</div><div class="od-value">${formatDate(order.shipping?.estimatedDeliveryAt)}</div></div>
                    </div>`;

                // Fallback variantes: si aucune option n'est disponible dans order.items, tenter de récupérer via /woo-raw
                let itemsOptions = items.map(it => Array.isArray(it.options) ? it.options : []);
                try {
                    const none = itemsOptions.every(arr => !Array.isArray(arr) || arr.length === 0);
                    if (items.length && none && order.provider === 'woocommerce') {
                        const r0 = await fetch(`/api/admin/orders/${encodeURIComponent(order._id)}/woo-raw`, { headers: { 'Authorization': `Basic ${authToken}` } });
                        const j0 = await r0.json().catch(() => ({}));
                        if (r0.ok && j0 && Array.isArray(j0.items) && j0.items.length) {
                            itemsOptions = j0.items.map(li => Array.isArray(li.meta_data)
                                ? li.meta_data
                                    .filter(m => (m.display_key || m.key) && (m.display_value || m.value))
                                    .map(m => ({ key: String(m.display_key || m.key), value: String(m.display_value || m.value) }))
                                : []);
                        }
                    }
                } catch(_) {}

                const itemsHtml = items.length ? `
                    <div class="od-table-wrap">
                        <table class="od-table">
                            <thead><tr><th>SKU</th><th>Article</th><th style="text-align:right;">Qté</th><th style="text-align:right;">Prix unitaire</th></tr></thead>
                            <tbody>
                                ${items.map((item, i) => {
                                    const name = stripTags(item.name || '');
                                    const sku = item.sku || '';
                                    const curOpts = Array.isArray(itemsOptions[i]) ? itemsOptions[i] : (Array.isArray(item.options) ? item.options : []);
                                    const opts = Array.isArray(curOpts) && curOpts.length
                                        ? `<div class=\"od-item-opts\" style=\"color:#64748b;font-size:12px;margin-top:2px;\">${curOpts.map(o => {
                                                const k = (o.key || '').toString().replace(/^pa_|attribute_/i,'').replace(/_/g,' ');
                                                return `${esc(k)}: ${esc(o.value || '')}`;
                                            }).join(' · ')}</div>`
                                        : '';
                                    return `
                                        <tr>
                                            <td>${esc(sku)}</td>
                                            <td>${esc(name)}${opts}</td>
                                            <td style=\"text-align:right;\">${item.qty || 0}</td>
                                            <td style=\"text-align:right;\">${formatMoney(item.unitPrice || 0, currency)}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" style="text-align:right;opacity:.8;">Sous-total HT</td>
                                    <td style="text-align:right;">${formatMoney((order.totals?.amount || 0) - (order.totals?.tax || 0) - (order.totals?.shipping || 0), order.totals?.currency || 'EUR')}</td>
                                </tr>
                                <tr>
                                    <td colspan="3" style="text-align:right;opacity:.8;">TVA</td>
                                    <td style="text-align:right;">${formatMoney(order.totals?.tax || 0, order.totals?.currency || 'EUR')}</td>
                                </tr>
                                <tr>
                                    <td colspan="3" style="text-align:right;opacity:.8;">Frais de port${order.shipping?.method ? ` · ${esc(order.shipping.method)}` : ''}</td>
                                    <td style="text-align:right;">${formatMoney(order.totals?.shipping || 0, order.totals?.currency || 'EUR')}</td>
                                </tr>
                                <tr>
                                    <td colspan="3" style="text-align:right;font-weight:600;">Total TTC</td>
                                    <td style="text-align:right;font-weight:600;">${formatMoney(order.totals?.amount || 0, order.totals?.currency || 'EUR')}</td>
                                </tr>
                                ${(order.shipping?.carrier || order.shipping?.trackingNumber) ? `
                                <tr>
                                    <td colspan="4" style="text-align:right;opacity:.8;">
                                        ${order.shipping?.carrier ? `Transporteur a0: ${esc(order.shipping.carrier)}` : ''}
                                        ${order.shipping?.carrier && order.shipping?.trackingNumber ? ' · ' : ''}
                                        ${order.shipping?.trackingNumber ? `Suivi a0: ${esc(order.shipping.trackingNumber)}` : ''}
                                    </td>
                                </tr>` : ''}
                            </tfoot>
                        </table>
                    </div>` : '<div class="od-empty"><i class="fas fa-box-open"></i>Aucun article enregistré</div>';

                const noteEvents = events.filter(ev => ev && ev.type === 'note');
                const notesHtml = noteEvents.length ? `
                    <ul class="od-notes">
                        ${noteEvents.slice().reverse().map(ev => `
                            <li class="od-note">
                                <div class="od-note__head"><span>${esc(ev?.payloadSnippet?.by || 'Agent')}</span><span>${formatDateTime(ev.at)}</span></div>
                                <div class="od-note__body">${esc(ev.message || '')}</div>
                            </li>`).join('')}
                    </ul>` : '<div class="od-empty"><i class="fas fa-comment-slash"></i>Aucune note interne</div>';

                const historyEvents = events.filter(ev => ev && ev.type !== 'note');

                // Supprimer le badge "Paiement" dans la bannière si présent
                try {
                    setTimeout(() => {
                        const root = document.getElementById('order-details-content');
                        if (!root) return;
                        const cards = root.querySelectorAll('.od-banner__quick-card');
                        cards.forEach(card => {
                            const label = card.querySelector('.od-banner__quick-label');
                            if (label && /paiement/i.test(label.textContent || '')) {
                                card.remove();
                            }
                        });
                    }, 0);
                } catch(_) {}
                const formatEventEntry = (ev) => {
                    const type = String(ev?.type || '').toLowerCase();
                    const message = ev?.message || '';
                    const cleanedMessage = message.trim();
                    const defaultTitle = type ? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Événement';
                    const defaultDescription = cleanedMessage || 'Action enregistrée.';
                    const payload = ev?.payloadSnippet || {};
                    switch (type) {
                        case 'technical_ref_required_set': {
                            const isCleared = cleanedMessage.toLowerCase().includes('non requise');
                            const isAuto = cleanedMessage.toLowerCase().includes('rétroactif');
                            return {
                                title: 'Référence technique',
                                description: isCleared
                                    ? "La référence technique est désormais considérée comme complète."
                                    : isAuto
                                        ? 'La commande nécessite une vérification technique (détection automatique).'
                                        : cleanedMessage || 'La commande nécessite une vérification technique.'
                            };
                        }
                        case 'technical_ref_updated':
                            if (cleanedMessage.toLowerCase().includes('cylindrée')) {
                                return {
                                    title: 'Cylindrée mise à jour',
                                    description: cleanedMessage.replace('Cylindrée:', 'Nouvelle cylindrée :').trim() || 'La cylindrée a été mise à jour.'
                                };
                            }
                            if (cleanedMessage.toLowerCase().includes('tcu')) {
                                return {
                                    title: 'Référence TCU mise à jour',
                                    description: cleanedMessage.replace('TCU:', 'Nouvelle référence :').trim() || 'La référence TCU a été mise à jour.'
                                };
                            }
                            return {
                                title: 'Référence technique mise à jour',
                                description: cleanedMessage || 'Les informations de référence technique ont été modifiées.'
                            };
                        case 'estimated_delivery_set':
                            return {
                                title: 'Livraison estimée définie',
                                description: cleanedMessage || 'Une date de livraison estimée a été enregistrée.'
                            };
                        case 'estimated_delivery_unset':
                            return {
                                title: 'Livraison estimée retirée',
                                description: cleanedMessage || 'La date de livraison estimée a été supprimée.'
                            };
                        case 'status_changed':
                        case 'order_status_changed':
                            return {
                                title: 'Statut de commande mis à jour',
                                description: cleanedMessage || 'Le statut de la commande a été modifié.'
                            };
                        case 'payment_marked_paid':
                            return {
                                title: 'Paiement confirmé',
                                description: cleanedMessage || 'La commande a été marquée comme payée.'
                            };
                        case 'product_type_set': {
                            const typeValue = cleanedMessage.split('=').pop()?.trim();
                            return {
                                title: 'Type de produit identifié',
                                description: typeValue ? `La commande est classée comme : ${typeValue}.` : 'Le type de produit a été identifié.'
                            };
                        }
                        case 'woo_update_pushed': {
                            const wooId = payload?.id || payload?.orderId;
                            return null;
                        }
                        case 'woo_sync': {
                            return null;
                        }
                        case 'order_updated_admin':
                            return {
                                title: 'Modification manuelle',
                                description: 'La commande a été ajustée par un administrateur.'
                            };
                        case 'mollie_sync_update': {
                            const status = payload?.status || '';
                            return {
                                title: 'Synchronisation Mollie',
                                description: status ? `Statut de paiement mis à jour via Mollie : ${status}.` : 'Mise à jour de paiement reçue via Mollie.'
                            };
                        }
                        case 'mollie_webhook_update': {
                            const status = payload?.status || '';
                            return {
                                title: 'Webhook Mollie reçu',
                                description: status ? `Notification de Mollie : statut ${status}.` : 'Notification de mise à jour reçue depuis Mollie.'
                            };
                        }
                        case 'technical_ref_initialized':
                            return {
                                title: 'Référence technique initialisée',
                                description: cleanedMessage || 'Les champs de référence technique ont été préparés.'
                            };
                        case 'mark_paid_bank_transfer':
                            return {
                                title: 'Paiement par virement bancaire',
                                description: cleanedMessage || 'La commande a été marquée comme payée par virement.'
                            };
                        case 'order_shipped': {
                            const carrier = payload?.carrier || '';
                            const tracking = payload?.trackingNumber || '';
                            const parts = [];
                            if (carrier) parts.push(`Transporteur : ${carrier}`);
                            if (tracking) parts.push(`Suivi : ${tracking}`);
                            return {
                                title: 'Commande expédiée',
                                description: parts.length ? parts.join(' · ') : cleanedMessage || 'La commande a été expédiée.'
                            };
                        }
                        default:
                            return { title: defaultTitle, description: defaultDescription };
                    }
                };
                const timelineHtml = historyEvents.length ? `
                    <ul class="od-timeline">
                        ${historyEvents.slice().reverse().map(ev => {
                            const entry = formatEventEntry(ev);
                            if (!entry) return '';
                            return `
                            <li class="od-timeline__item">
                                <span class="od-timeline__dot"></span>
                                <div class="od-timeline__content">
                                    <div class="od-timeline__time">${formatDateTime(ev.at)}</div>
                                    <div class="od-timeline__title">${esc(entry.title)}</div>
                                    <div class="od-timeline__text">${esc(entry.description)}</div>
                                </div>
                            </li>`;
                        }).join('')}
                    </ul>` : '<div class="od-empty"><i class="fas fa-stream"></i>Aucun historique disponible</div>';

                const addressBlock = (addr) => [addr.address1, addr.address2, `${addr.postcode || ''} ${addr.city || ''}`.trim(), addr.country]
                    .filter(Boolean)
                    .map(line => esc(line))
                    .join('<br>');

                content.innerHTML = `
                    <div class="od-layout" role="document" aria-label="Détails commande">
                        <section class="od-banner">
                            <div class="od-banner__left">
                                <div class="od-banner__header">
                                    <div class="od-banner__icon"><i class="fas fa-receipt"></i></div>
                                    <div class="od-banner__info">
                                        <div class="od-banner__title-row">
                                            <h3>Commande ${esc(orderNumber)}</h3>
                                            <button class="od-copy od-copy--ghost" data-copy="${escAttr(orderNumber)}"><i class="fas fa-copy"></i> Copier</button>
                                        </div>
                                        <div class="od-banner__meta-line"><i class="fas fa-calendar-plus"></i><span>Créée le ${created}</span></div>
                                        <div class="od-banner__meta-line"><i class="fas fa-clock"></i><span>Dernière mise à jour ${updated}</span></div>
                                    </div>
                                </div>
                                ${tags.length ? `<div class="od-tags">${tags.join(' ')}</div>` : ''}
                                <div class="od-banner__meta-timeline">
                                    <div class="od-banner__meta-item"><span>Créée</span><strong>${created}</strong></div>
                                    <span class="od-banner__meta-sep" aria-hidden="true"></span>
                                    <div class="od-banner__meta-item"><span>Dernière mise à jour</span><strong>${updated}</strong></div>
                                    <span class="od-banner__meta-sep" aria-hidden="true"></span>
                                    <div class="od-banner__meta-item"><span>Source</span><strong>${providerLabel}</strong></div>
                                </div>
                                <div class="od-banner__quick">
                                    <div class="od-banner__quick-card">
                                        <span class="od-banner__quick-label"><i class="fas fa-box"></i>Articles</span>
                                        <span class="od-banner__quick-value">${items.length}</span>
                                        <span class="od-banner__quick-hint">${totalSummary}</span>
                                    </div>
                                    <div class="od-banner__quick-card">
                                        <span class="od-banner__quick-label"><i class="fas fa-wallet"></i>Paiement</span>
                                        <span class="od-banner__quick-value">${paymentMethod}</span>
                                        <span class="od-banner__quick-hint">${paidLabel}</span>
                                    </div>
                                    <div class="od-banner__quick-card">
                                        <span class="od-banner__quick-label"><i class="fas fa-key"></i>Référence technique</span>
                                        <span class="od-banner__quick-value">${order.meta?.tcuReference ? esc(order.meta.tcuReference) : '—'}</span>
                                        <span class="od-banner__quick-hint">${order.meta?.engineDisplacement ? `${esc(order.meta.engineDisplacement)} · Cylindrée` : 'Cylindrée non renseignée'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="od-banner__right">
                                <div class="od-banner__status-chip" title="Statut actuel">${statusBadge}</div>
                                <div class="od-banner__amount-wrap">
                                    <div class="od-banner__amount">${totalAmount}</div>
                                    <div class="od-banner__amount-hint">Total TTC</div>
                                </div>
                                <div class="od-actions">
                                    <button class="btn-secondary" id="od-edit"><i class="fas fa-pen"></i> Modifier</button>
                                    <button class="btn-secondary" id="od-paid"><i class="fas fa-euro-sign"></i> Marquer payé</button>
                                    <button class="btn-primary" id="od-ship"><i class="fas fa-truck"></i> Expédier</button>
                                </div>
                            </div>
                        </section>
                        
                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-receipt"></i>Résumé commande</h3></div>
                            <div class="od-card od-card--flat">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field">
                                        <div class="od-label">Sous-total HT</div>
                                        <div class="od-value">${formatMoney((order.totals?.amount || 0) - (order.totals?.tax || 0) - (order.totals?.shipping || 0), order.totals?.currency || 'EUR')}</div>
                                    </div>
                                    <div class="od-field">
                                        <div class="od-label">TVA</div>
                                        <div class="od-value">${formatMoney(order.totals?.tax || 0, order.totals?.currency || 'EUR')}</div>
                                    </div>
                                    <div class="od-field">
                                        <div class="od-label">Frais de port</div>
                                        <div class="od-value">${formatMoney(order.totals?.shipping || 0, order.totals?.currency || 'EUR')}</div>
                                    </div>
                                    <div class="od-field">
                                        <div class="od-label">Total TTC</div>
                                        <div class="od-value">${formatMoney(order.totals?.amount || 0, order.totals?.currency || 'EUR')}</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-truck"></i>Expédition</h3></div>
                            <div class="od-card od-card--flat">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field"><div class="od-label">Méthode</div><div class="od-value">${order.shipping?.method ? esc(order.shipping.method) : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Transporteur</div><div class="od-value">${order.shipping?.carrier ? esc(order.shipping.carrier) : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">N° de suivi</div><div class="od-value">${order.shipping?.trackingNumber ? esc(order.shipping.trackingNumber) : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Livraison estimée</div><div class="od-value">${order.shipping?.estimatedDeliveryAt ? formatDate(new Date(order.shipping.estimatedDeliveryAt)) : '—'}</div></div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-user"></i>Client</h3></div>
                            <div class="od-card">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field"><div class="od-label">Nom</div><div class="od-value">${esc(customer.name || '—')}</div></div>
                                    <div class="od-field"><div class="od-label">Email</div><div class="od-value">${customer.email ? `<a href="mailto:${escAttr(customer.email)}">${esc(customer.email)}</a> <button class="od-copy" data-copy="${escAttr(customer.email)}"><i class="fas fa-copy"></i></button>` : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Téléphone</div><div class="od-value">${customer.phone ? `<a href="tel:${escAttr(customer.phone)}">${esc(customer.phone)}</a>` : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Compte créé</div><div class="od-value">${formatDateTime(customer.createdAt)}</div></div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-file-invoice"></i>Facturation</h3></div>
                            <div class="od-card">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field"><div class="od-label">Nom</div><div class="od-value">${esc(billing.name || customer.name || '—')}</div></div>
                                    <div class="od-field"><div class="od-label">Société</div><div class="od-value">${esc(billing.company || '—')}</div></div>
                                    <div class="od-field"><div class="od-label">Adresse</div><div class="od-value od-value--multiline">${addressBlock(billing) || '—'}</div></div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-shipping-fast"></i>Livraison</h3></div>
                            <div class="od-card od-card--flat">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field"><div class="od-label">Nom</div><div class="od-value">${esc(shipping.name || customer.name || '—')}</div></div>
                                    <div class="od-field"><div class="od-label">Téléphone</div><div class="od-value">${shipping.phone ? `<a href="tel:${escAttr(shipping.phone)}">${esc(shipping.phone)}</a>` : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Société</div><div class="od-value">${esc(shipping.company || '—')}</div></div>
                                    <div class="od-field"><div class="od-label">Adresse</div><div class="od-value od-value--multiline">${addressBlock(shipping) || '—'}</div></div>
                                </div>
                                ${shipmentGrid}
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-car"></i>Véhicule</h3></div>
                            <div class="od-card od-card--flat">
                                <div class="od-grid od-grid--2">
                                    <div class="od-field"><div class="od-label">VIN / Plaque</div><div class="od-value">${vinStr ? `${esc(vinStr)} <button class="od-copy" data-copy="${escAttr(vinStr)}"><i class="fas fa-copy"></i></button>` : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Référence TCU</div><div class="od-value">${order.meta?.tcuReference ? esc(order.meta.tcuReference) : '—'}</div></div>
                                    <div class="od-field"><div class="od-label">Cylindrée</div><div class="od-value">${order.meta?.engineDisplacement ? esc(order.meta.engineDisplacement) : '—'}</div></div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-list"></i>Articles</h3></div>
                            <div class="od-card od-card--flat">${itemsHtml}</div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-sticky-note"></i>Notes internes</h3></div>
                            <div class="od-card od-card--flat">
                                ${notesHtml}
                                <div class="od-note-form">
                                    <textarea id="od-note-text" placeholder="Écrire une note pour les autres agents…"></textarea>
                                    <div class="od-note-form__actions">
                                        <button id="od-add-note" class="btn-secondary"><i class="fas fa-plus"></i> Ajouter la note</button>
                                        <div id="od-note-error" class="login-error" style="display:none;"></div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="od-section">
                            <div class="od-section__header"><h3 class="od-section__title"><i class="fas fa-stream"></i>Historique</h3></div>
                            <div class="od-card od-card--flat">${timelineHtml}</div>
                        </section>
                    </div>`;

                try {
                    const btnEdit = content.querySelector('#od-edit');
                    const btnShip = content.querySelector('#od-ship');
                    const btnPaid = content.querySelector('#od-paid');
                    if (btnEdit) btnEdit.addEventListener('click', () => openEditOrderModal(id));
                    if (btnShip) btnShip.addEventListener('click', () => openShipModal(id));
                    if (btnPaid) btnPaid.addEventListener('click', async () => {
                        try {
                            btnPaid.disabled = true;
                            btnPaid.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement…';
                            const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/mark-paid`, { method: 'POST', headers: { 'Authorization': `Basic ${authToken}` } });
                            const d2 = await r.json().catch(() => ({}));
                            if (!r.ok || !d2.success) throw new Error(d2.message || 'Échec marquage payé');
                            showToast('Commande marquée payée', 'success');
                            await loadOrdersList(1);
                            setTimeout(() => openOrderDetails(id), 150);
                        } catch (errPaid) {
                            showToast(errPaid.message || 'Erreur', 'error');
                        } finally {
                            btnPaid.disabled = false;
                            btnPaid.innerHTML = '<i class="fas fa-euro-sign"></i> Marquer payé';
                        }
                    });
                } catch {}

                try {
                    content.querySelectorAll('[data-copy]').forEach(el => {
                        el.addEventListener('click', async () => {
                            const value = el.getAttribute('data-copy') || '';
                            try {
                                await navigator.clipboard.writeText(value);
                                showToast('Copié dans le presse-papier', 'success');
                            } catch {}
                        });
                    });
                } catch {}

                try {
                    const addBtn = content.querySelector('#od-add-note');
                    const noteInput = content.querySelector('#od-note-text');
                    const noteErr = content.querySelector('#od-note-error');
                    const submitNote = async () => {
                        if (!addBtn) return;
                        const msg = (noteInput?.value || '').trim();
                        if (!msg) {
                            noteErr.textContent = 'Veuillez écrire une note.';
                            noteErr.style.display = 'block';
                            return;
                        }
                        try {
                            noteErr.style.display = 'none';
                            noteErr.textContent = '';
                            addBtn.disabled = true;
                            addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout…';
                            const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/notes`, {
                                method: 'POST',
                                headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: msg })
                            });
                            const d3 = await r.json().catch(() => ({}));
                            if (!r.ok || !d3.success) throw new Error(d3.message || 'Échec ajout note');
                            showToast('Note ajoutée', 'success');
                            openOrderDetails(id);
                        } catch (errNote) {
                            noteErr.textContent = errNote.message || 'Erreur';
                            noteErr.style.display = 'block';
                        } finally {
                            addBtn.disabled = false;
                            addBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter la note';
                        }
                    };
                    if (addBtn) addBtn.addEventListener('click', submitNote);
                    if (noteInput) noteInput.addEventListener('keydown', (e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitNote();
                    });
                } catch {}
            })
            .catch(() => {
                content.innerHTML = '<div class="login-error">Impossible de charger la commande</div>';
            });
    }

    function openCreateOrderModal() {
        if (!authToken) return logout();
        const root = ensureModalRoot();
        root.style.display = 'flex';
        root.innerHTML = '';
        const modal = document.createElement('div');
        modal.className = 'cpf-modal';
        modal.style.maxWidth = '1024px';
        modal.style.width = '95vw';
        modal.style.maxHeight = '90vh';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.innerHTML = `
          <div class="cpf-modal-header">
            <div class="icon"><i class="fas fa-cart-plus"></i></div>
            <div class="cpf-modal-title">Créer une commande</div>
          </div>
          <div class="cpf-modal-body co-order-modal-body">
            <style>
              .co-order-modal-body { flex: 1; overflow: auto; padding-right: 4px; }
              .co-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
              .co-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
              .co-section { margin-top:10px; }
              .co-section h4 { margin:6px 0; font-size:14px; }
              .co-inline { display:flex; align-items:center; gap:8px; }
              .co-help { color:#6b7280; font-size:12px; }
              .co-totals { background:#f9fafb; border:1px solid #e5e7eb; padding:8px; border-radius:8px; }
              .co-totals .row { display:flex; justify-content:space-between; margin:2px 0; }
              .co-table-wrap { overflow-x:auto; margin-top:6px; border:1px solid #e5e7eb; border-radius:8px; }
              .tickets-table.co-table { min-width: 900px; width: 100%; }
              #co-items input { height: 34px; }
              #co-items .co-qty { width: 80px; text-align: right; }
              #co-items .co-price { width: 120px; text-align: right; }
              #co-items .co-name { min-width: 220px; }
              #co-items .co-sku { min-width: 140px; }
              .co-del { padding: 6px 10px; }
              /* Styles champs */
              .co-field { display:flex; flex-direction:column; gap:4px; }
              .co-field label { font-size:12px; color:#374151; }
              .co-field input, .co-field select { height:36px; border:1px solid #d1d5db; border-radius:8px; padding:6px 10px; }
              .co-field input:focus, .co-field select:focus { outline:none; border-color:#93c5fd; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
              @media (max-width: 640px) {
                .co-grid-2 { grid-template-columns: 1fr; }
                .tickets-table.co-table { min-width: 580px; }
              }
              @media (max-height: 700px) {
                .co-grid-2 { gap:6px; }
                .co-section { margin-top:6px; }
                .co-totals { padding:6px; }
              }
              /* Garder la barre d'actions visible et lisible */
              .cpf-modal .cpf-modal-actions { background:#fff; border-top:1px solid #e5e7eb; padding:10px 12px; }
            </style>
            <div class="co-grid-2">
              <div>
                <label>Numéro (optionnel)</label>
                <input id="co-number" type="text" />
              </div>
              <div>
                <label>Devise</label>
                <input id="co-currency" type="text" value="EUR" />
              </div>
              <div>
                <label>Source</label>
                <select id="co-provider">
                  <option value="manual">Manuelle</option>
                  <option value="mollie">Mollie</option>
                  <option value="bank_transfer">Virement</option>
                </select>
              </div>
            </div>
            <div class="co-section">
              <h4>Adresse de facturation</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="co-bill-name">Nom complet</label><input id="co-bill-name" type="text" placeholder="Nom et prénom" /></div>
                <div class="co-field"><label for="co-bill-company">Société (optionnel)</label><input id="co-bill-company" type="text" /></div>
                <div class="co-field"><label for="co-bill-email">Email</label><input id="co-bill-email" type="email" placeholder="client@example.com" /></div>
                <div class="co-field"><label for="co-bill-phone">Téléphone</label><input id="co-bill-phone" type="text" /></div>
                <div class="co-field"><label for="co-bill-address1">Adresse 1</label><input id="co-bill-address1" type="text" placeholder="N°, rue" /></div>
                <div class="co-field"><label for="co-bill-address2">Adresse 2</label><input id="co-bill-address2" type="text" placeholder="Complément" /></div>
                <div class="co-field"><label for="co-bill-city">Ville</label><input id="co-bill-city" type="text" /></div>
                <div class="co-field"><label for="co-bill-postcode">Code postal</label><input id="co-bill-postcode" type="text" /></div>
                <div class="co-field"><label for="co-bill-country">Pays</label><input id="co-bill-country" type="text" value="FR" /></div>
              </div>
            </div>
            <div class="co-section">
              <h4>Adresse de livraison</h4>
              <div class="co-inline" style="margin-bottom:6px;">
                <input id="co-ship-same" type="checkbox" checked />
                <label for="co-ship-same">Identique à la facturation</label>
              </div>
              <div class="co-grid-2" id="co-ship-grid">
                <div class="co-field"><label for="co-ship-name">Nom complet</label><input id="co-ship-name" type="text" placeholder="Nom et prénom" /></div>
                <div class="co-field"><label for="co-ship-company">Société (optionnel)</label><input id="co-ship-company" type="text" /></div>
                <div class="co-field"><label for="co-ship-phone">Téléphone</label><input id="co-ship-phone" type="text" /></div>
                <div class="co-field"><label for="co-ship-address1">Adresse 1</label><input id="co-ship-address1" type="text" placeholder="N°, rue" /></div>
                <div class="co-field"><label for="co-ship-address2">Adresse 2</label><input id="co-ship-address2" type="text" placeholder="Complément" /></div>
                <div class="co-field"><label for="co-ship-city">Ville</label><input id="co-ship-city" type="text" /></div>
                <div class="co-field"><label for="co-ship-postcode">Code postal</label><input id="co-ship-postcode" type="text" /></div>
                <div class="co-field"><label for="co-ship-country">Pays</label><input id="co-ship-country" type="text" value="FR" /></div>
              </div>
            </div>
            <div class="co-section">
              <h4>Véhicule</h4>
              <div class="co-grid-2">
                <div class="co-field"><label for="co-vin">VIN / Plaque (optionnel)</label><input id="co-vin" type="text" placeholder="Ex: VF3XXXXXXXXXXXXXX ou AB-123-CD" /></div>
              </div>
            </div>
            <hr/>
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <h4 style="margin:6px 0;">Articles</h4>
                <button id="co-add-item" class="btn-secondary"><i class="fas fa-plus"></i> Ajouter</button>
              </div>
              <div class="co-table-wrap">
                <table class="tickets-table co-table">
                  <thead><tr><th>SKU</th><th>Libellé</th><th>Qté</th><th>Prix unitaire (€)</th><th></th></tr></thead>
                  <tbody id="co-items"></tbody>
                </table>
              </div>
              <div class="co-help">Renseigne au moins un article avec une quantité &gt; 0 et un prix unitaire &gt; 0.</div>
            </div>
            <div class="co-grid-2" style="margin-top:8px;">
              <div>
                <label>Frais de port</label>
                <input id="co-shipping" type="number" step="0.01" value="0" />
              </div>
              <div>
                <label>Taxes</label>
                <input id="co-tax" type="number" step="0.01" value="0" />
              </div>
            </div>
            <div class="co-totals" style="margin-top:8px;">
              <div class="row"><span>Sous-total articles</span><span id="co-subtotal">0,00 €</span></div>
              <div class="row"><span>Frais de port</span><span id="co-shipping-out">0,00 €</span></div>
              <div class="row"><span>Taxes</span><span id="co-tax-out">0,00 €</span></div>
              <div class="row" style="font-weight:600;"><span>Total</span><span id="co-total">0,00 €</span></div>
            </div>
            <div class="co-inline" style="margin-top:8px;">
              <input id="co-mark-paid" type="checkbox" />
              <label for="co-mark-paid">Marquer payée (virement)</label>
            </div>
            <div id="co-error" class="login-error" style="display:none;"></div>
          </div>
          <div class="cpf-modal-actions">
            <button class="cpf-btn" data-action="cancel">Annuler</button>
            <button class="cpf-btn cpf-btn-primary" data-action="confirm">Créer</button>
          </div>
        `;
        const onCleanup = () => { root.style.display = 'none'; root.innerHTML=''; root.removeEventListener('click', onOverlayClick); };
        const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
        root.addEventListener('click', onOverlayClick);
        root.appendChild(modal);

        const itemsTbody = modal.querySelector('#co-items');
        const addItemBtn = modal.querySelector('#co-add-item');
        const subtotalEl = modal.querySelector('#co-subtotal');
        const totalEl = modal.querySelector('#co-total');
        const shipOutEl = modal.querySelector('#co-shipping-out');
        const taxOutEl = modal.querySelector('#co-tax-out');
        const errEl = modal.querySelector('#co-error');
        const estEl = modal.querySelector('#co-estimated');
        const engEl = modal.querySelector('#co-engine');
        const tcuEl = modal.querySelector('#co-tcu');
        const reqEl = modal.querySelector('#co-tech-req');
        const vinEl = modal.querySelector('#co-vin');
        const shipSameCbx = modal.querySelector('#co-ship-same');
        const billFields = {
            name: modal.querySelector('#co-bill-name'), company: modal.querySelector('#co-bill-company'), email: modal.querySelector('#co-bill-email'), phone: modal.querySelector('#co-bill-phone'),
            address1: modal.querySelector('#co-bill-address1'), address2: modal.querySelector('#co-bill-address2'),
            city: modal.querySelector('#co-bill-city'), postcode: modal.querySelector('#co-bill-postcode'), country: modal.querySelector('#co-bill-country')
        };
        const shipFields = {
            name: modal.querySelector('#co-ship-name'), company: modal.querySelector('#co-ship-company'), phone: modal.querySelector('#co-ship-phone'),
            address1: modal.querySelector('#co-ship-address1'), address2: modal.querySelector('#co-ship-address2'),
            city: modal.querySelector('#co-ship-city'), postcode: modal.querySelector('#co-ship-postcode'), country: modal.querySelector('#co-ship-country')
        };
        function copyBillToShip() {
            Object.keys(shipFields).forEach(k => { if (billFields[k]) shipFields[k].value = billFields[k]?.value || ''; });
        }
        function setShipDisabled(disabled) {
            Object.values(shipFields).forEach(el => { el.disabled = disabled; el.closest('.co-field').style.opacity = disabled ? 0.6 : 1; });
        }
        if (shipSameCbx) {
            setShipDisabled(true);
            copyBillToShip();
            shipSameCbx.addEventListener('change', () => {
                const same = !!shipSameCbx.checked;
                if (same) copyBillToShip();
                setShipDisabled(same);
            });
            // si on modifie la facturation et que la case est cochée, répliquer
            Object.values(billFields).forEach(el => el.addEventListener('input', () => { if (shipSameCbx.checked) copyBillToShip(); }));
        }

        function addItemRow(it = {}) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><input type="text" class="co-sku" value="${it.sku || ''}"></td>
              <td><input type="text" class="co-name" value="${it.name || ''}"></td>
              <td><input type="number" class="co-qty" step="1" min="0" value="${it.qty || 1}"></td>
              <td><input type="number" class="co-price" step="0.01" min="0" value="${it.unitPrice || 0}"></td>
              <td><button class="btn-secondary co-del"><i class="fas fa-trash"></i></button></td>
            `;
            itemsTbody.appendChild(tr);
        }
        function computeTotal() {
            const currency = (modal.querySelector('#co-currency')?.value || 'EUR').trim() || 'EUR';
            const rows = itemsTbody.querySelectorAll('tr');
            let itemsSum = 0;
            rows.forEach(r => {
                const q = parseFloat(r.querySelector('.co-qty')?.value || '0');
                const p = parseFloat(r.querySelector('.co-price')?.value || '0');
                itemsSum += (isNaN(q) ? 0 : q) * (isNaN(p) ? 0 : p);
            });
            const ship = parseFloat(modal.querySelector('#co-shipping')?.value || '0');
            const tax = parseFloat(modal.querySelector('#co-tax')?.value || '0');
            const shippingV = (isNaN(ship)?0:ship);
            const taxV = (isNaN(tax)?0:tax);
            const total = itemsSum + shippingV + taxV;
            subtotalEl.textContent = formatMoney(itemsSum, currency);
            shipOutEl.textContent = formatMoney(shippingV, currency);
            taxOutEl.textContent = formatMoney(taxV, currency);
            totalEl.textContent = formatMoney(total, currency);
        }
        addItemBtn.addEventListener('click', () => { addItemRow(); computeTotal(); });
        itemsTbody.addEventListener('click', (e) => {
            if (e.target.closest('.co-del')) {
                const tr = e.target.closest('tr');
                tr.parentNode.removeChild(tr);
                computeTotal();
            }
        });
        modal.addEventListener('input', (e) => {
            if (e.target.matches('.co-qty, .co-price, #co-shipping, #co-tax, #co-currency')) computeTotal();
        });
        // préparer une ligne par défaut
        addItemRow();
        computeTotal();

        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        cancelBtn.addEventListener('click', onCleanup);
        confirmBtn.addEventListener('click', async () => {
            try {
                errEl.style.display = 'none'; errEl.textContent = '';
                // Validation simple
                const emailVal = (billFields.email?.value || '').trim();
                const rows = itemsTbody.querySelectorAll('tr');
                let hasItem = false;
                rows.forEach(r => {
                    const q = parseFloat(r.querySelector('.co-qty')?.value || '0') || 0;
                    const p = parseFloat(r.querySelector('.co-price')?.value || '0') || 0;
                    if (q > 0 && p > 0) hasItem = true;
                });
                const errors = [];
                if (!emailVal) errors.push('Email client requis');
                if (!hasItem) errors.push('Ajouter au moins un article avec quantité et prix > 0');
                if (errors.length) {
                    errEl.innerHTML = errors.map(e => `• ${e}`).join('<br/>');
                    errEl.style.display = 'block';
                    return;
                }
                const payload = {
                    provider: (modal.querySelector('#co-provider')?.value || 'manual'),
                    number: (modal.querySelector('#co-number')?.value || '').trim() || undefined,
                    customer: {
                        name: (billFields.name?.value || '').trim(),
                        email: (billFields.email?.value || '').trim(),
                        phone: (billFields.phone?.value || '').trim()
                    },
                    totals: {
                        currency: (modal.querySelector('#co-currency')?.value || 'EUR').trim() || 'EUR',
                        amount: 0,
                        shipping: parseFloat(modal.querySelector('#co-shipping')?.value || '0') || 0,
                        tax: parseFloat(modal.querySelector('#co-tax')?.value || '0') || 0
                    },
                    items: []
                };
                rows.forEach(r => {
                    const sku = (r.querySelector('.co-sku')?.value || '').trim();
                    const name = (r.querySelector('.co-name')?.value || '').trim();
                    const qty = parseFloat(r.querySelector('.co-qty')?.value || '0') || 0;
                    const unitPrice = parseFloat(r.querySelector('.co-price')?.value || '0') || 0;
                    if (qty > 0 && (name || sku)) payload.items.push({ sku, name, qty, unitPrice });
                    payload.totals.amount += qty * unitPrice;
                });
                payload.totals.amount += (payload.totals.shipping || 0) + (payload.totals.tax || 0);
                // Adresses facturation + livraison
                const billingAddr = {
                    name: (billFields.name?.value || '').trim(), company: (billFields.company?.value || '').trim(),
                    email: (billFields.email?.value || '').trim(), phone: (billFields.phone?.value || '').trim(),
                    address1: (billFields.address1?.value || '').trim(), address2: (billFields.address2?.value || '').trim(),
                    city: (billFields.city?.value || '').trim(), postcode: (billFields.postcode?.value || '').trim(),
                    country: (billFields.country?.value || '').trim()
                };
                const hasBilling = Object.values(billingAddr).some(v => v);
                if (hasBilling) payload.billing = { address: billingAddr };
                const shippingAddr = {
                    name: (shipFields.name?.value || '').trim(), company: (shipFields.company?.value || '').trim(), phone: (shipFields.phone?.value || '').trim(),
                    address1: (shipFields.address1?.value || '').trim(), address2: (shipFields.address2?.value || '').trim(),
                    city: (shipFields.city?.value || '').trim(), postcode: (shipFields.postcode?.value || '').trim(),
                    country: (shipFields.country?.value || '').trim()
                };
                const hasShipping = Object.values(shippingAddr).some(v => v);
                if (hasShipping) payload.shipping = { address: shippingAddr };
                const estVal = (estEl?.value || '').trim();
                if (estVal) {
                  payload.shipping = payload.shipping || {};
                  payload.shipping.estimatedDeliveryAt = estVal;
                }
                const vinVal = (vinEl?.value || '').trim();
                if (vinVal) payload.meta = { vinOrPlate: vinVal };
                // Référence technique (création)
                const engVal = (engEl?.value || '').trim();
                const tcuVal = (tcuEl?.value || '').trim();
                const reqVal = !!(reqEl?.checked);
                payload.meta = payload.meta || {};
                if (engVal !== undefined) payload.meta.engineDisplacement = engVal;
                if (tcuVal !== undefined) payload.meta.tcuReference = tcuVal;
                payload.meta.technicalRefRequired = reqVal;
                // Marquer payée (virement)
                const markPaid = !!modal.querySelector('#co-mark-paid')?.checked;
                if (markPaid) payload.markPaid = true;
                if (!payload.customer.email) throw new Error('Email client requis');
                const res = await fetch('/api/admin/orders', {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.message || 'Création impossible');
                onCleanup();
                showToast('Commande créée', 'success');
                try {
                    const f1 = document.getElementById('orders-search-input'); if (f1) f1.value = '';
                    const f2 = document.getElementById('orders-provider-filter'); if (f2) f2.value = '';
                    const f3 = document.getElementById('orders-status-filter'); if (f3) f3.value = '';
                    const f4 = document.getElementById('orders-from'); if (f4) f4.value = '';
                    const f5 = document.getElementById('orders-to'); if (f5) f5.value = '';
                    const f6 = document.getElementById('orders-sort'); if (f6) f6.value = 'date_desc';
                    const f7 = document.getElementById('orders-type-filter'); if (f7) f7.value = '';
                } catch(_) {}
                await loadOrdersList(1);
                try { if (data.order && data.order._id) setTimeout(() => openOrderDetails(data.order._id), 200); } catch(_) {}
            } catch (e) {
                errEl.textContent = e.message || 'Erreur lors de la création';
                errEl.style.display = 'block';
            }
        });
    }
    
    // Modale Expédition (transporteur + n° de suivi)
    function openShipModal(orderId) {
        if (!authToken) return logout();
        const root = ensureModalRoot();
        root.style.display = 'flex';
        root.innerHTML = '';
        const modal = document.createElement('div');
        modal.className = 'cpf-modal';
        modal.style.maxWidth = '520px';
        modal.style.width = '95vw';
        modal.innerHTML = `
          <div class="cpf-modal-header">
            <div class="icon"><i class="fas fa-truck"></i></div>
            <div class="cpf-modal-title">Expédier la commande</div>
          </div>
          <div class="cpf-modal-body">
            <style>
              .ship-field { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
              .ship-field label { font-size:12px; color:#374151; }
              .ship-field input, .ship-field select { height:36px; border:1px solid #d1d5db; border-radius:8px; padding:6px 10px; }
              .ship-field input:focus, .ship-field select:focus { outline:none; border-color:#93c5fd; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
            </style>
            <div class="ship-field">
              <label for="ship-carrier">Transporteur</label>
              <input id="ship-carrier" type="text" placeholder="Ex: Colissimo, Chronopost, DHL…" />
            </div>
            <div class="ship-field">
              <label for="ship-tracking">N° de suivi</label>
              <input id="ship-tracking" type="text" placeholder="Ex: 8L123456789FR" />
            </div>
            <div id="ship-error" class="login-error" style="display:none;"></div>
          </div>
          <div class="cpf-modal-actions">
            <button class="cpf-btn" data-action="cancel">Annuler</button>
            <button class="cpf-btn cpf-btn-primary" data-action="confirm">Expédier</button>
          </div>
        `;
        const onCleanup = () => { root.style.display = 'none'; root.innerHTML=''; root.removeEventListener('click', onOverlayClick); };
        const onOverlayClick = (e) => { if (e.target === root) onCleanup(); };
        root.addEventListener('click', onOverlayClick);
        root.appendChild(modal);

        const carrierEl = modal.querySelector('#ship-carrier');
        const trackingEl = modal.querySelector('#ship-tracking');
        const errEl = modal.querySelector('#ship-error');
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        let currentOrderMeta = null;

        // Prefill depuis la commande si dispo
        fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { headers: { 'Authorization': `Basic ${authToken}` } })
          .then(r => r.json()).then(d => {
            if (d && d.success && d.order) {
              if (d.order.shipping) {
                if (d.order.shipping.carrier && carrierEl) carrierEl.value = d.order.shipping.carrier;
                if (d.order.shipping.trackingNumber && trackingEl) trackingEl.value = d.order.shipping.trackingNumber;
              }
              currentOrderMeta = d.order.meta || null;
            }
          }).catch(() => {});

        cancelBtn.addEventListener('click', onCleanup);
        confirmBtn.addEventListener('click', async () => {
          try {
            errEl.style.display = 'none'; errEl.textContent = '';
            const carrier = (carrierEl?.value || '').trim();
            const trackingNumber = (trackingEl?.value || '').trim();
            const errs = [];
            if (!carrier) errs.push('Transporteur obligatoire');
            if (!trackingNumber) errs.push('Numéro de suivi obligatoire');
            if (errs.length) {
              errEl.innerHTML = errs.map(e => `• ${e}`).join('<br/>');
              errEl.style.display = 'block';
              return;
            }
            // Confirmation supplémentaire si références requises mais incomplètes
            try {
              const techReq = !!(currentOrderMeta && currentOrderMeta.technicalRefRequired);
              const engine = (currentOrderMeta && typeof currentOrderMeta.engineDisplacement === 'string') ? currentOrderMeta.engineDisplacement.trim() : '';
              const tcu = (currentOrderMeta && typeof currentOrderMeta.tcuReference === 'string') ? currentOrderMeta.tcuReference.trim() : '';
              if (techReq && (!engine || !tcu)) {
                const ok = window.confirm('Les références techniques sont requises mais incomplètes (cylindrée/TCU). Expédier quand même ?');
                if (!ok) return;
              }
            } catch(_) {}
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi…';
            const r = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/ship`, {
              method: 'POST',
              headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ carrier, trackingNumber })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.success) throw new Error(d.message || 'Échec expédition');
            onCleanup();
            showToast('Commande expédiée', 'success');
            try {
              if (d.parcelPanel && typeof d.parcelPanel === 'object' && d.parcelPanel.attempted) {
                if (d.parcelPanel.ok) {
                  showToast('Suivi envoyé à Woo (ParcelPanel): OK', 'success');
                } else {
                  showToast(`Suivi Woo non confirmé: ${d.parcelPanel.message || 'erreur API'}`, 'warning');
                }
              }
            } catch(_) {}
            await loadOrdersList(1);
          } catch (e) {
            errEl.textContent = e.message || 'Erreur expédition';
            errEl.style.display = 'block';
          } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Expédier';
          }
        });
    }

    function handleHashRoute() {
        const hash = window.location.hash;
        // La documentation doit être consultable même sans être connecté
        if (hash === '#docs') {
            try { if (typeof adminLogin !== 'undefined' && adminLogin) adminLogin.style.display = 'none'; } catch(_) {}
            showDocs();
            // Mettre à jour la visibilité des sections réservées admin
            try { if (typeof applyRoleBasedUI === 'function') applyRoleBasedUI(); } catch(_) {}
            return;
        }
        if (hash === '#orders') {
            if (!authToken) return;
            showOrders();
            return;
        }
        if (!authToken) return;
        applyRoleBasedUI();
        if (hash === '#settings') {
            showSettings();
            if (currentUserRole === 'admin') { loadUsers(); }
            if (typeof loadTemplates === 'function') loadTemplates();
            // Charger la liste des documents si admin
            if (currentUserRole === 'admin' && typeof loadDocsList === 'function') loadDocsList();
        } else {
            showDashboard();
        }
    }
    
    function notifyUsersFeedback(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        }
        if (usersFeedback) {
            usersFeedback.textContent = message;
            usersFeedback.style.color = type === 'error' ? '#c0392b' : (type === 'success' ? '#27ae60' : '#333');
        }
    }
    
    // --- Gestion des Utilisateurs SAV ---
    async function loadUsers() {
        if (!usersListEl) return;
        try {
            notifyUsersFeedback('Chargement des utilisateurs...');
            usersListEl.innerHTML = '';
            const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!res.ok) {
                if (res.status === 401) return logout();
                if (res.status === 403) throw new Error('Accès refusé. Rôle administrateur requis.');
                throw new Error('Erreur lors du chargement des utilisateurs');
            }
            const data = await res.json();
            cachedUsers = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
            renderUsers(cachedUsers);
            notifyUsersFeedback(`${cachedUsers.length} utilisateur(s) chargé(s).`, 'success');
        } catch (e) {
            console.error('loadUsers error:', e);
            notifyUsersFeedback(e.message || 'Erreur lors du chargement des utilisateurs', 'error');
        }
    }
    
    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    function renderUsers(users) {
        if (!usersListEl) return;
        if (!Array.isArray(users)) users = [];
        usersListEl.innerHTML = users.map(u => {
            const id = u._id || u.id;
            const fullName = `${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}`.trim();
            const roleLabel = u.role === 'admin' ? 'Admin' : 'Agent';
            const statusBadge = u.isActive ? '<span class="status-badge status-validé">Actif</span>' : '<span class="status-badge status-refusé">Inactif</span>';
            return `
                <tr data-id="${id}"
                    data-firstname="${escapeHtml(u.firstName)}"
                    data-lastname="${escapeHtml(u.lastName)}"
                    data-email="${escapeHtml(u.email)}"
                    data-role="${escapeHtml(u.role)}"
                    data-isactive="${u.isActive ? '1' : '0'}">
                    <td>${fullName}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${escapeHtml(roleLabel)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-secondary edit-user-btn" data-id="${id}"><i class="fas fa-pen"></i> Modifier</button>
                        <button class="btn-danger delete-user-btn" data-id="${id}"><i class="fas fa-trash"></i> Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    function resetUserForm() {
        if (!userForm) return;
        userForm.reset();
        if (userIdInput) userIdInput.value = '';
        if (userIsActiveCheckbox) userIsActiveCheckbox.checked = true;
        if (userFormError) { userFormError.textContent = ''; userFormError.style.display = 'none'; }
        if (userFormTitle) userFormTitle.textContent = 'Nouvel utilisateur';
    }
    
    function openUserForm(user = null) {
        resetUserForm();
        if (user) {
            if (userFormTitle) userFormTitle.textContent = 'Modifier l\'utilisateur';
            if (userIdInput) userIdInput.value = user.id;
            if (userFirstNameInput) userFirstNameInput.value = user.firstName || '';
            if (userLastNameInput) userLastNameInput.value = user.lastName || '';
            if (userEmailInput) userEmailInput.value = user.email || '';
            if (userRoleSelect) userRoleSelect.value = user.role || 'agent';
            if (userIsActiveCheckbox) userIsActiveCheckbox.checked = !!user.isActive;
        }
        if (userFormCard) userFormCard.style.display = 'block';
    }
    
    function collectUserFormData() {
        const payload = {
            firstName: userFirstNameInput?.value?.trim() || '',
            lastName: userLastNameInput?.value?.trim() || '',
            email: userEmailInput?.value?.trim().toLowerCase() || '',
            role: userRoleSelect?.value || 'agent',
            isActive: !!(userIsActiveCheckbox?.checked)
        };
        const pwd = userPasswordInput?.value || '';
        const pwd2 = userPasswordConfirmInput?.value || '';
        if (userIdInput?.value) {
            if (pwd || pwd2) {
                if (pwd.length < 8) throw new Error('Mot de passe trop court (min. 8 caractères)');
                if (pwd !== pwd2) throw new Error('Les mots de passe ne correspondent pas');
                payload.password = pwd;
            }
        } else {
            if (pwd.length < 8) throw new Error('Mot de passe trop court (min. 8 caractères)');
            if (pwd !== pwd2) throw new Error('Les mots de passe ne correspondent pas');
            payload.password = pwd;
        }
        return payload;
    }
    
    async function saveUser(e) {
        e.preventDefault();
        if (!userForm) return;
        try {
            const id = userIdInput?.value;
            const payload = collectUserFormData();
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/admin/users/${encodeURIComponent(id)}` : '/api/admin/users';
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authToken}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                throw new Error(data?.message || 'Erreur lors de l\'enregistrement');
            }
            notifyUsersFeedback(id ? 'Utilisateur mis à jour' : 'Utilisateur créé', 'success');
            if (userFormCard) userFormCard.style.display = 'none';
            resetUserForm();
            await loadUsers();
        } catch (err) {
            if (userFormError) {
                userFormError.textContent = err.message || 'Erreur lors de l\'enregistrement';
                userFormError.style.display = 'block';
            }
        }
    }
    
    async function deleteUser(id) {
        if (!id) return;
        if (!confirm('Confirmer la suppression de cet utilisateur ?')) return;
        try {
            const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Basic ${authToken}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                throw new Error(data?.message || 'Erreur lors de la suppression');
            }
            notifyUsersFeedback('Utilisateur supprimé', 'success');
            await loadUsers();
        } catch (e) {
            notifyUsersFeedback(e.message || 'Erreur lors de la suppression', 'error');
        }
    }

    // --- Gestion des Modèles de Réponse ---
    let cachedTemplatesAll = [];
    let cachedTemplatesActive = [];
    const templatesListEl = document.getElementById('templates-list');
    const templatesFeedbackEl = document.getElementById('templates-feedback');
    const templateFormCard = document.getElementById('template-form-card');
    const templateForm = document.getElementById('template-form');
    const templateFormTitle = document.getElementById('template-form-title');
    const templateIdInput = document.getElementById('template-id');
    const templateKeyInput = document.getElementById('template-key');
    const templateLabelInput = document.getElementById('template-label');
    const templateContentInput = document.getElementById('template-content');
    const templateIsActiveCheckbox = document.getElementById('template-isActive');
    const templateFormError = document.getElementById('template-form-error');

    function notifyTemplatesFeedback(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        }
        if (templatesFeedbackEl) {
            templatesFeedbackEl.textContent = message;
            templatesFeedbackEl.style.color = type === 'error' ? '#c0392b' : (type === 'success' ? '#27ae60' : '#333');
        }
    }

    async function loadTemplates() {
        if (!templatesListEl) return;
        try {
            notifyTemplatesFeedback('Chargement des modèles...');
            templatesListEl.innerHTML = '';
            const res = await fetch('/api/admin/templates', { headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                if (res.status === 403) throw new Error('Accès refusé. Administrateur ou agent requis.');
                throw new Error(data?.message || 'Erreur lors du chargement des modèles');
            }
            cachedTemplatesAll = Array.isArray(data?.templates) ? data.templates : [];
            renderTemplates(cachedTemplatesAll);
            notifyTemplatesFeedback(`${cachedTemplatesAll.length} modèle(s) chargé(s).`, 'success');
        } catch (e) {
            console.error('loadTemplates error:', e);
            notifyTemplatesFeedback(e.message || 'Erreur lors du chargement des modèles', 'error');
        }
    }

    function renderTemplates(list) {
        if (!templatesListEl) return;
        const arr = Array.isArray(list) ? list : [];
        templatesListEl.innerHTML = arr.map(t => {
            const id = t._id || t.id;
            const statusBadge = t.isActive ? '<span class="status-badge status-validé">Actif</span>' : '<span class="status-badge status-refusé">Inactif</span>';
            return `
                <tr data-id="${id}" data-key="${escapeHtml(t.key)}" data-label="${escapeHtml(t.label)}" data-isactive="${t.isActive ? '1' : '0'}">
                    <td>${escapeHtml(t.label)}</td>
                    <td><code>${escapeHtml(t.key)}</code></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-secondary edit-template-btn" data-id="${id}"><i class="fas fa-pen"></i> Modifier</button>
                        <button class="btn-danger delete-template-btn" data-id="${id}"><i class="fas fa-trash"></i> Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function resetTemplateForm() {
        templateForm?.reset?.();
        if (templateIdInput) templateIdInput.value = '';
        if (templateIsActiveCheckbox) templateIsActiveCheckbox.checked = true;
        if (templateFormError) { templateFormError.textContent = ''; templateFormError.style.display = 'none'; }
        if (templateFormTitle) templateFormTitle.textContent = 'Nouveau modèle';
    }

    function openTemplateForm(template = null) {
        resetTemplateForm();
        if (template) {
            if (templateFormTitle) templateFormTitle.textContent = 'Modifier le modèle';
            if (templateIdInput) templateIdInput.value = template.id;
            if (templateKeyInput) templateKeyInput.value = template.key || '';
            if (templateLabelInput) templateLabelInput.value = template.label || '';
            if (templateContentInput) templateContentInput.value = template.content || '';
            if (templateIsActiveCheckbox) templateIsActiveCheckbox.checked = !!template.isActive;
        }
        if (templateFormCard) templateFormCard.style.display = 'block';
    }

    async function saveTemplate(e) {
        e?.preventDefault?.();
        if (!templateForm) return;
        try {
            const id = templateIdInput?.value;
            const payload = {
                key: templateKeyInput?.value?.trim().toLowerCase(),
                label: templateLabelInput?.value?.trim(),
                content: templateContentInput?.value || '',
                isActive: !!(templateIsActiveCheckbox?.checked)
            };
            if (!payload.key || !payload.label || !payload.content) throw new Error('Veuillez remplir tous les champs requis.');
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/admin/templates/${encodeURIComponent(id)}` : '/api/admin/templates';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${authToken}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                throw new Error(data?.message || 'Erreur lors de l\'enregistrement du modèle');
            }
            notifyTemplatesFeedback(id ? 'Modèle mis à jour' : 'Modèle créé', 'success');
            if (templateFormCard) templateFormCard.style.display = 'none';
            resetTemplateForm();
            await loadTemplates();
            // Recharger la liste active si on est dans la fiche ticket
            await refreshActiveTemplatesCache();
            if (document.getElementById('response-template')) populateResponseTemplateSelect();
        } catch (err) {
            if (templateFormError) {
                templateFormError.textContent = err.message || 'Erreur lors de l\'enregistrement';
                templateFormError.style.display = 'block';
            }
        }
    }

    async function deleteTemplate(id) {
        if (!id) return;
        if (!confirm('Confirmer la suppression de ce modèle ?')) return;
        try {
            const res = await fetch(`/api/admin/templates/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                throw new Error(data?.message || 'Erreur lors de la suppression du modèle');
            }
            notifyTemplatesFeedback('Modèle supprimé', 'success');
            await loadTemplates();
            await refreshActiveTemplatesCache();
            if (document.getElementById('response-template')) populateResponseTemplateSelect();
        } catch (e) {
            notifyTemplatesFeedback(e.message || 'Erreur lors de la suppression', 'error');
        }
    }

    async function refreshActiveTemplatesCache() {
        try {
            const res = await fetch('/api/admin/templates?active=1', { headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                cachedTemplatesActive = [];
                return;
            }
            cachedTemplatesActive = Array.isArray(data?.templates) ? data.templates : [];
        } catch (_) {
            cachedTemplatesActive = [];
        }
    }

    function populateResponseTemplateSelect() {
        const select = document.getElementById('response-template');
        if (!select) return;
        // Nettoyer puis peupler
        select.innerHTML = '<option value="">Aucun modèle</option>' + (cachedTemplatesActive || []).map(t => `<option value="${escapeHtml(t.key)}">${escapeHtml(t.label)}</option>`).join('');
    }

    function substituteTemplateVariables(tplContent, ticket) {
        const t = ticket || {};
        const client = t.clientInfo || {};
        const order = t.orderInfo || {};
        const data = {
            client: {
                firstName: client.firstName || 'client',
                lastName: client.lastName || ''
            },
            ticket: {
                number: t.ticketNumber || ''
            },
            order: {
                number: order.orderNumber || t.orderNumber || ''
            }
        };
        return String(tplContent || '').replace(/{{\s*([^}]+)\s*}}/g, (m, path) => {
            const parts = String(path).split('.');
            let cur = data;
            for (const p of parts) {
                if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]; else return '';
            }
            return cur == null ? '' : String(cur);
        });
    }

    // Listeners pour la gestion des modèles
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (!target) return;
        if (target.id === 'add-template-btn') {
            openTemplateForm();
        } else if (target.id === 'refresh-templates-btn') {
            loadTemplates();
        } else if (target.id === 'cancel-template-btn') {
            if (templateFormCard) templateFormCard.style.display = 'none';
            resetTemplateForm();
        } else if (target.classList && target.classList.contains('edit-template-btn')) {
            const id = target.getAttribute('data-id');
            const item = (cachedTemplatesAll || []).find(t => (t._id || t.id) === id);
            if (item) {
                openTemplateForm({
                    id: id,
                    key: item.key,
                    label: item.label,
                    content: item.content,
                    isActive: !!item.isActive
                });
            }
        } else if (target.classList && target.classList.contains('delete-template-btn')) {
            const id = target.getAttribute('data-id');
            deleteTemplate(id);
        }
    });

    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form && form.id === 'template-form') {
            saveTemplate(e);
        }
    });
    
    // --- Gestion Documentation (édition admin) ---
    function notifyDocsFeedback(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        }
        if (docsFeedbackEl) {
            docsFeedbackEl.textContent = message;
            docsFeedbackEl.style.color = type === 'error' ? '#c0392b' : (type === 'success' ? '#27ae60' : '#333');
        }
    }

    function renderDocsFiles(list, filterTerm = '') {
        if (!docsFilesEl) return;
        const term = String(filterTerm || '').toLowerCase();
        const arr = Array.isArray(list) ? list : [];
        const filtered = term
            ? arr.filter(f => (f.path || '').toLowerCase().includes(term) || (f.name || '').toLowerCase().includes(term))
            : arr;
        docsFilesEl.innerHTML = filtered.map(f => {
            const isActive = currentDocPath && currentDocPath === f.path;
            const safePath = String(f.path || '');
            const safeName = String(f.name || safePath.split('/').pop());
            return `
                <li class="doc-item${isActive ? ' active' : ''}" data-path="${safePath}" style="padding:8px 10px; border-bottom:1px solid #f0f0f0; display:flex; align-items:center; gap:8px; justify-content:space-between;">
                    <div class="doc-item-main" style="display:flex; align-items:center; gap:8px; min-width:0; cursor:pointer;">
                        <i class="fas fa-file-alt" aria-hidden="true"></i>
                        <span class="doc-path" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safePath}</span>
                    </div>
                    <button class="doc-delete-btn btn-light" title="Supprimer" aria-label="Supprimer ${safePath}" data-path="${safePath}" style="min-width:32px; height:28px;"><i class="fas fa-trash"></i></button>
                </li>
            `;
        }).join('');
    }

    async function loadDocsList() {
        if (!docsFilesEl) return;
        try {
            notifyDocsFeedback('Chargement des documents...');
            docsFilesEl.innerHTML = '';
            const res = await fetch('/api/admin/docs', { headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                if (res.status === 403) throw new Error('Accès refusé. Rôle administrateur requis.');
                throw new Error(data?.message || 'Erreur lors du chargement des documents');
            }
            cachedDocsFiles = Array.isArray(data?.files) ? data.files : [];
            renderDocsFiles(cachedDocsFiles, docsFilterInput?.value || '');
            notifyDocsFeedback(`${cachedDocsFiles.length} document(s) listé(s).`, 'success');
        } catch (e) {
            console.error('loadDocsList error:', e);
            notifyDocsFeedback(e.message || 'Erreur lors du chargement des documents', 'error');
        }
    }

    async function openDoc(relPath) {
        const path = String(relPath || '').trim();
        if (!path) return;
        try {
            notifyDocsFeedback('Chargement du contenu...');
            const url = `/api/admin/docs/content?path=${encodeURIComponent(path)}`;
            const res = await fetch(url, { headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                if (res.status === 404) throw new Error('Fichier non trouvé');
                throw new Error(data?.message || 'Erreur lors de la lecture du document');
            }
            if (docsCurrentPathInput) docsCurrentPathInput.value = data.path || path;
            // Renseigner l'éditeur (mode Visuel/Markdown) avec le contenu existant
            if (typeof setEditorFromMarkdown === 'function') {
                setEditorFromMarkdown(data.content || '');
            } else if (docsEditorTextarea) {
                docsEditorTextarea.value = data.content || '';
            }
            currentDocPath = data.path || path;
            renderDocsFiles(cachedDocsFiles, docsFilterInput?.value || '');
            notifyDocsFeedback('Document chargé.', 'success');
        } catch (e) {
            console.error('openDoc error:', e);
            notifyDocsFeedback(e.message || 'Erreur lors du chargement du document', 'error');
        }
    }

    async function saveCurrentDoc() {
        const path = String(docsCurrentPathInput?.value || '').trim();
        const content = (typeof getEditorMarkdown === 'function')
            ? getEditorMarkdown()
            : String(docsEditorTextarea?.value || '');
        if (!path) {
            notifyDocsFeedback('Veuillez saisir un chemin de fichier (.md).', 'error');
            if (docsCurrentPathInput) try { docsCurrentPathInput.focus(); } catch(_) {}
            return;
        }
        if (!/\.md$/i.test(path)) {
            notifyDocsFeedback('Le fichier doit avoir l’extension .md', 'error');
            return;
        }
        try {
            notifyDocsFeedback('Enregistrement en cours...');
            const res = await fetch('/api/admin/docs/content', {
                method: 'PUT',
                headers: { 'Authorization': `Basic ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, content })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                throw new Error(data?.message || 'Erreur lors de l’enregistrement');
            }
            currentDocPath = data.path || path;
            await loadDocsList();
            // Rester sur le document courant
            renderDocsFiles(cachedDocsFiles, docsFilterInput?.value || '');
            notifyDocsFeedback('Document enregistré.', 'success');
        } catch (e) {
            console.error('saveCurrentDoc error:', e);
            notifyDocsFeedback(e.message || 'Erreur lors de l’enregistrement', 'error');
        }
    }

    async function deleteCurrentDoc(targetPath) {
        const path = String(targetPath || docsCurrentPathInput?.value || currentDocPath || '').trim();
        if (!path) {
            notifyDocsFeedback('Aucun document sélectionné.', 'error');
            return;
        }
        if (!/\.md$/i.test(path)) {
            notifyDocsFeedback('Le fichier doit avoir l’extension .md', 'error');
            return;
        }
        let ok = true;
        if (typeof window.showConfirmModal === 'function') {
            ok = await window.showConfirmModal({
                title: 'Supprimer le document',
                message: `Voulez-vous vraiment supprimer définitivement <b>${path}</b> ? Cette action est irréversible.`,
                confirmText: 'Supprimer',
                cancelText: 'Annuler',
                confirmType: 'danger'
            });
        } else {
            ok = window.confirm(`Supprimer définitivement « ${path} » ?`);
        }
        if (!ok) return;
        try {
            notifyDocsFeedback('Suppression en cours...');
            const url = `/api/admin/docs/content?path=${encodeURIComponent(path)}`;
            const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Basic ${authToken}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 401) return logout();
                if (res.status === 404) throw new Error('Fichier non trouvé');
                throw new Error(data?.message || 'Erreur lors de la suppression');
            }
            // Nettoyer l’éditeur et l’état courant
            if (docsEditorTextarea) docsEditorTextarea.value = '';
            if (docsCurrentPathInput) docsCurrentPathInput.value = '';
            currentDocPath = '';
            // Recharger la liste
            await loadDocsList();
            renderDocsFiles(cachedDocsFiles, docsFilterInput?.value || '');
            notifyDocsFeedback('Document supprimé.', 'success');
        } catch (e) {
            console.error('deleteCurrentDoc error:', e);
            notifyDocsFeedback(e.message || 'Erreur lors de la suppression', 'error');
        }
    }

    // Écouteurs d’événements Documentation
    if (refreshDocsBtn) refreshDocsBtn.addEventListener('click', () => loadDocsList());
    if (saveDocBtn) saveDocBtn.addEventListener('click', () => saveCurrentDoc());
    if (deleteDocBtn) deleteDocBtn.addEventListener('click', () => deleteCurrentDoc());
    if (newDocBtn) newDocBtn.addEventListener('click', () => {
        if (docsCurrentPathInput) docsCurrentPathInput.value = docsCurrentPathInput.value || 'nouveau-document.md';
        if (docsEditorTextarea) docsEditorTextarea.value = '';
        currentDocPath = '';
        renderDocsFiles(cachedDocsFiles, docsFilterInput?.value || '');
        notifyDocsFeedback('Nouveau document: indiquez le chemin puis saisissez le contenu. Cliquez sur Enregistrer.', 'info');
        try { docsCurrentPathInput?.focus(); } catch(_) {}
    });
    if (docsFilterInput) docsFilterInput.addEventListener('input', () => {
        renderDocsFiles(cachedDocsFiles, docsFilterInput.value);
    });
    // Modes éditeur: Visuel (WYSIWYG) / Markdown
    const docsModeVisualBtn = document.getElementById('docs-mode-visual');
    const docsModeMarkdownBtn = document.getElementById('docs-mode-markdown');
    const docsEditorWysiwyg = document.getElementById('docs-editor-wysiwyg');
    const turndownService = (typeof window !== 'undefined' && window.TurndownService) ? new window.TurndownService() : null;
    let isVisualMode = true;
    function setEditorFromMarkdown(md) {
        if (docsEditorTextarea) docsEditorTextarea.value = String(md ?? '');
        // Si mode visuel actif, on rend en HTML
        if (isVisualMode && docsEditorWysiwyg) {
            docsEditorWysiwyg.innerHTML = (typeof marked !== 'undefined') ? marked.parse(String(md || '')) : String(md || '');
        }
        // MAJ preview
        try { renderDocsPreview(); } catch(_) {}
    }
    function getEditorMarkdown() {
        if (isVisualMode && docsEditorWysiwyg && turndownService) {
            try {
                const html = docsEditorWysiwyg.innerHTML;
                const md = turndownService.turndown(html);
                if (docsEditorTextarea) docsEditorTextarea.value = md;
                return md;
            } catch(_) {}
        }
        return String(docsEditorTextarea?.value || '');
    }
    function switchEditorMode(visual) {
        isVisualMode = !!visual;
        if (docsModeVisualBtn) docsModeVisualBtn.setAttribute('aria-pressed', isVisualMode ? 'true' : 'false');
        if (docsModeMarkdownBtn) docsModeMarkdownBtn.setAttribute('aria-pressed', isVisualMode ? 'false' : 'true');
        if (isVisualMode) {
            // Passer de MD -> HTML
            if (docsEditorWysiwyg) docsEditorWysiwyg.innerHTML = (typeof marked !== 'undefined') ? marked.parse(String(docsEditorTextarea?.value || '')) : String(docsEditorTextarea?.value || '');
            if (docsEditorWysiwyg) docsEditorWysiwyg.style.display = 'block';
            if (docsEditorTextarea) docsEditorTextarea.style.display = 'none';
            try { docsEditorWysiwyg?.focus(); } catch(_) {}
        } else {
            // Passer de HTML -> MD
            if (docsEditorWysiwyg && turndownService && docsEditorTextarea) {
                try { docsEditorTextarea.value = turndownService.turndown(docsEditorWysiwyg.innerHTML); } catch(_) {}
            }
            if (docsEditorWysiwyg) docsEditorWysiwyg.style.display = 'none';
            if (docsEditorTextarea) docsEditorTextarea.style.display = 'block';
            try { docsEditorTextarea?.focus(); } catch(_) {}
        }
        try { renderDocsPreview(); } catch(_) {}
    }
    if (docsModeVisualBtn) docsModeVisualBtn.addEventListener('click', () => switchEditorMode(true));
    if (docsModeMarkdownBtn) docsModeMarkdownBtn.addEventListener('click', () => switchEditorMode(false));
    // Initialiser selon l’UI (par défaut Visuel)
    switchEditorMode(true);

    // Toolbar de mise en forme Markdown / Visuel
    const docsEditorToolbar = document.querySelector('.docs-editor-toolbar');
    if (docsEditorToolbar && docsEditorTextarea) {
        docsEditorToolbar.addEventListener('click', (e) => {
            const btn = e.target?.closest && e.target.closest('[data-md]');
            if (!btn) return;
            const action = btn.getAttribute('data-md');
            if (isVisualMode && docsEditorWysiwyg) {
                applyVisualAction(action);
            } else {
                applyMarkdownAction(action);
            }
        });
    }
    // Appliquer action en mode Visuel via execCommand
    function applyVisualAction(action) {
        if (!docsEditorWysiwyg) return;
        try { docsEditorWysiwyg.focus(); } catch(_) {}
        const cmd = {
            bold: ['bold'],
            italic: ['italic'],
            h1: ['formatBlock', false, 'H1'],
            h2: ['formatBlock', false, 'H2'],
            h3: ['formatBlock', false, 'H3'],
            ul: ['insertUnorderedList'],
            ol: ['insertOrderedList'],
            quote: ['formatBlock', false, 'BLOCKQUOTE']
        }[action];
        if (action === 'link') {
            const url = window.prompt('Adresse du lien (URL) :', 'https://');
            if (!url) return;
            document.execCommand('createLink', false, url);
        } else if (action === 'code') {
            // Wrap selection in <code>
            document.execCommand('insertHTML', false, '<code>'+ (window.getSelection()?.toString() || 'code') +'</code>');
        } else if (cmd) {
            document.execCommand(cmd[0], cmd[1] ?? false, cmd[2] ?? null);
        }
        // Synchroniser vers Markdown + preview
        if (turndownService && docsEditorWysiwyg && docsEditorTextarea) {
            try { docsEditorTextarea.value = turndownService.turndown(docsEditorWysiwyg.innerHTML); } catch(_) {}
        }
        try { renderDocsPreview(); } catch(_) {}
    }
    // Prévisualisation en direct
    const docsPreviewToggle = document.getElementById('docs-preview-toggle');
    const docsLivePreview = document.getElementById('docs-live-preview');
    const docsLivePreviewArticle = document.getElementById('docs-live-preview-article');
    function renderDocsPreview() {
        if (!docsLivePreviewArticle || !docsEditorTextarea) return;
        try {
            const text = String(docsEditorTextarea.value || '');
            // Utiliser le même moteur que l’affichage public (#docs)
            docsLivePreviewArticle.innerHTML = (typeof marked !== 'undefined') ? marked.parse(text) : text;
        } catch (err) {
            docsLivePreviewArticle.innerHTML = '<div class="login-error">Erreur de prévisualisation</div>';
            console.error('docs preview error:', err);
        }
    }
    if (docsEditorTextarea) {
        docsEditorTextarea.addEventListener('input', () => {
            if (isVisualMode && docsEditorWysiwyg) {
                // En mode visuel, textarea suit via turndown, donc on évite d’écraser
                try { docsEditorWysiwyg.innerHTML = (typeof marked !== 'undefined') ? marked.parse(String(docsEditorTextarea.value || '')) : String(docsEditorTextarea.value || ''); } catch(_) {}
            }
            renderDocsPreview();
        });
        // Premier rendu si toggle actif
        if (docsPreviewToggle && docsPreviewToggle.checked) {
            setTimeout(renderDocsPreview, 0);
        }
    }
    if (docsEditorWysiwyg && turndownService) {
        docsEditorWysiwyg.addEventListener('input', () => {
            if (!isVisualMode) return;
            try { if (docsEditorTextarea) docsEditorTextarea.value = turndownService.turndown(docsEditorWysiwyg.innerHTML); } catch(_) {}
            renderDocsPreview();
        });
    }
    if (docsPreviewToggle && docsLivePreview) {
        docsPreviewToggle.addEventListener('change', () => {
            docsLivePreview.style.display = docsPreviewToggle.checked ? '' : 'none';
            if (docsPreviewToggle.checked) renderDocsPreview();
        });
        // Initial state
        docsLivePreview.style.display = docsPreviewToggle.checked ? '' : 'none';
    }

    function applyMarkdownAction(action) {
        const ta = docsEditorTextarea;
        if (!ta) return;
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const value = ta.value;
        const selected = value.slice(start, end) || '';
        const isMultiline = selected.includes('\n');
        let replace = selected;
        let newStart = start;
        let newEnd = end;
        const surround = (pre, post) => {
            replace = pre + (selected || 'texte') + post;
            newStart = start + pre.length;
            newEnd = newStart + (selected || 'texte').length;
        };
        const prefixLines = (prefix) => {
            const before = value.slice(0, start);
            const after = value.slice(end);
            const block = (selected || 'texte').split('\n').map(l => l ? (prefix + ' ' + l) : prefix).join('\n');
            ta.value = before + block + after;
            // Nouvelle sélection couvre le bloc inséré
            ta.setSelectionRange(before.length, before.length + block.length);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            try { ta.focus(); } catch(_) {}
            return true;
        };
        switch (action) {
            case 'bold':
                surround('**', '**');
                break;
            case 'italic':
                surround('*', '*');
                break;
            case 'h1':
                return prefixLines('#');
            case 'h2':
                return prefixLines('##');
            case 'h3':
                return prefixLines('###');
            case 'ul':
                return prefixLines('-');
            case 'ol':
                // Numérotation simple: 1. / 2.
                {
                    const lines = (selected || 'élément 1\nélément 2').split('\n');
                    const before = value.slice(0, start);
                    const after = value.slice(end);
                    const block = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
                    ta.value = before + block + after;
                    ta.setSelectionRange(before.length, before.length + block.length);
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    try { ta.focus(); } catch(_) {}
                    return true;
                }
            case 'link':
                {
                    const url = window.prompt('Adresse du lien (URL) :', 'https://');
                    if (!url) return;
                    const label = selected || 'lien';
                    replace = `[${label}](${url})`;
                    newStart = start + 1;
                    newEnd = newStart + label.length;
                    break;
                }
            case 'code':
                if (isMultiline) {
                    surround('```\n', '\n```');
                } else {
                    surround('`', '`');
                }
                break;
            case 'quote':
                return prefixLines('>');
            default:
                return;
        }
        // Appliquer la transformation par entourements
        const before = value.slice(0, start);
        const after = value.slice(end);
        ta.value = before + replace + after;
        ta.setSelectionRange(newStart, newEnd);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        try { ta.focus(); } catch(_) {}
    }
    if (docsFilesEl) docsFilesEl.addEventListener('click', (e) => {
        const delBtn = e.target?.closest && e.target.closest('.doc-delete-btn');
        if (delBtn) {
            const p = delBtn.getAttribute('data-path');
            deleteCurrentDoc(p);
            return;
        }
        const main = e.target?.closest && e.target.closest('.doc-item-main');
        const li = e.target?.closest && e.target.closest('li[data-path]');
        if (main && li) {
            const p = li.getAttribute('data-path');
            openDoc(p);
            // mettre à jour la preview après chargement du contenu
            setTimeout(renderDocsPreview, 0);
        }
    });
    
    // Fonction pour mettre à jour l'indicateur de statut actuel
    function updateCurrentStatusIndicator(currentStatus) {
        console.log('Mise à jour de l\'indicateur de statut actuel:', currentStatus);
        
        // Dictionnaire de traduction des statuts
        const statusTranslations = {
            'nouveau': 'Nouveau',
            'en_cours': 'En cours de traitement',
            'en_attente_client': 'En attente du client',
            'en_attente_fournisseur': 'En attente du fournisseur',
            'resolu': 'Résolu',
            'ferme': 'Fermé',
            'info_complementaire': 'Informations complémentaires requises',
            'en_analyse': 'En analyse',
            'validé': 'Validé',
            'refusé': 'Refusé',
            'en_cours_traitement': 'En cours de traitement',
            'expédié': 'Expédié',
            'clôturé': 'Clôturé'
        };

        try {
            // Récupérer l'indicateur visible et l'élément caché
            const visibleStatusElement = document.getElementById('visible-current-status');
            const statusElement = document.getElementById('detail-ticket-status');
            
            if (!currentStatus) {
                console.error('Aucun statut actuel fourni');
                currentStatus = 'nouveau'; // Valeur par défaut
            }
            
            const translatedStatus = statusTranslations[currentStatus] || currentStatus;
            console.log('Statut traduit:', translatedStatus);
            
            // Mettre à jour l'indicateur visible avec le style badge
            if (visibleStatusElement) {
                visibleStatusElement.textContent = translatedStatus;
                // Appliquer la classe du badge de statut
                visibleStatusElement.className = `status-badge status-${currentStatus}`;
                console.log('Indicateur de statut visible mis à jour avec:', translatedStatus);
            } else {
                console.error('Element visible-current-status introuvable dans le DOM');
            }
            
            // Mettre à jour l'élément caché
            if (statusElement) {
                statusElement.textContent = currentStatus;
                statusElement.setAttribute('data-status', currentStatus);
                console.log('Statut actuel stocké dans l\'\u00e9lément caché:', currentStatus);
            } else {
                console.error('Element detail-ticket-status introuvable dans le DOM');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'indicateur de statut:', error);
        }
    }
    
    // Fonction pour charger les tickets en fonction des filtres
    function getPerPage() {
        try {
            const sel = document.getElementById('per-page-select');
            const val = sel && sel.value ? parseInt(sel.value, 10) : null;
            if (val && [10,25,50,100].includes(val)) return val;
        } catch(_) {}
        const stored = parseInt(localStorage.getItem('ticketsPerPage') || '50', 10);
        return [10,25,50,100].includes(stored) ? stored : 50;
    }

    function setupPerPageSelector() {
        try {
            const pagination = document.getElementById('pagination');
            if (!pagination) return;
            // Créer le conteneur si absent
            let wrap = document.getElementById('pagination-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.id = 'pagination-wrap';
                wrap.className = 'pagination-wrap';
                // Insérer wrapper avant la pagination
                pagination.parentNode.insertBefore(wrap, pagination);
                wrap.appendChild(pagination);
            }
            // Ajouter le sélecteur s'il n'existe pas
            let existing = document.getElementById('per-page-select');
            if (!existing) {
                const ctrl = document.createElement('div');
                ctrl.className = 'per-page-control';
                ctrl.innerHTML = `
                    <label for="per-page-select" class="per-page-label">
                        Par page
                        <select id="per-page-select" aria-label="Tickets par page">
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </label>
                `;
                // Insérer avant la pagination dans le wrapper
                wrap.insertBefore(ctrl, pagination);
                // Valeur initiale depuis localStorage (ou 50)
                const perPage = getPerPage();
                const select = ctrl.querySelector('#per-page-select');
                if (select) select.value = String(perPage);
                // Écouteur
                select.addEventListener('change', () => {
                    const v = parseInt(select.value, 10);
                    if ([10,25,50,100].includes(v)) {
                        localStorage.setItem('ticketsPerPage', String(v));
                        loadTickets(1, collectFilters());
                    }
                });
            } else {
                // Synchroniser la valeur si déjà présent
                const perPage = getPerPage();
                existing.value = String(perPage);
            }
            // S'assurer que le résumé de page existe dans le wrapper
            let summary = document.getElementById('page-summary');
            if (!summary) {
                summary = document.createElement('div');
                summary.id = 'page-summary';
                summary.className = 'page-summary';
                summary.setAttribute('role', 'status');
                summary.setAttribute('aria-live', 'polite');
                summary.setAttribute('aria-atomic', 'true');
                wrap.appendChild(summary);
            }
        } catch(_) {}
    }

    async function loadTickets(page = 1, filters = {}) {
        try {
            currentPage = page;
            const limit = getPerPage();
            let url = `/api/admin/tickets?page=${encodeURIComponent(currentPage)}&limit=${encodeURIComponent(limit)}`;
            if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
            if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
            if (filters.partType) url += `&partType=${encodeURIComponent(filters.partType)}`;
            if (filters.ticketNumber) url += `&ticketNumber=${encodeURIComponent(filters.ticketNumber)}`;
            if (filters.orderNumber) url += `&orderNumber=${encodeURIComponent(filters.orderNumber)}`;
            if (filters.clientFirstName) url += `&clientFirstName=${encodeURIComponent(filters.clientFirstName)}`;
            if (filters.clientName) url += `&clientName=${encodeURIComponent(filters.clientName)}`;
            if (filters.dateFrom) url += `&dateFrom=${encodeURIComponent(filters.dateFrom)}`;
            if (filters.dateTo) url += `&dateTo=${encodeURIComponent(filters.dateTo)}`;
            if (filters.priority) url += `&priority=${encodeURIComponent(filters.priority)}`;

            // Afficher des skeletons pendant le chargement
            try { showLoadingSkeleton(limit); } catch(_) {}
            const response = await fetch(url, { headers: { 'Authorization': `Basic ${authToken}` } });
            if (!response.ok) {
                if (response.status === 401) throw new Error('Unauthorized');
                throw new Error('Erreur lors de la récupération des tickets');
            }
            const data = await response.json();

            // Pagination
            totalPages = (data.pagination && data.pagination.pages) ? data.pagination.pages : 1;
            // Ré-afficher la pagination et le sélecteur par page
            try { const pag = document.getElementById('pagination'); if (pag) { pag.style.display = ''; setupPerPageSelector(); } } catch (_) {}
            updatePagination();

            // Liste courante
            let list = Array.isArray(data.tickets) ? [...data.tickets] : [];

            // Filtre client: réponses en attente
            const hasClientUpdate = (t) => (window.__clientUpdatesMap instanceof Map) && window.__clientUpdatesMap.has(t._id);
            if (filters.awaitingAgentOnly && (window.__clientUpdatesMap instanceof Map)) {
                list = list.filter(t => hasClientUpdate(t));
            }

            // Tri (optionnel)
            if (filters.sort === 'oldest') {
                list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            } else if (filters.sort === 'newest') {
                list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            } else if (filters.sort === 'priority_asc' || filters.sort === 'priority_desc') {
                const weight = (t) => {
                    try {
                        const p = normalizePriority(t);
                        switch (p) {
                            case 'faible': return 0;
                            case 'moyen': return 1;
                            case 'élevé':
                            case 'eleve':
                            case 'haut': return 2;
                            case 'urgent': return 3;
                            default: return 1; // par défaut au milieu
                        }
                    } catch (_) { return 1; }
                };
                list.sort((a, b) => {
                    const da = weight(a);
                    const db = weight(b);
                    return (filters.sort === 'priority_asc') ? (da - db) : (db - da);
                });
            }

            // Calcul du total affiché
            const totalCountFromApi = (data && data.pagination && (data.pagination.total || data.pagination.totalItems || data.pagination.count)) ?? list.length;
            const totalCount = (filters.awaitingAgentOnly) ? list.length : totalCountFromApi;

            // Publier le total global de manière fiable
            try { window.__ticketsTotalCount = Number(totalCount) || 0; } catch(_) { /* noop */ }
            displayTickets(list, totalCount);

            // Mettre à jour compteurs/kanban
            try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
            if (typeof window.refreshKanbanView === 'function') {
                window.refreshKanbanView();
            }

        } catch (error) {
            console.error('Erreur lors du chargement des tickets (paginé):', error);
            showNotification('Erreur lors du chargement des tickets', 'error');
            try {
                // Nettoyer les skeletons et afficher un état vide simple
                const tbody = document.getElementById('tickets-list');
                if (tbody) {
                    tbody.innerHTML = '';
                    const tr = document.createElement('tr');
                    tr.className = 'empty-row';
                    tr.innerHTML = '<td colspan="7">Une erreur est survenue</td>';
                    tbody.appendChild(tr);
                }
                // Mettre à jour le résumé
                renderPageSummary(0, 0, window.__ticketsTotalCount || 0);
            } catch(_) {}
            throw error;
        }
    }
    
    // Afficher la liste des tickets
    function displayTickets(tickets, totalCount = (Array.isArray(tickets) ? tickets.length : 0)) {
        ticketsList.innerHTML = '';
        
        // Supprimer le compteur de résultats précédent s'il existe
        const existingResultCount = document.querySelector('.result-count');
        if (existingResultCount) {
            existingResultCount.remove();
        }
        
        // Créer un élément pour afficher le nombre de résultats
        const resultCount = document.createElement('div');
        resultCount.className = 'result-count';
        // Accessibilité: annoncer les mises à jour de résultats
        resultCount.setAttribute('role', 'status');
        resultCount.setAttribute('aria-live', 'polite');
        resultCount.setAttribute('aria-atomic', 'true');
        
        // Vérifier si des filtres sont appliqués
        const activeFilters = [];
        if (document.getElementById('status-filter').value) activeFilters.push(`Statut: ${statusTranslations[document.getElementById('status-filter').value] || document.getElementById('status-filter').value}`);
        if (document.getElementById('part-filter').value) activeFilters.push(`Type: ${partTypeTranslations[document.getElementById('part-filter').value] || document.getElementById('part-filter').value}`);
        if (document.getElementById('priority-filter').value) activeFilters.push(`Priorité: ${priorityTranslations[document.getElementById('priority-filter').value] || document.getElementById('priority-filter').value}`);
        if (document.getElementById('ticket-number-filter').value) activeFilters.push(`N° Ticket: ${document.getElementById('ticket-number-filter').value}`);
        if (document.getElementById('order-number-filter').value) activeFilters.push(`N° Commande: ${document.getElementById('order-number-filter').value}`);
        if (document.getElementById('client-firstname-filter').value) activeFilters.push(`Prénom: ${document.getElementById('client-firstname-filter').value}`);
        if (document.getElementById('client-name-filter').value) activeFilters.push(`Nom: ${document.getElementById('client-name-filter').value}`);
        if (document.getElementById('date-from').value || document.getElementById('date-to').value) {
            const dateFilter = [];
            if (document.getElementById('date-from').value) dateFilter.push(`Du: ${document.getElementById('date-from').value}`);
            if (document.getElementById('date-to').value) dateFilter.push(`Au: ${document.getElementById('date-to').value}`);
            activeFilters.push(`Dates: ${dateFilter.join(' ')}`);
        }
        if (document.getElementById('search-input').value) activeFilters.push(`Recherche: "${document.getElementById('search-input').value}"`);
        // Quick filter: awaiting response
        const awaitingBtn = document.getElementById('qf-awaiting');
        const awaitingActive = !!(awaitingBtn && (awaitingBtn.classList.contains('active') || awaitingBtn.getAttribute('aria-pressed') === 'true'));
        if (awaitingActive) activeFilters.push('En attente réponse');
        
        // Construire le message de résultats (nombre total toutes pages si dispo)
        let resultMessage = `<strong>${totalCount} ticket(s) trouvé(s)</strong>`;
        
        // Ajouter les filtres actifs au message si présents
        if (activeFilters.length > 0) {
            resultMessage += `<br><span class="active-filters">Filtres actifs: ${activeFilters.join(' | ')}</span>`;
        }
        
        resultCount.innerHTML = resultMessage;
        // Styles appliqués via CSS (.result-count)
        
        // Insérer avant la table des tickets
        const ticketsTable = document.querySelector('.tickets-table');
        ticketsTable.parentNode.insertBefore(resultCount, ticketsTable);
        // Stocker le total global pour la pagination
        try { window.__ticketsTotalCount = Number(totalCount) || 0; } catch(_) {}
        
        if (tickets.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-row';
            emptyRow.innerHTML = '<td colspan="7">Aucun ticket trouvé</td>';
            ticketsList.appendChild(emptyRow);
            // Mettre à jour le résumé de page à 0
            try { renderPageSummary(0, 0, totalCount); } catch(_) {}
            return;
        }
        
        tickets.forEach(ticket => {
            const row = document.createElement('tr');
            row.className = 'ticket-row';
            row.setAttribute('data-ticket-id', ticket._id);
            row.setAttribute('data-status', ticket.currentStatus);
            // Utiliser une priorité normalisée pour l'attribut data-priority pour assurer la cohérence
            const normPriority = (typeof normalizePriority === 'function') ? normalizePriority(ticket) : (ticket.priority || 'moyen');
            row.setAttribute('data-priority', normPriority);
            row.setAttribute('data-date', ticket.createdAt);
            // Ajouter un surlignage si ce ticket a des réponses client non vues
            try {
                if (window.__clientUpdatesMap && window.__clientUpdatesMap.has(ticket._id)) {
                    row.classList.add('client-updated');
                }
            } catch (_) { /* noop */ }
            
            // Appliquer un style en fonction de la priorité
            if (normPriority) {
                // Mappe directement sur les classes CSS connues via la valeur normalisée
                // (urgent|moyen|faible). Toute autre valeur tombe par défaut sur 'moyen' via le badge.
                const cls = ['urgent', 'moyen', 'faible'].includes(normPriority) ? normPriority : 'moyen';
                row.classList.add(`priority-${cls}`);
            }
            
            // Formater la date
            const createdAt = formatDate(ticket.createdAt);
            
            // Créer la cellule de priorité
            const priorityCell = document.createElement('td');
            const priorityBadge = document.createElement('span');
            priorityBadge.className = `priority-badge priority-${normPriority || 'moyen'}`;
            priorityBadge.textContent = priorityTranslations[normPriority] || priorityTranslations['moyen'];
            priorityCell.appendChild(priorityBadge);
            
            // Créer la cellule de statut avec badge
            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${ticket.currentStatus}`;
            statusBadge.textContent = statusTranslations[ticket.currentStatus] || ticket.currentStatus;
            statusCell.appendChild(statusBadge);
            
            // Créer la cellule d'actions
            const actionsCell = document.createElement('td');
            const viewButton = document.createElement('button');
            viewButton.className = 'btn-view';
            viewButton.innerHTML = '<i class="fas fa-eye"></i>';
            viewButton.title = 'Voir les détails';
            viewButton.addEventListener('click', () => viewTicket(ticket._id));
            actionsCell.appendChild(viewButton);
            
            // Ajouter un bouton de suppression
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-delete';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Supprimer le ticket';
            deleteButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                deleteTicket(ticket._id, ticket.ticketNumber, event);
                return false;
            });
            actionsCell.appendChild(deleteButton);
            
            // Créer les cellules individuellement pour éviter d'écraser les attributs
            const tdTicketNumber = document.createElement('td');
            tdTicketNumber.textContent = ticket.ticketNumber;
            // Ajouter le badge si le ticket a une réponse client non vue
            try {
                if (window.__clientUpdatesMap && window.__clientUpdatesMap.has(ticket._id)) {
                    if (!tdTicketNumber.querySelector('.client-replied-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'client-replied-badge';
                        badge.textContent = 'Réponse client';
                        tdTicketNumber.appendChild(badge);
                    }
                }
            } catch (_) { /* noop */ }

            // Ajouter un badge/alerte si "en attente de réponse agent" depuis plus de 24h
            try {
                const stamp = window.__clientUpdatesMap && window.__clientUpdatesMap.get(ticket._id);
                if (stamp) {
                    const updatedTime = new Date(stamp).getTime();
                    const now = Date.now();
                    const diffH = (now - updatedTime) / (1000 * 60 * 60);
                    if (diffH >= 24) {
                        row.classList.add('overdue-awaiting');
                        if (!tdTicketNumber.querySelector('.overdue-badge')) {
                            const overdue = document.createElement('span');
                            overdue.className = 'overdue-badge';
                            overdue.innerHTML = '<i class="fas fa-exclamation-triangle"></i> +24h';
                            overdue.title = 'Client en attente de réponse depuis plus de 24h';
                            tdTicketNumber.appendChild(overdue);
                        }
                    }
                }
            } catch (_) { /* noop */ }
            
            const tdClientName = document.createElement('td');
            tdClientName.textContent = `${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}`;
            
            const tdPartType = document.createElement('td');
            tdPartType.textContent = partTypeTranslations[ticket.partInfo.partType] || ticket.partInfo.partType;
            
            const tdCreatedAt = document.createElement('td');
            tdCreatedAt.textContent = createdAt;
            
            // Ajouter les cellules à la ligne
            row.appendChild(tdTicketNumber);
            row.appendChild(tdClientName);
            row.appendChild(tdPartType);
            row.appendChild(tdCreatedAt);
            row.appendChild(priorityCell);
            row.appendChild(statusCell);
            row.appendChild(actionsCell);
            
            ticketsList.appendChild(row);
        });
        // Mettre à jour les compteurs (barre de filtres rapides et tuiles de stats)
        try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
        try { if (typeof window.updateTicketCounters === 'function') window.updateTicketCounters(); } catch (_) {}
        // Mettre à jour le résumé de page (x–y sur N)
        try {
            const perPage = getPerPage();
            const start = (currentPage - 1) * perPage + 1;
            const end = start + tickets.length - 1;
            renderPageSummary(start, end, totalCount);
        } catch(_) {}
        // Après rendu, recalculer les badges "+24h" pour les lignes visibles
        try { if (typeof window.updateOverdueBadgesForVisibleRows === 'function') window.updateOverdueBadgesForVisibleRows(); } catch (_) {}
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        pagination.innerHTML = '';
        // A11y du conteneur de pagination
        try {
            pagination.setAttribute('role', 'navigation');
            pagination.setAttribute('aria-label', 'Pagination des tickets');
        } catch(_) {}
        
        // Bouton précédent
        const prevButton = document.createElement('button');
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.disabled = currentPage === 1;
        prevButton.setAttribute('aria-label', 'Page précédente');
        prevButton.setAttribute('aria-disabled', prevButton.disabled ? 'true' : 'false');
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                loadTickets(currentPage - 1, collectFilters());
            }
        });
        pagination.appendChild(prevButton);
        
        // Pages
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.className = 'active';
                pageButton.setAttribute('aria-current', 'page');
            }
            pageButton.setAttribute('aria-label', `Aller à la page ${i}`);
            pageButton.addEventListener('click', () => {
                loadTickets(i, collectFilters());
            });
            pagination.appendChild(pageButton);
        }
        
        // Bouton suivant
        const nextButton = document.createElement('button');
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.setAttribute('aria-label', 'Page suivante');
        nextButton.setAttribute('aria-disabled', nextButton.disabled ? 'true' : 'false');
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                loadTickets(currentPage + 1, collectFilters());
            }
        });
        pagination.appendChild(nextButton);
        // Mettre à jour le résumé de page après avoir rendu la pagination
        try {
            const perPage = getPerPage();
            const start = (currentPage - 1) * perPage + 1;
            // Le nombre d'éléments affichés est la taille du tbody actuel
            const visible = document.querySelectorAll('#tickets-list > tr').length;
            const end = visible > 0 ? (start + visible - 1) : 0;
            const total = Number(window.__ticketsTotalCount) || 0;
            renderPageSummary(start, end, total);
        } catch(_) {}
    }

    // Affiche "x–y sur N" à côté de la pagination
    function renderPageSummary(start, end, total) {
        let wrap = document.getElementById('pagination-wrap');
        if (!wrap) return;
        let summary = document.getElementById('page-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'page-summary';
            summary.className = 'page-summary';
            summary.setAttribute('role', 'status');
            summary.setAttribute('aria-live', 'polite');
            summary.setAttribute('aria-atomic', 'true');
            wrap.appendChild(summary);
        }
        const text = (start && end) ? `${start}\u2013${end} sur ${total}` : `0 sur ${total}`;
        summary.textContent = text;
    }
    
    // Voir les détails d'un ticket
    async function viewTicket(ticketId) {
        try {
            currentTicketId = ticketId;
            console.log('Récupération des détails du ticket ID:', ticketId);
            // Mémoriser la position de scroll de la liste
            try { lastListScrollY = window.scrollY || 0; } catch(_) { lastListScrollY = 0; }
            
            // Récupérer les détails du ticket
            const response = await fetch(`/api/admin/tickets/${ticketId}`, {
                headers: {
                    'Authorization': `Basic ${authToken}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                throw new Error('Erreur lors de la récupération des détails du ticket');
            }
            
            const data = await response.json();
            console.log('Données du ticket reçues:', data);
            
            const ticket = data.ticket;
            const statusHistory = data.statusHistory;
            
            // Vérifier si les données du ticket sont valides
            if (!ticket || typeof ticket !== 'object') {
                console.error('Données du ticket invalides:', ticket);
                alert('Erreur: Les données du ticket sont invalides ou manquantes.');
                return;
            }
            
            console.log('Ticket complet:', JSON.stringify(ticket));
            console.log('Statut actuel du ticket:', ticket.currentStatus);
            console.log('Historique des statuts:', statusHistory);
            
            console.log('Affichage des détails du ticket...');
            
            // Afficher les détails du ticket
            displayTicketDetails(ticket, statusHistory);
            
            // Afficher la vue détaillée
            console.log('Basculement vers la vue détaillée');
            
            // S'assurer que la dashboard est cachée et que la vue détaillée est visible
            const dashboardElement = document.querySelector('.admin-dashboard');
            if (!dashboardElement) {
                console.error('Element admin-dashboard introuvable');
            } else {
                dashboardElement.style.display = 'none';
                console.log('Dashboard cachée');
            }
            
            // Vérification de l'élément ticket-details
            if (!ticketDetails) {
                console.error('Element ticket-details introuvable');
            } else {
                // Forcer uniquement l'affichage sans modifier le z-index/position pour ne pas passer au-dessus du header
                ticketDetails.style.display = 'block';
                console.log('ticket-details affiché');
            }
            // Activer le raccourci clavier Échap pour revenir à la liste
            try {
                if (detailsKeydownHandler) document.removeEventListener('keydown', detailsKeydownHandler);
                detailsKeydownHandler = (ev) => {
                    if (ev.key === 'Escape') { ev.preventDefault(); try { goBackToList(); } catch(_) {} }
                };
                document.addEventListener('keydown', detailsKeydownHandler);
            } catch(_) {}
            // Mettre à jour les titres des boutons si présents
            try {
                const backBtn = document.getElementById('back-to-list');
                if (backBtn) backBtn.title = 'Retour à la liste (Échap)';
                const delBtn = document.getElementById('delete-ticket-detail');
                if (delBtn) delBtn.title = 'Supprimer le ticket';
            } catch(_) {}
            
            console.log('Vue détaillée affichée');
            
        } catch (error) {
            console.error('Erreur lors de la récupération des détails du ticket:', error);
            if (error.message === 'Unauthorized') {
                logout();
            }
        }
    }

    // Mettre à jour la pagination
    function updatePagination() {
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';
        
        // Bouton précédent
        const prevButton = document.createElement('button');
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                loadTickets(currentPage - 1, collectFilters());
            }
        });
        pagination.appendChild(prevButton);
        
        // Boutons de page
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = i === currentPage ? 'active' : '';
            pageButton.addEventListener('click', () => {
                loadTickets(i, collectFilters());
            });
            pagination.appendChild(pageButton);
        }
        
        // Bouton suivant
        const nextButton = document.createElement('button');
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                loadTickets(currentPage + 1, collectFilters());
            }
        });
        pagination.appendChild(nextButton);
    }
    
    // Fonction pour afficher les détails d'un ticket
    function displayTicketDetails(ticket, statusHistory) {
        console.log('Début de displayTicketDetails', { ticket, statusHistory });
        // Conserver le ticket courant pour les modèles de réponse et autres usages
        try { window.currentTicketData = ticket; } catch (_) {}
        // Charger les modèles actifs et peupler la liste
        refreshActiveTemplatesCache().then(() => populateResponseTemplateSelect());
        
        try {
            // Mettre à jour le fil d'Ariane
            console.log('Mise à jour du fil d\'Ariane avec le numéro de ticket:', ticket.ticketNumber);
            const breadcrumbElement = document.getElementById('breadcrumb-ticket-number');
            if (!breadcrumbElement) {
                console.error('Element breadcrumb-ticket-number introuvable');
            } else {
                breadcrumbElement.textContent = ticket.ticketNumber;
            }
        
            // Informations générales
            console.log('Mise à jour des informations générales');
            const detailTicketNumberElement = document.getElementById('detail-ticket-number');
            if (!detailTicketNumberElement) {
                console.error('Element detail-ticket-number introuvable');
            } else {
                detailTicketNumberElement.textContent = ticket.ticketNumber;
            }
        
            // Afficher la priorité actuelle
            console.log('Mise à jour de la priorité');
            const priorityElement = document.getElementById('detail-ticket-priority');
            
            // Dictionnaire de traduction des priorités
            const priorityTranslations = {
                'eleve': 'Élevée',
                'moyen': 'Moyenne',
                'faible': 'Faible',
                'élevé': 'Élevée',
                'urgent': 'Urgente'
            };
            
            // Définir la priorité du ticket (ou par défaut)
            const ticketPriority = ticket.priority || 'moyen';
            console.log('Priorité du ticket:', ticketPriority);
            
            // Mise à jour de l'indicateur visible de priorité
            const visiblePriorityElement = document.getElementById('visible-current-priority');
            if (visiblePriorityElement) {
                const priorityText = priorityTranslations[ticketPriority] || ticketPriority;
                visiblePriorityElement.textContent = priorityText;
                // Appliquer la classe du badge de priorité
                visiblePriorityElement.className = `priority-badge priority-${ticketPriority}`;
                console.log('Indicateur de priorité mis à jour avec:', priorityText);
            } else {
                console.error('Element visible-current-priority introuvable');
            }
            
            // Mettre à jour l'élément de priorité régulière
            if (!priorityElement) {
                console.error('Element detail-ticket-priority introuvable');
            } else if (ticket.priority) {
                const priorityText = priorityTranslations[ticket.priority] || ticket.priority;
                priorityElement.textContent = `Priorité: ${priorityText}`;
                priorityElement.className = `priority-badge priority-${ticket.priority}`;
                priorityElement.style.display = 'inline-block';
            } else {
                priorityElement.textContent = 'Priorité: Moyenne';
                priorityElement.className = 'priority-badge priority-moyen';
                priorityElement.style.display = 'inline-block';
            }
            
            // Stocker la priorité actuelle dans un élément caché pour d'autres formulaires
            try {
                const currentPriorityElement = document.getElementById('detail-ticket-current-priority');
                if (currentPriorityElement) {
                    currentPriorityElement.textContent = ticketPriority;
                    currentPriorityElement.setAttribute('data-priority', ticketPriority);
                }
            } catch(_) {}

            // Assignation & Escalade (affichage et visibilité des actions)
            try {
                const assignedEl = document.getElementById('detail-assigned-to');
                if (assignedEl) {
                    const u = ticket.assignedTo;
                    if (u && (u.firstName || u.lastName || u.email)) {
                        const name = `${(u.firstName||'').trim()} ${(u.lastName||'').trim()}`.trim();
                        assignedEl.textContent = name || u.email || 'Non assigné';
                    } else {
                        assignedEl.textContent = 'Non assigné';
                    }
                }
                const escBadge = document.getElementById('detail-escalation-badge');
                if (escBadge) escBadge.style.display = ticket.isEscalated ? 'inline-block' : 'none';
                applyRoleBasedUIForTicket(ticket);
            } catch(_) {}

            // Informations client
            console.log('Mise à jour des informations client');
            try {
                const clientNameElement = document.getElementById('detail-client-name');
                if (!clientNameElement) {
                    console.error('Element detail-client-name introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.firstName && ticket.clientInfo.lastName) {
                    clientNameElement.textContent = `${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}`;
                }
                
                const clientEmailElement = document.getElementById('detail-client-email');
                if (!clientEmailElement) {
                    console.error('Element detail-client-email introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.email) {
                    clientEmailElement.textContent = ticket.clientInfo.email;
                }
                
                const clientPhoneElement = document.getElementById('detail-client-phone');
                if (!clientPhoneElement) {
                    console.error('Element detail-client-phone introuvable');
                } else if (ticket.clientInfo && ticket.clientInfo.phone) {
                    clientPhoneElement.textContent = ticket.clientInfo.phone;
                }
                
                const orderNumberElement = document.getElementById('detail-order-number');
                if (!orderNumberElement) {
                    console.error('Element detail-order-number introuvable');
                } else if (ticket.orderInfo && ticket.orderInfo.orderNumber) {
                    orderNumberElement.textContent = ticket.orderInfo.orderNumber;
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations client:', error);
            }
        
            // Informations véhicule
            console.log('Mise à jour des informations véhicule');
            try {
                const vehicleVinElement = document.getElementById('detail-vehicle-vin');
                if (!vehicleVinElement) {
                    console.error('Element detail-vehicle-vin introuvable');
                } else {
                    vehicleVinElement.textContent = (ticket.vehicleInfo && ticket.vehicleInfo.vin) ? ticket.vehicleInfo.vin : 'Non spécifié';
                }
                
                const installationDateElement = document.getElementById('detail-installation-date');
                if (!installationDateElement) {
                    console.error('Element detail-installation-date introuvable');
                } else {
                    installationDateElement.textContent = (ticket.vehicleInfo && ticket.vehicleInfo.installationDate) ? formatDate(ticket.vehicleInfo.installationDate) : 'Non spécifié';
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations véhicule:', error);
            }
        
            // Informations pièce et problème
            console.log('Mise à jour des informations pièce et problème');
            try {
                // Afficher le type de réclamation
                const claimTypeElement = document.getElementById('detail-claim-type');
                if (!claimTypeElement) {
                    console.error('Element detail-claim-type introuvable');
                } else {
                    // Traduction des types de réclamation
                    const claimTypeTranslations = {
                        'piece_defectueuse': 'Pièce défectueuse',
                        'probleme_livraison': 'Problème de livraison',
                        'erreur_reference': 'Erreur de référence',
                        'autre': 'Autre type de réclamation'
                    };
                    
                    const claimType = ticket.claimType || 'Non spécifié';
                    claimTypeElement.textContent = claimTypeTranslations[claimType] || claimType;
                    
                    // Afficher les informations spécifiques au type de réclamation
                    if (ticket.claimTypeData && ticket.claimType) {
                        console.log('Données spécifiques au type de réclamation:', ticket.claimTypeData);
                        
                        // Créer ou mettre à jour la section des données spécifiques
                        let specificDataHTML = '<div class="claim-specific-data"><h4>Détails spécifiques</h4><div class="info-grid">';
                        
                        switch(ticket.claimType) {
                            case 'piece_defectueuse':
                                // Déjà géré par les champs standards
                                break;
                            case 'probleme_livraison':
                                // Les champs numéro de suivi et transporteur ont été supprimés
                                if (ticket.claimTypeData.deliveryDate) specificDataHTML += `<div class="info-item"><label>Date de livraison</label><p>${formatDate(ticket.claimTypeData.deliveryDate)}</p></div>`;
                                if (ticket.claimTypeData.deliveryProblemType) specificDataHTML += `<div class="info-item"><label>Type de problème</label><p>${ticket.claimTypeData.deliveryProblemType}</p></div>`;
                                if (ticket.claimTypeData.deliveryProblemDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.deliveryProblemDescription}</p></div>`;
                                // Ajouter une remarque pour les tickets existants qui peuvent avoir ces anciennes données
                                if (ticket.claimTypeData.trackingNumber) specificDataHTML += `<div class="info-item"><label>N° de suivi (ancien)</label><p>${ticket.claimTypeData.trackingNumber}</p></div>`;
                                if (ticket.claimTypeData.carrier) specificDataHTML += `<div class="info-item"><label>Transporteur (ancien)</label><p>${ticket.claimTypeData.carrier}</p></div>`;
                                break;
                            case 'erreur_reference':
                                if (ticket.claimTypeData.receivedReference) specificDataHTML += `<div class="info-item"><label>Référence reçue</label><p>${ticket.claimTypeData.receivedReference}</p></div>`;
                                if (ticket.claimTypeData.expectedReference) specificDataHTML += `<div class="info-item"><label>Référence attendue</label><p>${ticket.claimTypeData.expectedReference}</p></div>`;
                                if (ticket.claimTypeData.compatibilityIssue) specificDataHTML += `<div class="info-item"><label>Problème de compatibilité</label><p>${ticket.claimTypeData.compatibilityIssue}</p></div>`;
                                if (ticket.claimTypeData.referenceErrorDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.referenceErrorDescription}</p></div>`;
                                break;
                            case 'autre':
                                if (ticket.claimTypeData.otherProblemType) specificDataHTML += `<div class="info-item"><label>Type de problème</label><p>${ticket.claimTypeData.otherProblemType}</p></div>`;
                                if (ticket.claimTypeData.otherProblemDescription) specificDataHTML += `<div class="info-item"><label>Description</label><p>${ticket.claimTypeData.otherProblemDescription}</p></div>`;
                                break;
                        }
                        
                        specificDataHTML += '</div></div>';
                        
                        // Ajouter les données spécifiques après les informations de la pièce
                        const partTabContent = document.getElementById('tab-part');
                        
                        // Vérifier si la section existe déjà
                        const existingSection = document.querySelector('.claim-specific-data');
                        if (existingSection) {
                            existingSection.outerHTML = specificDataHTML;
                        } else if (partTabContent) {
                            // Ajouter après la section principale
                            const ticketSection = partTabContent.querySelector('.ticket-section');
                            if (ticketSection) {
                                // Seulement ajouter s'il y a des données spécifiques à afficher
                                if (specificDataHTML.includes('<div class="info-item">')) {
                                    ticketSection.insertAdjacentHTML('beforeend', specificDataHTML);
                                }
                            }
                        }
                    }
                }
                
                const elementsToUpdate = [
                    { id: 'detail-part-type', value: () => (ticket.partInfo && ticket.partInfo.partType) ? (window.partTypeTranslations ? partTypeTranslations[ticket.partInfo.partType] || ticket.partInfo.partType : ticket.partInfo.partType) : 'Non spécifié' },
                    { id: 'detail-symptom', value: () => (ticket.partInfo && ticket.partInfo.symptom) ? ticket.partInfo.symptom : 'Non spécifié' },
                    { id: 'detail-failure-time', value: () => (ticket.partInfo && ticket.partInfo.failureTime) ? ticket.partInfo.failureTime : 'Non spécifié' },
                    { id: 'detail-error-codes', value: () => (ticket.partInfo && ticket.partInfo.errorCodes) ? ticket.partInfo.errorCodes : 'Non spécifié' },
                    { id: 'detail-pro-installation', value: () => (ticket.partInfo && ticket.partInfo.professionalInstallation !== undefined) ? (ticket.partInfo.professionalInstallation ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-oil-filled', value: () => (ticket.partInfo && ticket.partInfo.oilFilled !== undefined) ? (ticket.partInfo.oilFilled ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-oil-quantity', value: () => (ticket.partInfo && ticket.partInfo.oilQuantity) ? `${ticket.partInfo.oilQuantity} L` : 'Non spécifié' },
                    { id: 'detail-oil-reference', value: () => (ticket.partInfo && ticket.partInfo.oilReference) ? ticket.partInfo.oilReference : 'Non spécifié' },
                    { id: 'detail-new-parts', value: () => (ticket.partInfo && ticket.partInfo.newParts !== undefined) ? (ticket.partInfo.newParts ? 'Oui' : 'Non') : 'Non spécifié' },
                    { id: 'detail-parts-details', value: () => (ticket.partInfo && ticket.partInfo.newPartsDetails) ? ticket.partInfo.newPartsDetails : 'Non spécifié' }
                ];
                
                elementsToUpdate.forEach(item => {
                    const element = document.getElementById(item.id);
                    if (!element) {
                        console.error(`Element ${item.id} introuvable`);
                    } else {
                        try {
                            element.textContent = item.value();
                        } catch (error) {
                            console.error(`Erreur lors de la mise à jour de ${item.id}:`, error);
                            element.textContent = 'Erreur';
                        }
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la mise à jour des informations pièce et problème:', error);
            }
        
            // Notes internes
            console.log('Mise à jour des notes internes');
            try {
                const notesElement = document.getElementById('internal-notes');
                if (!notesElement) {
                    console.error('Element internal-notes introuvable');
                } else {
                    notesElement.value = ticket.internalNotes || '';
                }

                // Mise à jour explicite de l'indicateur de statut actuel
                updateCurrentStatusIndicator(ticket.currentStatus);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des notes internes:', error);
            }

            // Fil de conversation (panneau gauche)
            try {
                const conversation = document.getElementById('conversation-thread');
                if (!conversation) {
                    console.error('Element conversation-thread introuvable');
                } else {
                    // Nettoyer le contenu des messages
                    conversation.innerHTML = '';
                    // L'en-tête de conversation est désormais statique dans le HTML (admin/index.html)
                    // La carte est portée par le parent (.conversation-panel). Aucun style carte directement sur le thread.

                    const stTr = (typeof statusTranslations !== 'undefined' && statusTranslations) ? statusTranslations : (window.statusTranslations || {});
                    const normalizePath = (p) => {
                        if (!p) return '';
                        return p.includes('uploads/') ? '/uploads/' + p.split('uploads/')[1] : '/uploads/' + p.split('/').pop();
                    };

                    // Mapping documents -> statut (affectation unique par auteur + proximité temporelle)
                    const docsRaw = Array.isArray(ticket.documents) ? ticket.documents : [];
                    const normalizedDocs = docsRaw.map(doc => ({
                        ...doc,
                        __normPath: doc.filePath ? normalizePath(doc.filePath) : (doc.fileId ? `/uploads/${doc.fileId}` : ''),
                        __uploadAt: doc.uploadDate ? new Date(doc.uploadDate) : null
                    })).filter(d => d.__normPath);
                    const statusesAsc = Array.isArray(statusHistory) ? [...statusHistory].sort((a,b) => new Date(a.updatedAt) - new Date(b.updatedAt)) : [];
                    // Préparer les métadonnées des statuts (id, time, auteur, s'il s'agit d'un message client)
                    const statusMeta = statusesAsc.map(s => {
                        const author = (s && s.updatedBy === 'client') ? 'client' : 'cpf';
                        const timeMs = s && s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
                        const comment = (s && typeof s.comment === 'string') ? s.comment : '';
                        const isClientMessage = author === 'client' && (
                            (typeof s.clientResponse === 'boolean' && s.clientResponse === true) ||
                            /informations?\s+compl[ée]mentaires?\s+re[cç]ues?\s+du\s+client/i.test(comment)
                        );
                        return { id: s._id, timeMs, author, isClientMessage };
                    });
                    const docsByStatusId = new Map();
                    normalizedDocs.forEach(d => {
                        const docTimeMs = d.__uploadAt ? d.__uploadAt.getTime() : null;
                        const up = (d.uploadedBy && String(d.uploadedBy).toLowerCase());
                        const uploader = (up === 'admin' || up === 'agent') ? 'cpf' : 'client';
                        const clientMessageStats = uploader === 'client' ? statusMeta.filter(sm => sm.isClientMessage) : [];
                        const sameAuthorStats = statusMeta.filter(sm => sm.author === uploader);
                        const tiers = [clientMessageStats, sameAuthorStats, statusMeta];
                        let best = null;
                        for (const arr of tiers) {
                            if (!arr || arr.length === 0) continue;
                            if (typeof docTimeMs === 'number') {
                                // 1) Premier statut APRÈS l'upload
                                let localBest = null; let localDelta = Infinity;
                                arr.forEach(sm => {
                                    const delta = sm.timeMs - docTimeMs;
                                    if (delta >= 0 && delta < localDelta) { localDelta = delta; localBest = sm; }
                                });
                                // 2) Sinon, dernier statut AVANT l'upload
                                if (!localBest) {
                                    arr.forEach(sm => {
                                        const delta = docTimeMs - sm.timeMs;
                                        if (delta >= 0 && delta < localDelta) { localDelta = delta; localBest = sm; }
                                    });
                                }
                                if (localBest) { best = localBest; break; }
                            } else {
                                // Pas de date d'upload: on prend le dernier du groupe
                                if (arr.length > 0) { best = arr[arr.length - 1]; break; }
                            }
                        }
                        if (best && best.id) {
                            const arr = docsByStatusId.get(best.id) || [];
                            arr.push(d);
                            docsByStatusId.set(best.id, arr);
                        }
                    });

                    // Helper: classe de badge selon le statut
                    const getStatusBadgeClass = (status) => {
                        switch (status) {
                            case 'validé':
                            case 'clôturé':
                                return 'badge--success';
                            case 'refusé':
                                return 'badge--danger';
                            case 'info_complementaire':
                                return 'badge--warning';
                            case 'expédié':
                            case 'en_cours_traitement':
                                return 'badge--primary';
                            case 'en_analyse':
                            case 'nouveau':
                            default:
                                return 'badge--secondary';
                        }
                    };

                    // Afficher du plus ancien (en haut) au plus récent (en bas)
                    const hist = Array.isArray(statusHistory) ? [...statusHistory].sort((a,b) => new Date(a.updatedAt) - new Date(b.updatedAt)) : [];
                    hist.forEach(st => {
                        const role = (st.updatedBy === 'client') ? 'client' : ((st.updatedBy === 'admin' || st.updatedBy === 'agent') ? 'admin' : 'system');
                        const bubble = document.createElement('div');
                        bubble.className = `conversation-bubble ${role === 'client' ? 'from-client' : (role === 'admin' ? 'from-admin' : 'from-system')}`;
                        bubble.setAttribute('role', 'article');
                        const when = st.updatedAt ? new Date(st.updatedAt) : null;
                        const timeText = when ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(when) : '';
                        bubble.setAttribute('aria-label', `${role === 'client' ? 'Message client' : (role === 'admin' ? 'Message administrateur' : 'Mise à jour de statut')} ${timeText}`);

                        const header = document.createElement('div');
                        header.className = 'bubble-header';
                        const who = (role === 'client') ? 'Client' : (role === 'admin' ? 'Admin' : 'Système');
                        header.innerHTML = `<span class="bubble-author">${who}</span><span class="bubble-time">${timeText}</span>`;
                        // Badge de statut actif pour ce message
                        const statusText = stTr[st.status] || st.status || '';
                        const statusBadge = document.createElement('span');
                        statusBadge.className = `bubble-status-badge ${getStatusBadgeClass(st.status)}`;
                        statusBadge.textContent = statusText;
                        const timeEl = header.querySelector('.bubble-time');
                        if (timeEl && timeEl.parentNode) {
                            header.insertBefore(statusBadge, timeEl);
                        } else {
                            header.appendChild(statusBadge);
                        }

                        const content = document.createElement('div');
                        content.className = 'bubble-content';
                        // Le contenu conserve le texte existant
                        const parts = [];
                        if (role === 'system' && statusText) parts.push(`<em>${statusText}</em>`);
                        if (st.comment) parts.push(st.comment);
                        content.innerHTML = parts.length ? parts.map(p => `<p>${p}</p>`).join('') : '<p>Mise à jour</p>';

                        // Pièces jointes: attachments + documents liés à ce statut
                        const combinedItems = [];
                        if (Array.isArray(st.attachments)) {
                            st.attachments.forEach(att => {
                                let filePath = '';
                                if (att.filePath) {
                                    filePath = att.filePath.includes('uploads/') ? '/uploads/' + att.filePath.split('uploads/')[1] : '/uploads/' + att.filePath.split('/').pop();
                                }
                                combinedItems.push({ filePath, fileName: att.fileName || 'Fichier' });
                            });
                        }
                        const docsForThisStatus = docsByStatusId.get(st._id) || [];
                        docsForThisStatus.forEach(doc => {
                            if (doc.__normPath) combinedItems.push({ filePath: doc.__normPath, fileName: doc.fileName || 'Fichier' });
                        });
                        if (combinedItems.length > 0) {
                            const list = document.createElement('div');
                            list.className = 'bubble-attachments';
                            const seen = new Set();
                            combinedItems.forEach(item => {
                                const key = (item.filePath && item.filePath.toLowerCase()) || ('name:' + (item.fileName || '').toLowerCase());
                                if (seen.has(key)) return; seen.add(key);
                                const fileName = item.fileName || '';
                                const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
                                const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
                                const isPDF = ext === 'pdf';
                                const att = document.createElement('div');
                                att.className = 'bubble-attachment-item';
                                let preview;
                                if (item.filePath) {
                                    preview = document.createElement('a');
                                    preview.href = item.filePath;
                                    preview.target = '_blank';
                                    preview.rel = 'noopener';
                                    preview.className = 'attachment-preview';
                                } else {
                                    preview = document.createElement('div');
                                    preview.className = 'attachment-preview';
                                }
                                if (item.filePath && isImage) {
                                    preview.innerHTML = `<img src="${item.filePath}" alt="${fileName}" class="document-thumbnail">`;
                                } else if (item.filePath && isPDF) {
                                    preview.innerHTML = `<div class=\"pdf-preview\"><i class=\"fas fa-file-pdf\"></i><span>PDF</span></div>`;
                                } else {
                                    preview.innerHTML = `<i class=\"fas fa-file attachment-icon\"></i>`;
                                }
                                att.appendChild(preview);
                                list.appendChild(att);
                            });
                            bubble.appendChild(list);
                        }

                        bubble.appendChild(header);
                        bubble.appendChild(content);
                        conversation.appendChild(bubble);
                    });

                    try { conversation.scrollTop = conversation.scrollHeight; } catch(_) {}
                }
            } catch (e) {
                console.error('Erreur lors du rendu du fil de conversation:', e);
            }

            // Transformer le formulaire de mise à jour du statut en carte dédiée
            try {
                const statusForm = document.getElementById('update-status-form');
                if (statusForm) {
                    statusForm.classList.add('panel', 'panel--status');
                    // Éviter les doublons d'en-tête si déjà présent
                    if (!statusForm.querySelector('.panel-header')) {
                        const stHeader = document.createElement('div');
                        stHeader.className = 'panel-header';
                        stHeader.innerHTML = '<i class="fas fa-flag-checkered"></i><h3>Mettre à jour le statut</h3>';
                        statusForm.insertBefore(stHeader, statusForm.firstChild);
                    }
                } else {
                    console.warn('Formulaire #update-status-form introuvable pour stylisation en carte');
                }
            } catch(err) {
                console.warn('Impossible de styliser le formulaire de statut en carte', err);
            }

            // Documents
            console.log('Mise à jour des documents');
            try {
                const documentsList = document.getElementById('documents-list');
                if (!documentsList) {
                    console.error('Element documents-list introuvable');
                    return;
                }
                documentsList.innerHTML = '';
                
                if (ticket.documents && ticket.documents.length > 0) {
                    // Regrouper les documents par type
                    const documentsByType = {};
                    
                    // Initialiser les groupes de documents
                    documentTypeOrder.forEach(type => {
                        documentsByType[type] = [];
                    });
                    
                    // Ajouter les documents à leurs groupes respectifs
                    ticket.documents.forEach(doc => {
                        const docType = doc.type || 'documents_autres';
                        if (!documentsByType[docType]) {
                            documentsByType[docType] = [];
                        }
                        documentsByType[docType].push(doc);
                    });
                    
                    // Afficher les documents par groupe dans l'ordre défini
                    documentTypeOrder.forEach(type => {
                        const docs = documentsByType[type];
                        if (docs && docs.length > 0) {
                            // Créer un en-tête pour le groupe de documents
                            const groupHeader = document.createElement('div');
                            groupHeader.className = 'document-group-header';
                            groupHeader.innerHTML = `
                                <h4>
                                    <i class="fas ${documentTypeIcons[type] || 'fa-file'}"></i>
                                    ${documentTypeTranslations[type] || type}
                                    <span class="document-count">(${docs.length})</span>
                                </h4>
                            `;
                            documentsList.appendChild(groupHeader);
                            
                            // Créer un conteneur pour les documents de ce groupe
                            const groupContainer = document.createElement('div');
                            groupContainer.className = 'document-group';
                            
                            // Ajouter chaque document au groupe
                            docs.forEach(doc => {
                                const docItem = document.createElement('div');
                                docItem.className = 'document-item';
                                
                                const docIcon = document.createElement('div');
                                docIcon.className = 'document-icon';
                                docIcon.innerHTML = `<i class=\"fas ${documentTypeIcons[doc.type] || 'fa-file'}\"></i>`;
                                
                                const docName = document.createElement('div');
                                docName.className = 'document-name';
                                docName.textContent = doc.fileName;
                                
                                const docActions = document.createElement('div');
                                docActions.className = 'document-actions';
                                
                                // Vérifier si le chemin du fichier est défini
                                let filePath = '';
                                if (doc.filePath) {
                                    // Extraire uniquement la partie relative du chemin (après 'uploads/')
                                    filePath = doc.filePath.includes('uploads/') 
                                        ? '/uploads/' + doc.filePath.split('uploads/')[1] 
                                        : '/uploads/' + doc.filePath.split('/').pop();
                                } else if (doc.fileId) {
                                    // Si filePath n'est pas défini mais fileId oui, utiliser fileId
                                    filePath = `/uploads/${doc.fileId}`;
                                }
                                
                                // Créer un conteneur pour la prévisualisation
                                const docPreview = document.createElement('div');
                                docPreview.className = 'document-preview';
                                
                                // Déterminer le type de fichier pour la prévisualisation
                                const fileExtension = doc.fileName ? doc.fileName.split('.').pop().toLowerCase() : '';
                                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                                const isPDF = fileExtension === 'pdf';
                                
                                if (filePath && isImage) {
                                    // Prévisualisation d'image
                                    docPreview.innerHTML = `<img src="${filePath}" alt="${doc.fileName}" class="document-thumbnail">`;
                                } else if (filePath && isPDF) {
                                    // Icône PDF avec miniature
                                    docPreview.innerHTML = `
                                        <div class="pdf-preview">
                                            <i class="fas fa-file-pdf"></i>
                                            <span>PDF</span>
                                        </div>
                                    `;
                                } else {
                                    // Icône par défaut pour les autres types de fichiers
                                    docPreview.innerHTML = `<i class=\"fas ${documentTypeIcons[doc.type] || 'fa-file'} document-icon-large\"></i>`;
                                }
                                
                                // Ajouter les actions (liens)
                                if (filePath) {
                                    docActions.innerHTML = `<a href="${filePath}" target="_blank" class="btn-view-doc">Voir</a>`;
                                } else {
                                    // Si ni filePath ni fileId ne sont définis, désactiver le lien
                                    docActions.innerHTML = `<span class="disabled-link" title="Fichier non disponible">Voir</span>`;
                                }
                                
                                docItem.appendChild(docPreview);
                                docItem.appendChild(docName);
                                docItem.appendChild(docActions);
                                
                                groupContainer.appendChild(docItem);
                            });
                            
                            documentsList.appendChild(groupContainer);
                        }
                    });
                } else {
                    documentsList.innerHTML = '<p>Aucun document joint</p>';
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour des documents:', error);
            }
        
            // Historique des statuts
            console.log('Mise à jour de l\'historique des statuts');
            try {
                const statusTimeline = document.getElementById('detail-status-timeline');
                if (!statusTimeline) {
                    console.error('Element detail-status-timeline introuvable');
                    return;
                }
                
                statusTimeline.innerHTML = '';
                
                if (statusHistory && statusHistory.length > 0) {
            // Conserver la liste des chemins déjà rendus via les pièces jointes de statuts
            const renderedAttachmentPaths = new Set();
            // Préparer le mapping des documents du ticket vers une mise à jour de statut
            const normalizePath = (p) => {
                if (!p) return '';
                return p.includes('uploads/') ? '/uploads/' + p.split('uploads/')[1] : '/uploads/' + p.split('/').pop();
            };
            const docsRaw = Array.isArray(ticket.documents) ? ticket.documents : [];
            const normalizedDocs = docsRaw.map(doc => ({
                ...doc,
                __normPath: doc.filePath ? normalizePath(doc.filePath) : (doc.fileId ? `/uploads/${doc.fileId}` : ''),
                __uploadAt: doc.uploadDate ? new Date(doc.uploadDate) : null
            })).filter(d => d.__normPath);
            const statusesAsc = [...statusHistory].sort((a,b) => new Date(a.updatedAt) - new Date(b.updatedAt));
            const docsByStatusId = new Map();
            const usedDocPaths = new Set();
            // Assigner chaque document au statut le plus pertinent (par date, priorité aux réponses client)
            normalizedDocs.forEach(d => {
                const t = d.__uploadAt;
                let target = null;
                if (t) {
                    // Trouver le statut avec updatedAt <= t le plus proche
                    let idx = -1;
                    for (let i = 0; i < statusesAsc.length; i++) {
                        const u = new Date(statusesAsc[i].updatedAt);
                        if (u <= t) idx = i; else break;
                    }
                    if (idx === -1) idx = 0; // avant le premier, rattacher au premier
                    // Si possible, préférer un statut client en remontant
                    let chosen = statusesAsc[idx];
                    for (let j = idx; j >= 0; j--) {
                        if (statusesAsc[j] && statusesAsc[j].updatedBy === 'client') { chosen = statusesAsc[j]; break; }
                    }
                    target = chosen;
                } else {
                    // Pas de date: rattacher au dernier statut client si présent, sinon au plus récent
                    target = [...statusesAsc].reverse().find(s => s.updatedBy === 'client') || statusesAsc[statusesAsc.length - 1];
                }
                if (target && target._id) {
                    const arr = docsByStatusId.get(target._id) || [];
                    arr.push(d);
                    docsByStatusId.set(target._id, arr);
                }
            });
            statusHistory.forEach((status, index) => {
                const statusItem = document.createElement('div');
                statusItem.className = 'status-item';
                if (index === 0) statusItem.classList.add('active');
                
                const statusDot = document.createElement('div');
                statusDot.className = 'status-dot';
                const icon = document.createElement('i');
                icon.className = `fas ${statusIcons[status.status] || 'fa-circle-info'}`;
                statusDot.appendChild(icon);
                
                const statusContent = document.createElement('div');
                statusContent.className = 'status-content';
                
                const statusDate = document.createElement('div');
                statusDate.className = 'status-date';
                statusDate.textContent = formatDate(status.updatedAt);
                
                const statusTitle = document.createElement('div');
                statusTitle.className = 'status-title';
                statusTitle.textContent = statusTranslations[status.status] || status.status;
                
                const statusDescription = document.createElement('div');
                statusDescription.className = 'status-description';
                statusDescription.textContent = status.comment || 'Mise à jour du statut';
                
                // Ajouter des informations supplémentaires si demandées
                if (status.additionalInfoRequested) {
                    const additionalInfo = document.createElement('div');
                    additionalInfo.className = 'additional-info';
                    additionalInfo.innerHTML = `<strong>Informations demandées:</strong> ${status.additionalInfoRequested}`;
                    statusContent.appendChild(additionalInfo);
                }
                
                statusContent.appendChild(statusDate);
                statusContent.appendChild(statusTitle);
                statusContent.appendChild(statusDescription);
                
                // Pièces jointes associées à cette mise à jour (attachments + documents du ticket liés)
                const combinedItems = [];
                // 1) Depuis status.attachments
                if (Array.isArray(status.attachments)) {
                    status.attachments.forEach(att => {
                        let filePath = '';
                        if (att.filePath) {
                            filePath = att.filePath.includes('uploads/')
                                ? '/uploads/' + att.filePath.split('uploads/')[1]
                                : '/uploads/' + att.filePath.split('/').pop();
                        }
                        if (filePath) { try { renderedAttachmentPaths.add(filePath); } catch(_) {} }
                        combinedItems.push({
                            filePath,
                            fileName: att.fileName || 'Fichier'
                        });
                    });
                }
                // 2) Documents du ticket liés à ce statut
                const docsForThisStatus = docsByStatusId.get(status._id) || [];
                docsForThisStatus.forEach(doc => {
                    if (doc.__normPath && !renderedAttachmentPaths.has(doc.__normPath)) {
                        combinedItems.push({ filePath: doc.__normPath, fileName: doc.fileName || 'Fichier' });
                        try { usedDocPaths.add(doc.__normPath); } catch(_) {}
                    }
                });
                
                if (combinedItems.length > 0) {
                    // Déduplication locale des pièces jointes par chemin normalisé (ou nom)
                    const seenKeys = new Set();
                    const itemsToRender = [];
                    combinedItems.forEach(ci => {
                        const key = (ci.filePath && ci.filePath.toLowerCase()) || ('name:' + (ci.fileName || '').toLowerCase());
                        if (!seenKeys.has(key)) { seenKeys.add(key); itemsToRender.push(ci); }
                    });

                    const attachmentsContainer = document.createElement('div');
                    attachmentsContainer.className = 'status-attachments';
                    const attachmentsHeader = document.createElement('div');
                    attachmentsHeader.className = 'status-attachments-header';
                    attachmentsHeader.innerHTML = `<i class="fas fa-paperclip"></i> Pièces jointes (${itemsToRender.length})`;
                    attachmentsContainer.appendChild(attachmentsHeader);
                    const attachmentsList = document.createElement('div');
                    attachmentsList.className = 'status-attachments-list';
                    itemsToRender.forEach(item => {
                        const fileName = item.fileName;
                        const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
                        const isImage = ['jpg','jpeg','png','gif','webp'].includes(fileExt);
                        const isPDF = fileExt === 'pdf';
                        const attItem = document.createElement('div');
                        attItem.className = 'status-attachment-item';
                        // L'aperçu devient cliquable directement
                        let preview;
                        if (item.filePath) {
                            preview = document.createElement('a');
                            preview.href = item.filePath;
                            preview.target = '_blank';
                            preview.rel = 'noopener';
                            preview.className = 'attachment-preview';
                        } else {
                            preview = document.createElement('div');
                            preview.className = 'attachment-preview';
                        }
                        if (item.filePath && isImage) {
                            preview.innerHTML = `<img src="${item.filePath}" alt="${item.fileName}" class="document-thumbnail">`;
                        } else if (item.filePath && isPDF) {
                            preview.innerHTML = `<div class=\"pdf-preview\"><i class=\"fas fa-file-pdf\"></i><span>PDF</span></div>`;
                        } else {
                            preview.innerHTML = `<i class=\"fas fa-file attachment-icon\"></i>`;
                        }
                        attItem.appendChild(preview);
                        attachmentsList.appendChild(attItem);
                    });
                    attachmentsContainer.appendChild(attachmentsList);
                    statusContent.appendChild(attachmentsContainer);
                }
                
                statusItem.appendChild(statusDot);
                statusItem.appendChild(statusContent);
                
                statusTimeline.appendChild(statusItem);
            });

            // Ajouter un item de timeline pour les documents non liés à un statut
            try {
                const leftovers = normalizedDocs.filter(d => d.__normPath && !renderedAttachmentPaths.has(d.__normPath) && !usedDocPaths.has(d.__normPath));
                // Déduplication des documents non liés par chemin normalisé
                const leftoversMap = new Map();
                leftovers.forEach(d => { if (!leftoversMap.has(d.__normPath)) leftoversMap.set(d.__normPath, d); });
                const uniqueLeftovers = Array.from(leftoversMap.values());
                if (uniqueLeftovers.length > 0) {
                    const item = document.createElement('div');
                    item.className = 'status-item';

                    const dot = document.createElement('div');
                    dot.className = 'status-dot';
                    const i = document.createElement('i');
                    i.className = 'fas fa-paperclip';
                    dot.appendChild(i);

                    const content = document.createElement('div');
                    content.className = 'status-content';

                    const date = document.createElement('div');
                    date.className = 'status-date';
                    date.textContent = 'Documents non liés';

                    const title = document.createElement('div');
                    title.className = 'status-title';
                    title.textContent = `Pièces jointes (${uniqueLeftovers.length})`;

                    const list = document.createElement('div');
                    list.className = 'status-attachments-list';

                    uniqueLeftovers.forEach(doc => {
                        const att = document.createElement('div');
                        att.className = 'status-attachment-item';
                        const fileName = doc.fileName || 'Fichier';
                        const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
                        const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
                        const isPDF = ext === 'pdf';

                        // L'aperçu devient cliquable directement
                        let preview;
                        if (doc.__normPath) {
                            preview = document.createElement('a');
                            preview.href = doc.__normPath;
                            preview.target = '_blank';
                            preview.rel = 'noopener';
                            preview.className = 'attachment-preview';
                        } else {
                            preview = document.createElement('div');
                            preview.className = 'attachment-preview';
                        }
                        if (doc.__normPath && isImage) {
                            preview.innerHTML = `<img src="${doc.__normPath}" alt="${fileName}" class="document-thumbnail">`;
                        } else if (doc.__normPath && isPDF) {
                            preview.innerHTML = `<div class="pdf-preview"><i class="fas fa-file-pdf"></i><span>PDF</span></div>`;
                        } else {
                            preview.innerHTML = `<i class="fas fa-file attachment-icon"></i>`;
                        }

                        att.appendChild(preview);
                        list.appendChild(att);
                    });

                    const container = document.createElement('div');
                    container.className = 'status-attachments';

                    const header = document.createElement('div');
                    header.className = 'status-attachments-header';
                    header.innerHTML = `<i class="fas fa-paperclip"></i> Documents du ticket (non liés)`;

                    container.appendChild(header);
                    container.appendChild(list);

                    content.appendChild(date);
                    content.appendChild(title);
                    content.appendChild(container);
                    item.appendChild(dot);
                    item.appendChild(content);
                    statusTimeline.appendChild(item);
                }
            } catch (e) {
                console.warn('Impossible d\'ajouter le bloc documents dans la timeline:', e);
            }
                } else {
                    statusTimeline.innerHTML = '<p>Aucun historique de statut disponible</p>';
                }
                // Réinitialiser le formulaire de mise à jour de statut
                const form = document.getElementById('update-status-form');
                if (form) {
                    form.reset();
                    console.log('Formulaire de mise à jour du statut réinitialisé');
                } else {
                    console.error('Formulaire de mise à jour du statut non trouvé lors de la réinitialisation');
                }
                
                console.log('Affichage des détails du ticket terminé');
                // Les gestionnaires d'événements sont déjà configurés via la délégation d'événements
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'historique des statuts:', error);
            }
        } catch (error) {
            console.error('Erreur globale dans displayTicketDetails:', error);
            alert('Erreur lors de l\'affichage des détails du ticket. Veuillez consulter la console pour plus d\'informations.');
        }
    }
    
    // Mettre à jour le statut d'un ticket
    async function updateTicketStatus(ticketId, status, comment, additionalInfoRequested, clientNotified, priority, agentResponded = false) {
        try {
            const payload = {
                status,
                comment,
                additionalInfoRequested,
                clientNotified,
                priority,
                updatedBy: 'admin'
            };
            console.log('[updateTicketStatus] Payload envoyé:', payload);
            const response = await fetch(`/api/admin/tickets/${ticketId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authToken}`
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                let serverMessage = '';
                try {
                    const errJson = await response.json();
                    serverMessage = errJson?.message || errJson?.error || JSON.stringify(errJson);
                    console.error('[updateTicketStatus] Réponse erreur JSON:', errJson);
                } catch (_) {
                    try {
                        const errText = await response.text();
                        serverMessage = errText;
                        console.error('[updateTicketStatus] Réponse erreur texte:', errText);
                    } catch (__) {
                        // ignore
                    }
                }
                console.error('[updateTicketStatus] Échec mise à jour', { statusCode: response.status, payload });
                throw new Error(serverMessage || 'Erreur lors de la mise à jour du statut');
            }
            
            // Recharger les détails du ticket
            viewTicket(ticketId);
            
            // Toute action admin = réponse: nettoyer les badges/états d'attente (+24h, réponse client)
            try { if (typeof window.acknowledgeClientUpdate === 'function') window.acknowledgeClientUpdate(ticketId); } catch (_) {}
            
            // Rafraîchir la vue Kanban si elle existe
            if (typeof window.refreshKanbanView === 'function') {
                window.refreshKanbanView();
            }
            
        } catch (error) {
            console.error('Erreur lors de la mise à jour du statut:', error);
            if (error.message === 'Unauthorized') {
                logout();
            }
            alert(`Une erreur est survenue lors de la mise à jour du statut: ${error?.message || ''}`);
        }
    }
    
    // Téléverser des pièces jointes pour un commentaire via l'endpoint d'informations complémentaires
    async function uploadCommentAttachments(ticketNumber, files, message = '') {
        try {
            if (!ticketNumber || !files || files.length === 0) return false;
            const formData = new FormData();
            formData.append('ticketNumber', ticketNumber);
            if (message) formData.append('message', message);
            Array.from(files).forEach(f => formData.append('files', f)); // champ attendu par le backend: 'files'

            const headers = {};
            if (typeof authToken === 'string' && authToken) {
                headers['Authorization'] = `Basic ${authToken}`;
            }

            const resp = await fetch('/api/tickets/additional-info', {
                method: 'POST',
                headers, // ne pas définir Content-Type, laissé à FormData
                body: formData
            });
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw new Error(`Upload pièces jointes échoué (${resp.status}). ${text}`);
            }
            const data = await resp.json().catch(() => ({}));
            console.log('Pièces jointes téléversées avec succès:', data);
            // Rafraîchir la vue pour voir les nouveaux documents
            if (typeof currentTicketId !== 'undefined' && currentTicketId) {
                try { viewTicket(currentTicketId); } catch(_) {}
            }
            return true;
        } catch (e) {
            console.error('Erreur lors du téléversement des pièces jointes:', e);
            alert('Erreur lors du téléversement des pièces jointes.');
            return false;
        }
    }
    
    // Enregistrer les notes internes
    async function saveInternalNotes(ticketId, notes) {
        try {
            if (!ticketId) {
                showToast('error', "Aucun ticket sélectionné");
                return;
            }
            const response = await fetch(`/api/admin/tickets/${ticketId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authToken}`
                },
                body: JSON.stringify({ notes })
            });
            if (!response.ok) {
                if (response.status === 401) throw new Error('Unauthorized');
                const text = await response.text().catch(() => '');
                throw new Error(text || 'Erreur lors de l\'enregistrement des notes');
            }
            // Optionnel: consommer la réponse
            const data = await response.json().catch(() => null);
            // Confirmer côté UI
            showToast('success', 'Notes internes enregistrées');
            // Rafraîchir les détails du ticket pour refléter les données persistées
            try { if (typeof currentTicketId !== 'undefined' && currentTicketId) viewTicket(currentTicketId); } catch(_) {}
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des notes:', error);
            if (error.message === 'Unauthorized') {
                logout();
                return;
            }
            showToast('error', "Impossible d'enregistrer les notes");
        }
    }
    
    // Événements
    
    // Connexion
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        login(username, password);
    });

    // Mot de passe oublié
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotForm = document.getElementById('forgot-form');
    const forgotMsg = document.getElementById('forgot-msg');
    if (forgotLink && forgotForm) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = !forgotForm.style.display || forgotForm.style.display === 'none';
            forgotForm.style.display = isHidden ? 'block' : 'none';
            if (forgotMsg) { forgotMsg.style.display = 'none'; forgotMsg.textContent = ''; forgotMsg.style.color = ''; }
        });
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('forgot-email');
            const email = emailInput ? String(emailInput.value || '').trim().toLowerCase() : '';
            if (!email) return;
            if (forgotMsg) { forgotMsg.style.display = 'none'; forgotMsg.textContent = ''; forgotMsg.style.color = ''; }
            try {
                const resp = await fetch('/api/auth/request-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await resp.json().catch(() => ({}));
                if (resp.ok) {
                    if (forgotMsg) {
                        forgotMsg.textContent = 'Si un compte existe, un email a été envoyé.';
                        forgotMsg.style.display = 'block';
                        forgotMsg.style.color = 'green';
                    }
                } else {
                    if (forgotMsg) {
                        forgotMsg.textContent = (data && data.message) ? data.message : 'Erreur lors de la demande.';
                        forgotMsg.style.display = 'block';
                        forgotMsg.style.color = '';
                    }
                }
            } catch (_) {
                if (forgotMsg) {
                    forgotMsg.textContent = 'Erreur réseau';
                    forgotMsg.style.display = 'block';
                    forgotMsg.style.color = '';
                }
            }
        });
    }
    
    // Déconnexion
    logoutBtn.addEventListener('click', () => {
        logout();
    });
    
    // Initialiser le système d'onglets
    initTabsSystem();
    
    // Retour à la liste
    document.getElementById('back-to-list').addEventListener('click', (e) => {
        e.preventDefault();
        goBackToList();
        try { if (window.location.hash !== '#tickets') window.location.hash = '#tickets'; } catch(_) {}
    });
    
    document.getElementById('breadcrumb-tickets').addEventListener('click', (e) => {
        e.preventDefault();
        goBackToList();
        try { if (window.location.hash !== '#tickets') window.location.hash = '#tickets'; } catch(_) {}
    });
    // Raccourci: clic sur l'onglet "Tickets" dans l'en-tête doit toujours ramener à la liste
    document.addEventListener('click', function(e) {
        const link = e.target && e.target.closest('.horizontal-nav a[href="#tickets"]');
        if (!link) return;
        e.preventDefault();
        goBackToList();
        try {
            if (window.location.hash !== '#tickets') {
                window.location.hash = '#tickets';
            } else {
                if (typeof handleHashRoute === 'function') handleHashRoute();
            }
        } catch(_) {}
    });
    
    // --- Documentation: chargement Markdown et interactions ---
    // Charge un document Markdown depuis admin/docs/<relativePath> et l'affiche
    window.loadMarkdownDoc = async function(relativePath) {
        try {
            const container = document.getElementById('docs-content-article');
            if (!container) return;
            container.dataset.loaded = 'true';
            container.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';
            // Construire une URL absolue fiable vers /admin/docs/<path>
            const base = (location && typeof location.pathname === 'string' && location.pathname.startsWith('/admin')) ? '/admin/' : '/';
            let url = `${base}docs/${relativePath}`.replace(/\\+/g, '/').replace(/\/+/g, '/');
            console.debug('[Docs] Chargement du document:', relativePath, '->', url);
            let resp = await fetch(url, { credentials: 'same-origin' }).catch(e => ({ ok: false, _err: e }));
            // Fallback si besoin (au cas improbable où le contexte n'est pas /admin)
            if (!resp || !resp.ok) {
                const alt = `/admin/docs/${relativePath}`;
                if (alt !== url) {
                    console.warn('[Docs] Premier essai échoué, tentative fallback:', alt, resp && resp.status);
                    resp = await fetch(alt, { credentials: 'same-origin' }).catch(e => ({ ok: false, _err: e }));
                    url = alt;
                }
            }
            if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw new Error(text || `Impossible de charger ${url}`);
            }
            const md = await resp.text();
            let html = '';
            try {
                if (typeof marked !== 'undefined' && marked.parse) {
                    html = marked.parse(md);
                } else {
                    html = md; // fallback en texte brut si marked non dispo
                }
            } catch (perr) {
                console.error('[Docs] Erreur de parsing Markdown via marked:', perr);
                html = md; // fallback
            }
            // Décision d’escalade selon le doc affiché
            container.dataset.docRel = relativePath;
            const decision = (function(rel){
                const r = String(rel || '').toLowerCase();
                // Règles métier demandées
                if (r.startsWith('guides/mecatroniques')) {
                    return { type: 'meca', title: 'Mécatronique — action conseillée', primary: 'Contacter le fournisseur mécatronique', who: 'fournisseur', templateClient: "Bonjour,\n\nSuite à votre signalement sur la mécatronique, nous ouvrons une demande auprès du fournisseur. Merci de nous transmettre :\n- Photos du montage et connectiques\n- Lecture des défauts éventuelle\n- Numéro de série de la pièce\n\nNous revenons vers vous dès retour du fournisseur.\nCordialement,", templateInterne: "[Action] Dossier transmis au fournisseur mécatronique. En attente de retour." };
                }
                if (r.startsWith('guides/moteurs') || r.startsWith('guides/boites') || r.startsWith('guides/ponts') || r.startsWith('guides/autres')) {
                    return { type: 'heavy', title: 'Moteur / Boîte / Autres — action conseillée', primary: 'Contacter le patron', who: 'patron', templateClient: "Bonjour,\n\nVotre dossier (moteur/boîte/autre) est en cours d’analyse prioritaire. Nous escaladons en interne pour décision.\nPouvez-vous joindre : photos du montage, facture huile/consommables, symptômes précis ?\n\nNous revenons vers vous rapidement.\nCordialement,", templateInterne: "[Action] Dossier escaladé au patron pour décision (moteur/boîte/autre)." };
                }
                if (r.startsWith('transport/')) {
                    return { type: 'transport', title: 'Transport — action conseillée', primary: 'Ouvrir la procédure transport', who: 'transport', open: 'docs/transport/ups.md', templateClient: "Bonjour,\n\nPour le transport, merci de suivre la procédure UPS (emballage, photos, étiquette). Nous pouvons vous la renvoyer si besoin.\n\nCordialement,", templateInterne: "[Action] Se référer à la documentation transport (UPS)." };
                }
                // Par défaut, rien
                return null;
            })(relativePath);

            const actionsHtml = decision ? `
                <div class="docs-actions" data-who="${decision.who}">
                  <div class="docs-actions-title">${decision.title}</div>
                  <div class="docs-actions-buttons">
                    ${decision.type === 'transport'
                        ? `<button class="btn-secondary" data-doc-action="open-transport" data-href="${decision.open}"><i class="fas fa-truck"></i> ${decision.primary}</button>`
                        : decision.who === 'fournisseur'
                            ? `<button class="btn-secondary" data-doc-action="contact-supplier"><i class="fas fa-industry"></i> ${decision.primary}</button>`
                            : `<button class="btn-secondary" data-doc-action="contact-boss"><i class="fas fa-user-tie"></i> ${decision.primary}</button>`}
                    <button class="btn-light" data-doc-action="insert-template" data-template="client"><i class="fas fa-copy"></i> Réponse client</button>
                    <button class="btn-light" data-doc-action="insert-template" data-template="interne"><i class="fas fa-clipboard"></i> Note interne</button>
                  </div>
                </div>
            ` : '';

            // Fallback visible si le rendu semble vide
            const finalHtml = (actionsHtml + html);
            const isEmpty = !finalHtml || !String(finalHtml).trim();
            if (isEmpty) {
                console.warn('[Docs] HTML vide après rendu, activation du fallback');
                container.innerHTML = `<div class="docs-actions" style="margin-bottom:10px; padding:10px; background:#fff3cd; border:1px solid #ffe69c; border-radius:8px; color:#7a5d00;">Rendu vide — affichage brut du fichier.</div><pre style="white-space:pre-wrap;">${md.replace(/[&<>]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))}</pre>`;
            } else {
                container.innerHTML = finalHtml;
            }
            // S'assurer que la zone est visible
            try {
                const docsRoot = document.getElementById('admin-docs');
                const docsContent = container.closest && container.closest('.docs-content');
                if (docsRoot) docsRoot.style.display = 'block';
                if (docsContent && docsContent.style) docsContent.style.display = 'block';
                if (container && container.style) container.style.display = 'block';
                const st = window.getComputedStyle ? window.getComputedStyle(container) : null;
                console.debug('[Docs] Rendu inséré:', {
                    lenMd: md.length,
                    lenHtml: String(html).length,
                    decision: !!decision,
                    path: relativePath,
                    offsetHeight: container.offsetHeight,
                    visible: st ? (st.display + '|' + st.visibility + '|' + st.opacity) : 'n/a',
                    txtLen: (container.textContent || '').length
                });
            } catch(_) {}
            // Stocker les templates pour les boutons
            if (decision) {
                container.dataset.templateClient = decision.templateClient || '';
                container.dataset.templateInterne = decision.templateInterne || '';
            } else {
                container.dataset.templateClient = '';
                container.dataset.templateInterne = '';
            }
            // Remonter en haut du contenu
            try { if (window.innerWidth >= 1000) { container.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } catch(_) {}
        } catch (err) {
            const container = document.getElementById('docs-content-article');
            if (container) container.innerHTML = `<div class="login-error">${err.message || 'Erreur inattendue'}</div>`;
            console.error('loadMarkdownDoc error:', err);
        }
    };

    // --- Documentation publique: sidebar dynamique ---
    async function loadPublicDocsSidebar() {
        const container = document.getElementById('docs-sidebar-dynamic');
        if (!container) return;
        container.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';
        try {
            const res = await fetch('/api/docs', { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data || data.success !== true) {
                throw new Error(data?.message || 'Erreur lors du chargement des documents');
            }
            const files = Array.isArray(data.files) ? data.files : [];
            renderPublicDocsSidebar(files);
            // Charger automatiquement le premier document si rien n'est encore chargé
            const art = document.getElementById('docs-content-article');
            const first = files[0] && files[0].path;
            if (first && art && !art.dataset.loaded) {
                try { window.loadMarkdownDoc(first); } catch(_) {}
            }
        } catch (e) {
            console.error('loadPublicDocsSidebar error:', e);
            container.innerHTML = `<div class="login-error">${e.message || 'Erreur lors du chargement des documents'}</div>`;
        }
    }

    function renderPublicDocsSidebar(files) {
        const container = document.getElementById('docs-sidebar-dynamic');
        if (!container) return;
        const list = Array.isArray(files) ? files : [];
        if (list.length === 0) {
            container.innerHTML = '<p>Aucun document disponible.</p>';
            return;
        }
        const html = [
            '<ul class="docs-list" style="list-style:none; margin:0; padding:0;">',
            ...list.map(f => {
                const safePath = String(f.path || '');
                const label = String(f.name || safePath.split('/').pop());
                return `<li style="padding:8px 10px; border-bottom:1px solid #f0f0f0;"><a href="#docs" data-doc="${safePath}" style="display:flex; gap:8px; align-items:center; text-decoration:none; color:inherit;"><i class="fas fa-file-alt" aria-hidden="true"></i><span>${safePath}</span></a></li>`;
            }),
            '</ul>'
        ].join('');
        container.innerHTML = html;
        try { container.dataset.loaded = 'true'; } catch(_) {}
    }

    // Clics sur les liens de la sidebar documentation (capture pour priorité maximale)
    document.addEventListener('click', function(e) {
        const a = e.target && e.target.closest && e.target.closest('.docs-sidebar a[data-doc]');
        if (!a) return;
        // Intercepter tôt pour éviter qu'un autre handler global empêche le chargement
        e.preventDefault();
        try { e.stopPropagation(); } catch(_) {}
        const rel = a.getAttribute('data-doc');
        if (rel) {
            try {
                if (window.location.hash !== '#docs') {
                    window.location.hash = '#docs';
                } else if (history && history.replaceState) {
                    history.replaceState(null, '', '#docs');
                }
            } catch(_) {}
            try {
                document.querySelectorAll('.docs-sidebar a[data-doc].active').forEach(el => el.classList.remove('active'));
                a.classList.add('active');
            } catch(_) {}
            try {
                const docs = document.getElementById('admin-docs');
                if (docs) docs.style.display = 'block';
                if (typeof showDocs === 'function') showDocs();
            } catch(_) {}
            window.loadMarkdownDoc(rel);
        }
    }, true);

    // Clics sur les liens de la sidebar documentation (bubbling, backup)
    document.addEventListener('click', function(e) {
        const a = e.target && e.target.closest('.docs-sidebar a[data-doc]');
        if (!a) return;
        e.preventDefault();
        try { e.stopPropagation(); } catch(_) {}
        const rel = a.getAttribute('data-doc');
        if (rel) {
            // Aller sur #docs si on n'y est pas
            try {
                if (window.location.hash !== '#docs') {
                    window.location.hash = '#docs';
                } else if (history && history.replaceState) {
                    // Verrouiller le hash sur #docs pour éviter un basculement tardif par d'autres handlers
                    history.replaceState(null, '', '#docs');
                }
            } catch(_) {}
            // Mettre à jour l'état actif dans la sidebar
            try {
                document.querySelectorAll('.docs-sidebar a[data-doc].active').forEach(el => el.classList.remove('active'));
                a.classList.add('active');
            } catch(_) {}
            // Forcer l'affichage de la section docs (au cas où elle aurait été masquée par un handler global)
            try {
                const docs = document.getElementById('admin-docs');
                if (docs) docs.style.display = 'block';
                if (typeof showDocs === 'function') showDocs();
            } catch(_) {}
            window.loadMarkdownDoc(rel);
        }
    });

    // En dernière ligne de défense: empêcher les gestionnaires globaux de fermer quoi que ce soit
    // lorsque l’on clique à l’intérieur de la zone Documentation (#admin-docs)
    // Capture = true pour intercepter avant les autres écouteurs
    document.addEventListener('click', function(e) {
        try {
            const insideDocs = e.target && e.target.closest && e.target.closest('#admin-docs');
            if (!insideDocs) return;
            // Laisser passer nos propres handlers (liens de la sidebar et boutons d'actions du doc)
            const isDocsLink = e.target.closest && e.target.closest('.docs-sidebar a[data-doc]');
            const isDocsActionBtn = e.target.closest && e.target.closest('[data-doc-action]');
            if (isDocsLink || isDocsActionBtn) return;
            // Sinon, bloquer la propagation pour éviter des fermetures parasites externes
            e.stopPropagation();
        } catch(_) {}
    }, true);

    // Recherche dans la sidebar docs
    const docsSearch = document.getElementById('docs-search');
    if (docsSearch) {
        docsSearch.addEventListener('input', function() {
            const q = (this.value || '').toLowerCase().trim();
            const items = document.querySelectorAll('.docs-sidebar li');
            items.forEach(li => {
                const txt = (li.textContent || '').toLowerCase();
                li.style.display = !q || txt.includes(q) ? '' : 'none';
            });
        });
    }

    // Gestionnaire d'événement pour le bouton de suppression dans la vue détaillée
    document.getElementById('delete-ticket-detail').addEventListener('click', async (event) => {
        event.preventDefault();
        const btn = event.currentTarget;
        const ticketId = currentTicketId;
        const ticketNumber = document.getElementById('detail-ticket-number').textContent;
        if (!ticketId) return;
        // État de chargement
        const prevHTML = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression...';
        try {
            const ok = await deleteTicket(ticketId, ticketNumber, event);
            if (ok) {
                goBackToList();
            }
        } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.innerHTML = prevHTML;
        }
    });
    
    // Fonction pour collecter tous les filtres
    function collectFilters() {
        const ticketNumberValue = document.getElementById('ticket-number-filter').value;
        const orderNumberValue = document.getElementById('order-number-filter').value;
        const clientFirstNameValue = document.getElementById('client-firstname-filter').value;
        const clientNameValue = document.getElementById('client-name-filter').value;
        const dateFromValue = document.getElementById('date-from').value;
        const dateToValue = document.getElementById('date-to').value;
        const priorityValue = document.getElementById('priority-filter')?.value || '';
        
        console.log('Filtres collectés:');
        console.log('- Statut:', statusFilter.value);
        console.log('- Type de pièce:', partFilter.value);
        console.log('- N° Ticket:', ticketNumberValue);
        console.log('- N° Commande:', orderNumberValue);
        console.log('- Prénom client:', clientFirstNameValue);
        console.log('- Nom client:', clientNameValue);
        console.log('- Date du:', dateFromValue);
        console.log('- Date au:', dateToValue);
        console.log('- Priorité:', priorityValue);
        
        const awaitingCheckbox = document.getElementById('awaiting-agent-filter');
        const awaitingBtn = document.getElementById('qf-awaiting');
        const awaitingFromBtn = !!(awaitingBtn && (awaitingBtn.classList.contains('active') || awaitingBtn.getAttribute('aria-pressed') === 'true'));
        const awaitingAgentOnly = awaitingCheckbox ? !!awaitingCheckbox.checked : awaitingFromBtn;

        return {
            search: searchInput.value,
            status: statusFilter.value,
            partType: partFilter.value,
            ticketNumber: ticketNumberValue,
            orderNumber: orderNumberValue,
            clientFirstName: clientFirstNameValue,
            clientName: clientNameValue,
            dateFrom: dateFromValue,
            dateTo: dateToValue,
            priority: priorityValue,
            awaitingAgentOnly,
            sort: document.getElementById('sort-order-hidden')?.value || ''
        };
    }



    // Recherche
    searchBtn.addEventListener('click', () => {
        loadTickets(1, collectFilters());
    });
    
    // Appliquer les filtres
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        console.log('Bouton "Appliquer les filtres" trouvé, ajout du gestionnaire d\'événements');
        applyFiltersBtn.addEventListener('click', (e) => {
            console.log('Bouton "Appliquer les filtres" cliqué');
            e.preventDefault(); // Empêcher le comportement par défaut
            loadTickets(1, collectFilters());
        });
    } else {
        console.error('Bouton "Appliquer les filtres" non trouvé dans le DOM');
    }
    
    // Effacer les filtres
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Réinitialiser tous les filtres
            document.getElementById('status-filter').value = '';
            document.getElementById('part-filter').value = '';
            document.getElementById('priority-filter').value = '';
            document.getElementById('ticket-number-filter').value = '';
            document.getElementById('order-number-filter').value = '';
            document.getElementById('client-firstname-filter').value = '';
            document.getElementById('client-name-filter').value = '';
            document.getElementById('date-from').value = '';
            document.getElementById('date-to').value = '';
            document.getElementById('search-input').value = '';
            const awaitingFilter = document.getElementById('awaiting-agent-filter');
            if (awaitingFilter) awaitingFilter.checked = false;
            
            // Réinitialiser le tri rapide
            const sortHidden = document.getElementById('sort-order-hidden');
            if (sortHidden) sortHidden.value = '';
            const qfOldest = document.getElementById('qf-oldest');
            const qfNewest = document.getElementById('qf-newest');
            if (qfOldest) qfOldest.classList.remove('active');
            if (qfNewest) qfNewest.classList.remove('active');
            const qfAwaiting = document.getElementById('qf-awaiting');
            const qfUrgent = document.getElementById('qf-urgent');
            if (qfAwaiting) {
                qfAwaiting.classList.remove('active');
                qfAwaiting.setAttribute('aria-pressed', 'false');
            }
            if (qfUrgent) {
                qfUrgent.classList.remove('active');
                qfUrgent.setAttribute('aria-pressed', 'false');
            }

            // Recharger les tickets sans filtres
            loadTickets(1);
            
            // Prévisualiser les résultats après réinitialisation
            previewFilterResults();
        });
    } else {
        console.error('Bouton "Effacer les filtres" non trouvé dans le DOM');
    }
    
    // Ajouter des écouteurs d'événements pour la prévisualisation en temps réel
    const filterElements = [
        'status-filter', 'part-filter', 'priority-filter', 'ticket-number-filter',
        'order-number-filter', 'client-firstname-filter', 'client-name-filter',
        'date-from', 'date-to', 'search-input'
    ];
    
    // Fonction pour ajouter un délai avant d'exécuter la prévisualisation (debounce)
    let previewTimeout;
    const debouncedPreview = () => {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            previewFilterResults();
        }, 300); // Attendre 300ms après la dernière modification
    };
    
    // Ajouter les écouteurs à tous les éléments de filtre
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.tagName === 'SELECT') {
                element.addEventListener('change', debouncedPreview);
            } else {
                element.addEventListener('input', debouncedPreview);
                element.addEventListener('keyup', debouncedPreview);
            }
        }
    });
    
    // Écouteur pour le filtre "Réponse client non traitée"
    const awaitingOnlyEl = document.getElementById('awaiting-agent-filter');
    if (awaitingOnlyEl) awaitingOnlyEl.addEventListener('change', () => {
        try {
            localStorage.setItem('awaitingAgentOnly', awaitingOnlyEl.checked ? '1' : '0');
            const qfAwaiting = document.getElementById('qf-awaiting');
            if (qfAwaiting) qfAwaiting.classList.toggle('active', !!awaitingOnlyEl.checked);
        } catch (_) {}
        debouncedPreview();
    });
    
    // Ajouter des gestionnaires d'événements pour les touches Entrée sur les champs de recherche
    document.getElementById('ticket-number-filter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadTickets(1, collectFilters());
        }
    });
    
    document.getElementById('order-number-filter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadTickets(1, collectFilters());
        }
    });
    
    document.getElementById('client-name-filter').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadTickets(1, collectFilters());
        }
    });
    
    // Réinitialiser les filtres
    const resetFiltersButton = document.getElementById('clear-filters');
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
        // Réinitialiser tous les champs de filtres
        searchInput.value = '';
        statusFilter.value = '';
        partFilter.value = '';
        document.getElementById('ticket-number-filter').value = '';
        document.getElementById('order-number-filter').value = '';
        document.getElementById('client-name-filter').value = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        // Réinitialiser le filtre "Réponse client non traitée"
        const awaitingOnlyEl = document.getElementById('awaiting-agent-filter');
        if (awaitingOnlyEl) awaitingOnlyEl.checked = false;
        
        // Recharger les tickets sans filtres
        loadTickets(1, {});
        });
    }
    
    // Recherche avec touche Entrée
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadTickets(1, collectFilters());
        }
    });
    
    // Recherche avancée avec touche Entrée pour les autres champs
    const filterInputs = [
        document.getElementById('ticket-number-filter'),
        document.getElementById('order-number-filter'),
        document.getElementById('client-name-filter')
    ];
    
    filterInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadTickets(1, collectFilters());
            }
        });
    });

    // --- Filtres rapides (barre au-dessus de la liste) ---
    const qfAwaiting = document.getElementById('qf-awaiting');
    const qfUrgent = document.getElementById('qf-urgent');
    const qfOldest = document.getElementById('qf-oldest');
    const qfNewest = document.getElementById('qf-newest');
    const qfReset = document.getElementById('qf-reset');
    const qfPriorityAsc = document.getElementById('qf-priority-asc');
    const qfPriorityDesc = document.getElementById('qf-priority-desc');
    const sortHidden = document.getElementById('sort-order-hidden');

    // Synchroniser l'état du filtre rapide "urgent" avec la valeur actuelle du sélecteur de priorité
    if (qfUrgent) {
        const prSel = document.getElementById('priority-filter');
        const isActive = !!(prSel && prSel.value === 'urgent');
        qfUrgent.classList.toggle('active', isActive);
        qfUrgent.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    if (qfAwaiting) {
        qfAwaiting.addEventListener('click', () => {
            const awaitingOnlyEl = document.getElementById('awaiting-agent-filter');
            const nextState = !qfAwaiting.classList.contains('active');
            qfAwaiting.classList.toggle('active', nextState);
            qfAwaiting.setAttribute('aria-pressed', nextState ? 'true' : 'false');
            if (awaitingOnlyEl) awaitingOnlyEl.checked = nextState;
            try { localStorage.setItem('awaitingAgentOnly', nextState ? '1' : '0'); } catch (_) {}
            loadTickets(1, collectFilters());
        });
    }

    if (qfUrgent) {
        qfUrgent.addEventListener('click', () => {
            const prioritySelect = document.getElementById('priority-filter');
            const isActive = qfUrgent.classList.contains('active');
            // Toggle
            if (isActive) {
                // Ne supprimer que si la valeur est actuellement 'urgent'
                if (prioritySelect && prioritySelect.value === 'urgent') {
                    prioritySelect.value = '';
                }
                qfUrgent.classList.remove('active');
                qfUrgent.setAttribute('aria-pressed', 'false');
            } else {
                if (prioritySelect) prioritySelect.value = 'urgent';
                qfUrgent.classList.add('active');
                qfUrgent.setAttribute('aria-pressed', 'true');
            }
            loadTickets(1, collectFilters());
        });
    }

    function applySort(mode) {
        if (!sortHidden) return loadTickets(1, collectFilters());
        if (mode && sortHidden.value === mode) {
            // Toggle off if already active
            sortHidden.value = '';
            if (qfOldest) qfOldest.classList.remove('active');
            if (qfNewest) qfNewest.classList.remove('active');
            if (qfPriorityAsc) qfPriorityAsc.classList.remove('active');
            if (qfPriorityDesc) qfPriorityDesc.classList.remove('active');
            if (qfOldest) qfOldest.setAttribute('aria-pressed', 'false');
            if (qfNewest) qfNewest.setAttribute('aria-pressed', 'false');
            if (qfPriorityAsc) qfPriorityAsc.setAttribute('aria-pressed', 'false');
            if (qfPriorityDesc) qfPriorityDesc.setAttribute('aria-pressed', 'false');
        } else {
            sortHidden.value = mode || '';
            if (qfOldest) qfOldest.classList.toggle('active', mode === 'oldest');
            if (qfNewest) qfNewest.classList.toggle('active', mode === 'newest');
            if (qfPriorityAsc) qfPriorityAsc.classList.toggle('active', mode === 'priority_asc');
            if (qfPriorityDesc) qfPriorityDesc.classList.toggle('active', mode === 'priority_desc');
            if (qfOldest) qfOldest.setAttribute('aria-pressed', mode === 'oldest' ? 'true' : 'false');
            if (qfNewest) qfNewest.setAttribute('aria-pressed', mode === 'newest' ? 'true' : 'false');
            if (qfPriorityAsc) qfPriorityAsc.setAttribute('aria-pressed', mode === 'priority_asc' ? 'true' : 'false');
            if (qfPriorityDesc) qfPriorityDesc.setAttribute('aria-pressed', mode === 'priority_desc' ? 'true' : 'false');
        }
        loadTickets(1, collectFilters());
    }

    if (qfOldest) qfOldest.addEventListener('click', () => applySort('oldest'));
    if (qfNewest) qfNewest.addEventListener('click', () => applySort('newest'));
    if (qfPriorityAsc) qfPriorityAsc.addEventListener('click', () => applySort('priority_asc'));
    if (qfPriorityDesc) qfPriorityDesc.addEventListener('click', () => applySort('priority_desc'));

    if (qfReset) {
        qfReset.addEventListener('click', () => {
            const clearBtn = document.getElementById('clear-filters');
            if (clearBtn) clearBtn.click(); else {
                // fallback clear
                if (sortHidden) sortHidden.value = '';
                if (qfOldest) qfOldest.classList.remove('active');
                if (qfNewest) qfNewest.classList.remove('active');
                if (qfAwaiting) qfAwaiting.classList.remove('active');
                if (qfUrgent) qfUrgent.classList.remove('active');
                if (qfPriorityAsc) qfPriorityAsc.classList.remove('active');
                if (qfPriorityDesc) qfPriorityDesc.classList.remove('active');
                if (qfOldest) qfOldest.setAttribute('aria-pressed', 'false');
                if (qfNewest) qfNewest.setAttribute('aria-pressed', 'false');
                if (qfAwaiting) qfAwaiting.setAttribute('aria-pressed', 'false');
                if (qfUrgent) qfUrgent.setAttribute('aria-pressed', 'false');
                if (qfPriorityAsc) qfPriorityAsc.setAttribute('aria-pressed', 'false');
                if (qfPriorityDesc) qfPriorityDesc.setAttribute('aria-pressed', 'false');
                loadTickets(1, {});
            }
        });
    }
    
    // Utiliser une approche par délégation d'événements pour le formulaire et les boutons
    // Cette méthode est plus robuste car elle fonctionne même si les éléments ne sont pas encore
    // dans le DOM au moment où le code est exécuté
    
    // Gestionnaire pour le changement de statut (afficher/masquer les infos complémentaires)
    document.addEventListener('change', function(e) {
        // Si l'élément qui a changé est le sélecteur de statut
        if (e.target && e.target.id === 'new-status') {
            console.log('Changement détecté sur le sélecteur de statut:', e.target.value);
            const additionalInfoGroup = document.getElementById('additional-info-group');
            if (additionalInfoGroup) {
                additionalInfoGroup.style.display = 
                    e.target.value === 'info_complementaire' ? 'block' : 'none';
            }
        } else if (e.target && e.target.id === 'response-template') {
            // Insertion d'un modèle dynamique
            const select = e.target;
            const key = select.value;
            const textarea = document.getElementById('status-comment');
            if (!textarea) return;
            if (!key) { textarea.value = ''; return; }
            const item = (cachedTemplatesActive || []).find(t => t.key === key);
            if (!item) { textarea.value = ''; return; }
            const content = substituteTemplateVariables(item.content, (window.currentTicketData || {}));
            textarea.value = content;
        } else if (e.target && e.target.id === 'comment-attachments') {
            // Prévisualisation des pièces jointes
            const input = e.target;
            const preview = document.getElementById('comment-attachments-preview');
            if (!preview) return;
            preview.innerHTML = '';
            const files = input.files || [];
            if (files.length === 0) {
                preview.style.display = 'none';
                return;
            }
            const frag = document.createDocumentFragment();
            Array.from(files).forEach(file => {
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;';
                const icon = document.createElement('div');
                icon.style.cssText = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:4px;overflow:hidden;';
                if (isImage) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:cover;';
                    icon.appendChild(img);
                } else {
                    icon.innerHTML = '<i class="fas fa-file"></i>'; 
                }
                const meta = document.createElement('div');
                meta.textContent = `${file.name} (${Math.round(file.size/1024)} Ko)`;
                item.appendChild(icon);
                item.appendChild(meta);
                frag.appendChild(item);
            });
            preview.appendChild(frag);
            preview.style.display = 'block';
        }
    });
    
    // Gestionnaire pour la soumission du formulaire de mise à jour du statut
    document.addEventListener('submit', async function(e) {
        // Si l'élément qui a été soumis est le formulaire de mise à jour du statut
        if (e.target && e.target.id === 'update-status-form') {
            e.preventDefault();
            console.log('Soumission du formulaire de mise à jour du statut détectée');
            
            const statusValue = document.getElementById('new-status')?.value;
            const comment = document.getElementById('status-comment')?.value || '';
            const additionalInfo = document.getElementById('additional-info')?.value || '';
            const notifyClient = document.getElementById('notify-client')?.checked || false;
            const filesInput = document.getElementById('comment-attachments');
            const files = (filesInput && filesInput.files) ? filesInput.files : [];
            const ticketNumber = (document.getElementById('detail-ticket-number')?.textContent || '').trim();
            let finalComment = comment;
            
            // Demande de confirmation
            const userConfirmed = await showConfirmModal({
                title: 'Confirmer',
                message: 'Confirmer la mise à jour du ticket ?',
                confirmText: 'Confirmer',
                cancelText: 'Annuler'
            });
            if (!userConfirmed) return;

            // Gestion de la priorité : si vide, on utilise la priorité actuelle
            let priority = document.getElementById('ticket-priority')?.value;
            console.log('Valeur sélectionnée dans le menu priorité:', priority);
            
            if (!priority) {
                console.log('Option "Conserver la priorité actuelle" sélectionnée, recherche de la priorité actuelle...');
                
                // Essayer différentes approches pour récupérer la priorité actuelle
                
                // Approche 1: Récupérer à partir de l'élément caché
                const currentPriorityElement = document.getElementById('detail-ticket-current-priority');
                console.log('Elément de priorité caché trouvé:', currentPriorityElement ? 'Oui' : 'Non');
                
                if (currentPriorityElement && currentPriorityElement.getAttribute('data-priority')) {
                    priority = currentPriorityElement.getAttribute('data-priority');
                    console.log('Priorité actuelle récupérée depuis data-priority:', priority);
                } else {
                    // Approche 2: Récupérer via l'élément d'affichage de la priorité
                    const displayPriorityElement = document.getElementById('detail-ticket-priority');
                    
                    if (displayPriorityElement && displayPriorityElement.className) {
                        // Extraire la priorité à partir de la classe CSS (priority-XXX)
                        const priorityClass = displayPriorityElement.className.split(' ')
                            .find(cls => cls.startsWith('priority-') && cls !== 'priority-badge');
                            
                        if (priorityClass) {
                            priority = priorityClass.replace('priority-', '');
                            console.log('Priorité récupérée depuis la classe CSS:', priority);
                        }
                    }
                    
                    if (!priority) {
                        // Approche 3: Méthode de secours - récupérer la priorité via API
                        console.log('Impossible de récupérer la priorité localement, tentative via API');
                        
                        try {
                            const resp = await fetch(`/api/admin/tickets/${currentTicketId}`, {
                                headers: {
                                    'Authorization': `Basic ${authToken}`
                                }
                            });
                            const data = await resp.json();
                            const apiPriority = (data.ticket && data.ticket.priority) ? data.ticket.priority : 'moyen';
                            console.log('Priorité récupérée (API ou défaut):', apiPriority);
                            await updateTicketStatus(
                                currentTicketId,
                                statusValue,
                                finalComment,
                                statusValue === 'info_complementaire' ? additionalInfo : '',
                                notifyClient,
                                apiPriority,
                                // On considère que l'agent a répondu seulement si notifyClient est coché
                                !!notifyClient
                            );
                            if (files && files.length && ticketNumber) {
                                try {
                                    await uploadCommentAttachments(ticketNumber, files, `[Admin] ${finalComment || 'Pièces jointes ajoutées'}`);
                                } catch(_) {}
                            }
                            showToast('success', 'Mise à jour effectuée');
                            return;
                        } catch (error) {
                            console.error('Erreur lors de la récupération de la priorité:', error);
                            await updateTicketStatus(
                                currentTicketId,
                                statusValue,
                                finalComment,
                                statusValue === 'info_complementaire' ? additionalInfo : '',
                                notifyClient,
                                'moyen',
                                // On considère que l'agent a répondu seulement si notifyClient est coché
                                !!notifyClient
                            );
                            if (files && files.length && ticketNumber) {
                                try {
                                    await uploadCommentAttachments(ticketNumber, files, `[Admin] ${finalComment || 'Pièces jointes ajoutées'}`);
                                } catch(_) {}
                            }
                            showToast('success', 'Mise à jour effectuée');
                            return;
                        }
                    }
                }
            }
            
            if (!statusValue) {
                showToast('error', 'Veuillez sélectionner un statut');
                return;
            }
            
            // Vérifions si nous avons trouvé une priorité valide
            if (!priority && !statusValue.startsWith('same_')) {
                // Si la priorité est toujours indéfinie après nos tentatives, utilisons la valeur par défaut
                priority = 'moyen';
                console.log('Utilisation de la priorité par défaut:', priority);
            }
            
            // Si "Conserver le même statut" est sélectionné, récupérer le statut actuel
            if (statusValue === 'same_status') {
                console.log('Option "Conserver le même statut" sélectionnée');
                
                // Récupérer le statut actuel à partir de l'élément dédié
                const currentStatusElement = document.getElementById('detail-ticket-status');
                
                if (currentStatusElement && currentStatusElement.getAttribute('data-status')) {
                    const currentStatus = currentStatusElement.getAttribute('data-status');
                    console.log('Statut actuel récupéré:', currentStatus);
                    
                    // Utiliser le statut actuel pour la mise à jour
                    await updateTicketStatus(
                        currentTicketId,
                        currentStatus,
                        finalComment,
                        currentStatus === 'info_complementaire' ? additionalInfo : '',
                        notifyClient,
                        priority,
                        // On considère que l'agent a répondu seulement si notifyClient est coché
                        !!notifyClient
                    );
                    if (files && files.length && ticketNumber) {
                        try {
                            await uploadCommentAttachments(ticketNumber, files, `[Admin] ${finalComment || 'Pièces jointes ajoutées'}`);
                        } catch(_) {}
                    }
                    showToast('success', 'Mise à jour effectuée');
                    return;
                } else {
                    console.log('Statut actuel non disponible dans l\'élément HTML, récupération via API');
                    try {
                        const resp = await fetch(`/api/admin/tickets/${currentTicketId}`, {
                            headers: {
                                'Authorization': `Basic ${authToken}`
                            }
                        });
                        const data = await resp.json();
                        if (data.ticket && data.ticket.currentStatus) {
                            const apiStatus = data.ticket.currentStatus;
                            console.log('Statut actuel récupéré depuis API:', apiStatus);
                            await updateTicketStatus(
                                currentTicketId,
                                apiStatus,
                                finalComment,
                                apiStatus === 'info_complementaire' ? additionalInfo : '',
                                notifyClient,
                                priority,
                                // On considère que l'agent a répondu seulement si notifyClient est coché
                                !!notifyClient
                            );
                            if (files && files.length && ticketNumber) {
                                try {
                                    await uploadCommentAttachments(ticketNumber, files, `[Admin] ${finalComment || 'Pièces jointes ajoutées'}`);
                                } catch(_) {}
                            }
                            showToast('success', 'Mise à jour effectuée');
                            return;
                        } else {
                            showToast('error', 'Impossible de récupérer le statut actuel. Veuillez choisir un statut spécifique.');
                            console.error('Données du ticket invalides ou statut manquant:', data);
                            return;
                        }
                    } catch (error) {
                        showToast('error', 'Erreur lors de la récupération du statut actuel. Veuillez réessayer.');
                        console.error('Erreur lors de la récupération du statut:', error);
                        return;
                    }
                }
            } else {
                // Utiliser le statut sélectionné pour la mise à jour
                await updateTicketStatus(
                    currentTicketId,
                    statusValue,
                    finalComment,
                    statusValue === 'info_complementaire' ? additionalInfo : '',
                    notifyClient,
                    priority,
                    // On considère que l'agent a répondu seulement si notifyClient est coché
                    !!notifyClient
                );
                if (files && files.length && ticketNumber) {
                    try {
                        await uploadCommentAttachments(ticketNumber, files, `[Admin] ${finalComment || 'Pièces jointes ajoutées'}`);
                    } catch(_) {}
                }
                showToast('success', 'Mise à jour effectuée');
            }
        }
    });
    
    // Gestionnaire pour l'enregistrement des notes internes
    document.addEventListener('click', function(e) {
        // Si l'élément cliqué est le bouton d'enregistrement des notes
        if (e.target && (e.target.id === 'save-notes' || e.target.closest('#save-notes'))) {
            console.log('Clic sur le bouton d\'enregistrement des notes détecté');
            const notes = document.getElementById('internal-notes')?.value || '';
            saveInternalNotes(currentTicketId, notes);
        } else if (e.target && (e.target.id === 'btn-assign-ticket' || e.target.closest('#btn-assign-ticket'))) {
            // Ouvrir la modale d'assignation
            e.preventDefault();
            openAssignModal();
        } else if (e.target && (e.target.id === 'btn-request-assistance' || e.target.closest('#btn-request-assistance'))) {
            // Ouvrir la modale d'assistance
            e.preventDefault();
            openAssistanceModal();
        } else if (e.target && (e.target.id === 'btn-escalate-ticket' || e.target.closest('#btn-escalate-ticket'))) {
            // Ouvrir la modale d'escalade
            e.preventDefault();
            openEscalateModal();
        }
    });
    
    // La gestion des événements est maintenant configurée via la délégation d'événements
    // ce qui permet d'attacher les handlers même aux éléments qui ne sont pas encore créés
    
    // --- Listeners Paramètres / Gestion des utilisateurs ---
    if (navTicketsLink) {
        navTicketsLink.addEventListener('click', () => { window.location.hash = '#tickets'; });
    }
    if (navSettingsLink) {
        navSettingsLink.addEventListener('click', () => { window.location.hash = '#settings'; });
    }
    if (navDocsLink) {
        navDocsLink.addEventListener('click', () => { window.location.hash = '#docs'; });
    }
    window.addEventListener('hashchange', handleHashRoute);
    // Appliquer la route actuelle immédiatement (permet d'afficher #docs au chargement)
    try { if (typeof handleHashRoute === 'function') handleHashRoute(); } catch(_) {}
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserForm());
    if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', () => loadUsers());
    if (cancelUserBtn) cancelUserBtn.addEventListener('click', () => { if (userFormCard) userFormCard.style.display = 'none'; resetUserForm(); });
    if (userForm) userForm.addEventListener('submit', saveUser);
    
    // Délégation pour Edit/Supprimer
    document.addEventListener('click', function(e) {
        const editBtn = e.target?.closest && e.target.closest('.edit-user-btn');
        const delBtn = e.target?.closest && e.target.closest('.delete-user-btn');
        if (editBtn) {
            const tr = editBtn.closest('tr');
            const user = {
                id: tr?.dataset?.id,
                firstName: tr?.dataset?.firstname,
                lastName: tr?.dataset?.lastname,
                email: tr?.dataset?.email,
                role: tr?.dataset?.role,
                isActive: tr?.dataset?.isactive === '1'
            };
            openUserForm(user);
        } else if (delBtn) {
            const id = delBtn.getAttribute('data-id');
            deleteUser(id);
        }
    });
    
    // Initialisation
    checkAuth();
}

// Démarrage fiable : si le DOM est déjà prêt, on initialise tout de suite
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}

// ===== Modal & Toast Helpers =====
function ensureToastContainer() {
    let c = document.getElementById('cpf-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'cpf-toast-container';
        c.className = 'cpf-toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function normalizeTypeAndMessage(a, b) {
    const types = ['success','error','info','warning'];
    if (types.includes(String(a))) {
        return { type: String(a), message: b || '' };
    }
    const t = types.includes(String(b)) ? String(b) : 'info';
    return { type: t, message: a || '' };
}

function iconForType(type) {
    switch (type) {
        case 'success': return '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>';
        case 'error': return '<i class="fas fa-times-circle" style="color: var(--danger-color);"></i>';
        case 'warning': return '<i class="fas fa-exclamation-triangle" style="color: #f39c12;"></i>';
        default: return '<i class="fas fa-info-circle" style="color: var(--secondary-color);"></i>';
    }
}

function titleForType(type) {
    switch (type) {
        case 'success': return 'Succès';
        case 'error': return 'Erreur';
        case 'warning': return 'Attention';
        default: return 'Info';
    }
}

function showToast(a, b) {
    const { type, message } = normalizeTypeAndMessage(a, b);
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `cpf-toast ${type}`;
    toast.innerHTML = `
        <span class="icon">${iconForType(type)}</span>
        <div>
          <div class="title">${titleForType(type)}</div>
          <div class="msg">${message}</div>
        </div>
        <button class="close" aria-label="Fermer"><i class="fas fa-times"></i></button>
    `;
    const close = () => { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); };
    toast.querySelector('.close').addEventListener('click', close);
    container.appendChild(toast);
    setTimeout(close, 4000);
    return toast;
}

// Backward compat alias used elsewhere in the codebase
function showNotification(a, b) { return showToast(a, b); }
window.showNotification = showNotification;
window.showToast = showToast;

function ensureModalRoot() {
    let root = document.getElementById('cpf-modal-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'cpf-modal-root';
        document.body.appendChild(root);
    }
    return root;
}

function showConfirmModal(opts = {}) {
    return new Promise(resolve => {
        const root = ensureModalRoot();
        root.style.display = 'flex';
        root.innerHTML = '';
        const modal = document.createElement('div');
        modal.className = 'cpf-modal';
        const title = opts.title || 'Confirmer';
        const message = opts.message || '';
        const confirmText = opts.confirmText || 'Confirmer';
        const cancelText = opts.cancelText || 'Annuler';
        modal.innerHTML = `
          <div class="cpf-modal-header">
            <div class="icon"><i class="fas fa-question"></i></div>
            <div class="cpf-modal-title">${title}</div>
          </div>
          <div class="cpf-modal-body">${message}</div>
          <div class="cpf-modal-actions">
            <button class="cpf-btn" data-action="cancel">${cancelText}</button>
            <button class="cpf-btn cpf-btn-primary" data-action="confirm">${confirmText}</button>
          </div>
        `;
        const onCleanup = () => {
            root.style.display = 'none';
            root.innerHTML = '';
            document.removeEventListener('keydown', onKey);
            root.removeEventListener('click', onOverlayClick);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { onCleanup(); resolve(false); }
        };
        const onOverlayClick = (e) => {
            if (e.target === root) { onCleanup(); resolve(false); }
        };
        root.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKey);
        root.appendChild(modal);
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        cancelBtn.addEventListener('click', () => { onCleanup(); resolve(false); });
        confirmBtn.addEventListener('click', () => { onCleanup(); resolve(true); });
        // Focus the confirm button for quick keyboard confirm
        setTimeout(() => { try { confirmBtn.focus(); } catch(_){} }, 0);
    });
}
window.showConfirmModal = showConfirmModal;
