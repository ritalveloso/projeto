let video;
let handPose;
let hands = [];

let modelReady = false;
let cameraReady = false;

// Dimensões da câmara
const CAM_W = 640;
const CAM_H = 480;

//camisola
let shirtCenterX;
let shirtCenterY;

let shoulderX;
let shoulderY;

// Manga direita
let sleeveEndX;
let sleeveEndY;
// Manga esquerda
let leftSleeveEndX;
let leftSleeveEndY;

// Manga que está a ser manipulada
// null, "left" ou "right"
let activeSleeve = null;

const INITIAL_LENGTH = 230;
const MIN_LENGTH = 180;
const MAX_LENGTH = 430;

const GRAB_RADIUS = 85;

//gesto
let isPinching = false;
let isDragging = false;

let grabOffsetX = 0;
let grabOffsetY = 0;

const PINCH_CLOSE = 0.30;
const PINCH_OPEN = 0.45;

let thumbTip = null;
let indexTip = null;

//suavização
const MOVEMENT_SMOOTHING = 0.35;

// Estado da experiência
let statusMessage = "A preparar a experiência...";

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  updateGarmentPosition();

  statusMessage = "A iniciar a câmara...";

  video = createCapture(VIDEO, () => {

    cameraReady = true;

    console.log("Câmara pronta!");

    handPose.detectStart(video, gotHands);

    modelReady = true;

    statusMessage = "Junta o polegar e o indicador para agarrar a manga.";

    console.log("Deteção de mãos iniciada!");
  });

  video.size(CAM_W, CAM_H);
  video.hide();
}

function gotHands(results) {
  hands = results || [];
}

function draw() {
  clear();
  // Atualizar a posição da camisola
  updateGarmentPosition();
  // Processar a mão detetada
  if (modelReady && cameraReady && hands.length > 0) {
    processHand();
  } else {

    thumbTip = null;
    indexTip = null;

    // Se a mão desaparecer durante o movimento,
    // a manga fica na última posição.
    if (isDragging) {

      isDragging = false;
      isPinching = false;

      statusMessage = "Manga fixada.";

    } else if (hands.length === 0 && modelReady) {

      isPinching = false;
    }
  }

  drawInterface();
  drawGarment();
  drawHandTracking();

  drawInstructions();
}

function updateGarmentPosition() {
  shirtCenterX = width / 2;
  shirtCenterY = height * 0.49;

  shoulderX = shirtCenterX + 105;
  shoulderY = shirtCenterY - 125;

  // Manga direita
  if (sleeveEndX === undefined) {
    sleeveEndX = shoulderX + INITIAL_LENGTH;
    sleeveEndY = shirtCenterY - 65;
  }

  // Manga esquerda
  if (leftSleeveEndX === undefined) {
    leftSleeveEndX = shirtCenterX - 105 - INITIAL_LENGTH;
    leftSleeveEndY = shirtCenterY - 65;
  }
}

// PROCESSAR A MÃO
function processHand() {
  const hand = hands[0];

  // Obter os pontos dos dedos
  thumbTip = getHandPoint(hand, "thumb_tip", 4);
  indexTip = getHandPoint(hand, "index_finger_tip", 8);

  const indexMCP = getHandPoint(hand, "index_finger_mcp", 5);
  const pinkyMCP = getHandPoint(hand, "pinky_mcp", 17);

  // Verificar se todos os pontos existem
  if (
    !thumbTip ||
    !indexTip ||
    !indexMCP ||
    !pinkyMCP
  ) {
    return;
  }

  // Distância entre polegar e indicador
  const fingerDistance = dist(
    thumbTip.x,
    thumbTip.y,
    indexTip.x,
    indexTip.y
  );

  // Largura da palma
  const palmWidth = dist(
    indexMCP.x,
    indexMCP.y,
    pinkyMCP.x,
    pinkyMCP.y
  );

  if (palmWidth < 1) return;

  // Normalizar a distância entre os dedos
  const pinchRatio = fingerDistance / palmWidth;

  // Ponto médio entre os dedos
  const pinchX = (thumbTip.x + indexTip.x) / 2;
  const pinchY = (thumbTip.y + indexTip.y) / 2;

  // Converter coordenadas da câmara para o ecrã
  // Inverter horizontalmente para funcionar como espelho
  const handX = map(
    pinchX,
    0,
    CAM_W,
    width,
    0
  );

  const handY = map(
    pinchY,
    0,
    CAM_H,
    0,
    height
  );

  // DETETAR GESTO DE PINÇA
  const wasPinching = isPinching;

  if (!isPinching && pinchRatio < PINCH_CLOSE) {
    isPinching = true;
  } else if (isPinching && pinchRatio > PINCH_OPEN) {
    isPinching = false;
  }

  // AGARRAR UMA DAS MANGAS
  // Só agarra quando os dedos passam de abertos a juntos
  if (isPinching && !wasPinching && !isDragging) {

    const distanceRight = dist(
      handX, handY,
      sleeveEndX, sleeveEndY
    );

    const distanceLeft = dist(
      handX, handY,
      leftSleeveEndX, leftSleeveEndY
    );

    if (
      distanceRight < GRAB_RADIUS ||
      distanceLeft < GRAB_RADIUS
    ) {

      // Escolher a manga mais próxima
      activeSleeve =
        distanceLeft < distanceRight ? "left" : "right";

      isDragging = true;

      const endX = activeSleeve === "left"
        ? leftSleeveEndX
        : sleeveEndX;

      const endY = activeSleeve === "left"
        ? leftSleeveEndY
        : sleeveEndY;

      grabOffsetX = endX - handX;
      grabOffsetY = endY - handY;

      statusMessage = "Manga agarrada! Puxa para esticar.";
    }
  }

  // ARRASTAR A MANGA SELECIONADA
  if (isDragging && isPinching && activeSleeve) {

    let targetX = handX + grabOffsetX;
    let targetY = handY + grabOffsetY;

    if (activeSleeve === "right") {

      targetX = constrain(
        targetX,
        shoulderX + MIN_LENGTH,
        shoulderX + MAX_LENGTH
      );

      targetY = constrain(
        targetY,
        shoulderY - 20,
        shoulderY + 220
      );

      sleeveEndX = lerp(
        sleeveEndX,
        targetX,
        MOVEMENT_SMOOTHING
      );

      sleeveEndY = lerp(
        sleeveEndY,
        targetY,
        MOVEMENT_SMOOTHING
      );

    } else {

      const leftShoulderX = shirtCenterX - 105;

      targetX = constrain(
        targetX,
        leftShoulderX - MAX_LENGTH,
        leftShoulderX - MIN_LENGTH
      );

      targetY = constrain(
        targetY,
        shoulderY - 20,
        shoulderY + 220
      );

      leftSleeveEndX = lerp(
        leftSleeveEndX,
        targetX,
        MOVEMENT_SMOOTHING
      );

      leftSleeveEndY = lerp(
        leftSleeveEndY,
        targetY,
        MOVEMENT_SMOOTHING
      );
    }

    statusMessage = "Puxa a manga para a posição desejada.";
  }

  // LARGAR A MANGA
  if (!isPinching && isDragging) {

    isDragging = false;
    activeSleeve = null;

    statusMessage = "Manga fixada! Podes continuar a criar.";
  }
}

// OBTER PONTOS DA MÃO
function getHandPoint(hand, pointName, fallbackIndex) {
  // Formato atual do ml5.js
  if (hand[pointName]) {
    return hand[pointName];
  }

  // Procurar nos keypoints
  if (hand.keypoints) {

    const namedPoint = hand.keypoints.find(
      point => point.name === pointName
    );

    if (namedPoint) {
      return namedPoint;
    }

    // Utilizar índice como alternativa
    if (hand.keypoints[fallbackIndex]) {
      return hand.keypoints[fallbackIndex];
    }
  }

  // Formato alternativo
  if (hand.landmarks && hand.landmarks[fallbackIndex]) {

    const point = hand.landmarks[fallbackIndex];

    return {
      x: point[0],
      y: point[1]
    };
  }

  return null;
}

// DESENHAR A CAMISOLA
function drawGarment() {
  push();
  translate(shirtCenterX, shirtCenterY);
  //stroke(75, 35, 100);
  strokeWeight(2.5);
  fill(255);

  // CORPO DA CAMISOLA
  beginShape();
  vertex(-105, -145);
  vertex(-65, -125);
  vertex(-40, -95);
  vertex(40, -95);
  vertex(65, -125);
  vertex(105, -145);
  vertex(140, -35);
  vertex(140, 185);
  vertex(-140, 185);
  vertex(-140, -35);
  endShape(CLOSE);

  // MANGA ESQUERDA DINÂMICA
  const localLeftX = leftSleeveEndX - shirtCenterX;
  const localLeftY = leftSleeveEndY - shirtCenterY;

  beginShape();
  vertex(-105, -145);
  vertex(-185, -110);
  // Extremidade superior
  vertex(localLeftX, localLeftY - 25);
  // Extremidade inferior
  vertex(localLeftX, localLeftY + 25);
  // Parte inferior da manga
  vertex(localLeftX + 65, localLeftY + 20);
  vertex(-110, -100);
  endShape(CLOSE);

  // MANGA DIREITA DINÂMICA
  const localEndX = sleeveEndX - shirtCenterX;
  const localEndY = sleeveEndY - shirtCenterY;

  beginShape();

  // Ligação ao ombro
  vertex(105, -145);
  vertex(185, -110);

  // Extremidade superior
  vertex(localEndX, localEndY - 25);

  // Extremidade inferior
  vertex(localEndX, localEndY + 25);

  // Parte inferior da manga
  vertex(localEndX - 65, localEndY + 20);
  vertex(110, -100);
  endShape(CLOSE);
  //costura da manga direita
  //stroke(190, 170, 200);
  strokeWeight(1.5);
  line(150, -105, localEndX - 30, localEndY);

  // Costura da manga esquerda
  line(-150, -105, localLeftX + 30, localLeftY);
  pop();

  // INDICADORES DAS EXTREMIDADES
  noFill();
  stroke(135, 70, 170, 130);
  strokeWeight(2);

  // Manga direita
  if (activeSleeve !== "right") {
    circle(sleeveEndX, sleeveEndY, 22);
  }

  // Manga esquerda
  if (activeSleeve !== "left") {
    circle(leftSleeveEndX, leftSleeveEndY, 22);
  }
}

function drawInterface() {
  noStroke();
  textFont("Satoshi");
  textAlign(CENTER, CENTER);

  fill("#A711E2");

  textStyle(BOLD);
  textSize(24);

  text("A tua criação", width / 2, 55);

  fill("#F3E8F7");

  textStyle(NORMAL);
  textSize(16);

  text("Molda a tua peça através dos gestos da mão", width / 2, 88);
}

function drawInstructions() {
  noStroke();

  textFont("Satoshi");
  textAlign(CENTER, CENTER);

  fill("#2E043F");

  textStyle(NORMAL);
  textSize(18);

  text(statusMessage, width / 2, height - 55);
}

function drawHandTracking() {
  if (!thumbTip || !indexTip) return;
  // Polegar
  const thumbX = map(thumbTip.x, 0, CAM_W, width, 0);
  const thumbY = map(thumbTip.y, 0, CAM_H, 0, height);

  // Indicador
  const indexX = map(indexTip.x, 0, CAM_W, width, 0);
  const indexY = map(indexTip.y, 0, CAM_H, 0, height);

  // Linha entre os dedos
  stroke(isPinching ? "#A711E2" : "#888888");
  strokeWeight(3);

  line(thumbX, thumbY, indexX, indexY);

  // Polegar
  noStroke();

  fill("#E64B75");
  circle(thumbX, thumbY, 15);

  // Indicador
  fill("#421CEB");
  circle(indexX, indexY, 15);

  // Indicador central da pinça
  if (isPinching) {

    fill("#A711E2");

    circle((thumbX + indexX) / 2, (thumbY + indexY) / 2, 12);
  }
}

function windowResized() {
  const oldCenterX = shirtCenterX;
  const oldCenterY = shirtCenterY;

  const rightOffsetX = sleeveEndX - oldCenterX;
  const rightOffsetY = sleeveEndY - oldCenterY;

  const leftOffsetX = leftSleeveEndX - oldCenterX;
  const leftOffsetY = leftSleeveEndY - oldCenterY;

  resizeCanvas(windowWidth, windowHeight);

  updateGarmentPosition();

  sleeveEndX = shirtCenterX + rightOffsetX;
  sleeveEndY = shirtCenterY + rightOffsetY;

  leftSleeveEndX = shirtCenterX + leftOffsetX;
  leftSleeveEndY = shirtCenterY + leftOffsetY;
}

function keyPressed() {
  if (key === "r" || key === "R") {
    // Manga direita
    sleeveEndX = shoulderX + INITIAL_LENGTH;
    sleeveEndY = shirtCenterY - 65;
    // Manga esquerda
    leftSleeveEndX = shirtCenterX - 105 - INITIAL_LENGTH;
    leftSleeveEndY = shirtCenterY - 65;

    isDragging = false;
    isPinching = false;
    activeSleeve = null;

    statusMessage = "Mangas reiniciadas.";
  }
}