
import {
  FaceDetector,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs";

// =================================
// CONFIGURAÇÃO
// =================================

// Proporção do rosto relativamente à largura da câmara
const FACE_FAR = 0.10;
const FACE_NEAR = 0.28;

// Suavidade da animação
const SMOOTHING = 0.07;

// Tempo de espera com círculo completo
const COMPLETION_DELAY = 250;

// Círculo SVG
const progressCircle = document.getElementById(
  "progress-circle"
);

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

progressCircle.style.strokeDasharray = CIRCUMFERENCE;
progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

// =================================
// VARIÁVEIS
// =================================

let video;
let faceDetector;

let progress = 0;
let targetProgress = 0;

let completed = false;
let fullSince = -1;

let debugMode = false;
let lastVideoTime = -1;

let debugElement = null;

// =================================
// INICIALIZAR
// =================================

async function init() {
  try {

    console.log("A carregar deteção facial...");

    // Carregar MediaPipe
    const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm"
);

    // Criar detetor de rostos
    faceDetector = await FaceDetector.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "CPU"
        },

        runningMode: "VIDEO",
        minDetectionConfidence: 0.5
      }
    );

    console.log("Detetor facial carregado!");

    // Criar vídeo invisível
    video = document.createElement("video");

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    // Pedir acesso à câmara
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    });

    video.srcObject = stream;

    await video.play();

    console.log("Câmara pronta!");

    // Iniciar animação
    requestAnimationFrame(animate);

  } catch (error) {

    console.error("Erro ao iniciar a experiência:", error);

    const message = document.querySelector(
      ".interaction-area p"
    );

    if (message) {
      message.textContent =
        "Não foi possível iniciar a câmara.";
    }
  }
}

// =================================
// CALCULAR PROXIMIDADE
// =================================

function calculateProximity() {

  if (!faceDetector || video.readyState < 2) {
    targetProgress = 0;
    return;
  }

  // Evitar processar o mesmo fotograma
  if (video.currentTime === lastVideoTime) {
    return;
  }

  lastVideoTime = video.currentTime;

  const results = faceDetector.detectForVideo(
    video,
    performance.now()
  );

  const faces = results.detections || [];

  let largestFace = 0;

  // Procurar o maior rosto
  for (const face of faces) {

    const faceWidth = face.boundingBox.width;

    if (faceWidth > largestFace) {
      largestFace = faceWidth;
    }
  }

  if (largestFace > 0) {

    // Proporção do rosto na imagem
    const faceRatio = largestFace / video.videoWidth;

    // Converter proximidade em progresso
    targetProgress =
      (faceRatio - FACE_FAR) /
      (FACE_NEAR - FACE_FAR);

    // Limitar entre 0 e 1
    targetProgress = Math.max(
      0,
      Math.min(1, targetProgress)
    );

  } else {

    // Sem rosto detetado
    targetProgress = 0;
  }
}

// =================================
// ATUALIZAR CÍRCULO
// =================================

function updateCircle() {

  const offset = CIRCUMFERENCE * (1 - progress);

  progressCircle.style.strokeDashoffset = offset;
}

// =================================
// VERIFICAR CONCLUSÃO
// =================================


function checkCompletion() {

  if (completed) return;

  // Considerar o círculo completo a partir de 99%
  if (progress >= 0.99 && targetProgress >= 0.99) {

    if (fullSince === -1) {
      fullSince = performance.now();
    }

    // Aguardar 600 ms
    if (performance.now() - fullSince >= COMPLETION_DELAY) {

      completed = true;

      // Garantir que o círculo fica visualmente completo
      progress = 1;
      updateCircle();

      console.log("Experiência iniciada!");

      window.location.href = "camisola.html";
    }

  } else {

    fullSince = -1;
  }
}


// =================================
// ANIMAÇÃO
// =================================

function animate() {

  if (completed) return;

  // Calcular distância estimada
  calculateProximity();

  // Suavizar progresso
  progress += (targetProgress - progress) * SMOOTHING;

  // Atualizar SVG
  updateCircle();

  // Verificar se terminou
  checkCompletion();

  // Atualizar debug
  if (debugMode) {
    updateDebug();
  }

  requestAnimationFrame(animate);
}

// =================================
// DEBUG
// =================================

function updateDebug() {

  if (!debugElement) return;

  debugElement.textContent =
    "Progresso: " +
    (progress * 100).toFixed(1) +
    "%";
}

// =================================
// TECLAS
// =================================

document.addEventListener("keydown", (event) => {

  // D = ativar/desativar debug
  if (event.key.toLowerCase() === "d") {

    debugMode = !debugMode;

    if (!debugElement) {

      debugElement = document.createElement("div");

      debugElement.style.position = "fixed";
      debugElement.style.top = "20px";
      debugElement.style.left = "20px";
      debugElement.style.padding = "12px";
      debugElement.style.background = "rgba(0,0,0,0.7)";
      debugElement.style.color = "white";
      debugElement.style.fontFamily = "monospace";
      debugElement.style.zIndex = "1000";

      document.body.appendChild(debugElement);
    }

    debugElement.style.display =
      debugMode ? "block" : "none";
  }

  // R = reiniciar progresso
  if (event.key.toLowerCase() === "r") {

    progress = 0;
    targetProgress = 0;

    completed = false;
    fullSince = -1;

    updateCircle();
  }
});

// =================================
// COMEÇAR
// =================================

init();
