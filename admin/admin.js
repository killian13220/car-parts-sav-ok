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
        
        const ticket = await response.json();
        
        // Masquer la liste des tickets et afficher les détails
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('ticket-details').style.display = 'block';
        
        // Remplir les détails du ticket
        window.displayTicketDetails(ticket);
        
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
    
    console.log('Mise à jour du statut visible:', ticket.currentStatus);
    
    if (statusElement) {
        // Vérifions que currentStatus existe et n'est pas vide
        if (ticket.currentStatus) {
            const translatedStatus = statusTranslations[ticket.currentStatus] || ticket.currentStatus;
            statusElement.textContent = translatedStatus;
            statusElement.setAttribute('data-status', ticket.currentStatus);
            console.log('Statut actuel stocké dans l\'élément:', ticket.currentStatus);
            console.log('Statut traduit:', translatedStatus);
            
            // Mise à jour de l'indicateur visible
            if (visibleStatusElement) {
                visibleStatusElement.textContent = translatedStatus;
                visibleStatusElement.className = `status-${ticket.currentStatus}`;
                console.log('Indicateur de statut visible mis à jour avec:', translatedStatus);
            } else {
                console.error('L\'élément visible-current-status n\'existe pas dans le DOM');
            }
        } else {
            console.error('Le ticket n\'a pas de currentStatus valide:', ticket);
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
        .client-replied-badge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:12px;line-height:1;background:#e6f2ff;color:#0b64d1;border:1px solid #bcdcff}`;
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
            }
        }
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
        if (ticketDetails) ticketDetails.style.display = 'none';
        const dashboard = document.querySelector('.admin-dashboard');
        if (dashboard) dashboard.style.display = 'block';
        if (detailsKeydownHandler) {
            document.removeEventListener('keydown', detailsKeydownHandler);
            detailsKeydownHandler = null;
        }
        if (typeof lastListScrollY === 'number') {
            try { window.scrollTo({ top: lastListScrollY, left: 0, behavior: 'auto' }); } catch(_) { window.scrollTo(0, lastListScrollY || 0); }
        }
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

document.addEventListener('DOMContentLoaded', function() {
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
            if (!userManagementSection) return;
            if (currentUserRole === 'agent') {
                userManagementSection.style.display = 'none';
            } else {
                userManagementSection.style.display = '';
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
            if (window.location.hash === '#settings') {
                showSettings();
                if (currentUserRole === 'admin') { loadUsers(); }
                if (typeof loadTemplates === 'function') loadTemplates();
            } else {
                showDashboard();
                loadDashboard();
            }
        } else {
            adminLogin.style.display = 'flex';
            if (adminDashboard) adminDashboard.style.display = 'none';
            if (adminSettings) adminSettings.style.display = 'none';
            ticketDetails.style.display = 'none';
            currentUserRole = null;
            if (userManagementSection) userManagementSection.style.display = '';
        }
    }
    
    // Fonction de connexion
    async function login(username, password) {
        try {
            // Créer le token Basic Auth
            const token = btoa(`${username}:${password}`);
            
            // Tester la connexion en récupérant la liste des tickets
            const response = await fetch('/api/admin/tickets', {
                headers: {
                    'Authorization': `Basic ${token}`
                }
            });
            
            if (response.ok) {
                // Stocker le token et afficher le tableau de bord
                localStorage.setItem('authToken', token);
                authToken = token;
                await fetchCurrentUserRole();
                await checkAuth();
            } else {
                throw new Error('Identifiants incorrects');
            }
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        }
    }
    
    // Fonction de déconnexion
    function logout() {
        localStorage.removeItem('authToken');
        authToken = null;
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
                        const nowIso = new Date().toISOString();
                        for (const item of list) {
                            if (item && item.ticketId) {
                                window.__clientUpdatesMap.set(item.ticketId, item.updatedAt || nowIso);
                            }
                        }
                        try { if (typeof window.refreshClientUpdatesBadge === 'function') window.refreshClientUpdatesBadge(); } catch (_) {}
                        try { if (typeof window.updateQuickFilterCounts === 'function') window.updateQuickFilterCounts(); } catch (_) {}
                        try { saveClientUpdatesCache(); } catch (_) {}
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
    
    function handleHashRoute() {
        if (!authToken) return;
        applyRoleBasedUI();
        if (window.location.hash === '#settings') {
            showSettings();
            if (currentUserRole === 'admin') { loadUsers(); }
            if (typeof loadTemplates === 'function') loadTemplates();
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
            
            // Stocker la priorité actuelle dans l'élément caché
            const currentPriorityElement = document.getElementById('detail-ticket-current-priority');
            if (currentPriorityElement) {
                currentPriorityElement.textContent = ticketPriority;
                currentPriorityElement.setAttribute('data-priority', ticketPriority);
                console.log('Priorité stockée dans l\'\u00e9lément caché:', ticketPriority);
            } else {
                console.error('Element detail-ticket-current-priority introuvable');
            }
        
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
                } else if (ticket.internalNotes) {
                    notesElement.value = ticket.internalNotes;
                } else {
                    notesElement.value = '';
                }
                
                // Mise à jour explicite de l'indicateur de statut actuel
                updateCurrentStatusIndicator(ticket.currentStatus);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des notes internes:', error);
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
                        docIcon.innerHTML = `<i class="fas ${documentTypeIcons[doc.type] || 'fa-file'}"></i>`;
                        
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
                            docPreview.innerHTML = `<i class="fas ${documentTypeIcons[doc.type] || 'fa-file'} document-icon-large"></i>`;
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
            
            // Si l'agent a réellement répondu (ex. notifyClient coché),
            // alors on accuse réception et on enlève le marquage "Réponse client".
            if (agentResponded && typeof window.acknowledgeClientUpdate === 'function') {
                window.acknowledgeClientUpdate(ticketId);
            }
            
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
            const response = await fetch(`/api/admin/tickets/${ticketId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authToken}`
                },
                body: JSON.stringify({
                    notes
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                throw new Error('Erreur lors de l\'enregistrement des notes');
            }
            
            alert('Notes enregistrées avec succès');
            
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des notes:', error);
            if (error.message === 'Unauthorized') {
                logout();
            }
            alert('Une erreur est survenue lors de l\'enregistrement des notes');
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
    });
    
    document.getElementById('breadcrumb-tickets').addEventListener('click', (e) => {
        e.preventDefault();
        goBackToList();
    });
    
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
    window.addEventListener('hashchange', handleHashRoute);
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
});

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
