// Puntos estratégicos iniciales en la ciudad de Montería, Córdoba
const PUNTOS_INICIALES_MONTERIA = [
  {
    id: "MON-001",
    nombre: "Ronda del Sinú - Calle 28",
    barrio: "Centro",
    lat: 8.7562,
    lng: -75.8856,
    tipo: "Reciclaje y Ordinarios",
    capacidadLitros: 240,
    estado: "sobrelleno", // Estado inicial para ver el mapa de calor
    nivelPorcentaje: 100,
    ultimoReporte: {
      fecha: "Hace 15 min",
      ciudadano: "Carlos M.",
      comentario: "Contenedor desbordado cerca a los miradores del río.",
      foto: null
    },
    historial: [
      {
        fecha: "2026-10-08 13:45",
        estado: "sobrelleno",
        ciudadano: "Carlos M.",
        comentario: "Contenedor desbordado cerca a los miradores del río."
      }
    ]
  },
  {
    id: "MON-002",
    nombre: "Parque Simón Bolívar (Catedral)",
    barrio: "Centro Histórico",
    lat: 8.7548,
    lng: -75.8839,
    tipo: "Plásticos y Botellas",
    capacidadLitros: 120,
    estado: "lleno",
    nivelPorcentaje: 85,
    ultimoReporte: {
      fecha: "Hace 40 min",
      ciudadano: "Valeria Gómez",
      comentario: "Está casi a tope con botellas de agua.",
      foto: null
    },
    historial: [
      {
        fecha: "2026-10-08 13:20",
        estado: "lleno",
        ciudadano: "Valeria Gómez",
        comentario: "Está casi a tope con botellas de agua."
      }
    ]
  },
  {
    id: "MON-003",
    nombre: "Muelle Turístico del Sinú",
    barrio: "El Nispero / Ronda",
    lat: 8.7595,
    lng: -75.8885,
    tipo: "Ordinarios",
    capacidadLitros: 240,
    estado: "vacio",
    nivelPorcentaje: 15,
    ultimoReporte: {
      fecha: "Hace 2 horas",
      ciudadano: "Cuadrilla Limpieza Aseo",
      comentario: "Vaciado y desinfectado.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-004",
    nombre: "Centro Comercial Alamedas",
    barrio: "La Castellana / Recreo",
    lat: 8.7612,
    lng: -75.8741,
    tipo: "Punto Ecológico (Papel, Plástico, Vidrio)",
    capacidadLitros: 360,
    estado: "medio",
    nivelPorcentaje: 50,
    ultimoReporte: {
      fecha: "Hace 3 horas",
      ciudadano: "Jorge Díaz",
      comentario: "Nivel regular a la salida del parqueadero.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-005",
    nombre: "Pasaje del Sol - Zona Gastronómica",
    barrio: "La Castellana",
    lat: 8.7685,
    lng: -75.8698,
    tipo: "Orgánicos y Ordinarios",
    capacidadLitros: 240,
    estado: "sobrelleno",
    nivelPorcentaje: 100,
    ultimoReporte: {
      fecha: "Hace 25 min",
      ciudadano: "Restaurante Local",
      comentario: "Mucha afluencia del almuerzo, lleno totalmente.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-006",
    nombre: "Universidad de Córdoba (Entrada Principal)",
    barrio: "Mocarí",
    lat: 8.7905,
    lng: -75.8615,
    tipo: "Punto Verde Universitario",
    capacidadLitros: 300,
    estado: "vacio",
    nivelPorcentaje: 20,
    ultimoReporte: {
      fecha: "Ayer",
      ciudadano: "Estudiante Unicor",
      comentario: "Contenedor limpio.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-007",
    nombre: "Mercado del Sur",
    barrio: "La Granja / Sur",
    lat: 8.7365,
    lng: -75.8821,
    tipo: "Orgánicos e Industriales",
    capacidadLitros: 500,
    estado: "sobrelleno",
    nivelPorcentaje: 100,
    ultimoReporte: {
      fecha: "Hace 10 min",
      ciudadano: "Comerciante Sector",
      comentario: "Requiere recolección urgente de residuos de plaza.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-008",
    nombre: "Villa Olímpica de Montería",
    barrio: "El Recreo",
    lat: 8.7654,
    lng: -75.8795,
    tipo: "Aprovechables / Bebidas",
    capacidadLitros: 200,
    estado: "medio",
    nivelPorcentaje: 60,
    ultimoReporte: {
      fecha: "Hace 1 hora",
      ciudadano: "Deportista",
      comentario: "Llenándose por evento de patinaje.",
      foto: null
    },
    historial: []
  },
  {
    id: "MON-009",
    nombre: "Terminal de Transportes de Montería",
    barrio: "Los Pericos / Este",
    lat: 8.7428,
    lng: -75.8592,
    tipo: "Ordinarios y Plásticos",
    capacidadLitros: 360,
    estado: "lleno",
    nivelPorcentaje: 90,
    ultimoReporte: {
      fecha: "Hace 50 min",
      ciudadano: "Pasajero",
      comentario: "Sala de espera este, necesita vaciado.",
      foto: null
    },
    historial: []
  }
];
