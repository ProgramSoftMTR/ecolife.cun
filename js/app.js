/**
 * EcoMontería Smart - Gestión Inteligente de Residuos & Mapa de Calor
 * Lógica principal de la aplicación
 */

(function () {
  // Constantes y Estado de la Aplicación
  const STORAGE_KEY = 'ecomonteria_bins_v1';
  const MONTERIA_COORDS = [8.7550, -75.8850]; // Coordenadas centrales de Montería (Ronda del Sinú / Centro)
  const isMobile = window.innerWidth <= 900;
  const DEFAULT_ZOOM = isMobile ? 13 : 14;

  let map = null;
  let heatLayer = null;
  let heatmapActive = true;
  let isAddModeActive = false;
  let tempClickCoords = null;
  let currentActiveBin = null;
  let markersMap = new Map(); // id -> L.marker
  let cameraStream = null;
  let capturedPhotoBase64 = null;

  // Carga de datos iniciales o desde LocalStorage
  let bins = [];

  function loadBinsData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        bins = JSON.parse(saved);
      } catch (e) {
        console.error("Error al parsear datos de almacenamiento, usando iniciales", e);
        bins = [...PUNTOS_INICIALES_MONTERIA];
      }
    } else {
      bins = [...PUNTOS_INICIALES_MONTERIA];
      saveBinsData();
    }
  }

  function saveBinsData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bins));
    updateStats();
    renderBinsList();
    updateHeatmap();
  }

  // ==========================================================================
  // Inicialización del Mapa de Montería
  // ==========================================================================
  function initMap() {
    map = L.map('map', {
      center: MONTERIA_COORDS,
      zoom: DEFAULT_ZOOM,
      zoomControl: false
    });

    // Control de Zoom en posición derecha
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Capa OpenStreetMap estándar: 100% libre, garantizada para cargar en cualquier teléfono sin requerir API key ni recargas forzadas
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    // CARTO Basemaps con API Key oficial del usuario (formato estándar para móviles y web)
    const cartoApiKey = 'cb1_4enu_1_f4e1983c2bcc4be2da8ec905';
    const cartoVoyager = L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoApiKey}`, {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19
    });

    // Capa de satélite híbrido Esri
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });

    // Usar OpenStreetMap como base predeterminada para asegurar que en cualquier celular abra al instante sin marcas de agua ni bloqueos
    osmLayer.addTo(map);

    // Control selector de capas (esquina superior derecha)
    L.control.layers({
      "Mapa Callejero (OpenStreetMap - Rápido)": osmLayer,
      "Mapa Moderno (CARTO con API Key)": cartoVoyager,
      "Vista Satelital (Esri)": satelliteLayer
    }, null, { position: 'topright' }).addTo(map);

    // Auto-ajuste de tamaño para pantallas de celulares y tablets al cargar
    map.whenReady(() => {
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 600);
      setTimeout(() => map.invalidateSize(), 1200);
    });

    window.addEventListener('resize', () => map.invalidateSize());
    window.addEventListener('orientationchange', () => setTimeout(() => map.invalidateSize(), 300));


    // Escala
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    // Evento de clic en mapa para colocar nuevo contenedor
    map.on('click', handleMapClick);

    // Renderizar marcadores
    renderAllMarkers();

    // Inicializar mapa de calor
    initHeatmap();

    // Verificar si la URL viene con parámetro de escaneo de QR (?reportar=ID)
    checkUrlReportParam();
  }

  // ==========================================================================
  // Iconos y Marcadores Dinámicos según Estado
  // ==========================================================================
  function createCustomMarkerIcon(bin) {
    let statusClass = 'marker-vacio';
    let iconClass = 'fa-trash-can';

    if (bin.estado === 'sobrelleno') {
      statusClass = 'marker-sobrelleno';
      iconClass = 'fa-triangle-exclamation';
    } else if (bin.estado === 'lleno') {
      statusClass = 'marker-lleno';
      iconClass = 'fa-trash-arrow-up';
    } else if (bin.estado === 'medio') {
      statusClass = 'marker-medio';
      iconClass = 'fa-trash-can';
    }

    const html = `
      <div class="custom-marker ${statusClass}" title="${bin.nombre} (${bin.estado.toUpperCase()})">
        <i class="fa-solid ${iconClass}"></i>
      </div>
    `;

    return L.divIcon({
      className: 'custom-leaflet-icon-wrapper',
      html: html,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22]
    });
  }

  function renderAllMarkers() {
    // Limpiar marcadores existentes
    markersMap.forEach(marker => map.removeLayer(marker));
    markersMap.clear();

    bins.forEach(bin => {
      const marker = L.marker([bin.lat, bin.lng], {
        icon: createCustomMarkerIcon(bin),
        title: bin.nombre
      });

      marker.bindPopup(() => createPopupContent(bin));
      marker.addTo(map);
      markersMap.set(bin.id, marker);
    });
  }

  function createPopupContent(bin) {
    let badgeClass = 'bg-green';
    let estadoTexto = 'Vacío / En Buen Estado';

    if (bin.estado === 'sobrelleno') {
      badgeClass = 'bg-red';
      estadoTexto = '🚨 ¡Sobrelleno! (Alerta Roja)';
    } else if (bin.estado === 'lleno') {
      badgeClass = 'bg-red';
      estadoTexto = '⚠️ Lleno (Requiere Vaciado)';
    } else if (bin.estado === 'medio') {
      badgeClass = 'bg-yellow';
      estadoTexto = '🟡 Nivel Medio (50%)';
    }

    const div = document.createElement('div');
    div.className = 'popup-container';
    div.innerHTML = `
      <div class="popup-header">
        <span class="popup-id">${bin.id}</span>
        <span class="popup-status-badge ${badgeClass}">${estadoTexto}</span>
      </div>
      <h4 class="popup-title">${bin.nombre}</h4>
      <p class="popup-barrio"><i class="fa-solid fa-location-dot"></i> Barrio: <strong>${bin.barrio}</strong></p>
      
      ${bin.ultimoReporte ? `
        <div style="font-size:0.75rem; color:#64748b; margin-bottom:0.75rem; background:#f8fafc; padding:0.4rem; border-radius:6px;">
          <strong>Último Reporte:</strong> ${bin.ultimoReporte.fecha} por ${bin.ultimoReporte.ciudadano || 'Ciudadano'}<br>
          <em>"${bin.ultimoReporte.comentario || 'Sin comentario'}"</em>
        </div>
      ` : ''}

      <div class="popup-actions">
        <button class="btn btn-danger-action btn-sm" onclick="window.ecoApp.openCitizenReport('${bin.id}')">
          <i class="fa-solid fa-camera"></i> Escanear / Reportar con Foto
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.ecoApp.openBinDetail('${bin.id}')">
          <i class="fa-solid fa-qrcode"></i> Ver Código QR y Detalles
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.ecoApp.markBinCleaned('${bin.id}')">
          <i class="fa-solid fa-broom"></i> Marcar como Vaciado
        </button>
      </div>
    `;
    return div;
  }

  // ==========================================================================
  // Capa de Mapa de Calor (Leaflet.heat)
  // Muestra intensidad alta (rojo) donde hay botes llenos o sobrellenos
  // ==========================================================================
  function initHeatmap() {
    updateHeatmap();
  }

  function updateHeatmap() {
    const heatPoints = [];

    bins.forEach(bin => {
      let intensity = 0;
      if (bin.estado === 'sobrelleno') {
        intensity = 1.0; // Máxima intensidad roja
      } else if (bin.estado === 'lleno') {
        intensity = 0.75;
      } else if (bin.estado === 'medio') {
        intensity = 0.25;
      }

      if (intensity > 0) {
        heatPoints.push([bin.lat, bin.lng, intensity]);
      }
    });

    if (heatLayer) {
      map.removeLayer(heatLayer);
    }

    if (heatmapActive && heatPoints.length > 0) {
      heatLayer = L.heatLayer(heatPoints, {
        radius: 40,
        blur: 28,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.2: '#fde047', // Amarillo
          0.5: '#fb923c', // Naranja
          0.8: '#ef4444', // Rojo fuerte
          1.0: '#991b1b'  // Rojo oscuro crítico
        }
      }).addTo(map);
    }
  }

  function toggleHeatmap() {
    heatmapActive = !heatmapActive;
    const btn = document.getElementById('btn-toggle-heatmap');
    if (heatmapActive) {
      btn.classList.add('active');
      btn.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> <span>Mapa de Calor: <strong>ACTIVO</strong></span>`;
      updateHeatmap();
      showToast('Mapa de calor de residuos activado', 'success');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> <span>Mapa de Calor: <strong>INACTIVO</strong></span>`;
      if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
      }
      showToast('Mapa de calor oculto', 'info');
    }
  }

  // ==========================================================================
  // Estadísticas y Barra Superior
  // ==========================================================================
  function updateStats() {
    const total = bins.length;
    const criticos = bins.filter(b => b.estado === 'sobrelleno' || b.estado === 'lleno').length;
    const medios = bins.filter(b => b.estado === 'medio').length;
    const vacios = bins.filter(b => b.estado === 'vacio').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-criticos').textContent = criticos;
    document.getElementById('stat-medios').textContent = medios;
    document.getElementById('stat-vacios').textContent = vacios;
    document.getElementById('sidebar-count').textContent = `${total} puntos`;
  }

  // ==========================================================================
  // Renderizado del Panel Lateral (Lista de Contenedores)
  // ==========================================================================
  function renderBinsList() {
    const container = document.getElementById('bins-list');
    const searchTerm = document.getElementById('input-search').value.toLowerCase().trim();
    const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';

    let filtered = bins.filter(bin => {
      const matchSearch = bin.nombre.toLowerCase().includes(searchTerm) ||
        bin.barrio.toLowerCase().includes(searchTerm) ||
        bin.id.toLowerCase().includes(searchTerm);

      let matchFilter = true;
      if (activeFilter === 'critico') {
        matchFilter = (bin.estado === 'sobrelleno' || bin.estado === 'lleno');
      } else if (activeFilter === 'medio') {
        matchFilter = (bin.estado === 'medio');
      } else if (activeFilter === 'vacio') {
        matchFilter = (bin.estado === 'vacio');
      }

      return matchSearch && matchFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem; color: #94a3b8;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <p>No se encontraron contenedores con esos criterios en Montería.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(bin => {
      let tagClass = 'tag-green';
      let tagLabel = 'Vacío';

      if (bin.estado === 'sobrelleno') {
        tagClass = 'tag-red';
        tagLabel = 'Sobrelleno';
      } else if (bin.estado === 'lleno') {
        tagClass = 'tag-red';
        tagLabel = 'Lleno';
      } else if (bin.estado === 'medio') {
        tagClass = 'tag-yellow';
        tagLabel = 'Medio';
      }

      return `
        <div class="bin-card status-${bin.estado}" onclick="window.ecoApp.focusBin('${bin.id}')">
          <div class="bin-card-header">
            <h4 class="bin-name">${bin.nombre}</h4>
            <span class="bin-tag ${tagClass}">${tagLabel}</span>
          </div>

          <div class="bin-meta">
            <span class="bin-barrio"><i class="fa-solid fa-location-dot"></i> ${bin.barrio}</span>
            <span class="bin-id" style="font-family:monospace; font-weight:700;">${bin.id}</span>
          </div>

          <div class="bin-card-footer">
            <span class="bin-last-report">
              <i class="fa-regular fa-clock"></i> ${bin.ultimoReporte ? bin.ultimoReporte.fecha : 'Sin reportes recientes'}
            </span>
            <div class="bin-quick-actions" onclick="event.stopPropagation()">
              <button class="btn-icon-action action-report" title="Reportar Estado con Foto" onclick="window.ecoApp.openCitizenReport('${bin.id}')">
                <i class="fa-solid fa-camera"></i>
              </button>
              <button class="btn-icon-action" title="Ver QR y Ficha" onclick="window.ecoApp.openBinDetail('${bin.id}')">
                <i class="fa-solid fa-qrcode"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function focusBin(binId) {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return;

    map.flyTo([bin.lat, bin.lng], 16, { animate: true, duration: 1 });
    const marker = markersMap.get(bin.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 600);
    }

    // En pantallas móviles, cerrar el sidebar para mostrar el mapa
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar').classList.remove('open');
    }
  }

  // ==========================================================================
  // Agregar Nuevo Contenedor (Clic en Mapa de Montería)
  // ==========================================================================
  function activateAddMode() {
    isAddModeActive = true;
    document.getElementById('banner-add-mode').classList.remove('hidden');
    document.getElementById('map').style.cursor = 'crosshair';
    showToast('Haz clic en el mapa de Montería para ubicar el nuevo bote', 'info');
  }

  function deactivateAddMode() {
    isAddModeActive = false;
    document.getElementById('banner-add-mode').classList.add('hidden');
    document.getElementById('map').style.cursor = '';
  }

  function handleMapClick(e) {
    if (!isAddModeActive) return;

    tempClickCoords = e.latlng;
    deactivateAddMode();

    // Rellenar formulario modal de nuevo bote
    document.getElementById('new-bin-lat').value = tempClickCoords.lat.toFixed(5);
    document.getElementById('new-bin-lng').value = tempClickCoords.lng.toFixed(5);
    document.getElementById('new-bin-nombre').value = '';
    document.getElementById('new-bin-barrio').value = '';

    openModal('modal-new-bin');
  }

  function saveNewBin() {
    const nombre = document.getElementById('new-bin-nombre').value.trim();
    const barrio = document.getElementById('new-bin-barrio').value.trim();
    const tipo = document.getElementById('new-bin-tipo').value;
    const estadoInicial = document.getElementById('new-bin-estado-inicial').value;
    const lat = parseFloat(document.getElementById('new-bin-lat').value);
    const lng = parseFloat(document.getElementById('new-bin-lng').value);

    if (!nombre || !barrio) {
      alert('Por favor ingresa el nombre de referencia y el barrio para el bote.');
      return;
    }

    const nextNumber = bins.length + 1;
    const newId = `MON-${String(nextNumber).padStart(3, '0')}`;

    const newBin = {
      id: newId,
      nombre: nombre,
      barrio: barrio,
      lat: lat,
      lng: lng,
      tipo: tipo,
      capacidadLitros: 240,
      estado: estadoInicial,
      nivelPorcentaje: estadoInicial === 'sobrelleno' ? 100 : (estadoInicial === 'lleno' ? 85 : (estadoInicial === 'medio' ? 50 : 10)),
      ultimoReporte: {
        fecha: "Recién registrado",
        ciudadano: "Administrador EcoMontería",
        comentario: "Contenedor instalado en punto estratégico.",
        foto: null
      },
      historial: []
    };

    bins.unshift(newBin);
    saveBinsData();
    renderAllMarkers();

    closeModal('modal-new-bin');
    showToast(`¡Bote ${newId} guardado con éxito! Código QR generado.`, 'success');

    // Enfocar y abrir la ficha para ver su QR recién creado
    focusBin(newId);
    setTimeout(() => openBinDetail(newId), 800);
  }

  // ==========================================================================
  // Reporte Ciudadano (con Escaneo QR y Foto en Tiempo Real)
  // ==========================================================================
  function openCitizenReport(binId) {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return;

    currentActiveBin = bin;
    document.getElementById('report-modal-bin-title').textContent = bin.nombre;
    document.getElementById('report-modal-bin-location').innerHTML = `
      <i class="fa-solid fa-location-dot"></i> Montería, Sector: <strong>${bin.barrio}</strong> | ID: <code>${bin.id}</code>
    `;

    // Seleccionar radio de estado actual por defecto o sobrelleno
    const radio = document.querySelector(`input[name="report-status"][value="${bin.estado}"]`);
    if (radio) {
      radio.checked = true;
    } else {
      document.querySelector('input[name="report-status"][value="sobrelleno"]').checked = true;
    }

    // Limpiar foto y cámara previa
    resetPhotoModule();
    document.getElementById('report-citizen-name').value = '';
    document.getElementById('report-citizen-notes').value = '';

    openModal('modal-report');
  }

  function resetPhotoModule() {
    stopCameraStream();
    capturedPhotoBase64 = null;
    document.getElementById('photo-preview-container').classList.add('hidden');
    document.getElementById('photo-preview-img').src = '';
    document.getElementById('live-camera-container').classList.add('hidden');
    document.getElementById('input-photo-file').value = '';
  }

  // Cámara en Tiempo Real con WebRTC (navigator.mediaDevices.getUserMedia)
  async function startLiveCamera() {
    try {
      const videoElement = document.getElementById('camera-video');
      document.getElementById('live-camera-container').classList.remove('hidden');

      // Solicitar acceso a la cámara trasera si está disponible (facingMode: environment)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      cameraStream = stream;
      videoElement.srcObject = stream;
      showToast('Cámara iniciada. Enfoca el contenedor.', 'info');
    } catch (err) {
      console.warn("No se pudo acceder a la cámara en vivo:", err);
      document.getElementById('live-camera-container').classList.add('hidden');
      alert("No se pudo acceder a la cámara web directamente. Puedes usar el botón 'Tomar con Cámara del Celular / Archivo' para capturar la foto.");
    }
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    const container = document.getElementById('live-camera-container');
    if (container) container.classList.add('hidden');
  }

  function captureSnapshotFromVideo() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');

    if (!video.videoWidth) {
      alert("La cámara aún se está inicializando.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Agregar marca de agua con fecha y hora de Montería
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    const nowStr = new Date().toLocaleString('es-CO');
    ctx.fillText(`EcoMontería • Evidencia en Vivo: ${nowStr}`, 20, canvas.height - 20);

    capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);

    // Detener la cámara y mostrar vista previa
    stopCameraStream();
    displayPhotoPreview(capturedPhotoBase64);
    showToast('Foto capturada correctamente', 'success');
  }

  function handleFileInputPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      capturedPhotoBase64 = e.target.result;
      displayPhotoPreview(capturedPhotoBase64);
      showToast('Foto cargada exitosamente', 'success');
    };
    reader.readAsDataURL(file);
  }

  function displayPhotoPreview(dataUrl) {
    const img = document.getElementById('photo-preview-img');
    img.src = dataUrl;
    document.getElementById('photo-preview-container').classList.remove('hidden');
  }

  function submitCitizenReport() {
    if (!currentActiveBin) return;

    const selectedRadio = document.querySelector('input[name="report-status"]:checked');
    if (!selectedRadio) {
      alert('Por favor selecciona el estado del contenedor.');
      return;
    }

    const nuevoEstado = selectedRadio.value;
    const ciudadano = document.getElementById('report-citizen-name').value.trim() || 'Ciudadano en Montería';
    const comentario = document.getElementById('report-citizen-notes').value.trim() || 'Reporte de nivel mediante código QR';

    // Validación de foto: si no tomó foto, generar una imagen de muestra con canvas
    if (!capturedPhotoBase64) {
      // Generar snapshot sintético para garantizar evidencia fotográfica
      capturedPhotoBase64 = generatePlaceholderEvidence(currentActiveBin.nombre, nuevoEstado);
    }

    const ahora = new Date();
    const fechaHora = ahora.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const reporteObj = {
      fecha: fechaHora,
      estado: nuevoEstado,
      ciudadano: ciudadano,
      comentario: comentario,
      foto: capturedPhotoBase64
    };

    // Actualizar contenedor
    currentActiveBin.estado = nuevoEstado;
    currentActiveBin.nivelPorcentaje = nuevoEstado === 'sobrelleno' ? 100 : (nuevoEstado === 'lleno' ? 90 : (nuevoEstado === 'medio' ? 50 : 10));
    currentActiveBin.ultimoReporte = {
      fecha: "Hace un momento",
      ciudadano: ciudadano,
      comentario: comentario,
      foto: capturedPhotoBase64
    };

    if (!currentActiveBin.historial) currentActiveBin.historial = [];
    currentActiveBin.historial.unshift(reporteObj);

    // Guardar cambios
    saveBinsData();
    renderAllMarkers();

    // Reproducir sonido sintético de confirmación
    playBeepSound(nuevoEstado === 'sobrelleno' || nuevoEstado === 'lleno' ? 'alert' : 'success');

    closeModal('modal-report');

    // Mensaje de éxito
    if (nuevoEstado === 'sobrelleno' || nuevoEstado === 'lleno') {
      showToast(`¡Reporte de ALERTA recibido! El contenedor se marcó en ROJO y activó el mapa de calor.`, 'danger');
    } else {
      showToast(`¡Reporte registrado con éxito! Gracias por tu colaboración cívica en Montería.`, 'success');
    }

    // Enfocar el contenedor en el mapa
    focusBin(currentActiveBin.id);
  }

  // Generador de evidencia fotográfica sintética en caso de que el usuario no use cámara en la prueba
  function generatePlaceholderEvidence(nombre, estado) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Fondo degradado simulación de contenedor
    const grad = ctx.createLinearGradient(0, 0, 400, 300);
    if (estado === 'sobrelleno' || estado === 'lleno') {
      grad.addColorStop(0, '#7f1d1d');
      grad.addColorStop(1, '#dc2626');
    } else if (estado === 'medio') {
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(1, '#d97706');
    } else {
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(1, '#059669');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 300);

    // Dibujo esquemático del bote de basura
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(150, 90, 100, 140);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(140, 75, 120, 15);

    // Texto
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EVIDENCIA FOTOGRÁFICA QR', 200, 45);

    ctx.font = '14px sans-serif';
    ctx.fillText(`${nombre}`, 200, 260);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`ESTADO: ${estado.toUpperCase()}`, 200, 285);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  // Marcar como limpio/vaciado (para cuadrilla de aseo de Montería)
  function markBinCleaned(binId) {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return;

    bin.estado = 'vacio';
    bin.nivelPorcentaje = 0;
    bin.ultimoReporte = {
      fecha: "Recién vaciado",
      ciudadano: "Cuadrilla Aseo Montería",
      comentario: "Contenedor vaciado y listo para su uso.",
      foto: null
    };

    saveBinsData();
    renderAllMarkers();
    showToast(`El contenedor ${bin.id} ha sido marcado como LIMPIO y VACÍO (Verde).`, 'success');

    // Si el modal de detalle está abierto, actualizarlo
    const modalDetail = document.getElementById('modal-detail');
    if (!modalDetail.classList.contains('hidden')) {
      openBinDetail(binId);
    }
  }

  // ==========================================================================
  // Generación y Gestión de Códigos QR
  // ==========================================================================
  function generateQrUrl(binId) {
    // Genera URL que al escanear abre la app con el parámetro del contenedor
    const currentUrl = window.location.href.split('?')[0];
    return `${currentUrl}?reportar=${binId}`;
  }

  function openBinDetail(binId) {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return;

    currentActiveBin = bin;

    document.getElementById('detail-code').textContent = bin.id;
    document.getElementById('detail-title').textContent = bin.nombre;
    document.getElementById('detail-barrio').textContent = `Barrio: ${bin.barrio}`;
    document.getElementById('detail-tipo').textContent = bin.tipo;
    document.getElementById('detail-coords').textContent = `${bin.lat.toFixed(5)}, ${bin.lng.toFixed(5)}`;
    document.getElementById('detail-qr-id').textContent = `ID: ${bin.id}`;

    // Estado Badge
    const pill = document.getElementById('detail-status-pill');
    if (bin.estado === 'sobrelleno') {
      pill.className = 'status-pill pill-danger';
      pill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Sobrelleno (Alerta Roja)`;
    } else if (bin.estado === 'lleno') {
      pill.className = 'status-pill pill-danger';
      pill.innerHTML = `<i class="fa-solid fa-trash-arrow-up"></i> Lleno (Rojo)`;
    } else if (bin.estado === 'medio') {
      pill.className = 'status-pill pill-warning';
      pill.innerHTML = `<i class="fa-solid fa-battery-half"></i> Nivel Medio (50%)`;
    } else {
      pill.className = 'status-pill pill-success';
      pill.innerHTML = `<i class="fa-solid fa-circle-check"></i> Vacío (Óptimo)`;
    }

    // Botones de acción del detalle
    document.getElementById('detail-btn-report').onclick = () => {
      closeModal('modal-detail');
      openCitizenReport(bin.id);
    };

    document.getElementById('detail-btn-empty').onclick = () => {
      markBinCleaned(bin.id);
    };

    // Renderizar Código QR nítido
    const qrContainer = document.getElementById('detail-qr-container');
    qrContainer.innerHTML = '';
    const qrTargetUrl = generateQrUrl(bin.id);

    new QRCode(qrContainer, {
      text: qrTargetUrl,
      width: 140,
      height: 140,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

    // Botón descargar QR individual
    document.getElementById('btn-download-single-qr').onclick = () => {
      downloadQrAsImage(qrContainer, `QR_${bin.id}_${bin.nombre.replace(/\s+/g, '_')}`);
    };

    // Renderizar Historial de Reportes y Fotos
    const historyContainer = document.getElementById('detail-history-list');
    if (!bin.historial || bin.historial.length === 0) {
      historyContainer.innerHTML = `
        <p style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:1rem;">
          No hay reportes anteriores registrados para este contenedor.
        </p>
      `;
    } else {
      historyContainer.innerHTML = bin.historial.map(item => `
        <div class="history-item">
          ${item.foto ? `<img class="history-thumb" src="${item.foto}" alt="Evidencia" onclick="window.ecoApp.previewPhotoZoom('${item.foto}')">` : `
            <div class="history-thumb" style="display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;">
              <i class="fa-solid fa-camera"></i>
            </div>
          `}
          <div class="history-info">
            <div class="history-title-row">
              <span class="history-reporter">${item.ciudadano} &bull; <strong style="text-transform:uppercase; color:${item.estado === 'sobrelleno' || item.estado === 'lleno' ? '#dc2626' : '#059669'}">${item.estado}</strong></span>
              <span class="history-date">${item.fecha}</span>
            </div>
            <p class="history-notes">${item.comentario || 'Reporte de estado de llenado'}</p>
          </div>
        </div>
      `).join('');
    }

    openModal('modal-detail');
  }

  function downloadQrAsImage(container, fileName) {
    const imgOrCanvas = container.querySelector('img') || container.querySelector('canvas');
    if (!imgOrCanvas) return;

    let dataUrl = '';
    if (imgOrCanvas.tagName === 'IMG') {
      dataUrl = imgOrCanvas.src;
    } else {
      dataUrl = imgOrCanvas.toDataURL('image/png');
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Código QR descargado', 'success');
  }

  // Galería de Tarjetas QR para Imprimir
  function openAllQrsModal() {
    const grid = document.getElementById('qr-stickers-grid');
    grid.innerHTML = '';

    bins.forEach(bin => {
      const card = document.createElement('div');
      card.className = 'qr-sticker-item';

      const qrWrapper = document.createElement('div');
      qrWrapper.className = 'sticker-qr';

      card.innerHTML = `
        <div class="sticker-header">
          <i class="fa-solid fa-recycle"></i>
          <span>EcoMontería Limpia</span>
        </div>
        <div class="sticker-instruction">
          <i class="fa-solid fa-mobile-screen"></i> Escanea para reportar con foto si está lleno
        </div>
      `;

      card.appendChild(qrWrapper);

      const footer = document.createElement('div');
      footer.innerHTML = `
        <div class="sticker-code">${bin.id}</div>
        <div class="sticker-location">${bin.nombre}</div>
      `;
      card.appendChild(footer);

      grid.appendChild(card);

      // Generar QR dentro del wrapper
      new QRCode(qrWrapper, {
        text: generateQrUrl(bin.id),
        width: 130,
        height: 130,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    });

    openModal('modal-all-qrs');
  }

  // Modal para Simular Escáner QR de cualquier bote
  function openQrSimulatorModal() {
    const select = document.getElementById('select-simulate-bin');
    select.innerHTML = bins.map(b => `
      <option value="${b.id}">[${b.id}] ${b.nombre} (${b.barrio}) - Estado actual: ${b.estado.toUpperCase()}</option>
    `).join('');

    openModal('modal-qr-simulator');
  }

  function confirmSimulatedScan() {
    const binId = document.getElementById('select-simulate-bin').value;
    closeModal('modal-qr-simulator');
    openCitizenReport(binId);
  }

  // ==========================================================================
  // Manejo de Parámetros URL (?reportar=BIN_ID)
  // Permite que al escanear con un teléfono inteligente abra de inmediato
  // ==========================================================================
  function checkUrlReportParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const reportBinId = urlParams.get('reportar') || urlParams.get('bin');

    if (reportBinId) {
      setTimeout(() => {
        openCitizenReport(reportBinId);
        showToast(`Escaneo de código QR detectado para el bote ${reportBinId}`, 'info');
      }, 500);
    }
  }

  // ==========================================================================
  // Sonido Sintético Web Audio (para retroalimentación táctil/sonora)
  // ==========================================================================
  function playBeepSound(type) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'alert') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      // AudioContext no disponible o bloqueado por navegador
    }
  }

  // ==========================================================================
  // Control de Modales y Notificaciones Toast
  // ==========================================================================
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
    if (id === 'modal-report') {
      stopCameraStream();
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast toast-${type}`;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }

  function previewPhotoZoom(imgUrl) {
    const win = window.open();
    win.document.write(`<img src="${imgUrl}" style="max-width:100%;height:auto;margin:auto;display:block;">`);
  }

  // ==========================================================================
  // Configuración de Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Botones de Cabecera
    document.getElementById('btn-toggle-heatmap').addEventListener('click', toggleHeatmap);
    document.getElementById('btn-add-mode').addEventListener('click', activateAddMode);
    document.getElementById('btn-cancel-add-mode').addEventListener('click', deactivateAddMode);
    document.getElementById('btn-open-citizen-report').addEventListener('click', openQrSimulatorModal);
    document.getElementById('btn-view-all-qrs').addEventListener('click', openAllQrsModal);

    // Botón flotante móvil para abrir/cerrar sidebar
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Filtros de búsqueda y estado
    document.getElementById('input-search').addEventListener('input', renderBinsList);
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        renderBinsList();
      });
    });

    // Guardar nuevo bote
    document.getElementById('btn-save-new-bin').addEventListener('click', saveNewBin);
    document.getElementById('btn-cancel-new-bin').addEventListener('click', () => closeModal('modal-new-bin'));
    document.getElementById('btn-close-new-bin').addEventListener('click', () => closeModal('modal-new-bin'));

    // Reporte Ciudadano y Cámara
    document.getElementById('btn-submit-report').addEventListener('click', submitCitizenReport);
    document.getElementById('btn-cancel-report').addEventListener('click', () => closeModal('modal-report'));
    document.getElementById('btn-close-report-modal').addEventListener('click', () => closeModal('modal-report'));
    document.getElementById('btn-start-camera').addEventListener('click', startLiveCamera);
    document.getElementById('btn-stop-camera').addEventListener('click', stopCameraStream);
    document.getElementById('btn-take-snapshot').addEventListener('click', captureSnapshotFromVideo);
    document.getElementById('input-photo-file').addEventListener('change', handleFileInputPhoto);
    document.getElementById('btn-remove-photo').addEventListener('click', resetPhotoModule);

    // Modal de Detalle
    document.getElementById('btn-close-detail').addEventListener('click', () => closeModal('modal-detail'));

    // Modal QRs
    document.getElementById('btn-close-all-qrs').addEventListener('click', () => closeModal('modal-all-qrs'));

    // Simulador QR
    document.getElementById('btn-close-qr-simulator').addEventListener('click', () => closeModal('modal-qr-simulator'));
    document.getElementById('btn-cancel-simulate').addEventListener('click', () => closeModal('modal-qr-simulator'));
    document.getElementById('btn-confirm-simulate').addEventListener('click', confirmSimulatedScan);

    // Cerrar modales con clic en el fondo overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });
  }

  // Exponer API a nivel global para llamadas desde popups HTML
  window.ecoApp = {
    openCitizenReport,
    openBinDetail,
    markBinCleaned,
    focusBin,
    previewPhotoZoom
  };

  // Inicialización general al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    loadBinsData();
    initMap();
    updateStats();
    renderBinsList();
    setupEventListeners();
  });

})();
