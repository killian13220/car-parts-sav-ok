document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-ticket');
    const ticketNumberInput = document.getElementById('ticket-number');
    const trackingResult = document.getElementById('tracking-result');
    const errorMessage = document.getElementById('error-message');
    const loadingIndicator = document.querySelector('.loading');
    const copyTicketButton = document.getElementById('copy-ticket-number');
    const additionalInfoForm = document.getElementById('additional-info-form');
    const additionalFilesInput = document.getElementById('additional-files');
    const selectedFilesContainer = document.getElementById('selected-files');
    const infoRequestMessage = document.getElementById('info-request-message');
    
    // Masquer le message de demande d'information par défaut
    if (infoRequestMessage) {
        infoRequestMessage.style.display = 'none';
    }
    
    // Éléments d'affichage des informations du ticket
    const displayTicketNumber = document.getElementById('display-ticket-number');
    const creationDate = document.getElementById('creation-date');
    const clientName = document.getElementById('client-name');
    const partType = document.getElementById('part-type');
    const claimType = document.getElementById('claim-type');
    const currentStatus = document.getElementById('current-status');
    const statusTimeline = document.getElementById('status-timeline');
    
    // Traduction des types de pièces
    const partTypeTranslations = {
        'boite_vitesses': 'Boîte de vitesses',
        'moteur': 'Moteur',
        'mecatronique': 'Mécatronique',
        'boite_transfert': 'Boîte de transfert',
        'pont': 'Pont',
        'autres': 'Autres pièces'
    };
    
    // Traduction des types de réclamation
    const claimTypeTranslations = {
        'piece_defectueuse': 'Pièce défectueuse',
        'probleme_livraison': 'Problème de livraison ou suivi',
        'erreur_reference': 'Erreur de référence ou modèle',
        'autre': 'Autre type de réclamation'
    };
    
    // Traduction des statuts
    const statusTranslations = {
        'nouveau': 'Nouveau',
        'en_analyse': 'En cours d\'analyse',
        'info_complementaire': 'Informations complémentaires requises',
        'validé': 'Demande validée',
        'refusé': 'Demande refusée',
        'en_cours_traitement': 'En cours de traitement',
        'expédié': 'Pièce expédiée',
        'clôturé': 'Dossier clôturé'
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
    
    // Messages explicatifs/rassurants par statut
    const statusReassuranceMessages = {
        'nouveau': "Un agent SAV va prendre en charge votre ticket très prochainement. Vous recevrez une notification par email à chaque étape. Aucune action n'est requise de votre part pour le moment.",
        'en_analyse': "Votre dossier est en cours d'analyse par notre équipe. Si des informations sont nécessaires, nous vous le demanderons. Sinon, vous recevrez une mise à jour dès que possible.",
        'info_complementaire': "Nous avons besoin d'informations complémentaires pour poursuivre le traitement. Merci d'utiliser la section de réponse tout en bas de cette page pour répondre et joindre, si besoin, des documents.",
        'validé': "Bonne nouvelle, votre demande a été validée. Nous passons à l'étape suivante et vous tiendrons informé(e) des avancées.",
        'refusé': "Votre demande n'a pas pu être validée. Le motif est indiqué ci-dessus. Pour toute question, vous pouvez nous écrire via la section de communication.",
        'en_cours_traitement': "Votre dossier est en cours de traitement par nos équipes. Vous serez notifié(e) dès la prochaine étape.",
        'expédié': "Votre pièce a été expédiée. Si un suivi de livraison est disponible, il vous sera communiqué.",
        'clôturé': "Le dossier est clôturé. Aucune action supplémentaire n'est nécessaire. Merci pour votre confiance."
    };
    
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

    // Classe de badge selon le statut
    function getStatusBadgeClass(status) {
        switch (status) {
            case 'validé':
            case 'clôturé':
                return 'status-badge--success';
            case 'refusé':
                return 'status-badge--danger';
            case 'info_complementaire':
                return 'status-badge--warning';
            case 'expédié':
            case 'en_cours_traitement':
                return 'status-badge--primary';
            case 'en_analyse':
            case 'nouveau':
            default:
                return 'status-badge--secondary';
        }
    }
    
    // Fonction pour rechercher un ticket
    async function searchTicket(ticketNumber) {
        // Afficher le chargement
        loadingIndicator.style.display = 'block';
        errorMessage.style.display = 'none';
        trackingResult.style.display = 'none';
        
        try {
            // Appel à l'API
            const response = await fetch(`/api/tickets/${ticketNumber}`);
            const data = await response.json();
            
            // Cacher le chargement
            loadingIndicator.style.display = 'none';
            
            if (!data.success) {
                // Afficher l'erreur
                errorMessage.textContent = data.message || 'Ticket non trouvé. Vérifiez le numéro et réessayez.';
                errorMessage.style.display = 'block';
                return;
            }
            
            // Afficher les informations du ticket
            displayTicketData(data.ticket, data.statusHistory);
            
        } catch (error) {
            console.error('Erreur lors de la recherche du ticket:', error);
            loadingIndicator.style.display = 'none';
            errorMessage.textContent = 'Une erreur est survenue lors de la recherche du ticket. Veuillez réessayer plus tard.';
            errorMessage.style.display = 'block';
        }
    }
    
    // Fonction pour afficher les données du ticket
    function displayTicketData(ticket, statusHistory) {
        // Afficher les informations de base
        displayTicketNumber.textContent = ticket.ticketNumber;
        creationDate.textContent = formatDate(ticket.createdAt);
        clientName.textContent = `${ticket.clientInfo.firstName} ${ticket.clientInfo.lastName}`;
        partType.textContent = partTypeTranslations[ticket.partInfo.partType] || ticket.partInfo.partType;
        
        // Afficher le type de réclamation
        if (ticket.claimType) {
            claimType.textContent = claimTypeTranslations[ticket.claimType] || ticket.claimType;
        } else {
            claimType.textContent = 'Non spécifié';
        }
        currentStatus.textContent = statusTranslations[ticket.currentStatus] || ticket.currentStatus;
        
        // Colorer le statut actuel et mettre à jour l'icône
        const statusIcon = document.querySelector('.status-icon i');
        const statusDate = document.getElementById('status-date');
        
        // Trouver la dernière mise à jour de statut
        let lastStatusUpdate = statusHistory[statusHistory.length - 1];
        if (lastStatusUpdate) {
            statusDate.textContent = formatDate(lastStatusUpdate.updatedAt);
        }
        
        if (ticket.currentStatus === 'validé' || ticket.currentStatus === 'expédié' || ticket.currentStatus === 'clôturé') {
            currentStatus.style.color = 'var(--success-color)';
            if (statusIcon) statusIcon.className = 'fas fa-check-circle';
        } else if (ticket.currentStatus === 'refusé') {
            currentStatus.style.color = 'var(--primary-color)';
            if (statusIcon) statusIcon.className = 'fas fa-times-circle';
        } else if (ticket.currentStatus === 'info_complementaire') {
            currentStatus.style.color = 'var(--warning-color)';
            if (statusIcon) statusIcon.className = 'fas fa-exclamation-circle';
        } else {
            currentStatus.style.color = 'var(--secondary-color)';
            if (statusIcon) statusIcon.className = 'fas fa-circle-notch fa-spin';
        }
        
        // Masquer le badge de priorité pour les clients
        const priorityBadge = document.getElementById('priority-badge');
        if (priorityBadge) {
            priorityBadge.style.display = 'none';
        }
        
        // Vider la timeline
        statusTimeline.innerHTML = '';
        
        // Créer la barre de progression
        createProgressBar(ticket, statusHistory);
        
        // Afficher les documents associés au ticket
        displayDocuments(ticket);
        
        // Configurer la section de communication
        setupCommunicationSection(ticket, statusHistory);
        
        // Masquer complètement la section de communication si le dossier est clôturé
        const communicationSection = document.getElementById('communication-section');
        if (communicationSection) {
            if (ticket.currentStatus === 'clôturé') {
                communicationSection.style.display = 'none';
            } else {
                communicationSection.style.display = '';
            }
        }
        // Masquer également toute bannière de demande d'information dans ce cas
        if (ticket.currentStatus === 'clôturé') {
            const infoRequestBanner = document.getElementById('info-request-message');
            if (infoRequestBanner) infoRequestBanner.style.display = 'none';
        }
        
        // Ajouter les statuts à la timeline
        if (statusHistory && statusHistory.length > 0) {
            statusHistory.forEach((status, index) => {
                const statusItem = document.createElement('div');
                statusItem.className = 'status-item';
                if (index === 0) statusItem.classList.add('active');
                // Ajouter une classe spécifique par statut (ex: status-info_complementaire)
                if (status && status.status) {
                    statusItem.classList.add(`status-${status.status}`);
                }
                
                const statusDot = document.createElement('div');
                statusDot.className = 'status-dot';
                const icon = document.createElement('i');
                icon.className = `fas ${statusIcons[status.status] || 'fa-circle-info'}`;
                statusDot.appendChild(icon);
                
                const statusContent = document.createElement('div');
                statusContent.className = 'status-content';
                // En-tête lisible: badge + date
                const header = document.createElement('div');
                header.className = 'status-header';
                const badge = document.createElement('span');
                badge.className = `status-badge ${getStatusBadgeClass(status.status)}`;
                const badgeIcon = document.createElement('i');
                badgeIcon.className = `fas ${statusIcons[status.status] || 'fa-circle-info'}`;
                const badgeText = document.createElement('span');
                badgeText.className = 'status-title';
                badgeText.textContent = ` ${statusTranslations[status.status] || status.status}`;
                badge.appendChild(badgeIcon);
                badge.appendChild(badgeText);
                const dateEl = document.createElement('div');
                dateEl.className = 'status-date';
                const clockIcon = document.createElement('i');
                clockIcon.className = 'far fa-clock';
                const dateText = document.createElement('span');
                dateText.textContent = ` ${formatDate(status.updatedAt)}`;
                dateEl.appendChild(clockIcon);
                dateEl.appendChild(dateText);
                header.appendChild(badge);
                header.appendChild(dateEl);
                
                const statusDescription = document.createElement('div');
                statusDescription.className = 'status-description';
                statusDescription.textContent = status.comment || 'Mise à jour du statut';
                
                let additionalInfoEl = null;
                if (status.additionalInfoRequested) {
                    additionalInfoEl = document.createElement('div');
                    additionalInfoEl.className = 'additional-info';
                    additionalInfoEl.innerHTML = `<strong>Informations demandées:</strong> ${status.additionalInfoRequested}`;
                    
                    // Vérifier si cette demande d'information a déjà été fermée par l'utilisateur
                    let infoRequestAnswered = false;
                    
                    // Parcourir l'historique pour vérifier si une réponse a été fournie après cette demande
                    const currentIndex = statusHistory.indexOf(status);
                    if (currentIndex >= 0 && currentIndex < statusHistory.length - 1) {
                        // Vérifier les statuts suivants pour voir si une réponse a été fournie
                        for (let i = currentIndex + 1; i < statusHistory.length; i++) {
                            if (statusHistory[i].clientResponse && statusHistory[i].status !== 'info_complementaire') {
                                infoRequestAnswered = true;
                                break;
                            }
                        }
                    }
                    
                    // Créer un identifiant unique pour cette demande d'information
                    const infoRequestId = `info-request-${ticket.ticketNumber}-${status.date}`;
                    
                    // Vérifier si cette demande a déjà été fermée par l'utilisateur
                    const closedRequests = JSON.parse(localStorage.getItem('closedInfoRequests') || '{}');
                    const isRequestClosed = closedRequests[infoRequestId];
                    
                    const infoRequestMessage = document.getElementById('info-request-message');
                    
                    // N'afficher le message que s'il n'a pas été fermé précédemment
                    if (!isRequestClosed) {
                        infoRequestMessage.innerHTML = `
                            <div class="info-request-content">
                                <strong>Le service SAV vous demande:</strong> ${status.additionalInfoRequested}
                            </div>
                            <button type="button" class="close-info-request" aria-label="Fermer" data-request-id="${infoRequestId}">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        `;
                        infoRequestMessage.style.display = 'block';
                        
                        // Ajouter un événement de clic pour fermer le message et le mémoriser
                        const closeButton = infoRequestMessage.querySelector('.close-info-request');
                        if (closeButton) {
                            closeButton.addEventListener('click', function() {
                                // Masquer le message
                                infoRequestMessage.style.display = 'none';
                                
                                // Mémoriser que ce message a été fermé
                                const requestId = this.getAttribute('data-request-id');
                                const closedRequests = JSON.parse(localStorage.getItem('closedInfoRequests') || '{}');
                                closedRequests[requestId] = true;
                                localStorage.setItem('closedInfoRequests', JSON.stringify(closedRequests));
                            });
                        }
                    } else {
                        // Si le message a déjà été fermé, le masquer
                        infoRequestMessage.style.display = 'none';
                    }
                }
                
                statusContent.appendChild(header);
                statusContent.appendChild(statusDescription);
                // Message explicatif/rassurant en fonction du statut
                const reassuranceMsg = statusReassuranceMessages[status.status];
                if (reassuranceMsg) {
                    const reassurance = document.createElement('div');
                    reassurance.className = 'status-reassurance';
                    reassurance.textContent = reassuranceMsg;
                    statusContent.appendChild(reassurance);
                }
                if (additionalInfoEl) {
                    statusContent.appendChild(additionalInfoEl);
                }
                
                statusItem.appendChild(statusDot);
                statusItem.appendChild(statusContent);
                statusTimeline.appendChild(statusItem);
            });
        } else {
            // Pas d'historique de statut
            const noHistory = document.createElement('p');
            noHistory.textContent = 'Aucun historique de statut disponible.';
            statusTimeline.appendChild(noHistory);
        }
        
        // Afficher le résultat
        trackingResult.style.display = 'block';
    }
    
    // Événement de clic sur le bouton de recherche
    searchButton.addEventListener('click', () => {
        const ticketNumber = ticketNumberInput.value.trim();
        
        if (!ticketNumber) {
            errorMessage.textContent = 'Veuillez entrer un numéro de ticket.';
            errorMessage.style.display = 'block';
            return;
        }
        
        searchTicket(ticketNumber);
    });
    
    // Événement de pression de la touche Entrée dans le champ de recherche
    ticketNumberInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });
    
    // Fonction pour créer la barre de progression
    function createProgressBar(ticket, statusHistory) {
        const progressSteps = document.getElementById('progress-steps');
        const progressBar = document.getElementById('progress-bar');
        
        if (!progressSteps || !progressBar) return; // S'assurer que les éléments existent
        
        progressSteps.innerHTML = '';
        
        // Définir les différents parcours possibles
        const workflows = {
            // Parcours standard avec remplacement de pièce
            remplacement: [
                { status: 'nouveau', label: 'Demande reçue', icon: 'fa-file-circle-check' },
                { status: 'en_analyse', label: 'Analyse SAV', icon: 'fa-magnifying-glass' },
                { status: 'validé', label: 'Remplacement validé', icon: 'fa-check-circle' },
                { status: 'en_cours_traitement', label: 'En cours de traitement', icon: 'fa-box-open' },
                { status: 'expédié', label: 'Pièce expédiée', icon: 'fa-truck-fast' },
                { status: 'clôturé', label: 'Dossier clôturé', icon: 'fa-flag-checkered' }
            ],
            
            // Parcours avec remboursement
            remboursement: [
                { status: 'nouveau', label: 'Demande reçue', icon: 'fa-file-circle-check' },
                { status: 'en_analyse', label: 'Analyse SAV', icon: 'fa-magnifying-glass' },
                { status: 'validé', label: 'Remboursement validé', icon: 'fa-check-circle' },
                { status: 'en_cours_traitement', label: 'Traitement comptable', icon: 'fa-euro-sign' },
                { status: 'clôturé', label: 'Remboursement effectué', icon: 'fa-flag-checkered' }
            ],
            
            // Parcours avec réparation
            réparation: [
                { status: 'nouveau', label: 'Demande reçue', icon: 'fa-file-circle-check' },
                { status: 'en_analyse', label: 'Analyse SAV', icon: 'fa-magnifying-glass' },
                { status: 'validé', label: 'Réparation validée', icon: 'fa-check-circle' },
                { status: 'en_cours_traitement', label: 'Réparation en cours', icon: 'fa-screwdriver-wrench' },
                { status: 'expédié', label: 'Pièce réparée expédiée', icon: 'fa-truck-fast' },
                { status: 'clôturé', label: 'Dossier clôturé', icon: 'fa-flag-checkered' }
            ],
            
            // Parcours refusé
            refusé: [
                { status: 'nouveau', label: 'Demande reçue', icon: 'fa-file-circle-check' },
                { status: 'en_analyse', label: 'Analyse SAV', icon: 'fa-magnifying-glass' },
                { status: 'refusé', label: 'Demande refusée', icon: 'fa-circle-xmark' },
                { status: 'clôturé', label: 'Dossier clôturé', icon: 'fa-flag-checkered' }
            ],
            
            // Parcours problème non lié au produit
            non_lié: [
                { status: 'nouveau', label: 'Demande reçue', icon: 'fa-file-circle-check' },
                { status: 'en_analyse', label: 'Analyse SAV', icon: 'fa-magnifying-glass' },
                { status: 'validé', label: 'Analyse complétée', icon: 'fa-check-circle' },
                { status: 'en_cours_traitement', label: 'Conseils techniques', icon: 'fa-info-circle' },
                { status: 'clôturé', label: 'Dossier clôturé', icon: 'fa-flag-checkered' }
            ]
        };
        
        // Déterminer le type de résolution en fonction des notes ou du statut
        let resolutionType = 'remplacement'; // Par défaut
        
        // Déterminer le type de résolution en fonction des notes et de l'historique
        if (ticket.currentStatus === 'refusé') {
            resolutionType = 'refusé';
        }
        else if (ticket.notes) {
            const notes = ticket.notes.toLowerCase();
            if (notes.includes('problème non lié') || notes.includes('pas de défaut')) {
                resolutionType = 'non_lié';
            } else if (notes.includes('remboursement')) {
                resolutionType = 'remboursement';
            } else if (notes.includes('réparation')) {
                resolutionType = 'réparation';
            }
        }
        
        // Vérifier également dans l'historique
        if (statusHistory && Array.isArray(statusHistory)) {
            for (const entry of statusHistory) {
                if (!entry.notes) continue;
                
                const notes = entry.notes.toLowerCase();
                if (notes.includes('remboursement')) {
                    resolutionType = 'remboursement';
                    break;
                } else if (notes.includes('réparation')) {
                    resolutionType = 'réparation';
                    break;
                } else if (notes.includes('problème non lié') || notes.includes('pas de défaut')) {
                    resolutionType = 'non_lié';
                    break;
                }
            }
        }
        
        // Sélectionner le workflow approprié
        let steps = workflows[resolutionType] || workflows.remplacement;
        
        // Trouver l'étape actuelle
        let currentStepIndex = steps.findIndex(step => step.status === ticket.currentStatus);
        if (currentStepIndex === -1) currentStepIndex = 0;
        
        // Calculer la largeur de la barre de progression
        let progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;
        const isTerminal = ticket.currentStatus === 'refusé' || ticket.currentStatus === 'clôturé';
        if (isTerminal) progressPercentage = 100;
        progressBar.style.width = `${progressPercentage}%`;

        // Mettre à jour le titre sans pourcentage (plus clair pour le client)
        const progressTitle = document.querySelector('.progress-container h3');
        if (progressTitle) {
            let title = 'Statut du dossier';
            if (ticket.currentStatus === 'refusé') title = 'Statut du dossier — refusé';
            else if (ticket.currentStatus === 'clôturé') title = 'Statut du dossier — clôturé';
            progressTitle.removeAttribute('data-percent');
            progressTitle.textContent = title;
        }
        
        // Supprimer tout message d'explication existant
        const existingExplanation = document.querySelector('.progress-explanation');
        if (existingExplanation) {
            existingExplanation.remove();
        }
        
        // Mettre à jour la ligne active du fil d'Ariane
        const progressStepsElement = document.querySelector('.progress-steps');
        if (progressStepsElement) {
            // Calculer la largeur de la ligne active en fonction de l'étape actuelle
            const activeLineWidth = currentStepIndex === 0 ? 0 : 
                                   (currentStepIndex / (steps.length - 1)) * (progressStepsElement.offsetWidth - 120);
            progressStepsElement.style.setProperty('--active-line-width', `${activeLineWidth}px`);
        }
        
        // Créer les étapes
        steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'progress-step';
            
            const stepDot = document.createElement('div');
            stepDot.className = 'step-dot';
            if (index <= currentStepIndex) stepDot.classList.add('active');
            
            const stepIcon = document.createElement('i');
            stepIcon.className = `fas ${step.icon}`;
            stepDot.appendChild(stepIcon);
            
            const stepLabel = document.createElement('div');
            stepLabel.className = 'step-label';
            if (index <= currentStepIndex) stepLabel.classList.add('active');
            
            // Afficher des étapes neutres pour les étapes futures non confirmées
            // sauf pour les étapes initiales qui sont toujours les mêmes
            if (index > currentStepIndex && index > 1) {
                // Si nous sommes dans une étape future et après l'analyse
                // Utiliser des libellés neutres pour ne pas créer de fausses attentes
                if (resolutionType === 'remplacement' && !isResolutionConfirmed(statusHistory)) {
                    if (index === 2) stepLabel.textContent = 'Décision SAV';
                    else if (index === 3) stepLabel.textContent = 'Traitement';
                    else if (index === 4) stepLabel.textContent = 'Expédition éventuelle';
                    else stepLabel.textContent = 'Clôture';
                } else {
                    // Si la résolution est confirmée ou pour les étapes passées, afficher le libellé spécifique
                    stepLabel.textContent = step.label;
                }
            } else {
                // Pour les étapes passées ou l'étape actuelle, afficher le libellé spécifique
                stepLabel.textContent = step.label;
            }
            
            // Ajouter un tooltip pour afficher plus d'informations sur l'étape
            const statusDate = getStatusDate(statusHistory, step.status);
            if (statusDate) {
                const formattedDate = new Date(statusDate).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                stepElement.setAttribute('title', `${step.label}: ${formattedDate}`);
                stepElement.classList.add('has-tooltip');
            }
            
            stepElement.appendChild(stepDot);
            stepElement.appendChild(stepLabel);
            
            progressSteps.appendChild(stepElement);
        });
        
        // Vérifie si une résolution spécifique a été confirmée dans l'historique
        function isResolutionConfirmed(history) {
            if (!history || !Array.isArray(history)) return false;
            
            // Chercher des notes confirmant une décision spécifique
            return history.some(entry => {
                if (!entry.notes) return false;
                const notes = entry.notes.toLowerCase();
                return notes.includes('remplacement confirmé') || 
                       notes.includes('remboursement confirmé') || 
                       notes.includes('réparation confirmée');
            });
        }
        
        // Fonction pour obtenir la date d'un statut à partir de l'historique
        function getStatusDate(history, status) {
            if (!history || !Array.isArray(history)) return null;
            const statusEntry = history.find(entry => entry.status === status);
            return statusEntry ? statusEntry.date : null;
        }
    }
    
    // Fonction pour afficher les documents associés au ticket
    function displayDocuments(ticket) {
        // Vérification de sécurité
        if (!ticket) {
            console.warn('Ticket non défini dans displayDocuments');
            return;
        }
        
        const documentsGrid = document.getElementById('documents-grid');
        if (!documentsGrid) {
            console.warn('Element documents-grid non trouvé');
            return;
        }
        
        documentsGrid.innerHTML = '';
        
        // Vérifier si le ticket a des documents
        if (!ticket.documents || !Array.isArray(ticket.documents) || ticket.documents.length === 0) {
            documentsGrid.innerHTML = '<p>Aucun document associé à ce ticket.</p>';
            return;
        }
        
        // Créer un modal pour l'agrandissement des images
        if (!document.getElementById('image-modal')) {
            const modal = document.createElement('div');
            modal.id = 'image-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <span class="close-modal">&times;</span>
                <img class="modal-content" id="modal-img">
            `;
            document.body.appendChild(modal);
            
            // Fermer le modal au clic sur la croix
            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            // Fermer le modal au clic en dehors de l'image
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        try {
            // Afficher les documents
            ticket.documents.forEach(doc => {
                // Vérifier que le document et son nom de fichier existent
                if (!doc || !doc.fileName) { // Correction: fileName au lieu de filename
                    console.warn('Document invalide ou sans nom de fichier:', doc);
                    return; // Passer au document suivant
                }
                
                const documentItem = document.createElement('div');
                documentItem.className = 'document-item';
                
                const documentThumbnail = document.createElement('div');
                documentThumbnail.className = 'document-thumbnail';
                
                // Déterminer le type de document (sécurisé)
                const isImage = ['jpg', 'jpeg', 'png', 'gif'].some(ext => 
                    typeof doc.fileName === 'string' && doc.fileName.toLowerCase().endsWith(ext)
                );
            
                if (isImage) {
                    const img = document.createElement('img');
                    // Extraire le nom du fichier à partir du chemin complet
                    const filePath = doc.filePath || '';
                    const fileName = filePath.split('/').pop();
                    img.src = `/uploads/${fileName}`;
                    img.alt = doc.originalFilename || 'Image';
                    documentThumbnail.appendChild(img);
                    
                    // Ajouter la fonctionnalité d'agrandissement
                    documentThumbnail.addEventListener('click', () => {
                        const modal = document.getElementById('image-modal');
                        const modalImg = document.getElementById('modal-img');
                        if (modal && modalImg) {
                            modal.style.display = 'block';
                            // Extraire le nom du fichier à partir du chemin complet
                            const filePath = doc.filePath || '';
                            const fileName = filePath.split('/').pop();
                            modalImg.src = `/uploads/${fileName}`;
                        }
                    });
                } else {
                    // Pour les autres types de fichiers, afficher une icône
                    let iconClass = 'fa-file';
                    
                    const filename = doc.fileName ? doc.fileName.toLowerCase() : '';
                    if (filename.endsWith('pdf')) {
                        iconClass = 'fa-file-pdf';
                    } else if (['doc', 'docx'].some(ext => filename.endsWith(ext))) {
                        iconClass = 'fa-file-word';
                    } else if (['xls', 'xlsx'].some(ext => filename.endsWith(ext))) {
                        iconClass = 'fa-file-excel';
                    }
                    const icon = document.createElement('i');
                    icon.className = `fas ${iconClass}`;
                    documentThumbnail.appendChild(icon);
                    
                    // Ajouter un lien pour télécharger
                    documentThumbnail.addEventListener('click', () => {
                        // Extraire le nom du fichier à partir du chemin complet
                        const filePath = doc.filePath || '';
                        const fileName = filePath.split('/').pop();
                        window.open(`/uploads/${fileName}`, '_blank');
                    });
                }
            
                const documentInfo = document.createElement('div');
                documentInfo.className = 'document-info';
                documentInfo.textContent = doc.originalFilename || doc.fileName;
                
                documentItem.appendChild(documentThumbnail);
                documentItem.appendChild(documentInfo);
                documentsGrid.appendChild(documentItem);
            });
        } catch (error) {
            console.error('Erreur lors de l\'affichage des documents:', error);
            documentsGrid.innerHTML = '<p>Une erreur est survenue lors de l\'affichage des documents.</p>';
        }
    }
    function setupCommunicationSection(ticket, statusHistory) {
        const additionalInfoForm = document.getElementById('additional-info-form');
        if (!additionalInfoForm) return; // S'assurer que le formulaire existe

        // Réinitialiser et cloner pour purger les anciens écouteurs
        additionalInfoForm.reset();
        const newForm = additionalInfoForm.cloneNode(true);
        additionalInfoForm.parentNode.replaceChild(newForm, additionalInfoForm);

        // Récupérer les éléments du nouveau formulaire
        const filesInput = newForm.querySelector('#additional-files');
        const filesLabel = newForm.querySelector('.file-label');
        const selectedFilesEl = newForm.querySelector('#selected-files');
        const messageInput = newForm.querySelector('#additional-message');
        const submitBtn = newForm.querySelector('.submit-btn');
        const counterEl = newForm.querySelector('#message-counter');
        const formFeedback = document.getElementById('form-feedback');

        // Accessibilité
        if (selectedFilesEl) {
            selectedFilesEl.setAttribute('role', 'status');
            selectedFilesEl.setAttribute('aria-live', 'polite');
        }

        // État local pour les fichiers choisis
        let chosenFiles = [];

        function setFormFeedback(type, text) {
            if (!formFeedback) return;
            formFeedback.className = `form-feedback form-feedback--${type}`;
            formFeedback.textContent = text;
            formFeedback.style.display = 'block';
            formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            clearTimeout(formFeedback._hideTimer);
            formFeedback._hideTimer = setTimeout(() => {
                formFeedback.style.display = 'none';
            }, 4000);
        }

        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        function updateSubmitState() {
            const hasMessage = messageInput.value.trim().length > 0;
            const hasFiles = chosenFiles.length > 0;
            if (submitBtn) submitBtn.disabled = !(hasMessage || hasFiles);
        }

        function updateCounter() {
            if (counterEl && messageInput) {
                const max = messageInput.getAttribute('maxlength') ? parseInt(messageInput.getAttribute('maxlength'), 10) : null;
                const len = messageInput.value.length;
                counterEl.textContent = max ? `${len}/${max}` : `${len}`;
            }
        }

        function autoResize() {
            if (!messageInput) return;
            messageInput.style.height = 'auto';
            const maxH = 240; // px
            messageInput.style.height = Math.min(messageInput.scrollHeight, maxH) + 'px';
        }

        function renderChips() {
            if (!selectedFilesEl) return;
            selectedFilesEl.innerHTML = '';
            chosenFiles.forEach((file, index) => {
                const chip = document.createElement('div');
                chip.className = 'file-chip';
                chip.innerHTML = `
                    <i class="fas fa-file"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${formatSize(file.size)})</span>
                    <button type="button" class="remove-file" aria-label="Supprimer ${file.name}" data-index="${index}"><i class="fas fa-times"></i></button>
                `;
                selectedFilesEl.appendChild(chip);
            });
            updateSubmitState();
        }

        function syncInputFromChosen() {
            if (!filesInput) return;
            const dt = new DataTransfer();
            chosenFiles.forEach(f => dt.items.add(f));
            filesInput.files = dt.files;
        }

        function addFiles(fileList) {
            if (!fileList || fileList.length === 0) return;
            for (let i = 0; i < fileList.length; i++) {
                const f = fileList[i];
                // éviter doublons simples par (name, size, lastModified)
                const exists = chosenFiles.some(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified);
                if (!exists) chosenFiles.push(f);
            }
            syncInputFromChosen();
            renderChips();
        }

        // Listeners
        if (filesInput) {
            filesInput.addEventListener('change', (e) => addFiles(e.target.files));
        }
        if (filesLabel) {
            ['dragenter','dragover'].forEach(evt => filesLabel.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                filesLabel.classList.add('dragover');
            }));
            ;['dragleave','drop'].forEach(evt => filesLabel.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                filesLabel.classList.remove('dragover');
            }));
            filesLabel.addEventListener('drop', (e) => {
                if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
            });
        }
        if (selectedFilesEl) {
            selectedFilesEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.remove-file');
                if (!btn) return;
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                if (!Number.isNaN(idx)) {
                    chosenFiles.splice(idx, 1);
                    syncInputFromChosen();
                    renderChips();
                }
            });
        }
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                updateSubmitState();
                updateCounter();
                autoResize();
            });
            // init
            updateCounter();
            autoResize();
        }
        updateSubmitState();

        // Soumission
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const message = messageInput ? messageInput.value.trim() : '';
            if (!message && chosenFiles.length === 0) {
                setFormFeedback('error', 'Veuillez saisir un message ou joindre des fichiers.');
                return;
            }

            const formData = new FormData();
            formData.append('message', message);
            formData.append('ticketNumber', ticket.ticketNumber);
            chosenFiles.forEach(f => formData.append('files', f));

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn._prevHTML = submitBtn.innerHTML;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
                }
                console.log('Envoi des informations complémentaires...');
                const response = await fetch('/api/tickets/additional-info', {
                    method: 'POST',
                    body: formData
                });
                console.log('Réponse reçue:', response.status);
                if (!response.ok) {
                    throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                console.log('Données reçues:', data);
                if (data.success) {
                    const infoRequestMessage = document.getElementById('info-request-message');
                    if (infoRequestMessage) {
                        infoRequestMessage.style.display = 'none';
                        const closeButton = infoRequestMessage.querySelector('.close-info-request');
                        if (closeButton) {
                            const requestId = closeButton.getAttribute('data-request-id');
                            if (requestId) {
                                const closedRequests = JSON.parse(localStorage.getItem('closedInfoRequests') || '{}');
                                closedRequests[requestId] = true;
                                localStorage.setItem('closedInfoRequests', JSON.stringify(closedRequests));
                            }
                        }
                    }
                    setFormFeedback('success', 'Informations envoyées avec succès. Votre ticket a été mis à jour.');
                    setTimeout(() => { searchTicket(ticket.ticketNumber); }, 500);
                } else {
                    setFormFeedback('error', data.message || 'Une erreur est survenue lors de l\'envoi des informations.');
                }
            } catch (error) {
                console.error('Erreur lors de l\'envoi des informations complémentaires:', error);
                let errorMessage = 'Une erreur est survenue lors de l\'envoi des informations.';
                if (error.message) errorMessage += ' Détail: ' + error.message;
                setFormFeedback('error', errorMessage + ' Veuillez réessayer.');
            }
            finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    if (submitBtn._prevHTML) submitBtn.innerHTML = submitBtn._prevHTML;
                }
            }
        });
    }
    
    // Copier le numéro de ticket
    copyTicketButton.addEventListener('click', () => {
        const ticketNumber = document.getElementById('display-ticket-number').textContent;
        navigator.clipboard.writeText(ticketNumber)
            .then(() => {
                // Changer temporairement l'icône pour indiquer la copie
                const icon = copyTicketButton.querySelector('i');
                icon.className = 'fas fa-check';
                setTimeout(() => {
                    icon.className = 'fas fa-copy';
                }, 2000);
            })
            .catch(err => {
                console.error('Erreur lors de la copie:', err);
                alert('Impossible de copier le numéro de ticket. Veuillez le sélectionner et copier manuellement.');
            });
    });
    
    // Vérifier si un numéro de ticket est présent dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const ticketParam = urlParams.get('ticket');
    
    if (ticketParam) {
        ticketNumberInput.value = ticketParam;
        searchButton.click();
    }
});
